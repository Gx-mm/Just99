/* ==========================================================================
   Supabase Configuration & Authentication Logic
   ========================================================================== */
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function toast(msg, type = "success") {
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.getElementById("toastContainer").appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function setLoading(btn, state) {
    btn.disabled = state;
    btn.classList.toggle("loading", state);
}

// DOM Elements
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPhone = document.getElementById("signupPhone");
const signupPassword = document.getElementById("signupPassword");
const signupConfirmPassword = document.getElementById("signupConfirmPassword");

// Handle Tabs Switching
if (loginTab && signupTab && loginForm && signupForm) {
    loginTab.onclick = () => {
        loginTab.classList.add("active");
        signupTab.classList.remove("active");
        loginForm.classList.add("active-form");
        signupForm.classList.remove("active-form");
    };

    signupTab.onclick = () => {
        signupTab.classList.add("active");
        loginTab.classList.remove("active");
        signupForm.classList.add("active-form");
        loginForm.classList.remove("active-form");
    };
}

// Login Logic
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("loginBtn");
        setLoading(btn, true);

        try {
            const email = loginEmail.value.trim();
            const password = loginPassword.value;

            const { data, error } = await client.from("users").select("*").eq("email", email).eq("password", password).single();

            if (error || !data) {
                toast("Invalid Email or Password", "error");
                return;
            }

            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("userId", data.id || "");
            localStorage.setItem("userName", data.name || "");
            localStorage.setItem("userEmail", data.email || "");
            localStorage.setItem("userPhone", data.phone || "");

            toast("Login Successful", "success");
            setTimeout(() => {
                window.location.href = "home.html";
            }, 1000);
        } catch (err) {
            toast(err.message || "Login failed", "error");
        } finally {
            setLoading(btn, false);
        }
    });
}

// Signup Logic
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("signupBtn");
        setLoading(btn, true);

        try {
            const name = signupName.value.trim();
            const email = signupEmail.value.trim();
            const phone = signupPhone.value.trim();
            const password = signupPassword.value;
            const confirm = signupConfirmPassword.value;

            if (password !== confirm) {
                toast("Passwords do not match", "error");
                return;
            }

            const emailCheck = await client.from("users").select("id").eq("email", email);
            if (emailCheck.data && emailCheck.data.length) {
                toast("Email already exists", "error");
                return;
            }

            const phoneCheck = await client.from("users").select("id").eq("phone", phone);
            if (phoneCheck.data && phoneCheck.data.length) {
                toast("Phone already exists", "error");
                return;
            }

            const { data, error } = await client.from("users").insert([{
                name, email, phone, password, profile_image: "", role: "user", is_active: true
            }]).select().single();

            if (error) {
                toast(error.message, "error");
                return;
            }

            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("userId", data?.id || "");
            localStorage.setItem("userName", name);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userPhone", phone);

            toast("Account Created Successfully", "success");
            setTimeout(() => {
                window.location.href = "home.html";
            }, 1000);
        } catch (err) {
            toast(err.message || "Signup failed", "error");
        } finally {
            setLoading(btn, false);
        }
    });
}

// Auto Login Check (Modified for safe redirect)
document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("userId");
    const isLoggedIn = localStorage.getItem("isLoggedIn");

    // Agar user logged in hai tabhi usko home par bhejo
    if (userId && isLoggedIn === "true") {
        window.location.replace("home.html");
    }
});

/* ==========================================================================
   Premium UI Interactions
   ========================================================================== */

// Handle multiple Password Show/Hide Toggles (For both Login and Signup forms)
document.querySelectorAll('.togglePasswordBtn').forEach(btn => {
    btn.addEventListener('click', function() {
        const inputWrapper = this.closest('.input-wrapper');
        const passwordInput = inputWrapper.querySelector('input');
        const eyeIcon = this.querySelector('.eyeIcon');
        
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
        } else {
            passwordInput.type = 'password';
            eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`;
        }
    });
});

// Button Ripple Effect
document.querySelectorAll('.submit-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
        if(this.disabled) return;
        
        let x = e.clientX - e.target.getBoundingClientRect().left;
        let y = e.clientY - e.target.getBoundingClientRect().top;
        
        let ripples = document.createElement('span');
        ripples.style.left = x + 'px';
        ripples.style.top = y + 'px';
        ripples.classList.add('ripple');
        
        this.appendChild(ripples);
        setTimeout(() => ripples.remove(), 800);
    });
});
