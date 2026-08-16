// login.js
(function () {
    'use strict';

    // ==========================================
    // Supabase Configuration
    // ==========================================
    const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
    const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";

    if (!window.supabase) {
        console.error("Supabase script not loaded.");
        return;
    }

    // Only ONE Supabase client instance
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ==========================================
    // State Management
    // ==========================================
    const state = {
        verifiedAdmin: null // Temporarily holds admin data between steps
    };

    // ==========================================
    // DOM Elements Cache
    // ==========================================
    const els = {
        // Step 1: Login Form
        loginForm: document.getElementById('loginForm'),
        adminEmail: document.getElementById('adminEmail'),
        adminPassword: document.getElementById('adminPassword'),
        verifyBtn: document.getElementById('verifyBtn'),
        
        // Step 3: Secret Code Modal
        secretCodeModal: document.getElementById('secretCodeModal'),
        secretCodeForm: document.getElementById('secretCodeForm'),
        secretCodeInput: document.getElementById('secretCodeInput'),
        cancelScBtn: document.getElementById('cancelScBtn'),
        confirmScBtn: document.getElementById('confirmScBtn')
    };

    // ==========================================
    // Utility Functions
    // ==========================================
    const notify = (msg, type) => {
        if (typeof window.showPopup === 'function') {
            window.showPopup(msg, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
        }
    };

    const clearSession = () => {
        localStorage.removeItem('admin_id');
        localStorage.removeItem('admin_name');
        localStorage.removeItem('admin_email');
        localStorage.removeItem('admin_role');
        localStorage.removeItem('admin_login');
        state.verifiedAdmin = null;
    };

    // ==========================================
    // Initialization
    // ==========================================
    function init() {
        // Clear any existing session on page load to prevent auto-bypassing
        clearSession();
        attachEventListeners();
    }

    // ==========================================
    // Event Listeners
    // ==========================================
    function attachEventListeners() {
        if (els.loginForm) {
            els.loginForm.addEventListener('submit', handleStepOneAuth);
        }
        
        if (els.secretCodeForm) {
            els.secretCodeForm.addEventListener('submit', handleStepFourVerification);
        }

        if (els.cancelScBtn) {
            els.cancelScBtn.addEventListener('click', cancelLoginProcess);
        }
    }

    // ==========================================
    // Authentication Flow
    // ==========================================
    
    /**
     * STEP 1 & 2: Email and Password Verification
     */
    async function handleStepOneAuth(e) {
        e.preventDefault();
        
        const email = els.adminEmail.value.trim();
        const password = els.adminPassword.value;

        if (!email || !password) {
            notify("Email and Password are required.", "warning");
            return;
        }

        try {
            // UI Loading state
            els.verifyBtn.disabled = true;
            els.verifyBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Verifying...";

            // Fetch admin record
            const { data: admin, error } = await supabaseClient
                .from('admins')
                .select('id, name, email, role, password, is_active')
                .eq('email', email)
                .single();

            // Verify existence and password match
            if (error || !admin || admin.password !== password) {
                notify("Invalid Email or Password.", "error");
                resetVerifyBtn();
                return;
            }

            // Check if active
            if (admin.is_active !== true && String(admin.is_active) !== 'true') {
                notify("Account is disabled. Contact system administrator.", "error");
                resetVerifyBtn();
                return;
            }

            // Step 2 Passed -> Proceed to Step 3
            state.verifiedAdmin = admin; // Store temporarily
            els.secretCodeInput.value = ''; // Clear previous input
            els.secretCodeModal.classList.add('active');
            
            // Auto focus on SC input
            setTimeout(() => { els.secretCodeInput.focus(); }, 100);

        } catch (error) {
            console.error("Auth Error:", error);
            notify("Authentication failed. Please try again.", "error");
            resetVerifyBtn();
        }
    }

    function resetVerifyBtn() {
        if (els.verifyBtn) {
            els.verifyBtn.disabled = false;
            els.verifyBtn.innerHTML = "Verify Identity <i class='bx bx-right-arrow-alt'></i>";
        }
    }

    /**
     * STEP 4 & 5: Secret Code Verification and Session Creation
     */
    async function handleStepFourVerification(e) {
        e.preventDefault();

        if (!state.verifiedAdmin) {
            notify("Session expired. Please restart login.", "error");
            cancelLoginProcess();
            return;
        }

        const inputCode = els.secretCodeInput.value.trim();
        
        if (!inputCode) {
            notify("Please enter the secret code.", "warning");
            return;
        }

        try {
            // UI Loading state
            els.confirmScBtn.disabled = true;
            els.confirmScBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Verifying...";

            // Fetch SC directly from Supabase (strict requirement)
            const { data, error } = await supabaseClient
                .from('admins')
                .select('sc')
                .eq('id', state.verifiedAdmin.id)
                .single();

            if (error || !data) {
                throw new Error("Unable to fetch security credentials.");
            }

            // Compare Secret Code (Strict String Comparison)
            if (String(data.sc).trim() !== String(inputCode).trim()) {
                notify("Invalid Secret Code.", "error");
                els.secretCodeInput.value = '';
                els.secretCodeInput.focus();
                
                els.confirmScBtn.disabled = false;
                els.confirmScBtn.innerHTML = "Verify Code";
                return;
            }

            // Step 5: Success! Establish Session
            localStorage.setItem('admin_id', state.verifiedAdmin.id);
            localStorage.setItem('admin_name', state.verifiedAdmin.name || 'Admin');
            localStorage.setItem('admin_email', state.verifiedAdmin.email);
            localStorage.setItem('admin_role', state.verifiedAdmin.role || 'admin');
            localStorage.setItem('admin_login', 'true');

            // Update last_login asynchronously (no await so it doesn't block redirect)
            supabaseClient
                .from('admins')
                .update({ last_login: new Date().toISOString() })
                .eq('id', state.verifiedAdmin.id)
                .then(() => console.log("Login time updated"))
                .catch((err) => console.error("Last login update error:", err));

            // Show Success Notification
            notify("Authentication successful. Redirecting...", "success");
            
            // Button Success State
            els.confirmScBtn.innerHTML = "<i class='bx bx-check'></i> Verified";
            els.confirmScBtn.classList.remove('btn-primary');
            els.confirmScBtn.classList.add('btn-success');
            
            // Fast Redirect to Dashboard using replace (prevents back-button to login)
            setTimeout(() => {
                window.location.replace('dashboard.html');
            }, 10);

        } catch (error) {
            console.error("SC Verification Error:", error);
            notify("Verification failed. Please try again.", "error");
            
            if (els.confirmScBtn) {
                els.confirmScBtn.disabled = false;
                els.confirmScBtn.innerHTML = "Verify Code";
            }
        }
    }

    function cancelLoginProcess() {
        state.verifiedAdmin = null;
        if (els.secretCodeModal) {
            els.secretCodeModal.classList.remove('active');
        }
        if (els.secretCodeInput) {
            els.secretCodeInput.value = '';
        }
        resetVerifyBtn();
    }

    // Init App
    document.addEventListener('DOMContentLoaded', init);

})();
