// products.js
(function () {
    'use strict';

    // ==========================================
    // Configuration & Initialization
    // ==========================================
    const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
    const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";

    if (!window.supabase) {
        console.error("Supabase library not loaded.");
        return;
    }

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Ensure safe popup calls
    const notify = (msg, type) => {
        if (typeof window.showPopup === 'function') {
            window.showPopup(msg, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
        }
    };

    // ==========================================
    // State Management
    // ==========================================
    const state = {
        products: [],
        totalCount: 0,
        page: 1,
        perPage: 10,
        filters: {
            name: '',
            slug: '',
            category: '',
            brand: '',
            status: '',
            featured: '',
            stock: '',
            priceMin: '',
            priceMax: ''
        },
        sort: 'newest',
        selectedIds: new Set(),
        debounceTimer: null,
        actionContext: null // Stores info for confirm modal (e.g. { type: 'delete', id: '123' })
    };

    // ==========================================
    // DOM Elements Caching
    // ==========================================
    const els = {
        // Stats
        statTotal: document.getElementById('statTotal'),
        statActive: document.getElementById('statActive'),
        statFeatured: document.getElementById('statFeatured'),
        statOutOfStock: document.getElementById('statOutOfStock'),
        statLowStock: document.getElementById('statLowStock'),
        liveProductCount: document.getElementById('liveProductCount'),
        
        // Buttons & Headers
        refreshBtn: document.getElementById('refreshBtn'),
        addProductBtn: document.getElementById('addProductBtn'),
        
        // Filters
        searchName: document.getElementById('searchName'),
        searchSlug: document.getElementById('searchSlug'),
        filterCategory: document.getElementById('filterCategory'),
        filterBrand: document.getElementById('filterBrand'),
        filterStatus: document.getElementById('filterStatus'),
        filterFeatured: document.getElementById('filterFeatured'),
        filterStock: document.getElementById('filterStock'),
        filterPriceMin: document.getElementById('filterPriceMin'),
        filterPriceMax: document.getElementById('filterPriceMax'),
        resetFiltersBtn: document.getElementById('resetFiltersBtn'),
        sortSelect: document.getElementById('sortSelect'),
        perPageSelect: document.getElementById('perPageSelect'),
        
        // Table & Bulk
        tableBody: document.getElementById('productsTableBody'),
        emptyState: document.getElementById('emptyState'),
        selectAllCheckbox: document.getElementById('selectAllCheckbox'),
        bulkActions: document.getElementById('bulkActions'),
        selectedCount: document.getElementById('selectedCount'),
        
        bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
        bulkActivateBtn: document.getElementById('bulkActivateBtn'),
        bulkDeactivateBtn: document.getElementById('bulkDeactivateBtn'),
        bulkFeatureBtn: document.getElementById('bulkFeatureBtn'),
        bulkUnfeatureBtn: document.getElementById('bulkUnfeatureBtn'),
        
        // Pagination
        prevPageBtn: document.getElementById('prevPageBtn'),
        nextPageBtn: document.getElementById('nextPageBtn'),
        pageNumbers: document.getElementById('pageNumbers'),
        
        // Modals
        productModal: document.getElementById('productModal'),
        viewModal: document.getElementById('viewModal'),
        imageModal: document.getElementById('imageModal'),
        confirmModal: document.getElementById('confirmModal'),
        
        // Product Form
        productForm: document.getElementById('productForm'),
        modalTitle: document.getElementById('modalTitle'),
        formProductId: document.getElementById('formProductId'),
        formName: document.getElementById('formName'),
        formSlug: document.getElementById('formSlug'),
        formDescription: document.getElementById('formDescription'),
        formPrice: document.getElementById('formPrice'),
        formOldPrice: document.getElementById('formOldPrice'),
        formDiscount: document.getElementById('formDiscount'),
        formBrand: document.getElementById('formBrand'),
        formCategory: document.getElementById('formCategory'),
        formStock: document.getElementById('formStock'),
        formRating: document.getElementById('formRating'),
        formThumbnail: document.getElementById('formThumbnail'),
        formStatus: document.getElementById('formStatus'),
        formFeatured: document.getElementById('formFeatured'),
        saveProductBtn: document.getElementById('saveProductBtn'),
        
        // Others
        viewModalBody: document.getElementById('viewModalBody'),
        previewImage: document.getElementById('previewImage'),
        confirmTitle: document.getElementById('confirmTitle'),
        confirmMessage: document.getElementById('confirmMessage'),
        executeConfirmBtn: document.getElementById('executeConfirmBtn')
    };

    // ==========================================
    // Initialization
    // ==========================================
    async function init() {
        attachEventListeners();
        await loadFilterOptions();
        await fetchStats();
        await fetchProducts();
    }

    // ==========================================
    // Core Data Fetching
    // ==========================================
    async function fetchStats() {
        try {
            const queries = [
                supabaseClient.from('products').select('*', { count: 'exact', head: true }),
                supabaseClient.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
                supabaseClient.from('products').select('*', { count: 'exact', head: true }).eq('featured', true),
                supabaseClient.from('products').select('*', { count: 'exact', head: true }).eq('stock', 0),
                supabaseClient.from('products').select('*', { count: 'exact', head: true }).gt('stock', 0).lte('stock', 5)
            ];

            const results = await Promise.all(queries);
            
            // Checking for errors in promises
            for(let res of results) {
                if (res.error) throw res.error;
            }

            const total = results[0].count || 0;
            
            if (els.statTotal) { els.statTotal.textContent = total; els.statTotal.classList.remove('skeleton-text'); }
            if (els.liveProductCount) els.liveProductCount.textContent = total;
            if (els.statActive) { els.statActive.textContent = results[1].count || 0; els.statActive.classList.remove('skeleton-text'); }
            if (els.statFeatured) { els.statFeatured.textContent = results[2].count || 0; els.statFeatured.classList.remove('skeleton-text'); }
            if (els.statOutOfStock) { els.statOutOfStock.textContent = results[3].count || 0; els.statOutOfStock.classList.remove('skeleton-text'); }
            if (els.statLowStock) { els.statLowStock.textContent = results[4].count || 0; els.statLowStock.classList.remove('skeleton-text'); }

        } catch (error) {
            console.error("Stats Fetch Error:", error);
            notify("Failed to load statistics.", "error");
        }
    }

    async function loadFilterOptions() {
        try {
            const { data, error } = await supabaseClient.from('products').select('category, brand');
            if (error) throw error;

            const categories = [...new Set(data.map(item => item.category).filter(Boolean))].sort();
            const brands = [...new Set(data.map(item => item.brand).filter(Boolean))].sort();

            if (els.filterCategory) {
                categories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat;
                    opt.textContent = cat;
                    els.filterCategory.appendChild(opt);
                });
            }

            if (els.filterBrand) {
                brands.forEach(brand => {
                    const opt = document.createElement('option');
                    opt.value = brand;
                    opt.textContent = brand;
                    els.filterBrand.appendChild(opt);
                });
            }
        } catch (error) {
            console.error("Filter Options Error:", error);
        }
    }

    function buildQuery() {
        let query = supabaseClient.from('products').select('*', { count: 'exact' });

        // Apply Filters
        if (state.filters.name) query = query.ilike('name', `%${state.filters.name}%`);
        if (state.filters.slug) query = query.ilike('slug', `%${state.filters.slug}%`);
        if (state.filters.category) query = query.eq('category', state.filters.category);
        if (state.filters.brand) query = query.eq('brand', state.filters.brand);
        if (state.filters.status) query = query.eq('status', state.filters.status);
        if (state.filters.featured === 'true') query = query.eq('featured', true);
        if (state.filters.featured === 'false') query = query.eq('featured', false);
        if (state.filters.priceMin) query = query.gte('price', state.filters.priceMin);
        if (state.filters.priceMax) query = query.lte('price', state.filters.priceMax);

        if (state.filters.stock === 'in_stock') query = query.gt('stock', 0);
        if (state.filters.stock === 'out_of_stock') query = query.eq('stock', 0);
        if (state.filters.stock === 'low_stock') query = query.gt('stock', 0).lte('stock', 5);

        // Apply Sorting
        switch (state.sort) {
            case 'newest': query = query.order('created_at', { ascending: false }); break;
            case 'oldest': query = query.order('created_at', { ascending: true }); break;
            case 'price_asc': query = query.order('price', { ascending: true }); break;
            case 'price_desc': query = query.order('price', { ascending: false }); break;
            case 'rating_desc': query = query.order('rating', { ascending: false }); break;
            case 'stock_asc': query = query.order('stock', { ascending: true }); break;
            default: query = query.order('created_at', { ascending: false });
        }

        // Apply Pagination
        const from = (state.page - 1) * state.perPage;
        const to = from + state.perPage - 1;
        query = query.range(from, to);

        return query;
    }

    async function fetchProducts() {
        renderTableSkeletons();
        
        try {
            const query = buildQuery();
            const { data, count, error } = await query;
            
            if (error) throw error;

            state.products = data || [];
            state.totalCount = count || 0;
            
            renderTable();
            updatePagination();
            updateBulkActionsVisibility();

        } catch (error) {
            console.error("Products Fetch Error:", error);
            notify("Failed to fetch products.", "error");
            if (els.tableBody) els.tableBody.innerHTML = '';
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
                    <td><div class="skeleton skeleton-img"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                    <td><div class="skeleton skeleton-block"></div></td>
                </tr>
            `;
        }
        if (els.emptyState) els.emptyState.style.display = 'none';
    }

    function renderTable() {
        if (!els.tableBody) return;
        els.tableBody.innerHTML = '';
        
        if (els.selectAllCheckbox) els.selectAllCheckbox.checked = false;
        
        if (state.products.length === 0) {
            if (els.emptyState) els.emptyState.style.display = 'block';
            return;
        }

        if (els.emptyState) els.emptyState.style.display = 'none';

        state.products.forEach(product => {
            const tr = document.createElement('tr');
            
            const isChecked = state.selectedIds.has(product.id) ? 'checked' : '';
            
            const thumbUrl = product.thumbnail || 'https://via.placeholder.com/40';
            const statusClass = `status-${(product.status || 'draft').toLowerCase()}`;
            const isFeatured = product.featured ? `<i class='bx bxs-star featured-badge'></i>` : `<i class='bx bx-star unfeatured-badge'></i>`;
            
            const formattedDate = product.created_at ? new Date(product.created_at).toLocaleDateString() : '-';
            
            tr.innerHTML = `
                <td><input type="checkbox" class="row-checkbox" data-id="${product.id}" ${isChecked}></td>
                <td><img src="${thumbUrl}" alt="Thumb" class="thumb-img" data-src="${thumbUrl}" loading="lazy"></td>
                <td>${product.id || '-'}</td>
                <td title="${product.name}"><strong>${truncateText(product.name, 20)}</strong></td>
                <td title="${product.slug}">${truncateText(product.slug, 15)}</td>
                <td>${product.category || '-'}</td>
                <td>${product.brand || '-'}</td>
                <td>$${Number(product.price).toFixed(2)}</td>
                <td>${product.old_price ? '$'+Number(product.old_price).toFixed(2) : '-'}</td>
                <td>${product.discount ? product.discount+'%' : '-'}</td>
                <td>${product.stock}</td>
                <td>${product.rating || '-'}</td>
                <td><span class="status-badge ${statusClass}">${product.status || 'Draft'}</span></td>
                <td>${isFeatured}</td>
                <td>${formattedDate}</td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn btn-view" data-id="${product.id}" title="Quick View"><i class='bx bx-show'></i></button>
                        <button class="icon-btn btn-edit" data-id="${product.id}" title="Edit"><i class='bx bx-edit'></i></button>
                        <button class="icon-btn btn-duplicate" data-id="${product.id}" title="Duplicate"><i class='bx bx-copy'></i></button>
                        <button class="icon-btn delete btn-delete" data-id="${product.id}" title="Delete"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            els.tableBody.appendChild(tr);
        });

        attachRowEventListeners();
    }

    function truncateText(text, length) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    function updatePagination() {
        if (!els.pageNumbers || !els.prevPageBtn || !els.nextPageBtn) return;
        
        const totalPages = Math.ceil(state.totalCount / state.perPage) || 1;
        
        els.prevPageBtn.disabled = state.page <= 1;
        els.nextPageBtn.disabled = state.page >= totalPages;
        
        els.pageNumbers.innerHTML = '';
        
        let startPage = Math.max(1, state.page - 2);
        let endPage = Math.min(totalPages, startPage + 4);
        
        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${i === state.page ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                state.page = i;
                fetchProducts();
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
        // Debounced search
        const debounceSearch = () => {
            clearTimeout(state.debounceTimer);
            state.debounceTimer = setTimeout(() => {
                state.page = 1;
                fetchProducts();
            }, 500);
        };

        if (els.searchName) {
            els.searchName.addEventListener('input', (e) => {
                state.filters.name = e.target.value;
                debounceSearch();
            });
        }

        if (els.searchSlug) {
            els.searchSlug.addEventListener('input', (e) => {
                state.filters.slug = e.target.value;
                debounceSearch();
            });
        }

        // Dropdown filters
        const dropdowns = ['filterCategory', 'filterBrand', 'filterStatus', 'filterFeatured', 'filterStock'];
        dropdowns.forEach(id => {
            if (els[id]) {
                els[id].addEventListener('change', (e) => {
                    const filterKey = id.replace('filter', '');
                    const keyStr = filterKey.charAt(0).toLowerCase() + filterKey.slice(1);
                    state.filters[keyStr] = e.target.value;
                    state.page = 1;
                    fetchProducts();
                });
            }
        });

        // Price filters
        if (els.filterPriceMin) {
            els.filterPriceMin.addEventListener('change', (e) => {
                state.filters.priceMin = e.target.value;
                state.page = 1;
                fetchProducts();
            });
        }
        if (els.filterPriceMax) {
            els.filterPriceMax.addEventListener('change', (e) => {
                state.filters.priceMax = e.target.value;
                state.page = 1;
                fetchProducts();
            });
        }
        // Reset
        if (els.resetFiltersBtn) {
            els.resetFiltersBtn.addEventListener('click', () => {
                state.filters = { name: '', slug: '', category: '', brand: '', status: '', featured: '', stock: '', priceMin: '', priceMax: '' };
                document.querySelectorAll('.filter-bar input, .filter-bar select').forEach(el => el.value = '');
                state.page = 1;
                fetchProducts();
            });
        }

        // Sorting & Pagination settings
        if (els.sortSelect) {
            els.sortSelect.addEventListener('change', (e) => {
                state.sort = e.target.value;
                state.page = 1;
                fetchProducts();
            });
        }

        if (els.perPageSelect) {
            els.perPageSelect.addEventListener('change', (e) => {
                state.perPage = parseInt(e.target.value, 10);
                state.page = 1;
                fetchProducts();
            });
        }

        if (els.prevPageBtn) els.prevPageBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; fetchProducts(); } });
        if (els.nextPageBtn) els.nextPageBtn.addEventListener('click', () => { state.page++; fetchProducts(); });
        
        if (els.refreshBtn) els.refreshBtn.addEventListener('click', () => { fetchStats(); fetchProducts(); });
        if (els.addProductBtn) els.addProductBtn.addEventListener('click', openAddModal);

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

        // Bulk Action Buttons
        if (els.bulkDeleteBtn) els.bulkDeleteBtn.addEventListener('click', () => requestConfirm('bulkDelete', 'Delete Selected Products', 'Are you sure you want to delete the selected products?'));
        if (els.bulkActivateBtn) els.bulkActivateBtn.addEventListener('click', () => processBulkAction('activate'));
        if (els.bulkDeactivateBtn) els.bulkDeactivateBtn.addEventListener('click', () => processBulkAction('deactivate'));
        if (els.bulkFeatureBtn) els.bulkFeatureBtn.addEventListener('click', () => processBulkAction('feature'));
        if (els.bulkUnfeatureBtn) els.bulkUnfeatureBtn.addEventListener('click', () => processBulkAction('unfeature'));

        // Modals Close handlers
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = e.target.closest('.modal-overlay');
                if (overlay) overlay.classList.remove('active');
            });
        });

        // Form Submission
        if (els.saveProductBtn) {
            els.saveProductBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (els.productForm && els.productForm.checkValidity()) {
                    await saveProduct();
                } else {
                    if (els.productForm) els.productForm.reportValidity();
                }
            });
        }

        // Confirm Modal execution
        if (els.executeConfirmBtn) {
            els.executeConfirmBtn.addEventListener('click', executeConfirmAction);
        }
    }

    function attachRowEventListeners() {
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.getAttribute('data-id');
                if (e.target.checked) state.selectedIds.add(id);
                else state.selectedIds.delete(id);
                updateBulkActionsVisibility();
                
                // Update selectAll state
                if (els.selectAllCheckbox && document.querySelectorAll('.row-checkbox:not(:checked)').length === 0) {
                    els.selectAllCheckbox.checked = true;
                } else if (els.selectAllCheckbox) {
                    els.selectAllCheckbox.checked = false;
                }
            });
        });

        document.querySelectorAll('.thumb-img').forEach(img => {
            img.addEventListener('click', (e) => {
                const src = e.target.getAttribute('data-src');
                if (els.previewImage) els.previewImage.src = src;
                if (els.imageModal) els.imageModal.classList.add('active');
            });
        });

        document.querySelectorAll('.btn-view').forEach(btn => btn.addEventListener('click', (e) => quickViewProduct(e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => openEditModal(e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.btn-duplicate').forEach(btn => btn.addEventListener('click', (e) => requestConfirm('duplicate', 'Duplicate Product', 'Are you sure you want to duplicate this product?', e.currentTarget.getAttribute('data-id'))));
        document.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', (e) => requestConfirm('delete', 'Delete Product', 'Are you sure you want to delete this product?', e.currentTarget.getAttribute('data-id'))));
    }

    // ==========================================
    // CRUD Operations
    // ==========================================
    function openAddModal() {
        if (els.productForm) els.productForm.reset();
        if (els.formProductId) els.formProductId.value = '';
        if (els.modalTitle) els.modalTitle.textContent = 'Add Product';
        if (els.productModal) els.productModal.classList.add('active');
    }

    function openEditModal(id) {
        const product = state.products.find(p => String(p.id) === String(id));
        if (!product) return;

        if (els.formProductId) els.formProductId.value = product.id;
        if (els.formName) els.formName.value = product.name || '';
        if (els.formSlug) els.formSlug.value = product.slug || '';
        if (els.formDescription) els.formDescription.value = product.description || '';
        if (els.formPrice) els.formPrice.value = product.price || 0;
        if (els.formOldPrice) els.formOldPrice.value = product.old_price || '';
        if (els.formDiscount) els.formDiscount.value = product.discount || '';
        if (els.formBrand) els.formBrand.value = product.brand || '';
        if (els.formCategory) els.formCategory.value = product.category || '';
        if (els.formStock) els.formStock.value = product.stock || 0;
        if (els.formRating) els.formRating.value = product.rating || '';
        if (els.formThumbnail) els.formThumbnail.value = product.thumbnail || '';
        if (els.formStatus) els.formStatus.value = product.status || 'draft';
        if (els.formFeatured) els.formFeatured.checked = product.featured || false;

        if (els.modalTitle) els.modalTitle.textContent = 'Edit Product';
        if (els.productModal) els.productModal.classList.add('active');
    }

    async function saveProduct() {
        const id = els.formProductId ? els.formProductId.value : '';
        
        const payload = {
            name: els.formName.value,
            slug: els.formSlug.value,
            description: els.formDescription.value,
            price: parseFloat(els.formPrice.value) || 0,
            old_price: parseFloat(els.formOldPrice.value) || null,
            discount: parseFloat(els.formDiscount.value) || null,
            brand: els.formBrand.value,
            category: els.formCategory.value,
            stock: parseInt(els.formStock.value, 10) || 0,
            rating: parseFloat(els.formRating.value) || null,
            thumbnail: els.formThumbnail.value,
            status: els.formStatus.value,
            featured: els.formFeatured.checked
        };

        try {
            if (els.saveProductBtn) {
                els.saveProductBtn.disabled = true;
                els.saveProductBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Saving...";
            }

            if (id) {
                const { error } = await supabaseClient.from('products').update(payload).eq('id', id);
                if (error) throw error;
                notify('Product updated successfully', 'success');
            } else {
                const { error } = await supabaseClient.from('products').insert([payload]);
                if (error) throw error;
                notify('Product added successfully', 'success');
            }

            if (els.productModal) els.productModal.classList.remove('active');
            await fetchStats();
            await fetchProducts();

        } catch (error) {
            console.error("Save Error:", error);
            notify(`Error: ${error.message}`, 'error');
        } finally {
            if (els.saveProductBtn) {
                els.saveProductBtn.disabled = false;
                els.saveProductBtn.innerHTML = "Save Product";
            }
        }
    }

    function quickViewProduct(id) {
        const product = state.products.find(p => String(p.id) === String(id));
        if (!product || !els.viewModalBody || !els.viewModal) return;

        const date = product.created_at ? new Date(product.created_at).toLocaleString() : 'N/A';

        els.viewModalBody.innerHTML = `
            <div style="display: flex; gap: 20px; margin-bottom: 20px;">
                <img src="${product.thumbnail || 'https://via.placeholder.com/150'}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;">
                <div>
                    <h3 style="font-size: 24px; margin-bottom: 8px;">${product.name}</h3>
                    <p style="color: var(--text-muted); margin-bottom: 8px;">Slug: ${product.slug}</p>
                    <p><span class="status-badge status-${(product.status||'draft').toLowerCase()}">${product.status}</span> ${product.featured ? '⭐ Featured' : ''}</p>
                    <h2 style="color: var(--primary-color); margin-top: 12px;">$${Number(product.price).toFixed(2)} ${product.old_price ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 14px; margin-left: 8px;">$${Number(product.old_price).toFixed(2)}</span>` : ''}</h2>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; background: var(--secondary-color); padding: 16px; border-radius: 8px;">
                <div><strong>Category:</strong> ${product.category || '-'}</div>
                <div><strong>Brand:</strong> ${product.brand || '-'}</div>
                <div><strong>Stock:</strong> ${product.stock}</div>
                <div><strong>Rating:</strong> ${product.rating || '-'} / 5</div>
                <div><strong>Created:</strong> ${date}</div>
                <div><strong>ID:</strong> ${product.id}</div>
            </div>
            <div>
                <strong>Description:</strong>
                <p style="margin-top: 8px; color: var(--text-muted); line-height: 1.5;">${product.description || 'No description available.'}</p>
            </div>
        `;
        els.viewModal.classList.add('active');
    }
    // ==========================================
    // Confirmation Modal Logic
    // ==========================================
    function requestConfirm(type, title, message, id = null) {
        state.actionContext = { type, id };
        if (els.confirmTitle) els.confirmTitle.textContent = title;
        if (els.confirmMessage) els.confirmMessage.textContent = message;
        if (els.confirmModal) els.confirmModal.classList.add('active');
    }

    async function executeConfirmAction() {
        if (!state.actionContext) return;
        
        const { type, id } = state.actionContext;
        if (els.executeConfirmBtn) {
            els.executeConfirmBtn.disabled = true;
            els.executeConfirmBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Executing...";
        }

        try {
            if (type === 'delete' && id) {
                const { error } = await supabaseClient.from('products').delete().eq('id', id);
                if (error) throw error;
                notify("Product deleted successfully.", "success");
            } 
            else if (type === 'duplicate' && id) {
                const product = state.products.find(p => String(p.id) === String(id));
                if (product) {
                    const copy = { ...product };
                    delete copy.id;
                    delete copy.created_at;
                    copy.name = `${copy.name} (Copy)`;
                    copy.slug = `${copy.slug}-copy-${Date.now().toString().slice(-4)}`;
                    
                    const { error } = await supabaseClient.from('products').insert([copy]);
                    if (error) throw error;
                    notify("Product duplicated successfully.", "success");
                }
            }
            else if (type === 'bulkDelete') {
                const idsArray = Array.from(state.selectedIds);
                const { error } = await supabaseClient.from('products').delete().in('id', idsArray);
                if (error) throw error;
                notify(`${idsArray.length} products deleted.`, "success");
                state.selectedIds.clear();
            }

            if (els.confirmModal) els.confirmModal.classList.remove('active');
            await fetchStats();
            await fetchProducts();

        } catch (error) {
            console.error("Action Error:", error);
            notify(`Error: ${error.message}`, "error");
        } finally {
            state.actionContext = null;
            if (els.executeConfirmBtn) {
                els.executeConfirmBtn.disabled = false;
                els.executeConfirmBtn.innerHTML = "Confirm";
            }
        }
    }

    async function processBulkAction(actionType) {
        if (state.selectedIds.size === 0) return;
        const idsArray = Array.from(state.selectedIds);
        let updateData = {};

        if (actionType === 'activate') updateData = { status: 'active' };
        else if (actionType === 'deactivate') updateData = { status: 'draft' };
        else if (actionType === 'feature') updateData = { featured: true };
        else if (actionType === 'unfeature') updateData = { featured: false };

        try {
            const { error } = await supabaseClient.from('products').update(updateData).in('id', idsArray);
            if (error) throw error;
            
            notify(`Bulk action '${actionType}' applied to ${idsArray.length} products.`, "success");
            state.selectedIds.clear();
            await fetchStats();
            await fetchProducts();
        } catch (error) {
            console.error("Bulk Action Error:", error);
            notify(`Error: ${error.message}`, "error");
        }
    }

    // ==========================================
    // Run Init
    // ==========================================
    document.addEventListener('DOMContentLoaded', init);

})();