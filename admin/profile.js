// profile.js
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

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ==========================================
    // State Management
    // ==========================================
    const state = {
        adminId: null, // Will fetch from localStorage or fallback
        adminData: null,
    };

    // ==========================================
    // DOM Elements Cache
    // ==========================================
    const els = {
        currentDateDisplay: document.getElementById('currentDateDisplay'),
        sidebarLogoutBtn: document.getElementById('sidebarLogoutBtn'),

        // Profile Card
        profileAvatarDisplay: document.getElementById('profileAvatarDisplay'),
        profileStatusDot: document.getElementById('profileStatusDot'),
        profileName: document.getElementById('profileName'),
        profileRole: document.getElementById('profileRole'),
        
        // Info List
        infoId: document.getElementById('infoId'),
        infoEmail: document.getElementById('infoEmail'),
        infoPhone: document.getElementById('infoPhone'),
        infoRoleBadge: document.getElementById('infoRoleBadge'),
        infoStatusBadge: document.getElementById('infoStatusBadge'),
        infoCreated: document.getElementById('infoCreated'),
        infoLastLogin: document.getElementById('infoLastLogin'),

        // Stats
        statProducts: document.getElementById('statProducts'),
        statOrders: document.getElementById('statOrders'),
        statRevenue: document.getElementById('statRevenue'),
        statWallet: document.getElementById('statWallet'),
        statUsers: document.getElementById('statUsers'),

        // Activity
        activityTimeline: document.getElementById('activityTimeline'),
        emptyActivityState: document.getElementById('emptyActivityState'),
        refreshActivityBtn: document.getElementById('refreshActivityBtn'),

        // Buttons
        openEditProfileBtn: document.getElementById('openEditProfileBtn'),
        openChangePasswordBtn: document.getElementById('openChangePasswordBtn'),

        // Modals
        editProfileModal: document.getElementById('editProfileModal'),
        changePasswordModal: document.getElementById('changePasswordModal'),
        logoutModal: document.getElementById('logoutModal'),

        // Edit Form
        editProfileForm: document.getElementById('editProfileForm'),
        editPhotoPreview: document.getElementById('editPhotoPreview'),
        editProfileImage: document.getElementById('editProfileImage'),
        editName: document.getElementById('editName'),
        editEmail: document.getElementById('editEmail'),
        editPhone: document.getElementById('editPhone'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),

        // Password Form
        changePasswordForm: document.getElementById('changePasswordForm'),
        currentPassword: document.getElementById('currentPassword'),
        newPassword: document.getElementById('newPassword'),
        confirmPassword: document.getElementById('confirmPassword'),
        updatePasswordBtn: document.getElementById('updatePasswordBtn'),

        // Logout
        confirmLogoutBtn: document.getElementById('confirmLogoutBtn')
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

    const formatCurrency = (amount) => {
        const num = parseFloat(amount);
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isNaN(num) ? 0 : num);
    };

    const formatDate = (dateString, includeTime = false) => {
        if (!dateString) return '-';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const getAvatarHTML = (name, imgUrl) => {
        if (imgUrl && imgUrl.trim() !== '') {
            return `<img src="${imgUrl}" alt="Avatar" onerror="this.outerHTML='<div class=\\'avatar-initials\\'>${(name||'A').charAt(0).toUpperCase()}</div>'">`;
        }
        return `<div class="avatar-initials">${(name || 'A').charAt(0).toUpperCase()}</div>`;
    };

    const removeSkeletons = (selector) => {
        document.querySelectorAll(selector).forEach(el => el.classList.remove('skeleton-text', 'skeleton-avatar'));
    };

    // ==========================================
    // Initialization
    // ==========================================
    async function init() {
        if (els.currentDateDisplay) {
            els.currentDateDisplay.innerHTML = `<i class='bx bx-calendar'></i> ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
        }
        attachEventListeners();
        await setupSession();
    }

    async function setupSession() {
        // Try getting admin ID from local storage (simulate login session)
        let savedId = localStorage.getItem('adminId');
        
        if (!savedId) {
            // Fallback: Get the first active admin from DB for demonstration / out-of-box working
            try {
                const { data, error } = await supabaseClient.from('admins').select('id').eq('is_active', true).limit(1).single();
                if (error) throw error;
                if (data) {
                    savedId = data.id;
                    localStorage.setItem('adminId', savedId);
                }
            } catch (err) {
                console.warn("No active admin found. Please ensure 'admins' table has data.", err);
                notify("No active admin profile found in database.", "error");
                return;
            }
        }

        state.adminId = savedId;
        
        // Fetch all components concurrently for performance
        if (state.adminId) {
            await Promise.all([
                fetchAdminProfile(),
                fetchDashboardStats(),
                fetchRecentActivity()
            ]);
        }
    }

    // ==========================================
    // Data Fetching
    // ==========================================
    async function fetchAdminProfile() {
        try {
            const { data, error } = await supabaseClient.from('admins').select('*').eq('id', state.adminId).single();
            if (error) throw error;
            
            state.adminData = data;
            renderProfile();

        } catch (error) {
            console.error("Profile Fetch Error:", error);
            notify("Failed to load profile data.", "error");
        }
    }

    async function fetchDashboardStats() {
        try {
            const [
                { count: productsCount },
                { count: ordersCount },
                { data: ordersData }, // for revenue
                { count: usersCount },
                { count: walletApprovals }
            ] = await Promise.all([
                supabaseClient.from('products').select('*', { count: 'exact', head: true }),
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }),
                supabaseClient.from('orders').select('total_amount').neq('order_status', 'Cancelled'),
                supabaseClient.from('users').select('*', { count: 'exact', head: true }),
                supabaseClient.from('wallet_requests').select('*', { count: 'exact', head: true }).eq('status', 'Approved')
            ]);

            let revenue = 0;
            if (ordersData) {
                ordersData.forEach(o => { revenue += parseFloat(o.total_amount || 0); });
            }

            if (els.statProducts) els.statProducts.textContent = productsCount || 0;
            if (els.statOrders) els.statOrders.textContent = ordersCount || 0;
            if (els.statRevenue) els.statRevenue.textContent = formatCurrency(revenue);
            if (els.statUsers) els.statUsers.textContent = usersCount || 0;
            if (els.statWallet) els.statWallet.textContent = walletApprovals || 0;

            removeSkeletons('.stat-details p');

        } catch (error) {
            console.error("Stats Fetch Error:", error);
        }
    }

    async function fetchRecentActivity() {
        // Constructing a timeline using real data queries to avoid fake data
        if (!els.activityTimeline) return;
        
        try {
            const activities = [];
            
            // 1. Admin Login/Creation Activity (from admins table)
            if (state.adminData) {
                if (state.adminData.last_login) {
                    activities.push({
                        type: 'login',
                        title: 'Admin Session Started',
                        desc: 'Successful login recorded.',
                        time: state.adminData.last_login,
                        icon: 'bx-log-in-circle',
                        color: 'info'
                    });
                }
            }

            // 2. Latest Order
            const { data: latestOrder } = await supabaseClient.from('orders').select('id, created_at, total_amount').order('created_at', { ascending: false }).limit(1).single();
            if (latestOrder) {
                activities.push({
                    type: 'order',
                    title: 'New Order Received',
                    desc: `Order #${latestOrder.id} placed for ${formatCurrency(latestOrder.total_amount)}.`,
                    time: latestOrder.created_at,
                    icon: 'bx-shopping-bag',
                    color: 'success'
                });
            }

            // 3. Latest Product
            const { data: latestProduct } = await supabaseClient.from('products').select('name, created_at').order('created_at', { ascending: false }).limit(1).single();
            if (latestProduct) {
                activities.push({
                    type: 'product',
                    title: 'Product Catalog Updated',
                    desc: `New product "${latestProduct.name}" added.`,
                    time: latestProduct.created_at,
                    icon: 'bx-box',
                    color: 'purple'
                });
            }

            // Sort newest first
            activities.sort((a, b) => new Date(b.time) - new Date(a.time));

            renderTimeline(activities);

        } catch (error) {
            console.error("Activity Fetch Error:", error);
            if (els.activityTimeline) els.activityTimeline.innerHTML = '';
            if (els.emptyActivityState) els.emptyActivityState.style.display = 'block';
        }
    }

    // ==========================================
    // Rendering
    // ==========================================
    function renderProfile() {
        const d = state.adminData;
        if (!d) return;

        // Hero Section
        if (els.profileAvatarDisplay) {
            els.profileAvatarDisplay.innerHTML = getAvatarHTML(d.name, d.profile_image);
            els.profileAvatarDisplay.classList.remove('skeleton-avatar');
        }
        if (els.profileStatusDot) {
            els.profileStatusDot.className = d.is_active ? 'status-indicator' : 'status-indicator offline';
        }
        if (els.profileName) {
            els.profileName.textContent = d.name || 'Admin Name';
            els.profileName.classList.remove('skeleton-text');
        }
        if (els.profileRole) {
            els.profileRole.textContent = d.role || 'Administrator';
            els.profileRole.classList.remove('skeleton-text');
        }

        // Info List
        if (els.infoId) els.infoId.textContent = d.id;
        if (els.infoEmail) els.infoEmail.textContent = d.email || '-';
        if (els.infoPhone) els.infoPhone.textContent = d.phone || '-';
        
        if (els.infoRoleBadge) els.infoRoleBadge.textContent = d.role || 'Admin';
        
        if (els.infoStatusBadge) {
            els.infoStatusBadge.innerHTML = d.is_active 
                ? `<span class="badge badge-active"><i class='bx bx-check-circle'></i> Active</span>`
                : `<span class="badge badge-inactive"><i class='bx bx-x-circle'></i> Inactive</span>`;
        }

        if (els.infoCreated) els.infoCreated.textContent = formatDate(d.created_at);
        if (els.infoLastLogin) els.infoLastLogin.textContent = formatDate(d.last_login, true);

        removeSkeletons('.info-value');
    }

    function renderTimeline(activities) {
        if (!els.activityTimeline) return;
        els.activityTimeline.innerHTML = '';

        if (!activities || activities.length === 0) {
            if (els.emptyActivityState) els.emptyActivityState.style.display = 'block';
            return;
        }

        if (els.emptyActivityState) els.emptyActivityState.style.display = 'none';

        activities.forEach(act => {
            const div = document.createElement('div');
            div.className = 'timeline-item';
            div.innerHTML = `
                <div class="timeline-icon ${act.color}"><i class='bx ${act.icon}'></i></div>
                <div class="timeline-content">
                    <div class="timeline-title">${act.title}</div>
                    <div class="timeline-desc">${act.desc}</div>
                    <span class="timeline-time">${formatDate(act.time, true)}</span>
                </div>
            `;
            els.activityTimeline.appendChild(div);
        });
    }

    // ==========================================
    // Event Listeners
    // ==========================================
    function attachEventListeners() {
        // Modal Triggers
        if (els.openEditProfileBtn) els.openEditProfileBtn.addEventListener('click', openEditModal);
        if (els.openChangePasswordBtn) els.openChangePasswordBtn.addEventListener('click', () => {
            if (els.changePasswordForm) els.changePasswordForm.reset();
            if (els.changePasswordModal) els.changePasswordModal.classList.add('active');
        });
        
        if (els.sidebarLogoutBtn) els.sidebarLogoutBtn.addEventListener('click', () => {
            if (els.logoutModal) els.logoutModal.classList.add('active');
        });

        // Close Modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });

        // Forms & Actions
        if (els.saveProfileBtn) els.saveProfileBtn.addEventListener('click', saveProfile);
        if (els.updatePasswordBtn) els.updatePasswordBtn.addEventListener('click', changePassword);
        if (els.confirmLogoutBtn) els.confirmLogoutBtn.addEventListener('click', executeLogout);
        
        if (els.refreshActivityBtn) els.refreshActivityBtn.addEventListener('click', () => {
            if (els.activityTimeline) els.activityTimeline.innerHTML = `<div class="skeleton-block" style="height:40px; margin-bottom:16px;"></div>`;
            fetchRecentActivity();
            notify("Activity refreshed", "success");
        });

        // Image Preview Handler
        if (els.editProfileImage) {
            els.editProfileImage.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                if (els.editPhotoPreview) {
                    if (val) {
                        els.editPhotoPreview.innerHTML = `<img src="${val}" onerror="this.outerHTML='<i class=\\'bx bx-user\\'></i>'">`;
                    } else {
                        els.editPhotoPreview.innerHTML = `<i class='bx bx-user'></i>`;
                    }
                }
            });
        }
    }

    // ==========================================
    // Form Submissions
    // ==========================================
    function openEditModal() {
        if (!state.adminData || !els.editProfileModal) return;
        const d = state.adminData;

        if (els.editName) els.editName.value = d.name || '';
        if (els.editEmail) els.editEmail.value = d.email || '';
        if (els.editPhone) els.editPhone.value = d.phone || '';
        if (els.editProfileImage) els.editProfileImage.value = d.profile_image || '';
        
        if (els.editPhotoPreview) {
            if (d.profile_image) {
                els.editPhotoPreview.innerHTML = `<img src="${d.profile_image}" onerror="this.outerHTML='<i class=\\'bx bx-user\\'></i>'">`;
            } else {
                els.editPhotoPreview.innerHTML = `<i class='bx bx-user'></i>`;
            }
        }

        els.editProfileModal.classList.add('active');
    }

    async function saveProfile(e) {
        e.preventDefault();
        
        if (els.editProfileForm && !els.editProfileForm.checkValidity()) {
            els.editProfileForm.reportValidity();
            return;
        }

        if (!state.adminId) return;

        const payload = {
            name: els.editName.value.trim(),
            email: els.editEmail.value.trim(),
            phone: els.editPhone.value.trim(),
            profile_image: els.editProfileImage.value.trim()
        };

        try {
            if (els.saveProfileBtn) {
                els.saveProfileBtn.disabled = true;
                els.saveProfileBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving...";
            }

            const { error } = await supabaseClient.from('admins').update(payload).eq('id', state.adminId);
            if (error) throw error;

            notify("Profile updated successfully.", "success");
            if (els.editProfileModal) els.editProfileModal.classList.remove('active');
            
            await fetchAdminProfile();

        } catch (error) {
            console.error("Profile Update Error:", error);
            notify(`Error: ${error.message}`, "error");
        } finally {
            if (els.saveProfileBtn) {
                els.saveProfileBtn.disabled = false;
                els.saveProfileBtn.innerHTML = "Save Changes";
            }
        }
    }

    async function changePassword(e) {
        e.preventDefault();
        
        if (els.changePasswordForm && !els.changePasswordForm.checkValidity()) {
            els.changePasswordForm.reportValidity();
            return;
        }

        const currentInput = els.currentPassword.value;
        const newPass = els.newPassword.value;
        const confirmPass = els.confirmPassword.value;

        if (newPass !== confirmPass) {
            notify("New passwords do not match.", "warning");
            return;
        }

        if (newPass.length < 6) {
            notify("Password must be at least 6 characters.", "warning");
            return;
        }

// Validate current password (simple text compare since schema uses raw password column)
        if (state.adminData.password && state.adminData.password !== currentInput) {
            notify("Current password is incorrect.", "error");
            return;
        }

        try {
            if (els.updatePasswordBtn) {
                els.updatePasswordBtn.disabled = true;
                els.updatePasswordBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Updating...";
            }

            const { error } = await supabaseClient.from('admins').update({ password: newPass }).eq('id', state.adminId);
            if (error) throw error;

            notify("Password updated successfully.", "success");
            
            // Update local state
            state.adminData.password = newPass;

            if (els.changePasswordModal) els.changePasswordModal.classList.remove('active');
            if (els.changePasswordForm) els.changePasswordForm.reset();

        } catch (error) {
            console.error("Password Update Error:", error);
            notify(`Error: ${error.message}`, "error");
        } finally {
            if (els.updatePasswordBtn) {
                els.updatePasswordBtn.disabled = false;
                els.updatePasswordBtn.innerHTML = "Update Password";
            }
        }
    }

    function executeLogout() {
        if (els.confirmLogoutBtn) {
            els.confirmLogoutBtn.disabled = true;
            els.confirmLogoutBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Logging out...";
        }
        
        // Clear session
        localStorage.removeItem('adminId');
        
        // Brief delay for animation then redirect
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 800);
    }

    // Init App
    document.addEventListener('DOMContentLoaded', init);

})();