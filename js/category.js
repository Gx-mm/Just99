/* ==========================================
   SUPABASE CONFIGURATION
========================================== */
var SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ==========================================
   GLOBAL STATE
========================================== */
let allProducts = [];
let allCategories = [];
let currentCategory = 'all';

// Initialize Cart and Wishlist from LocalStorage
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];

/* ==========================================
   DOM ELEMENTS
========================================== */
// Navbar Elements
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const headerWishlistCount = document.getElementById('headerWishlistCount');
const headerCartCount = document.getElementById('headerCartCount');
const floatCartCount = document.getElementById('floatCartCount');

// Category & Product Elements
const categoriesContainer = document.getElementById('categoriesContainer');
const productsContainer = document.getElementById('productsContainer');
const currentCategoryTitle = document.getElementById('currentCategoryTitle');
const emptyState = document.getElementById('emptyState');
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const categorySidebar = document.querySelector('.category-sidebar');

// Popup Elements
const customPopup = document.getElementById('customPopup');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupBtn = document.getElementById('popupBtn');

/* ==========================================
   INITIALIZATION
========================================== */
document.addEventListener('DOMContentLoaded', () => {
    updateBadges();
    setupEventListeners();
    
    // Fetch products on page load
    fetchProducts();
});

/* ==========================================
   HELPER: EXTRACT 1ST IMAGE FROM THUMBNAIL
========================================== */
function getFirstImage(thumbnailData) {
    if (!thumbnailData) return null;
    
    // Condition 1: If data is already an Array (e.g., from Supabase array column)
    if (Array.isArray(thumbnailData)) {
        return thumbnailData.length > 0 ? thumbnailData[0] : null;
    }
    
    // Condition 2: If data is a String
    if (typeof thumbnailData === 'string') {
        // Try parsing as JSON if it looks like an array string '["url1", "url2"]'
        if (thumbnailData.trim().startsWith('[')) {
            try {
                const parsed = JSON.parse(thumbnailData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed[0];
                }
            } catch (e) {
                // If parsing fails, move to comma-separated check
            }
        }
        // Assume it's comma-separated 'url1, url2, url3'
        return thumbnailData.split(',')[0].trim();
    }
    
    return null;
}

/* ==========================================
   DATA FETCHING (Supabase)
========================================== */
async function fetchProducts() {
    try {
        const { data, error } = await supabase.from('products').select('*');
        if (error) throw error;
        
        allProducts = data || [];
        
        // 1. Render the products
        renderProducts(allProducts);
        
        // 2. Automatically generate categories from the products
        generateCategoriesFromProducts(allProducts);
        
    } catch (error) {
        console.error('Error fetching products:', error);
        productsContainer.innerHTML = '';
        emptyState.style.display = 'block';
    }
}

function generateCategoriesFromProducts(products) {
    const uniqueCategories = [];
    const categoryTracker = new Set();
    
    products.forEach(product => {
        // Look for 'category_id' or 'category' in your database columns
        const catName = product.category_id || product.category; 
        
        if (catName && !categoryTracker.has(catName)) {
            categoryTracker.add(catName);
            uniqueCategories.push({
                id: catName,
                // Capitalize the first letter for a nice UI
                name: String(catName).charAt(0).toUpperCase() + String(catName).slice(1) 
            });
        }
    });
    
    allCategories = uniqueCategories;
    renderCategories(allCategories);
}

/* ==========================================
   RENDERING
========================================== */
function renderCategories(categories) {
    // Keep the "All Products" button and append the dynamic ones
    let html = `<button class="filter-item active" data-category="all">All Products</button>`;
    
    categories.forEach(cat => {
        html += `<button class="filter-item" data-category="${cat.id}">${cat.name}</button>`;
    });
    
    categoriesContainer.innerHTML = html;
}

function renderProducts(productsToRender) {
    productsContainer.innerHTML = '';
    
    if (productsToRender.length === 0) {
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    
    productsToRender.forEach(product => {
        const isWishlisted = wishlist.includes(product.id);
        const discountBadge = product.discount ? `<span class="discount-badge">-${product.discount}%</span>` : '';
        const oldPriceHtml = product.old_price ? `<span class="old-price">₹${product.old_price}</span>` : '';
        
        // Use helper to extract the 1st URL from thumbnail column
        const dbImage = getFirstImage(product.thumbnail);
        
        // Default placeholder fallback
        const placeholderImg = "https://placehold.co/300x300/f8f9fa/a0a0a0?text=No+Image";
        const finalImage = dbImage ? dbImage : placeholderImg;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = (e) => {
            // Prevent navigation if clicking add to cart or wishlist
            if (!e.target.closest('.add-cart-btn') && !e.target.closest('.wishlist-btn')) {
                window.location.href = `project.html?id=${product.id}`;
            }
        };

        card.innerHTML = `
            <div class="card-img-wrap">
                ${discountBadge}
                <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="toggleWishlist('${product.id}', this, event)">
                    <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </button>
                <img src="${finalImage}" alt="" onerror="this.onerror=null;this.src='${placeholderImg}';">
            </div>
            <div class="card-info">
                <h3 class="product-title">${product.name}</h3>
                <div class="rating-wrap">
                    <span class="rating-badge">
                        <svg viewBox="0 0 24 24" width="10" height="10" fill="white" stroke="white" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        ${product.rating || '4.5'}
                    </span>
                    <span class="rating-count">(${product.reviews || 0})</span>
                </div>
                <div class="price-wrap">
                    <span class="current-price">₹${product.price}</span>
                    ${oldPriceHtml}
                </div>
                <button class="add-cart-btn" onclick="addToCart('${product.id}', event)">Add to Cart</button>
            </div>
        `;
        productsContainer.appendChild(card);
    });
}

/* ==========================================
   EVENT LISTENERS & LOGIC
========================================== */
function setupEventListeners() {
    // Category Filtering
    categoriesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-item')) {
            document.querySelectorAll('.filter-item').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            
            const categoryId = e.target.getAttribute('data-category');
            currentCategoryTitle.textContent = e.target.textContent;
            
            if (categoryId === 'all') {
                renderProducts(allProducts);
            } else {
                const filtered = allProducts.filter(p => p.category_id == categoryId || p.category == categoryId);
                renderProducts(filtered);
            }

            if (window.innerWidth <= 900) {
                categorySidebar.style.display = 'none';
            }
        }
    });

    if (mobileFilterToggle) {
        mobileFilterToggle.addEventListener('click', () => {
            const isVisible = categorySidebar.style.display === 'block';
            categorySidebar.style.display = isVisible ? 'none' : 'block';
        });
    }

    // Top Navbar Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            if (query.length < 2) {
                searchResults.style.display = 'none';
                return;
            }

            const matches = allProducts.filter(p => p.name.toLowerCase().includes(query));
            
            if (matches.length > 0) {
                const placeholderSmall = "https://placehold.co/40x40/f8f9fa/a0a0a0?text=Img";
                
                searchResults.innerHTML = matches.slice(0, 5).map(product => {
                    // Get 1st image for search dropdown too
                    const dbSearchImage = getFirstImage(product.thumbnail);
                    const finalSearchImage = dbSearchImage ? dbSearchImage : placeholderSmall;
                    
                    return `
                    <div class="search-result-item" onclick="window.location.href='project.html?id=${product.id}'">
                        <img src="${finalSearchImage}" alt="" onerror="this.onerror=null;this.src='${placeholderSmall}';">
                        <div class="search-result-info">
                            <span class="search-result-name">${product.name}</span>
                            <span class="search-result-price">₹${product.price}</span>
                        </div>
                    </div>
                    `;
                }).join('');
                
                searchResults.style.display = 'block';
            } else {
                searchResults.innerHTML = `<div style="padding: 15px; text-align: center; color: var(--text-muted);">No products found</div>`;
                searchResults.style.display = 'block';
            }
        });

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
    }

    if (popupBtn) {
        popupBtn.addEventListener('click', () => {
            customPopup.classList.remove('show');
        });
    }
}

/* ==========================================
   CART & WISHLIST FUNCTIONS
========================================== */
function addToCart(productId, event) {
    if (event) event.stopPropagation(); 
    
    if (!cart.includes(productId)) {
        cart.push(productId);
        localStorage.setItem('cart', JSON.stringify(cart));
        updateBadges();
        showPopup('Success!', 'Product added to your cart.');
    } else {
        showPopup('Info', 'Product is already in your cart.');
    }
}

function toggleWishlist(productId, btnElement, event) {
    if (event) event.stopPropagation(); 
    
    const index = wishlist.indexOf(productId);
    if (index === -1) {
        wishlist.push(productId);
        btnElement.classList.add('active');
        showPopup('Wishlist', 'Added to your wishlist.');
    } else {
        wishlist.splice(index, 1);
        btnElement.classList.remove('active');
    }
    
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    updateBadges();
}

/* ==========================================
   UI HELPERS
========================================== */
function updateBadges() {
    const cartCount = cart.length;
    if (headerCartCount) {
        headerCartCount.textContent = cartCount;
        headerCartCount.style.display = cartCount > 0 ? 'flex' : 'none';
    }
    if (floatCartCount) {
        floatCartCount.textContent = cartCount;
        floatCartCount.style.display = cartCount > 0 ? 'flex' : 'none';
    }

    const wishlistCount = wishlist.length;
    if (headerWishlistCount) {
        headerWishlistCount.textContent = wishlistCount;
        headerWishlistCount.style.display = wishlistCount > 0 ? 'flex' : 'none';
    }
}

function showPopup(title, message) {
    if (popupTitle && popupMessage && customPopup) {
        popupTitle.textContent = title;
        popupMessage.textContent = message;
        customPopup.classList.add('show');
    } else {
        alert(`${title}: ${message}`);
    }
}
