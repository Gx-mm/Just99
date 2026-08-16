// orders.js
(function () {
    'use strict';

    // ==========================================
    // Supabase Configuration & Initialization
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
        orders: [],
        totalCount: 0,
        page: 1,
        perPage: 10,
        selectedIds: new Set(),
        debounceTimer: null,
        actionContext: null, // Stores info for modals e.g., { id: '123' }
        filters: {
            search: '',
            orderId: '',
            customer: '',
            product: '',
            dateFrom: '',
            dateTo: '',
            payment: '',
            orderStatus: '',
            deliveryStatus: '',
            minAmt: '',
            maxAmt: ''
        },
        sort: 'newest'
    };

    // ==========================================
    // DOM Elements Caching
    // ==========================================
    const els = {
        // Headers & Search
        currentDateDisplay: document.getElementById('currentDateDisplay'),
        globalSearch: document.getElementById('globalSearch'),
        exportBtn: document.getElementById('exportBtn'),
        refreshBtn: document.getElementById('refreshBtn'),
        
        // Stats
        statTotal: document.getElementById('statTotal'),
        statPending: document.getElementById('statPending'),
        statConfirmed: document.getElementById('statConfirmed'),
        statShipped: document.getElementById('statShipped'),
        statDelivered: document.getElementById('statDelivered'),
        statCancelled: document.getElementById('statCancelled'),
        statRevenue: document.getElementById('statRevenue'),
        statToday: document.getElementById('statToday'),

        // Filters
        filterOrderId: document.getElementById('filterOrderId'),
        filterCustomer: document.getElementById('filterCustomer'),
        filterProduct: document.getElementById('filterProduct'),
        filterDateFrom: document.getElementById('filterDateFrom'),
        filterDateTo: document.getElementById('filterDateTo'),
        filterPayment: document.getElementById('filterPayment'),
        filterOrderStatus: document.getElementById('filterOrderStatus'),
        filterDeliveryStatus: document.getElementById('filterDeliveryStatus'),
        filterMinAmt: document.getElementById('filterMinAmt'),
        filterMaxAmt: document.getElementById('filterMaxAmt'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),

        // Bulk Actions
        bulkActions: document.getElementById('bulkActions'),
        selectedCount: document.getElementById('selectedCount'),
        bulkConfirmBtn: document.getElementById('bulkConfirmBtn'),
        bulkShipBtn: document.getElementById('bulkShipBtn'),
        bulkDeliverBtn: document.getElementById('bulkDeliverBtn'),
        bulkCancelBtn: document.getElementById('bulkCancelBtn'),
        bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),

        // Table & Controls
        sortSelect: document.getElementById('sortSelect'),
        perPageSelect: document.getElementById('perPageSelect'),
        tableBody: document.getElementById('ordersTableBody'),
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
        updateModal: document.getElementById('updateModal'),
        deleteModal: document.getElementById('deleteModal'),
        
        // View Details
        viewOrderId: document.getElementById('viewOrderId'),
        viewCustomerDetails: document.getElementById('viewCustomerDetails'),
        viewProductDetails: document.getElementById('viewProductDetails'),
        viewPaymentDetails: document.getElementById('viewPaymentDetails'),
        viewTimeline: document.getElementById('viewTimeline'),

        // Update Form
        updateOrderForm: document.getElementById('updateOrderForm'),
        updateOrderId: document.getElementById('updateOrderId'),
        updateOrderStatus: document.getElementById('updateOrderStatus'),
        updateDeliveryStatus: document.getElementById('updateDeliveryStatus'),
        updateDeliveryPartner: document.getElementById('updateDeliveryPartner'),
        updateTrackingNumber: document.getElementById('updateTrackingNumber'),
        updateExpectedDate: document.getElementById('updateExpectedDate'),
        saveUpdateBtn: document.getElementById('saveUpdateBtn'),

        // Delete Confirm
        confirmDeleteBtn: document.getElementById('confirmDeleteBtn')
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
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    const getStatusClass = (status) => {
        if (!status) return 'pending';
        const s = status.toLowerCase();
        if (s.includes('pending')) return 'pending';
        if (s.includes('confirm') || s.includes('pack')) return 'confirmed';
        if (s.includes('ship') || s.includes('out')) return 'shipped';
        if (s.includes('deliver')) return 'delivered';
        if (s.includes('cancel') || s.includes('refund')) return 'cancelled';
        return 'pending';
    };

    const getPaymentClass = (method) => {
        if (!method) return 'cod';
        const m = method.toLowerCase();
        if (m.includes('smart')) return 'smart-balance';
        if (m.includes('upi')) return 'upi';
        if (m.includes('online')) return 'online';
        return 'cod';
    };

    // ==========================================
    // Initialization
    // ==========================================
    async function init() {
        if (els.currentDateDisplay) {
            els.currentDateDisplay.innerHTML = `<i class='bx bx-calendar'></i> ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
        }
        attachEventListeners();
        await Promise.all([fetchStats(), fetchOrders()]);
    }

    // ==========================================
    // Data Fetching API
    // ==========================================
    async function fetchStats() {
        try {
            const todayStr = new Date().toISOString().split('T')[0];

            // Use Promise.all to fetch distinct counts securely
            const [
                { count: totalCount },
                { count: pendingCount },
                { count: confirmedCount },
                { count: shippedCount },
                { count: deliveredCount },
                { count: cancelledCount },
                { data: allAmounts } 
            ] = await Promise.all([
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }),
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'Pending'),
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'Confirmed'),
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }).eq('delivery_status', 'Shipped'),
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }).eq('delivery_status', 'Delivered'),
                supabaseClient.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', 'Cancelled'),
                // For revenue & today's orders (fetch necessary fields only to optimize)
                supabaseClient.from('orders').select('total_amount, created_at').neq('order_status', 'Cancelled')
            ]);

            // Calculate Revenue and Today's orders
            let totalRevenue = 0;
            let todayOrders = 0;
            
            if (allAmounts) {
                allAmounts.forEach(order => {
                    totalRevenue += parseFloat(order.total_amount || 0);
                    if (order.created_at && order.created_at.startsWith(todayStr)) {
                        todayOrders++;
                    }
                });
            }

            // Update UI
            if (els.statTotal) els.statTotal.textContent = totalCount || 0;
            if (els.statPending) els.statPending.textContent = pendingCount || 0;
            if (els.statConfirmed) els.statConfirmed.textContent = confirmedCount || 0;
            if (els.statShipped) els.statShipped.textContent = shippedCount || 0;
            if (els.statDelivered) els.statDelivered.textContent = deliveredCount || 0;
            if (els.statCancelled) els.statCancelled.textContent = cancelledCount || 0;
            if (els.statRevenue) els.statRevenue.textContent = formatCurrency(totalRevenue);
            if (els.statToday) els.statToday.textContent = todayOrders || 0;

            // Remove skeletons
            document.querySelectorAll('.stat-info p').forEach(el => el.classList.remove('skeleton-text'));

        } catch (error) {
            console.error("Stats Fetch Error:", error);
            notify("Failed to load statistics.", "error");
        }
    }

    function buildQuery() {
        let query = supabaseClient.from('orders').select('*', { count: 'exact' });

        // Apply Search (Global Search applies to ID, Customer, Phone, Product)
        if (state.filters.search) {
            query = query.or(`id.ilike.%${state.filters.search}%,customer_name.ilike.%${state.filters.search}%,customer_phone.ilike.%${state.filters.search}%,product_name.ilike.%${state.filters.search}%`);
        } else {
            // Apply granular filters
            // Using eq for ID assuming it might be numeric or UUID. If text, ilike can be used. Will try eq first, or cast to text in DB. 
            // We'll use eq for simplicity. If error, switch to ilike.
            if (state.filters.orderId) query = query.eq('id', state.filters.orderId);
            if (state.filters.customer) query = query.or(`customer_name.ilike.%${state.filters.customer}%,customer_phone.ilike.%${state.filters.customer}%`);
            if (state.filters.product) query = query.ilike('product_name', `%${state.filters.product}%`);
        }

        // Apply Dates
        if (state.filters.dateFrom) query = query.gte('created_at', `${state.filters.dateFrom}T00:00:00Z`);
        if (state.filters.dateTo) query = query.lte('created_at', `${state.filters.dateTo}T23:59:59Z`);

        // Apply Selects
        if (state.filters.payment) query = query.eq('payment_method', state.filters.payment);
        if (state.filters.orderStatus) query = query.eq('order_status', state.filters.orderStatus);
        if (state.filters.deliveryStatus) query = query.eq('delivery_status', state.filters.deliveryStatus);

        // Apply Amounts
        if (state.filters.minAmt) query = query.gte('total_amount', parseFloat(state.filters.minAmt));
        if (state.filters.maxAmt) query = query.lte('total_amount', parseFloat(state.filters.maxAmt));

        // Sorting
        switch (state.sort) {
            case 'newest': query = query.order('created_at', { ascending: false }); break;
            case 'oldest': query = query.order('created_at', { ascending: true }); break;
            case 'highest_amt': query = query.order('total_amount', { ascending: false }); break;
            case 'lowest_amt': query = query.order('total_amount', { ascending: true }); break;
            case 'pending_first': 
                // Advanced sorting requires multiple orders, simplifying:
                query = query.order('order_status', { ascending: false }).order('created_at', { ascending: false });
                break;
            case 'delivered_first': 
                query = query.order('delivery_status', { ascending: true }).order('created_at', { ascending: false });
                break;
            default: query = query.order('created_at', { ascending: false });
        }

        // Pagination
        const from = (state.page - 1) * state.perPage;
        const to = from + state.perPage - 1;
        query = query.range(from, to);

        return query;
    }

    async function fetchOrders() {
        renderTableSkeletons();
        
        try {
            const query = buildQuery();
            const { data, count, error } = await query;
            
            if (error) throw error;

            state.orders = data || [];
            state.totalCount = count || 0;
            
            renderTable();
            updatePagination();
            updateBulkActionsVisibility();

        } catch (error) {
            console.error("Orders Fetch Error:", error);
            notify("Failed to fetch orders.", "error");
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
        for (let i = 0; i < Math.min(state.perPage, 5); i++) {
            els.tableBody.innerHTML += `
                <tr class="skeleton-row">
                    <td><div class="skeleton skeleton-block" style="width: 20px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 60px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 120px;"></div></td>
                    <td><div class="skeleton skeleton-avatar"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 30px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 70px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 90px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 90px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 100px;"></div></td>
                    <td><div class="skeleton skeleton-block" style="width: 80px;"></div></td>
                </tr>
            `;
        }
        if (els.emptyState) els.emptyState.style.display = 'none';
    }

    function renderTable() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = '';
        
        if (els.selectAllCheckbox) els.selectAllCheckbox.checked = false;
        
        if (state.orders.length === 0) {
            if (els.emptyState) els.emptyState.style.display = 'block';
            return;
        }

        if (els.emptyState) els.emptyState.style.display = 'none';

        state.orders.forEach(order => {
            const tr = document.createElement('tr');
            const isChecked = state.selectedIds.has(order.id) ? 'checked' : '';
            const imgUrl = order.product_image || 'https://via.placeholder.com/40';
            
            tr.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-id="${order.id}" ${isChecked}></td>
                <td><strong>#${order.id}</strong></td>
                <td>
                    <div class="customer-cell">
                        <span class="customer-name">${order.customer_name || 'Unknown'}</span>
                        <span class="customer-phone">${order.customer_phone || '-'}</span>
                    </div>
                </td>
                <td>
                    <div class="product-cell">
                        <img src="${imgUrl}" alt="Product" class="product-img">
                        <span class="product-name" title="${order.product_name}">${order.product_name || '-'}</span>
                    </div>
                </td>
                <td>${order.quantity || 1}</td>
                <td><strong>${formatCurrency(order.total_amount)}</strong></td>
                <td><span class="badge ${getPaymentClass(order.payment_method)}">${order.payment_method || 'N/A'}</span></td>
                <td><span class="badge ${getStatusClass(order.order_status)}">${order.order_status || 'Pending'}</span></td>
                <td><span class="badge ${getStatusClass(order.delivery_status)}">${order.delivery_status || 'Pending'}</span></td>
                <td>${formatDate(order.created_at)}</td>
                <td>
                    <div class="row-actions">
                        <button class="act-btn view" data-id="${order.id}" title="View Order"><i class='bx bx-show'></i></button>
                        <button class="act-btn edit" data-id="${order.id}" title="Update Status"><i class='bx bx-edit'></i></button>
                        <button class="act-btn delete" data-id="${order.id}" title="Delete Order"><i class='bx bx-trash'></i></button>
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
                fetchOrders();
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
    // Event Listeners Setup
    // ==========================================
    function attachEventListeners() {
        // Debounced Search Function
        const debounceFetch = () => {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => {
                state.page = 1;
                fetchOrders();
            }, 500);
        };

        // Inputs
        if (els.globalSearch) {
            els.globalSearch.addEventListener('input', (e) => {
                state.filters.search = e.target.value;
                debounceFetch();
            });
        }

        const inputFilters = ['filterOrderId', 'filterCustomer', 'filterProduct', 'filterDateFrom', 'filterDateTo', 'filterMinAmt', 'filterMaxAmt'];
        inputFilters.forEach(id => {
            if (els[id]) els[id].addEventListener('input', (e) => {
                state.filters[id.replace('filter', '').charAt(0).toLowerCase() + id.replace('filter', '').slice(1)] = e.target.value;
                debounceFetch();
            });
        });

        // Selects
        const selectFilters = ['filterPayment', 'filterOrderStatus', 'filterDeliveryStatus'];
        selectFilters.forEach(id => {
            if (els[id]) els[id].addEventListener('change', (e) => {
                state.filters[id.replace('filter', '').charAt(0).toLowerCase() + id.replace('filter', '').slice(1)] = e.target.value;
                state.page = 1;
                fetchOrders();
            });
        });

        if (els.sortSelect) els.sortSelect.addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; fetchOrders(); });
        if (els.perPageSelect) els.perPageSelect.addEventListener('change', (e) => { state.perPage = parseInt(e.target.value, 10); state.page = 1; fetchOrders(); });

        // Reset
        if (els.resetFiltersBtn) {
            els.resetFiltersBtn.addEventListener('click', () => {
                state.filters = { search: '', orderId: '', customer: '', product: '', dateFrom: '', dateTo: '', payment: '', orderStatus: '', deliveryStatus: '', minAmt: '', maxAmt: '' };
                document.querySelectorAll('.filter-input, #globalSearch').forEach(el => el.value = '');
                state.page = 1;
                fetchOrders();
            });
        }

        // Buttons
        if (els.refreshBtn) els.refreshBtn.addEventListener('click', () => { fetchStats(); fetchOrders(); notify('Data refreshed', 'success'); });
        if (els.prevPageBtn) els.prevPageBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchOrders(); } });
        if (els.nextPageBtn) els.nextPageBtn.addEventListener('click', () => { state.page++; fetchOrders(); });
        
        // CSV Export 
        if (els.exportBtn) els.exportBtn.addEventListener('click', exportToCSV);

        // Bulk Selection
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

        // Bulk Buttons
        if (els.bulkDeleteBtn) els.bulkDeleteBtn.addEventListener('click', () => openConfirmModal('bulkDelete'));
        if (els.bulkConfirmBtn) els.bulkConfirmBtn.addEventListener('click', () => processBulkAction({ order_status: 'Confirmed' }, 'Confirmed'));
        if (els.bulkShipBtn) els.bulkShipBtn.addEventListener('click', () => processBulkAction({ delivery_status: 'Shipped' }, 'Shipped'));
        if (els.bulkDeliverBtn) els.bulkDeliverBtn.addEventListener('click', () => processBulkAction({ delivery_status: 'Delivered', order_status: 'Completed' }, 'Delivered'));
        if (els.bulkCancelBtn) els.bulkCancelBtn.addEventListener('click', () => processBulkAction({ order_status: 'Cancelled', delivery_status: 'Cancelled' }, 'Cancelled'));

        // Modals Close
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });

        // Save Update Form
        if (els.saveUpdateBtn) els.saveUpdateBtn.addEventListener('click', saveOrderUpdate);
        
        // Confirm Delete Form
        if (els.confirmDeleteBtn) els.confirmDeleteBtn.addEventListener('click', executeDelete);
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

        document.querySelectorAll('.act-btn.view').forEach(btn => btn.addEventListener('click', (e) => openViewModal(e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.act-btn.edit').forEach(btn => btn.addEventListener('click', (e) => openUpdateModal(e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.act-btn.delete').forEach(btn => btn.addEventListener('click', (e) => openConfirmModal('singleDelete', e.currentTarget.getAttribute('data-id'))));
    }

    // ==========================================
    // Modal & CRUD Operations
    // ==========================================
    function openViewModal(id) {
        const order = state.orders.find(o => String(o.id) === String(id));
        if (!order || !els.viewModal) return;

        if (els.viewOrderId) els.viewOrderId.textContent = `#${order.id}`;
        
        // Customer Info
        if (els.viewCustomerDetails) {
            els.viewCustomerDetails.innerHTML = `
                <div class="detail-row"><span class="detail-label">Name:</span> <strong>${order.customer_name || '-'}</strong></div>
                <div class="detail-row"><span class="detail-label">Phone:</span> <strong>${order.customer_phone || '-'}</strong></div>
                <div class="detail-row"><span class="detail-label">Address:</span> <strong>${order.address || 'No address provided'}</strong></div>
            `;
        }
        
        // Product Info
        if (els.viewProductDetails) {
            els.viewProductDetails.innerHTML = `
                <div style="display:flex; gap:12px; margin-bottom:12px;">
                    <img src="${order.product_image || 'https://via.placeholder.com/60'}" style="width:60px; height:60px; border-radius:8px; object-fit:cover;">
                    <div>
                        <strong>${order.product_name || '-'}</strong><br>
                        <span style="color:var(--text-muted); font-size:12px;">Qty: ${order.quantity || 1}</span>
                    </div>
                </div>
                <div class="detail-row"><span class="detail-label">Amount:</span> <strong>${formatCurrency(order.total_amount)}</strong></div>
            `;
        }

        // Payment Info
        if (els.viewPaymentDetails) {
            els.viewPaymentDetails.innerHTML = `
                <div class="detail-row"><span class="detail-label">Method:</span> <span class="badge ${getPaymentClass(order.payment_method)}">${order.payment_method || 'N/A'}</span></div>
                <div class="detail-row"><span class="detail-label">Total Paid:</span> <strong>${formatCurrency(order.total_amount)}</strong></div>
                <div class="detail-row"><span class="detail-label">Date:</span> <strong>${formatDate(order.created_at)}</strong></div>
            `;
        }

        // Timeline Builder
        if (els.viewTimeline) {
            const os = (order.order_status || '').toLowerCase();
            const ds = (order.delivery_status || '').toLowerCase();
            
            let html = '';
            
            const steps = [
                { label: 'Order Placed (Pending)', active: true },
                { label: 'Order Confirmed', active: os === 'confirmed' || ds === 'packed' || ds === 'shipped' || ds === 'out for delivery' || ds === 'delivered' },
                { label: 'Order Packed', active: ds === 'packed' || ds === 'shipped' || ds === 'out for delivery' || ds === 'delivered' },
                { label: 'Order Shipped', active: ds === 'shipped' || ds === 'out for delivery' || ds === 'delivered', detail: order.tracking_number ? `Tracking: ${order.tracking_number} via ${order.delivery_partner || 'Courier'}` : '' },
                { label: 'Out For Delivery', active: ds === 'out for delivery' || ds === 'delivered' },
                { label: 'Delivered', active: ds === 'delivered' }
            ];

            if (os === 'cancelled' || os === 'refunded') {
                html = `<div class="timeline-item active" style="color:var(--danger);"><strong style="color:var(--danger)">Order Cancelled/Refunded</strong><span class="timeline-date">${formatDate(order.created_at)}</span></div>`;
            } else {
                steps.forEach(step => {
                    if (step.active || !html.includes('Order Cancelled')) { // just simple logic
                        html += `
                            <div class="timeline-item ${step.active ? 'active' : ''}">
                                <strong>${step.label}</strong>
                                ${step.detail ? `<span class="timeline-date">${step.detail}</span>` : ''}
                            </div>
                        `;
                    }
                });
            }
            els.viewTimeline.innerHTML = html;
        }

        els.viewModal.classList.add('active');
    }

    function openUpdateModal(id) {
        const order = state.orders.find(o => String(o.id) === String(id));
        if (!order || !els.updateModal) return;

        if (els.updateOrderForm) els.updateOrderForm.reset();
        
        if (els.updateOrderId) els.updateOrderId.value = order.id;
        if (els.updateOrderStatus) els.updateOrderStatus.value = order.order_status || 'Pending';
        if (els.updateDeliveryStatus) els.updateDeliveryStatus.value = order.delivery_status || 'Pending';
        if (els.updateDeliveryPartner) els.updateDeliveryPartner.value = order.delivery_partner || '';
        if (els.updateTrackingNumber) els.updateTrackingNumber.value = order.tracking_number || '';
        if (els.updateExpectedDate) els.updateExpectedDate.value = order.expected_delivery ? order.expected_delivery.split('T')[0] : '';

        els.updateModal.classList.add('active');
    }

    async function saveOrderUpdate(e) {
        e.preventDefault();
        const id = els.updateOrderId ? els.updateOrderId.value : null;
        if (!id) return;

        const payload = {
            order_status: els.updateOrderStatus.value,
            delivery_status: els.updateDeliveryStatus.value,
            delivery_partner: els.updateDeliveryPartner.value,
            tracking_number: els.updateTrackingNumber.value,
            expected_delivery: els.updateExpectedDate.value ? `${els.updateExpectedDate.value}T00:00:00Z` : null
        };

        try {
            if (els.saveUpdateBtn) {
                els.saveUpdateBtn.disabled = true;
                els.saveUpdateBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving...";
            }

            const { error } = await supabaseClient.from('orders').update(payload).eq('id', id);
            if (error) throw error;

            notify('Order updated successfully', 'success');
            if (els.updateModal) els.updateModal.classList.remove('active');
            
            await fetchStats();
            await fetchOrders();

        } catch (error) {
            console.error("Update Error:", error);
            notify(`Error: ${error.message}`, 'error');
        } finally {
            if (els.saveUpdateBtn) {
                els.saveUpdateBtn.disabled = false;
                els.saveUpdateBtn.innerHTML = "Save Changes";
            }
        }
    }

    function openConfirmModal(actionType, id = null) {
        state.actionContext = { type: actionType, id: id };
        
        if (els.deleteModal) {
            const text = actionType === 'bulkDelete' 
                ? `Are you sure you want to delete ${state.selectedIds.size} selected orders?`
                : 'Are you sure you want to delete this order?';
            
            const p = document.getElementById('deleteConfirmText');
            if (p) p.textContent = `${text} This action cannot be undone.`;
            
            els.deleteModal.classList.add('active');
        }
    }

    async function executeDelete() {
        if (!state.actionContext) return;
        const { type, id } = state.actionContext;

        try {
            if (els.confirmDeleteBtn) {
                els.confirmDeleteBtn.disabled = true;
                els.confirmDeleteBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Deleting...";
            }

            if (type === 'singleDelete' && id) {
                const { error } = await supabaseClient.from('orders').delete().eq('id', id);
                if (error) throw error;
                notify("Order deleted successfully", "success");
            } else if (type === 'bulkDelete') {
                const idsArray = Array.from(state.selectedIds);
                const { error } = await supabaseClient.from('orders').delete().in('id', idsArray);
                if (error) throw error;
                notify(`${idsArray.length} orders deleted`, "success");
                state.selectedIds.clear();
            }

            if (els.deleteModal) els.deleteModal.classList.remove('active');
            await fetchStats();
            await fetchOrders();

        } catch (error) {
            console.error("Delete Error:", error);
            notify(`Error: ${error.message}`, "error");
        } finally {
            if (els.confirmDeleteBtn) {
                els.confirmDeleteBtn.disabled = false;
                els.confirmDeleteBtn.innerHTML = "Delete";
            }
            state.actionContext = null;
        }
    }

    async function processBulkAction(payload, actionName) {
        if (state.selectedIds.size === 0) return;
        const idsArray = Array.from(state.selectedIds);

        try {
            const { error } = await supabaseClient.from('orders').update(payload).in('id', idsArray);
            if (error) throw error;

            notify(`Successfully marked ${idsArray.length} orders as ${actionName}`, "success");
            state.selectedIds.clear();
            
            await fetchStats();
            await fetchOrders();
        } catch (error) {
            console.error("Bulk Action Error:", error);
            notify(`Error: ${error.message}`, "error");
        }
    }
    // ==========================================
    // Extras
    // ==========================================
    function exportToCSV() {
        if (!state.orders || state.orders.length === 0) {
            notify("No data to export.", "warning");
            return;
        }
        
        const headers = ['Order ID', 'Customer Name', 'Customer Phone', 'Product', 'Quantity', 'Amount', 'Payment Method', 'Order Status', 'Delivery Status', 'Date'];
        const csvRows = [headers.join(',')];

        state.orders.forEach(o => {
            const row = [
                o.id,
                `"${o.customer_name || ''}"`,
                `"${o.customer_phone || ''}"`,
                `"${o.product_name || ''}"`,
                o.quantity || 1,
                o.total_amount || 0,
                o.payment_method || '',
                o.order_status || '',
                o.delivery_status || '',
                o.created_at || ''
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', `orders_export_${Date.now()}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        notify("Export downloaded successfully.", "success");
    }

    // Run
    document.addEventListener('DOMContentLoaded', init);

})();