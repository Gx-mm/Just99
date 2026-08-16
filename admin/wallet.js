// wallet.js
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

    // ONE client instance
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ==========================================
    // State Management
    // ==========================================
    const state = {
        requests: [],
        usersMap: {}, 
        totalCount: 0,
        page: 1,
        perPage: 10,
        selectedIds: new Set(),
        debounceTimer: null,
        actionContext: null, 
        filters: {
            search: '',
            status: '',
            datePreset: '',
            dateFrom: '',
            dateTo: '',
            userId: '',
            utr: ''
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

        statPending: document.getElementById('statPending'),
        statApproved: document.getElementById('statApproved'),
        statRejected: document.getElementById('statRejected'),
        statTodayReqs: document.getElementById('statTodayReqs'),
        statTodayAmount: document.getElementById('statTodayAmount'),
        statTotalApprovedAmt: document.getElementById('statTotalApprovedAmt'),

        filterStatus: document.getElementById('filterStatus'),
        filterDatePreset: document.getElementById('filterDatePreset'),
        filterDateFrom: document.getElementById('filterDateFrom'),
        filterDateTo: document.getElementById('filterDateTo'),
        filterUserId: document.getElementById('filterUserId'),
        filterUTR: document.getElementById('filterUTR'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),

        bulkActions: document.getElementById('bulkActions'),
        selectedCount: document.getElementById('selectedCount'),
        bulkApproveBtn: document.getElementById('bulkApproveBtn'),
        bulkRejectBtn: document.getElementById('bulkRejectBtn'),
        bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),

        sortSelect: document.getElementById('sortSelect'),
        perPageSelect: document.getElementById('perPageSelect'),
        tableBody: document.getElementById('tableBody'),
        emptyState: document.getElementById('emptyState'),
        selectAllCheckbox: document.getElementById('selectAllCheckbox'),

        pageStart: document.getElementById('pageStart'),
        pageEnd: document.getElementById('pageEnd'),
        totalItemsDisplay: document.getElementById('totalItemsDisplay'),
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        pageNumbers: document.getElementById('pageNumbers'),

        viewModal: document.getElementById('viewModal'),
        viewModalFooter: document.getElementById('viewModalFooter'),
        confirmModal: document.getElementById('confirmModal'),

        viewReqId: document.getElementById('viewReqId'),
        viewStatus: document.getElementById('viewStatus'),
        viewAmount: document.getElementById('viewAmount'),
        viewUtr: document.getElementById('viewUtr'),
        viewDate: document.getElementById('viewDate'),
        viewUserId: document.getElementById('viewUserId'),
        viewUserName: document.getElementById('viewUserName'),
        viewUserEmail: document.getElementById('viewUserEmail'),
        viewUserPhone: document.getElementById('viewUserPhone'),
        viewUserBalance: document.getElementById('viewUserBalance'),

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
            let title = "Notification";
            if(type === "success") title = "Success";
            if(type === "error") title = "Error";
            if(type === "warning") title = "Warning";
            window.showPopup(title, msg, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getStatusHTML = (status) => {
        const s = (status || 'Pending').toLowerCase();
        let icon = 'bx-time-five';
        if (s === 'approved') icon = 'bx-check-circle';
        if (s === 'rejected') icon = 'bx-x-circle';
        return `<span class="badge ${s}"><i class='bx ${icon}'></i> ${status || 'Pending'}</span>`;
    };

    const parseAmount = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    // ==========================================
    // Initialization
    // ==========================================
    async function init() {
        if (els.currentDateDisplay) {
            els.currentDateDisplay.innerHTML = `<i class='bx bx-calendar'></i> ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
        }
        attachEventListeners();
        await fetchStats();
        await fetchRequests();
    }

    // ==========================================
    // Data Fetching API
    // ==========================================
    async function fetchStats() {
        const todayStr = new Date().toISOString().split('T')[0];

        const { count: pendingCount, error: err1 } = await supabaseClient
            .from('wallet_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Pending');
            
        if(err1){
            notify(err1.message, "error");
            return;
        }

        const { count: approvedCount, error: err2 } = await supabaseClient
            .from('wallet_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Approved');
            
        if(err2){
            notify(err2.message, "error");
            return;
        }

        const { count: rejectedCount, error: err3 } = await supabaseClient
            .from('wallet_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Rejected');
            
        if(err3){
            notify(err3.message, "error");
            return;
        }

        const { data: allAmounts, error: err4 } = await supabaseClient
            .from('wallet_requests')
            .select('amount, status, created_at');
            
        if(err4){
            notify(err4.message, "error");
            return;
        }

        let todayReqs = 0;
        let todayAmount = 0;
        let totalApprovedAmt = 0;

        if (allAmounts) {
            allAmounts.forEach(req => {
                const amt = parseAmount(req.amount);
                if (req.status === 'Approved') {
                    totalApprovedAmt += amt;
                }
                if (req.created_at && req.created_at.startsWith(todayStr)) {
                    todayReqs++;
                    todayAmount += amt;
                }
            });
        }

        if (els.statPending) els.statPending.textContent = pendingCount || 0;
        if (els.statApproved) els.statApproved.textContent = approvedCount || 0;
        if (els.statRejected) els.statRejected.textContent = rejectedCount || 0;
        if (els.statTodayReqs) els.statTodayReqs.textContent = todayReqs;
        if (els.statTodayAmount) els.statTodayAmount.textContent = formatCurrency(todayAmount);
        if (els.statTotalApprovedAmt) els.statTotalApprovedAmt.textContent = formatCurrency(totalApprovedAmt);

        document.querySelectorAll('.stat-info p').forEach(el => el.classList.remove('skeleton-text'));
    }

    function buildQuery() {
        let query = supabaseClient.from('wallet_requests').select('*', { count: 'exact' });

        if (state.filters.search) {
            query = query.ilike('utr', `%${state.filters.search}%`);
        } else {
            if (state.filters.userId) query = query.eq('user_id', state.filters.userId);
            if (state.filters.utr) query = query.ilike('utr', `%${state.filters.utr}%`);
        }

        if (state.filters.status) query = query.eq('status', state.filters.status);

        if (state.filters.datePreset) {
            const now = new Date();
            if (state.filters.datePreset === 'today') {
                const today = now.toISOString().split('T')[0];
                query = query.gte('created_at', `${today}T00:00:00Z`);
            } else if (state.filters.datePreset === 'week') {
                const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString();
                query = query.gte('created_at', weekAgo);
            } else if (state.filters.datePreset === 'month') {
                const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
                query = query.gte('created_at', monthAgo);
            }
        } else {
            if (state.filters.dateFrom) query = query.gte('created_at', `${state.filters.dateFrom}T00:00:00Z`);
            if (state.filters.dateTo) query = query.lte('created_at', `${state.filters.dateTo}T23:59:59Z`);
        }

        switch (state.sort) {
            case 'newest': query = query.order('created_at', { ascending: false }); break;
            case 'oldest': query = query.order('created_at', { ascending: true }); break;
            case 'highest_amt': query = query.order('amount', { ascending: false }); break;
            case 'lowest_amt': query = query.order('amount', { ascending: true }); break;
            default: query = query.order('created_at', { ascending: false });
        }

        const from = (state.page - 1) * state.perPage;
        const to = from + state.perPage - 1;
        query = query.range(from, to);

        return query;
    }

    async function fetchRequests() {
        renderTableSkeletons();
        
        const query = buildQuery();
        const { data: requestsData, count, error } = await query;
        
        if(error){
            notify(error.message, "error");
            if (els.tableBody) els.tableBody.innerHTML = '';
            if (els.emptyState) els.emptyState.style.display = 'block';
            return;
        }

        state.totalCount = count || 0;
        state.requests = requestsData || [];

        if (state.requests.length > 0) {
            const userIds = [...new Set(state.requests.map(r => r.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                const { data: usersData, error: usrErr } = await supabaseClient.from('users').select('*').in('id', userIds);
                
                if(usrErr){
                    notify(usrErr.message, "error");
                } else if (usersData) {
                    usersData.forEach(u => state.usersMap[u.id] = u);
                }
            }
        }

        renderTable();
        updatePagination();
        updateBulkActionsVisibility();
    }

    // ==========================================
    // Rendering
    // ==========================================
    function renderTableSkeletons() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = '';
        for (let i = 0; i < Math.min(state.perPage, 5); i++) {
            els.tableBody.innerHTML += `
                <tr class="skeleton-row">
                    <td><div class="skeleton skeleton-block" style="width: 20px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 150px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 120px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 100px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 100px;"></div></td>
                </tr>
            `;
        }
        if (els.emptyState) els.emptyState.style.display = 'none';
    }

    function renderTable() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = '';
        
        if (els.selectAllCheckbox) els.selectAllCheckbox.checked = false;
        
        if (state.requests.length === 0) {
            if (els.emptyState) els.emptyState.style.display = 'block';
            return;
        }

        if (els.emptyState) els.emptyState.style.display = 'none';

        state.requests.forEach(req => {
            const tr = document.createElement('tr');
            const isChecked = state.selectedIds.has(String(req.id)) ? 'checked' : '';
            const user = state.usersMap[req.user_id] || {};
            const isPending = req.status === 'Pending';
            
            tr.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-id="${req.id}" ${isChecked}></td>
                <td><span class="id-text">${String(req.id).substring(0, 8)}...</span></td>
                <td>
                    <div class="user-cell">
                        <span class="user-name">${user.name || 'Unknown User'}</span>
                        <span class="user-phone">${user.phone || req.user_id}</span>
                    </div>
                </td>
                <td><span class="amount-text">${formatCurrency(req.amount)}</span></td>
                <td><strong>${req.utr || '-'}</strong></td>
                <td>${getStatusHTML(req.status)}</td>
                <td>${formatDate(req.created_at)}</td>
                <td>
                    <div class="row-actions">
                        <button class="act-btn view btn-view" data-id="${req.id}" title="View Details"><i class='bx bx-show'></i></button>
                        <button class="act-btn approve btn-approve" data-id="${req.id}" title="Approve" ${!isPending ? 'disabled' : ''}><i class='bx bx-check'></i></button>
                        <button class="act-btn reject btn-reject" data-id="${req.id}" title="Reject" ${!isPending ? 'disabled' : ''}><i class='bx bx-x'></i></button>
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
            btn.className = `btn-page ${i === state.page ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                state.page = i;
                fetchRequests();
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
                fetchRequests();
            }, 500);
        };

        if (els.globalSearch) els.globalSearch.addEventListener('input', (e) => { state.filters.search = e.target.value; debounceSearch(); });
        if (els.filterUserId) els.filterUserId.addEventListener('input', (e) => { state.filters.userId = e.target.value; debounceSearch(); });
        if (els.filterUTR) els.filterUTR.addEventListener('input', (e) => { state.filters.utr = e.target.value; debounceSearch(); });
        
        if (els.filterDateFrom) els.filterDateFrom.addEventListener('change', (e) => { state.filters.dateFrom = e.target.value; state.page = 1; fetchRequests(); });
        if (els.filterDateTo) els.filterDateTo.addEventListener('change', (e) => { state.filters.dateTo = e.target.value; state.page = 1; fetchRequests(); });

        if (els.filterStatus) els.filterStatus.addEventListener('change', (e) => { state.filters.status = e.target.value; state.page = 1; fetchRequests(); });
        if (els.filterDatePreset) els.filterDatePreset.addEventListener('change', (e) => { state.filters.datePreset = e.target.value; state.page = 1; fetchRequests(); });
        if (els.sortSelect) els.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; fetchRequests(); });
        if (els.perPageSelect) els.perPageSelect.addEventListener('change', (e) => { state.perPage = parseInt(e.target.value, 10); state.page = 1; fetchRequests(); });

        if (els.resetFiltersBtn) {
            els.resetFiltersBtn.addEventListener('click', () => {
                state.filters = { search: '', status: '', datePreset: '', dateFrom: '', dateTo: '', userId: '', utr: '' };
                document.querySelectorAll('.filter-input, #globalSearch').forEach(el => el.value = '');
                state.page = 1;
                fetchRequests();
            });
        }

        if (els.prevPageBtn) els.prevPageBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchRequests(); } });
        if (els.nextPageBtn) els.nextPageBtn.addEventListener('click', () => { state.page++; fetchRequests(); });
        
        if (els.refreshBtn) els.refreshBtn.addEventListener('click', async () => { 
            await fetchStats(); 
            await fetchRequests(); 
            notify('Data refreshed', 'success'); 
        });
        
        if (els.exportBtn) els.exportBtn.addEventListener('click', exportToCSV);

        if (els.selectAllCheckbox) {
            els.selectAllCheckbox.addEventListener('change', (e) => {
                const checked = e.target.checked;
                const checkboxes = document.querySelectorAll('.row-checkbox');
                checkboxes.forEach(cb => {
                    cb.checked = checked;
                    const id = cb.getAttribute('data-id');
                    if (checked) state.selectedIds.add(id);
                    else state.selectedIds.delete(id);
                });
                updateBulkActionsVisibility();
            });
        }

        if (els.bulkApproveBtn) els.bulkApproveBtn.addEventListener('click', () => openConfirmModal('bulkApprove', null, `Approve ${state.selectedIds.size} selected requests?`, 'success'));
        if (els.bulkRejectBtn) els.bulkRejectBtn.addEventListener('click', () => openConfirmModal('bulkReject', null, `Reject ${state.selectedIds.size} selected requests?`, 'warning'));
        if (els.bulkDeleteBtn) els.bulkDeleteBtn.addEventListener('click', () => openConfirmModal('bulkDelete', null, `Delete ${state.selectedIds.size} selected requests permanently?`, 'danger'));

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });

        if (els.executeConfirmBtn) els.executeConfirmBtn.addEventListener('click', executeConfirmAction);
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
        document.querySelectorAll('.btn-approve').forEach(btn => btn.addEventListener('click', (e) => openConfirmModal('approve', e.currentTarget.getAttribute('data-id'), 'Are you sure you want to approve this request and add balance?', 'success')));
        document.querySelectorAll('.btn-reject').forEach(btn => btn.addEventListener('click', (e) => openConfirmModal('reject', e.currentTarget.getAttribute('data-id'), 'Are you sure you want to reject this request?', 'warning')));
    }

    // ==========================================
    // Modals & CRUD Logic
    // ==========================================
    function openViewModal(id) {
        const req = state.requests.find(r => String(r.id) === String(id));
        if (!req || !els.viewModal) return;

        const user = state.usersMap[req.user_id] || {};
        
        if (els.viewReqId) els.viewReqId.textContent = req.id;
        if (els.viewStatus) els.viewStatus.innerHTML = getStatusHTML(req.status);
        if (els.viewAmount) els.viewAmount.textContent = formatCurrency(req.amount);
        if (els.viewUtr) els.viewUtr.textContent = req.utr || 'N/A';
        if (els.viewDate) els.viewDate.textContent = formatDate(req.created_at);

        if (els.viewUserId) els.viewUserId.textContent = req.user_id;
        if (els.viewUserName) els.viewUserName.textContent = user.name || 'N/A';
        if (els.viewUserEmail) els.viewUserEmail.textContent = user.email || 'N/A';
        if (els.viewUserPhone) els.viewUserPhone.textContent = user.phone || 'N/A';
        if (els.viewUserBalance) els.viewUserBalance.textContent = formatCurrency(user.smart_balance);

        if (els.viewModalFooter) {
            if (req.status === 'Pending') {
                els.viewModalFooter.innerHTML = `
                    <button class="btn btn-outline close-modal">Cancel</button>
                    <button class="btn btn-warning" onclick="document.getElementById('viewModal').classList.remove('active'); document.querySelector('.btn-reject[data-id=\\'${req.id}\\']').click();">Reject</button>
                    <button class="btn btn-success" onclick="document.getElementById('viewModal').classList.remove('active'); document.querySelector('.btn-approve[data-id=\\'${req.id}\\']').click();">Approve</button>
                `;
            } else {
                els.viewModalFooter.innerHTML = `<button class="btn btn-outline close-modal">Close</button>`;
            }
            
            els.viewModalFooter.querySelectorAll('.close-modal').forEach(b => {
                b.addEventListener('click', () => els.viewModal.classList.remove('active'));
            });
        }

        els.viewModal.classList.add('active');
    }

    function openConfirmModal(actionType, id, message, theme = 'primary') {
        state.actionContext = { type: actionType, id: id };
        
        if (els.confirmText) els.confirmText.textContent = message;
        
        if (els.confirmIcon) {
            els.confirmIcon.className = `confirm-icon ${theme}`;
            if (theme === 'danger') els.confirmIcon.innerHTML = `<i class='bx bx-trash'></i>`;
            else if (theme === 'success') els.confirmIcon.innerHTML = `<i class='bx bx-check-shield'></i>`;
            else if (theme === 'warning') els.confirmIcon.innerHTML = `<i class='bx bx-error-circle'></i>`;
            else els.confirmIcon.innerHTML = `<i class='bx bx-question-mark'></i>`;
        }
        
        if (els.executeConfirmBtn) {
            els.executeConfirmBtn.className = `btn btn-${theme}`;
            els.executeConfirmBtn.textContent = 'Confirm Proceed';
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

        if (type === 'approve') {
            await processApprove(id);
        } else if (type === 'reject') {
            await processReject(id);
        } else if (type === 'bulkApprove') {
            await processBulkApprove();
        } else if (type === 'bulkReject') {
            await processBulkAction('Rejected');
        } else if (type === 'bulkDelete') {
            await processBulkDelete();
        }

        if (els.confirmModal) els.confirmModal.classList.remove('active');
        
        await fetchStats();
        await fetchRequests();

        if (els.executeConfirmBtn) {
            els.executeConfirmBtn.disabled = false;
            els.executeConfirmBtn.textContent = "Confirm Proceed";
        }
        state.actionContext = null;
    }

    // ==========================================
    // Core Business Logic
    // ==========================================
    async function processApprove(reqId) {
        const { data: freshReq, error: reqErr } = await supabaseClient
            .from('wallet_requests')
            .select('*')
            .eq('id', reqId)
            .single();
            
        if(reqErr){
            notify(reqErr.message, "error");
            return;
        }

        if (freshReq.status !== 'Pending') {
            notify('This request has already been processed.', 'warning');
            return;
        }

        const { data: user, error: usrErr } = await supabaseClient
            .from('users')
            .select('id, smart_balance')
            .eq('id', freshReq.user_id)
            .single();
            
        if(usrErr){
            notify(usrErr.message, "error");
            return;
        }

        const currentBalance = parseAmount(user.smart_balance);
        const addAmount = parseAmount(freshReq.amount);
        const newBalance = currentBalance + addAmount;

        const { error: updUsrErr } = await supabaseClient
            .from('users')
            .update({ smart_balance: newBalance })
            .eq('id', user.id);
            
        if(updUsrErr){
            notify(updUsrErr.message, "error");
            return;
        }

        const { error: updReqErr } = await supabaseClient
            .from('wallet_requests')
            .update({ status: 'Approved' })
            .eq('id', reqId);
            
        if(updReqErr){
            notify(updReqErr.message, "error");
            return;
        }

        notify("Request approved & wallet updated successfully.", "success");
    }

    async function processReject(reqId) {
        const { error } = await supabaseClient
            .from('wallet_requests')
            .update({ status: 'Rejected' })
            .eq('id', reqId);
            
        if(error){
            notify(error.message, "error");
            return;
        }
        notify("Request rejected.", "success");
    }

    async function processBulkApprove() {
        const idsArray = Array.from(state.selectedIds);
        const validReqs = state.requests.filter(r => idsArray.includes(String(r.id)) && r.status === 'Pending');
        
        if (validReqs.length === 0) {
            notify("No pending requests selected to approve.", "warning");
            return;
        }

        const userAdditions = {};
        const reqIdsToUpdate = [];

        validReqs.forEach(req => {
            const uid = req.user_id;
            if (!userAdditions[uid]) userAdditions[uid] = 0;
            userAdditions[uid] += parseAmount(req.amount);
            reqIdsToUpdate.push(req.id);
        });

        for (const uid in userAdditions) {
            const { data: user, error: usrErr } = await supabaseClient
                .from('users')
                .select('id, smart_balance')
                .eq('id', uid)
                .single();
                
            if(usrErr){
                notify(usrErr.message, "error");
                return;
            }
            
            if (user) {
                const newBalance = parseAmount(user.smart_balance) + userAdditions[uid];
                const { error: updUsrErr } = await supabaseClient
                    .from('users')
                    .update({ smart_balance: newBalance })
                    .eq('id', uid);
                    
                if(updUsrErr){
                    notify(updUsrErr.message, "error");
                    return;
                }
            }
        }

        const { error: reqErr } = await supabaseClient
            .from('wallet_requests')
            .update({ status: 'Approved' })
            .in('id', reqIdsToUpdate);
            
        if(reqErr){
            notify(reqErr.message, "error");
            return;
        }

        notify(`Successfully approved ${reqIdsToUpdate.length} requests and updated wallets.`, "success");
        state.selectedIds.clear();
    }

    async function processBulkAction(newStatus) {
        const idsArray = Array.from(state.selectedIds);
        const { error } = await supabaseClient
            .from('wallet_requests')
            .update({ status: newStatus })
            .in('id', idsArray);
            
        if(error){
            notify(error.message, "error");
            return;
        }
        notify(`Selected requests marked as ${newStatus}.`, "success");
        state.selectedIds.clear();
    }

    async function processBulkDelete() {
        const idsArray = Array.from(state.selectedIds);
        const { error } = await supabaseClient
            .from('wallet_requests')
            .delete()
            .in('id', idsArray);
            
        if(error){
            notify(error.message, "error");
            return;
        }
        notify(`${idsArray.length} requests deleted permanently.`, "success");
        state.selectedIds.clear();
    }
       // ==========================================
    // Export Data
    // ==========================================
    function exportToCSV() {
        if (!state.requests || state.requests.length === 0) {
            notify("No data to export.", "warning");
            return;
        }
        
        const headers = ['Request ID', 'User ID', 'User Name', 'Amount', 'UTR/TXN ID', 'Status', 'Date'];
        const csvRows = [headers.join(',')];

        state.requests.forEach(r => {
            const user = state.usersMap[r.user_id] || {};
            const row = [
                r.id,
                r.user_id,
                `"${user.name || ''}"`,
                r.amount || 0,
                `"${r.utr || ''}"`,
                r.status || '',
                r.created_at || ''
            ];
            csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `wallet_requests_${Date.now()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        notify("Export downloaded successfully.", "success");
    }

    // Initialize the module
    document.addEventListener('DOMContentLoaded', init);

})();