// users.js
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
        users: [],
        totalCount: 0,
        page: 1,
        perPage: 10,
        selectedIds: new Set(),
        debounceTimer: null,
        actionContext: null, // Stores info for modals: { type: 'delete', id: '123' }
        filters: {
            search: '',
            status: '',
            role: ''
        },
        sort: 'newest'
    };

    // ==========================================
    // DOM Elements Cache
    // ==========================================
    const els = {
        currentDateDisplay: document.getElementById('currentDateDisplay'),
        globalSearch: document.getElementById('globalSearch'),
        refreshBtn: document.getElementById('refreshBtn'),
        exportBtn: document.getElementById('exportBtn'),

        // Stats
        statTotal: document.getElementById('statTotal'),
        statActive: document.getElementById('statActive'),
        statBlocked: document.getElementById('statBlocked'),
        statToday: document.getElementById('statToday'),
        statWalletBalance: document.getElementById('statWalletBalance'),

        // Filters
        filterStatus: document.getElementById('filterStatus'),
        filterRole: document.getElementById('filterRole'),
        sortSelect: document.getElementById('sortSelect'),
        perPageSelect: document.getElementById('perPageSelect'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),

        // Bulk Actions
        bulkActions: document.getElementById('bulkActions'),
        selectedCount: document.getElementById('selectedCount'),
        bulkUnblockBtn: document.getElementById('bulkUnblockBtn'),
        bulkBlockBtn: document.getElementById('bulkBlockBtn'),
        bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),

        // Table
        tableBody: document.getElementById('tableBody'),
        emptyState: document.getElementById('emptyState'),
        selectAllCheckbox: document.getElementById('selectAllCheckbox'),

        // Pagination
        pageStart: document.getElementById('pageStart'),
        pageEnd: document.getElementById('pageEnd'),
        totalItemsDisplay: document.getElementById('totalItemsDisplay'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        pageNumbers: document.getElementById('pageNumbers'),

        // Modals
        viewModal: document.getElementById('viewModal'),
        editModal: document.getElementById('editModal'),
        confirmModal: document.getElementById('confirmModal'),
        openEditFromViewBtn: document.getElementById('openEditFromViewBtn'),

        // View Modal Fields
        viewAvatarContainer: document.getElementById('viewAvatarContainer'),
        viewName: document.getElementById('viewName'),
        viewRole: document.getElementById('viewRole'),
        viewStatusBadge: document.getElementById('viewStatusBadge'),
        viewId: document.getElementById('viewId'),
        viewDate: document.getElementById('viewDate'),
        viewEmail: document.getElementById('viewEmail'),
        viewPhone: document.getElementById('viewPhone'),
        viewBalance: document.getElementById('viewBalance'),

        // Edit Modal Fields
        editUserForm: document.getElementById('editUserForm'),
        editUserId: document.getElementById('editUserId'),
        editName: document.getElementById('editName'),
        editEmail: document.getElementById('editEmail'),
        editPhone: document.getElementById('editPhone'),
        editProfileImage: document.getElementById('editProfileImage'),
        editRole: document.getElementById('editRole'),
        editStatus: document.getElementById('editStatus'),
        editCurrentBalance: document.getElementById('editCurrentBalance'),
        walletActionType: document.getElementById('walletActionType'),
        walletModifyAmount: document.getElementById('walletModifyAmount'),
        saveUserBtn: document.getElementById('saveUserBtn'),

        // Confirm Modal Fields
        confirmIcon: document.getElementById('confirmIcon'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmText: document.getElementById('confirmText'),
        executeConfirmBtn: document.getElementById('executeConfirmBtn')
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

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    const getAvatarHTML = (name, imgUrl) => {
        if (imgUrl && imgUrl.trim() !== '') {
            return `<img src="${imgUrl}" alt="Avatar" class="avatar-img" onerror="this.outerHTML='<div class=\\'avatar-circle\\'>${(name||'U').charAt(0).toUpperCase()}</div>'">`;
        }
        return `<div class="avatar-circle">${(name || 'U').charAt(0).toUpperCase()}</div>`;
    };

    const getStatusHTML = (isActive) => {
        if (isActive === true || String(isActive) === 'true') {
            return `<span class="badge active-badge"><i class='bx bx-check-circle'></i> Active</span>`;
        }
        return `<span class="badge blocked-badge"><i class='bx bx-block'></i> Blocked</span>`;
    };

    const getRoleHTML = (role) => {
        const r = (role || 'user').toLowerCase();
        if (r === 'admin') return `<span class="badge admin-badge"><i class='bx bx-shield-quarter'></i> Admin</span>`;
        return `<span class="badge user-badge"><i class='bx bx-user'></i> User</span>`;
    };

    // ==========================================
    // Initialization
    // ==========================================
    async function init() {
        if (els.currentDateDisplay) {
            els.currentDateDisplay.innerHTML = `<i class='bx bx-calendar'></i> ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
        }
        attachEventListeners();
        await Promise.all([fetchStats(), fetchUsers()]);
    }

    // ==========================================
    // Data Fetching API
    // ==========================================
    async function fetchStats() {
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            const [
                { count: totalCount },
                { count: activeCount },
                { count: blockedCount },
                { data: allUsersForBalanceAndDate }
            ] = await Promise.all([
                supabaseClient.from('users').select('*', { count: 'exact', head: true }),
                supabaseClient.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
                supabaseClient.from('users').select('*', { count: 'exact', head: true }).eq('is_active', false),
                supabaseClient.from('users').select('smart_balance, created_at')
            ]);

            let totalBal = 0;
            let todayRegs = 0;

            if (allUsersForBalanceAndDate) {
                allUsersForBalanceAndDate.forEach(u => {
                    totalBal += parseFloat(u.smart_balance || 0);
                    if (u.created_at && u.created_at.startsWith(todayStr)) {
                        todayRegs++;
                    }
                });
            }

            if (els.statTotal) els.statTotal.textContent = totalCount || 0;
            if (els.statActive) els.statActive.textContent = activeCount || 0;
            if (els.statBlocked) els.statBlocked.textContent = blockedCount || 0;
            if (els.statToday) els.statToday.textContent = todayRegs || 0;
            if (els.statWalletBalance) els.statWalletBalance.textContent = formatCurrency(totalBal);

            document.querySelectorAll('.stat-info p').forEach(el => el.classList.remove('skeleton-text'));

        } catch (error) {
            console.error("Stats Fetch Error:", error);
            notify("Failed to load statistics.", "error");
        }
    }

    function buildQuery() {
        let query = supabaseClient.from('users').select('*', { count: 'exact' });

        // Search
        if (state.filters.search) {
            const term = state.filters.search.trim();
            // Safe search preventing UUID cast errors
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(term);
            if (isUUID) {
                query = query.eq('id', term);
            } else {
                query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
            }
        }

        // Filters
        if (state.filters.status !== '') {
            query = query.eq('is_active', state.filters.status === 'true');
        }
        if (state.filters.role !== '') {
            query = query.eq('role', state.filters.role);
        }

        // Sorting
        switch (state.sort) {
            case 'newest': query = query.order('created_at', { ascending: false }); break;
            case 'oldest': query = query.order('created_at', { ascending: true }); break;
            case 'highest_bal': query = query.order('smart_balance', { ascending: false }); break;
            case 'lowest_bal': query = query.order('smart_balance', { ascending: true }); break;
            case 'az': query = query.order('name', { ascending: true }); break;
            case 'za': query = query.order('name', { ascending: false }); break;
            default: query = query.order('created_at', { ascending: false });
        }

        // Pagination
        const from = (state.page - 1) * state.perPage;
        const to = from + state.perPage - 1;
        query = query.range(from, to);

        return query;
    }

    async function fetchUsers() {
        renderTableSkeletons();
        
        try {
            const query = buildQuery();
            const { data, count, error } = await query;
            if (error) throw error;

            state.totalCount = count || 0;
            state.users = data || [];

            renderTable();
            updatePagination();
            updateBulkActionsVisibility();

        } catch (error) {
            console.error("Users Fetch Error:", error);
            notify("Failed to fetch users.", "error");
            if (els.tableBody) els.tableBody.innerHTML = '';
            if (els.emptyState) els.emptyState.style.display = 'block';
        }
    }

    // ==========================================
    // Rendering
    // ==========================================
    function renderTableSkeletons() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = '';
        for (let i = 0; i < Math.min(state.perPage, 6); i++) {
            els.tableBody.innerHTML += `
                <tr class="skeleton-row">
                    <td><div class="skeleton skeleton-block" style="width: 20px;"></div></td>
                    <td><div style="display:flex; gap:10px; align-items:center;"><div class="skeleton skeleton-avatar"></div><div style="flex:1"><div class="skeleton skeleton-block" style="margin-bottom:4px;"></div><div class="skeleton skeleton-block" style="width:60%;"></div></div></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 150px; margin-bottom:4px;"></div><div class="skeleton skeleton-block" style="width: 100px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 60px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 90px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 120px;"></div></td>
                </tr>
            `;
        }
        if (els.emptyState) els.emptyState.style.display = 'none';
    }

    function renderTable() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = '';
        
        if (els.selectAllCheckbox) els.selectAllCheckbox.checked = false;
        
        if (state.users.length === 0) {
            if (els.emptyState) els.emptyState.style.display = 'block';
            return;
        }

        if (els.emptyState) els.emptyState.style.display = 'none';

        state.users.forEach(user => {
            const tr = document.createElement('tr');
            const isChecked = state.selectedIds.has(user.id) ? 'checked' : '';
            const isActive = user.is_active === true || String(user.is_active) === 'true';
            
            tr.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-id="${user.id}" ${isChecked}></td>
                <td>
                    <div class="user-profile-cell">
                        ${getAvatarHTML(user.name, user.profile_image)}
                        <div class="user-meta">
                            <span class="user-name">${user.name || 'Unknown User'}</span>
                            <span class="user-id-sub">ID: ${String(user.id).substring(0,8)}...</span>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="contact-meta">
                        <span><i class='bx bx-envelope'></i> ${user.email || '-'}</span>
                        <span><i class='bx bx-phone'></i> ${user.phone || '-'}</span>
                    </div>
                </td>
                <td><span class="bal-text">${formatCurrency(user.smart_balance)}</span></td>
                <td>${getRoleHTML(user.role)}</td>
                <td>${getStatusHTML(user.is_active)}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <div class="row-actions">
                        <button class="act-btn view btn-view ripple" data-id="${user.id}" title="View Profile"><i class='bx bx-show'></i></button>
                        <button class="act-btn edit btn-edit ripple" data-id="${user.id}" title="Edit User"><i class='bx bx-edit'></i></button>
                        ${isActive 
                            ? `<button class="act-btn block btn-block ripple" data-id="${user.id}" title="Block User"><i class='bx bx-block'></i></button>`
                            : `<button class="act-btn unblock btn-unblock ripple" data-id="${user.id}" title="Unblock User"><i class='bx bx-check-shield'></i></button>`
                        }
                        <button class="act-btn delete btn-delete ripple" data-id="${user.id}" title="Delete User"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            els.tableBody.appendChild(tr);
        });

        attachRowEventListeners();
    }

    function updatePagination() {
        if (!els.pageNumbers) return;
        
        const totalPages = Math.ceil(state.totalCount / state.perPage) || 1;
        const from = state.totalCount === 0 ? 0 : ((state.page - 1) * state.perPage) + 1;
        const to = Math.min(state.page * state.perPage, state.totalCount);
        
        if (els.pageStart) els.pageStart.textContent = from;
        if (els.pageEnd) els.pageEnd.textContent = to;
        if (els.totalItemsDisplay) els.totalItemsDisplay.textContent = state.totalCount;

        if (els.prevPageBtn) els.prevPageBtn.disabled = state.page <= 1;
        if (els.nextPageBtn) els.nextPageBtn.disabled = state.page >= totalPages;
        
        els.pageNumbers.innerHTML = '';
        
        let startPage = Math.max(1, state.page - 1);
        let endPage = Math.min(totalPages, startPage + 2);
        
        if (endPage - startPage < 2) {
            startPage = Math.max(1, endPage - 2);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `btn-page ripple ${i === state.page ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                state.page = i;
                fetchUsers();
            });
            els.pageNumbers.appendChild(btn);
        }
    }

    function updateBulkActionsVisibility() {
        if (!els.bulkActions || !els.selectedCount) return;
        if (state.selectedIds.size > 0) {
            els.selectedCount.textContent = state.selectedIds.size;
            els.bulkActions.style.display = 'flex';
        } else {
            els.bulkActions.style.display = 'none';
        }
    }

    // ==========================================
    // Event Listeners
    // ==========================================
    function attachEventListeners() {
        const debounceSearch = () => {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => {
                state.page = 1;
                fetchUsers();
            }, 500);
        };

        // Header Actions
        if (els.globalSearch) els.globalSearch.addEventListener('input', (e) => { state.filters.search = e.target.value; debounceSearch(); });
        if (els.refreshBtn) els.refreshBtn.addEventListener('click', () => { fetchStats(); fetchUsers(); notify('Data refreshed', 'success'); });
        if (els.exportBtn) els.exportBtn.addEventListener('click', exportToCSV);

        // Filters & Selects
        if (els.filterStatus) els.filterStatus.addEventListener('change', (e) => { state.filters.status = e.target.value; state.page = 1; fetchUsers(); });
        if (els.filterRole) els.filterRole.addEventListener('change', (e) => { state.filters.role = e.target.value; state.page = 1; fetchUsers(); });
        if (els.sortSelect) els.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; fetchUsers(); });
        if (els.perPageSelect) els.perPageSelect.addEventListener('change', (e) => { state.perPage = parseInt(e.target.value, 10); state.page = 1; fetchUsers(); });

        if (els.resetFiltersBtn) {
            els.resetFiltersBtn.addEventListener('click', () => {
                state.filters = { search: '', status: '', role: '' };
                document.querySelectorAll('.filter-input, #globalSearch').forEach(el => el.value = '');
                state.page = 1;
                fetchUsers();
            });
        }

        // Pagination
        if (els.prevPageBtn) els.prevPageBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchUsers(); } });
        if (els.nextPageBtn) els.nextPageBtn.addEventListener('click', () => { state.page++; fetchUsers(); });

          // Bulk Selection
        if (els.selectAllCheckbox) {
            els.selectAllCheckbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                document.querySelectorAll('.row-checkbox').forEach(cb => {
                    cb.checked = checked;
                    const id = cb.getAttribute('data-id');
                    if (checked) state.selectedIds.add(id);
                    else state.selectedIds.delete(id);
                });
                updateBulkActionsVisibility();
            });
        }

        // Bulk Actions
        if (els.bulkUnblockBtn) els.bulkUnblockBtn.addEventListener('click', () => openConfirmModal('bulkUnblock', null, `Unblock ${state.selectedIds.size} selected users?`, 'success'));
        if (els.bulkBlockBtn) els.bulkBlockBtn.addEventListener('click', () => openConfirmModal('bulkBlock', null, `Block ${state.selectedIds.size} selected users?`, 'warning'));
        if (els.bulkDeleteBtn) els.bulkDeleteBtn.addEventListener('click', () => openConfirmModal('bulkDelete', null, `Permanently delete ${state.selectedIds.size} selected users?`, 'danger'));

        // Modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });

        if (els.saveUserBtn) els.saveUserBtn.addEventListener('click', saveUserEdit);
        if (els.executeConfirmBtn) els.executeConfirmBtn.addEventListener('click', executeConfirmAction);
        
        if (els.openEditFromViewBtn) {
            els.openEditFromViewBtn.addEventListener('click', () => {
                const id = els.viewId.textContent;
                if (els.viewModal) els.viewModal.classList.remove('active');
                openEditModal(id);
            });
        }
    }

    function attachRowEventListeners() {
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) state.selectedIds.add(id);
                else state.selectedIds.delete(id);
                updateBulkActionsVisibility();
                
                if (els.selectAllCheckbox && document.querySelectorAll('.row-checkbox:not(:checked)').length === 0) {
                    els.selectAllCheckbox.checked = true;
                } else if (els.selectAllCheckbox) {
                    els.selectAllCheckbox.checked = false;
                }
            });
        });

        document.querySelectorAll('.btn-view').forEach(btn => btn.addEventListener('click', (e) => openViewModal(e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => openEditModal(e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.btn-block').forEach(btn => btn.addEventListener('click', (e) => openConfirmModal('block', e.currentTarget.getAttribute('data-id'), 'Are you sure you want to block this user?', 'warning')));
        document.querySelectorAll('.btn-unblock').forEach(btn => btn.addEventListener('click', (e) => openConfirmModal('unblock', e.currentTarget.getAttribute('data-id'), 'Are you sure you want to unblock this user?', 'success')));
        document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => openConfirmModal('delete', e.currentTarget.getAttribute('data-id'), 'Are you sure you want to delete this user? This cannot be undone.', 'danger')));
    }

    // ==========================================
    // Modals Logic
    // ==========================================
    function openViewModal(id) {
        const user = state.users.find(u => String(u.id) === String(id));
        if (!user || !els.viewModal) return;

        if (els.viewAvatarContainer) els.viewAvatarContainer.innerHTML = getAvatarHTML(user.name, user.profile_image);
        if (els.viewName) els.viewName.textContent = user.name || 'N/A';
        if (els.viewRole) els.viewRole.textContent = user.role || 'user';
        if (els.viewStatusBadge) els.viewStatusBadge.innerHTML = getStatusHTML(user.is_active);
        
        if (els.viewId) els.viewId.textContent = user.id;
        if (els.viewDate) els.viewDate.textContent = formatDate(user.created_at);
        if (els.viewEmail) els.viewEmail.textContent = user.email || 'N/A';
        if (els.viewPhone) els.viewPhone.textContent = user.phone || 'N/A';
        if (els.viewBalance) els.viewBalance.textContent = formatCurrency(user.smart_balance);

        els.viewModal.classList.add('active');
    }

    function openEditModal(id) {
        const user = state.users.find(u => String(u.id) === String(id));
        if (!user || !els.editModal) return;

        if (els.editUserForm) els.editUserForm.reset();
        
        if (els.editUserId) els.editUserId.value = user.id;
        if (els.editName) els.editName.value = user.name || '';
        if (els.editEmail) els.editEmail.value = user.email || '';
        if (els.editPhone) els.editPhone.value = user.phone || '';
        if (els.editProfileImage) els.editProfileImage.value = user.profile_image || '';
        if (els.editRole) els.editRole.value = user.role || 'user';
        if (els.editStatus) els.editStatus.value = (user.is_active === true || String(user.is_active) === 'true') ? 'true' : 'false';
        
        if (els.editCurrentBalance) els.editCurrentBalance.textContent = formatCurrency(user.smart_balance);
        if (els.walletActionType) els.walletActionType.value = 'none';
        if (els.walletModifyAmount) els.walletModifyAmount.value = '';

        els.editModal.classList.add('active');
    }

    async function saveUserEdit(e) {
        e.preventDefault();
        const id = els.editUserId ? els.editUserId.value : null;
        if (!id) return;

        // Form Validation check natively
        if (els.editUserForm && !els.editUserForm.checkValidity()) {
            els.editUserForm.reportValidity();
            return;
        }

        const user = state.users.find(u => String(u.id) === String(id));
        if (!user) return;

        let finalBalance = parseFloat(user.smart_balance || 0);
        const modAction = els.walletActionType.value;
        const modAmt = parseFloat(els.walletModifyAmount.value);

        if (modAction !== 'none' && !isNaN(modAmt) && modAmt >= 0) {
            if (modAction === 'add') finalBalance += modAmt;
            else if (modAction === 'deduct') finalBalance = Math.max(0, finalBalance - modAmt);
            else if (modAction === 'set') finalBalance = modAmt;
        }

        const payload = {
            name: els.editName.value.trim(),
            email: els.editEmail.value.trim(),
            phone: els.editPhone.value.trim(),
            profile_image: els.editProfileImage.value.trim(),
            role: els.editRole.value,
            is_active: els.editStatus.value === 'true',
            smart_balance: finalBalance
        };

        try {
            if (els.saveUserBtn) {
                els.saveUserBtn.disabled = true;
                els.saveUserBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving...";
            }

            const { error } = await supabaseClient.from('users').update(payload).eq('id', id);
            if (error) throw error;

            notify('User updated successfully.', 'success');
            if (els.editModal) els.editModal.classList.remove('active');
            
            await fetchStats();
            await fetchUsers();

        } catch (error) {
            console.error("Save Error:", error);
            notify(`Error: ${error.message}`, 'error');
        } finally {
            if (els.saveUserBtn) {
                els.saveUserBtn.disabled = false;
                els.saveUserBtn.innerHTML = "Save Changes";
            }
        }
    }

    function openConfirmModal(actionType, id, message, theme = 'primary') {
        state.actionContext = { type: actionType, id: id };
        if (els.confirmText) els.confirmText.textContent = message;
        
        if (els.confirmIcon) {
            let iconHtml = `<i class='bx bx-question-mark'></i>`;
            if (theme === 'danger') iconHtml = `<i class='bx bx-trash'></i>`;
            if (theme === 'success') iconHtml = `<i class='bx bx-check-shield'></i>`;
            if (theme === 'warning') iconHtml = `<i class='bx bx-block'></i>`;
            els.confirmIcon.innerHTML = iconHtml;
            els.confirmIcon.style.color = `var(--${theme})`;
        }
        
        if (els.executeConfirmBtn) {
            els.executeConfirmBtn.className = `btn btn-${theme} ripple`;
            els.executeConfirmBtn.textContent = 'Confirm';
        }

        if (els.confirmModal) els.confirmModal.classList.add('active');
    }

    async function executeConfirmAction() {
        if (!state.actionContext) return;
        const { type, id } = state.actionContext;
        
        if (els.executeConfirmBtn) {
            els.executeConfirmBtn.disabled = true;
            els.executeConfirmBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Processing...";
        }

        try {
            if (type === 'delete' && id) {
                const { error } = await supabaseClient.from('users').delete().eq('id', id);
                if (error) throw error;
                notify("User deleted.", "success");
            } 
            else if (type === 'block' && id) {
                const { error } = await supabaseClient.from('users').update({ is_active: false }).eq('id', id);
                if (error) throw error;
                notify("User blocked.", "success");
            }
            else if (type === 'unblock' && id) {
                const { error } = await supabaseClient.from('users').update({ is_active: true }).eq('id', id);
                if (error) throw error;
                notify("User unblocked.", "success");
            }
            else if (type === 'bulkDelete') {
                const idsArray = Array.from(state.selectedIds);
                const { error } = await supabaseClient.from('users').delete().in('id', idsArray);
                if (error) throw error;
                notify(`${idsArray.length} users deleted.`, "success");
                state.selectedIds.clear();
            }
            else if (type === 'bulkBlock') {
                const idsArray = Array.from(state.selectedIds);
                const { error } = await supabaseClient.from('users').update({ is_active: false }).in('id', idsArray);
                if (error) throw error;
                notify(`${idsArray.length} users blocked.`, "success");
                state.selectedIds.clear();
            }
            else if (type === 'bulkUnblock') {
                const idsArray = Array.from(state.selectedIds);
                const { error } = await supabaseClient.from('users').update({ is_active: true }).in('id', idsArray);
                if (error) throw error;
                notify(`${idsArray.length} users unblocked.`, "success");
                state.selectedIds.clear();
            }

            if (els.confirmModal) els.confirmModal.classList.remove('active');
            
            await fetchStats();
            await fetchUsers();

        } catch (error) {
            console.error("Action Error:", error);
            notify(`Error: ${error.message}`, "error");
        } finally {
            if (els.executeConfirmBtn) {
                els.executeConfirmBtn.disabled = false;
                els.executeConfirmBtn.textContent = "Confirm";
            }
            state.actionContext = null;
        }
    }

    // ==========================================
    // Export Data
    // ==========================================
    function exportToCSV() {
        if (!state.users || state.users.length === 0) {
            notify("No data to export.", "warning");
            return;
        }
        
        const headers = ['User ID', 'Name', 'Email', 'Phone', 'Wallet Balance', 'Role', 'Status', 'Registration Date'];
        const csvRows = [headers.join(',')];

        state.users.forEach(u => {
            const row = [
                u.id,
                `"${u.name || ''}"`,
                `"${u.email || ''}"`,
                `"${u.phone || ''}"`,
                u.smart_balance || 0,
                u.role || 'user',
                (u.is_active === true || String(u.is_active) === 'true') ? 'Active' : 'Blocked',
                u.created_at || ''
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `users_export_${Date.now()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        notify("Export downloaded successfully.", "success");
    }

    // Init
    document.addEventListener('DOMContentLoaded', init);

})();