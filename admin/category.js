/* category.js */

(function () {
    'use strict';

    // ==========================================
    // Constants & State Configuration
    // ==========================================
    const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
    const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
    
    // Renamed to supabaseClient and isolated inside this function to prevent redeclaration errors
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const state = {
        banners: [],
        filteredBanners: [],
        currentPage: 1,
        itemsPerPage: 10,
        searchQuery: "",
        editingId: null,
        deleteId: null
    };

    // ==========================================
    // DOM Elements Setup
    // ==========================================
    const els = {
        // Top Info
        currentDate: document.getElementById('current-date'),
        statTotalBanners: document.getElementById('stat-total-banners'),
        
        // Inputs & Buttons
        globalSearch: document.getElementById('global-search'),
        refreshBtn: document.getElementById('refresh-btn'),
        addBannerBtn: document.getElementById('add-banner-btn'),
        
        // Table Area
        tableBody: document.getElementById('banner-table-body'),
        paginationInfo: document.getElementById('pagination-info'),
        paginationControls: document.getElementById('pagination-controls'),
        
        // Modals
        bannerModal: document.getElementById('banner-modal'),
        modalTitle: document.getElementById('modal-title'),
        bannerForm: document.getElementById('banner-form'),
        bannerUrlInput: document.getElementById('banner-url-input'),
        formPreviewContainer: document.getElementById('form-preview-container'),
        formImagePreview: document.getElementById('form-image-preview'),
        saveBannerBtn: document.getElementById('save-banner-btn'),
        
        deleteModal: document.getElementById('delete-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
        
        previewModal: document.getElementById('preview-modal'),
        fullPreviewImage: document.getElementById('full-preview-image'),
        
        // Global Elements
        sidebar: document.getElementById('sidebar')
    };

    // ==========================================
    // Utilities
    // ==========================================
    const formatDate = (dateStr) => {
        if (!dateStr) return 'N/A';
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }).format(new Date(dateStr));
    };

    // Custom Premium Toast
    const showCustomToast = (title, message, type = 'success') => {
        if (typeof window.showPopup === 'function') {
            window.showPopup(message, type);
            return;
        }
        
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
        
        toast.innerHTML = `
            <i data-feather="${iconName}" class="toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-msg">${message}</div>
            </div>
        `;
        
        container.appendChild(toast);
        if (typeof feather !== 'undefined') feather.replace();

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    };

    const setBtnLoading = (btn, isLoading, text) => {
        if (isLoading) {
            btn.dataset.original = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<i data-feather="loader" style="animation: spin 1s linear infinite;"></i> Processing...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.original || text;
        }
        if (typeof feather !== 'undefined') feather.replace();
    };

    const closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        state.editingId = null;
        state.deleteId = null;
        if (els.bannerForm) els.bannerForm.reset();
        if (els.formPreviewContainer) els.formPreviewContainer.classList.remove('active');
        if (els.formImagePreview) els.formImagePreview.src = '';
    };

    // ==========================================
    // Data Fetching & Processing
    // ==========================================
    async function fetchBanners() {
        renderSkeletons();
        
        try {
            const { data, error } = await supabaseClient
                .from('banner')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            state.banners = data || [];
            applyFiltersAndRender();
            updateStats();
        } catch (error) {
            console.error("Fetch Error:", error);
            showCustomToast('Error', 'Failed to load banners.', 'error');
            if (els.tableBody) els.tableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i data-feather="alert-triangle"></i><p>Failed to load data.</p></div></td></tr>`;
            if (typeof feather !== 'undefined') feather.replace();
        }
    }

    function updateStats() {
        if (els.statTotalBanners) els.statTotalBanners.textContent = state.banners.length;
    }

    function applyFiltersAndRender() {
        const query = state.searchQuery.toLowerCase();
        
        state.filteredBanners = state.banners.filter(banner => {
            const idMatch = String(banner.id).toLowerCase().includes(query);
            const urlMatch = (banner.banner_url || '').toLowerCase().includes(query);
            return idMatch || urlMatch;
        });

        state.currentPage = 1;
        renderTable();
    }

    // ==========================================
    // Rendering
    // ==========================================
    function renderSkeletons() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = Array(3).fill(`
            <tr class="skeleton-row">
                <td><div class="skeleton sk-avatar"></div></td>
                <td><div class="skeleton sk-text short"></div></td>
                <td><div class="skeleton sk-text short"></div></td>
                <td><div class="skeleton sk-text"></div></td>
                <td><div class="skeleton sk-text short"></div></td>
            </tr>
        `).join('');
    }

    function getEmptyState() {
        return `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="empty-icon-wrapper">
                            <i data-feather="image"></i>
                        </div>
                        <h3>No Banners Found</h3>
                        <p>There are currently no banners to display. Add a new banner to get started.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderTable() {
        if (!els.tableBody) return;
        
        if (state.filteredBanners.length === 0) {
            els.tableBody.innerHTML = getEmptyState();
            if (els.paginationInfo) els.paginationInfo.textContent = 'Showing 0-0 of 0';
            if (els.paginationControls) els.paginationControls.innerHTML = '';
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }

        const startIdx = (state.currentPage - 1) * state.itemsPerPage;
        const endIdx = startIdx + state.itemsPerPage;
        const currentData = state.filteredBanners.slice(startIdx, endIdx);

        els.tableBody.innerHTML = currentData.map(banner => `
            <tr>
                <td>
                    <img src="${banner.banner_url}" class="banner-thumbnail" alt="Banner" 
                         onclick="openPreviewModal('${banner.banner_url}')"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI0MCIgZmlsbD0iI2U1ZTdlYiI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQwIi8+PC9zdmc+'">
                </td>
                <td style="font-family: monospace; font-size: 13px;">${banner.id}</td>
                <td style="color: var(--text-secondary); font-size: 13px;">${formatDate(banner.created_at)}</td>
                <td>
                    <div class="url-cell" title="${banner.banner_url}">
                        ${banner.banner_url}
                    </div>
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-outline" style="padding: 6px 10px;" onclick="openEditModal('${banner.id}')" title="Edit">
                            <i data-feather="edit-2" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button class="btn btn-reject" style="padding: 6px 10px;" onclick="openDeleteModal('${banner.id}')" title="Delete">
                            <i data-feather="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        renderPagination();
        if (typeof feather !== 'undefined') feather.replace();
    }

    function renderPagination() {
        if (!els.paginationControls || !els.paginationInfo) return;
        
        const totalItems = state.filteredBanners.length;
        const totalPages = Math.ceil(totalItems / state.itemsPerPage);
        const startItem = totalItems === 0 ? 0 : ((state.currentPage - 1) * state.itemsPerPage) + 1;
        const endItem = Math.min(state.currentPage * state.itemsPerPage, totalItems);

        els.paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems}`;

        let html = `
            <button class="page-btn" ${state.currentPage === 1 ? 'disabled' : ''} onclick="changePage(${state.currentPage - 1})">
                <i data-feather="chevron-left"></i>
            </button>
        `;

        let startPage = Math.max(1, state.currentPage - 1);
        let endPage = Math.min(totalPages, startPage + 2);
        if (endPage - startPage < 2) startPage = Math.max(1, endPage - 2);

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
        }

        html += `
            <button class="page-btn" ${state.currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} onclick="changePage(${state.currentPage + 1})">
                <i data-feather="chevron-right"></i>
            </button>
        `;

        els.paginationControls.innerHTML = html;
        if (typeof feather !== 'undefined') feather.replace();
    }

    // Exported globally so onclick attributes in HTML still work
    window.changePage = (page) => {
        state.currentPage = page;
        renderTable();
    };

    // ==========================================
    // Modal Handlers & Actions
    // ==========================================
    window.openPreviewModal = (url) => {
        if (els.fullPreviewImage) els.fullPreviewImage.src = url;
        if (els.previewModal) els.previewModal.classList.add('active');
    };

    window.openDeleteModal = (id) => {
        state.deleteId = id;
        if (els.deleteModal) els.deleteModal.classList.add('active');
    };

    window.openEditModal = (id) => {
        const banner = state.banners.find(b => String(b.id) === String(id));
        if (!banner) return;
        
        state.editingId = id;
        if (els.modalTitle) els.modalTitle.textContent = 'Edit Banner';
        if (els.bannerUrlInput) els.bannerUrlInput.value = banner.banner_url;
        
        if (els.formImagePreview) els.formImagePreview.src = banner.banner_url;
        if (els.formPreviewContainer) els.formPreviewContainer.classList.add('active');
        
        if (els.bannerModal) els.bannerModal.classList.add('active');
    };

    const handleSaveBanner = async (e) => {
        e.preventDefault();
        if (els.bannerForm && !els.bannerForm.checkValidity()) {
            els.bannerForm.reportValidity();
            return;
        }

        const url = els.bannerUrlInput.value.trim();
        setBtnLoading(els.saveBannerBtn, true);

        try {
            if (state.editingId) {
                // Edit
                const { error } = await supabaseClient
                    .from('banner')
                    .update({ banner_url: url })
                    .eq('id', state.editingId);
                
                if (error) throw error;
                showCustomToast('Success', 'Banner updated successfully.');
            } else {
                // Add
                const { error } = await supabaseClient
                    .from('banner')
                    .insert([{ banner_url: url }]);
                
                if (error) throw error;
                showCustomToast('Success', 'New banner added successfully.');
            }
            
            closeAllModals();
            await fetchBanners();
        } catch (error) {
            console.error("Save Error:", error);
            showCustomToast('Action Failed', error.message || 'Could not save banner.', 'error');
        } finally {
            setBtnLoading(els.saveBannerBtn, false, 'Save Banner');
        }
    };

    const handleDeleteBanner = async () => {
        if (!state.deleteId) return;
        
        setBtnLoading(els.confirmDeleteBtn, true);
        
        try {
            const { error } = await supabaseClient
                .from('banner')
                .delete()
                .eq('id', state.deleteId);
                
            if (error) throw error;
            
            showCustomToast('Success', 'Banner deleted successfully.');
            closeAllModals();
            await fetchBanners();
        } catch (error) {
            console.error("Delete Error:", error);
            showCustomToast('Action Failed', error.message || 'Could not delete banner.', 'error');
        } finally {
            setBtnLoading(els.confirmDeleteBtn, false, 'Delete');
        }
    };

    // ==========================================
    // Event Listeners Configuration
    // ==========================================
    function setupEventListeners() {
        // Header setup
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if (els.currentDate) els.currentDate.textContent = new Date().toLocaleDateString('en-US', dateOptions);

        // Search
        let debounceTimer;
        if (els.globalSearch) {
            els.globalSearch.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                state.searchQuery = e.target.value.trim();
                debounceTimer = setTimeout(applyFiltersAndRender, 300);
            });
        }

        // Top Actions
        if (els.refreshBtn) {
            els.refreshBtn.addEventListener('click', () => {
                fetchBanners();
                showCustomToast('Refreshed', 'Data synced with database.', 'success');
            });
        }
        
        if (els.addBannerBtn) {
            els.addBannerBtn.addEventListener('click', () => {
                if (els.modalTitle) els.modalTitle.textContent = 'Add Banner';
                if (els.bannerModal) els.bannerModal.classList.add('active');
            });
        }

        // Form Image Preview Handler
        if (els.bannerUrlInput) {
            els.bannerUrlInput.addEventListener('input', (e) => {
                const url = e.target.value.trim();
                if (url) {
                    if (els.formImagePreview) els.formImagePreview.src = url;
                    if (els.formPreviewContainer) els.formPreviewContainer.classList.add('active');
                } else {
                    if (els.formPreviewContainer) els.formPreviewContainer.classList.remove('active');
                }
            });
        }

        // Form submission
        if (els.saveBannerBtn) els.saveBannerBtn.addEventListener('click', handleSaveBanner);
        if (els.confirmDeleteBtn) els.confirmDeleteBtn.addEventListener('click', handleDeleteBanner);

        // Modals generic close setup
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });
        
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAllModals();
            });
        });

        // Mobile Sidebar
        window.toggleSidebar = () => {
            if (els.sidebar) els.sidebar.classList.toggle('open');
        };
        
        // Custom inject spinning CSS
        const style = document.createElement('style');
        style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    // ==========================================
    // Initialization
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof feather !== 'undefined') feather.replace();
        setupEventListeners();
        fetchBanners();
    });

})();
