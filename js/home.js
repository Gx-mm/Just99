/* =========================
   SUPABASE CONFIG & INIT
========================= */
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================
   STATE & DOM CACHE
========================= */
let allProducts = [];
let userWishlist = [];
const userId = localStorage.getItem("userId") || "guest"; // Simple auth mock

const DOM = {
    bannerSlider: document.getElementById("bannerSlider"),
    bannerIndicators: document.getElementById("bannerIndicators"),
    categoriesContainer: document.getElementById("categoriesContainer"),
    dealsContainer: document.getElementById("dealsContainer"),
    popularContainer: document.getElementById("popularContainer"),
    newestContainer: document.getElementById("newestContainer"),
    featuredContainer: document.getElementById("featuredContainer"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults"),
    headerWishCount: document.getElementById("headerWishlistCount"),
    headerCartCount: document.getElementById("headerCartCount"),
    floatCartCount: document.getElementById("floatCartCount"),
    popupOverlay: document.getElementById("customPopup"),
    popupTitle: document.getElementById("popupTitle"),
    popupMessage: document.getElementById("popupMessage"),
    popupBtn: document.getElementById("popupBtn")
};

/* =========================
   APP INITIALIZATION
========================= */
async function initApp() {
    setupEventListeners();
    await Promise.all([
        fetchBanners(),
        fetchDataAndRender()
    ]);
    updateCounters();
}

/* =========================
   CUSTOM POPUP
========================= */
function showPopup(title, message) {
    DOM.popupTitle.innerText = title;
    DOM.popupMessage.innerText = message;
    DOM.popupOverlay.classList.add("show");
}
DOM.popupBtn.addEventListener("click", () => {
    DOM.popupOverlay.classList.remove("show");
});

/* =========================
   BANNER LOGIC
========================= */
async function fetchBanners() {
    const { data, error } = await client
        .from("banner")
        .select("*")
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        DOM.bannerSlider.innerHTML = `<div class="banner-slide"><img src="https://via.placeholder.com/1200x400?text=99Shops+Premium" alt="Banner"></div>`;
        return;
    }

    DOM.bannerSlider.innerHTML = data.map(b => `
        <div class="banner-slide">
            <img src="${b.banner_url}" alt="Banner" loading="lazy">
        </div>
    `).join("");

    DOM.bannerIndicators.innerHTML = data.map((_, i) => `
        <div class="dot ${i === 0 ? 'active' : ''}" data-index="${i}"></div>
    `).join("");

    initSlider(data.length);
}

function initSlider(slideCount) {
    if (slideCount <= 1) return;
    let currentIndex = 0;
    let interval;
    const dots = document.querySelectorAll(".dot");

    const goToSlide = (index) => {
        currentIndex = index;
        DOM.bannerSlider.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach(d => d.classList.remove("active"));
        if(dots[currentIndex]) dots[currentIndex].classList.add("active");
    };

    const nextSlide = () => {
        currentIndex = (currentIndex + 1) % slideCount;
        goToSlide(currentIndex);
    };

    const startAutoSlide = () => { interval = setInterval(nextSlide, 3000); };
    const stopAutoSlide = () => { clearInterval(interval); };

    startAutoSlide();

    // Touch Swipe Support
    let startX = 0, endX = 0;
    DOM.bannerSlider.addEventListener("touchstart", (e) => {
        stopAutoSlide();
        startX = e.changedTouches[0].screenX;
    }, {passive: true});
    DOM.bannerSlider.addEventListener("touchend", (e) => {
        endX = e.changedTouches[0].screenX;
        if (startX - endX > 50) nextSlide();
        else if (endX - startX > 50) goToSlide((currentIndex - 1 + slideCount) % slideCount);
        startAutoSlide();
    }, {passive: true});

    // Dots click
    dots.forEach(dot => {
        dot.addEventListener("click", (e) => {
            stopAutoSlide();
            goToSlide(parseInt(e.target.dataset.index));
            startAutoSlide();
        });
    });
}

/* =========================
   PRODUCTS & CATEGORIES
========================= */
async function fetchDataAndRender() {
    // Single Query for Performance
    const { data: products, error } = await client
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        showPopup("Error", "Failed to load products. Please try again.");
        return;
    }

    allProducts = products || [];
    
    if (userId !== "guest") {
        const { data: wishData } = await client.from("wishlist").select("product_id").eq("user_id", userId);
        userWishlist = (wishData || []).map(w => String(w.product_id));
    }

    renderCategories();
    renderProductSections();
}

function renderCategories() {
    if(!allProducts.length) return;
    
    // Extract Unique Categories & First Valid Image safely 
    const catMap = new Map();
    allProducts.forEach(p => {
        if (p.category && !catMap.has(p.category)) {
            const parsedThumbs = String(p.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
            const coverImage = parsedThumbs.length > 0 ? parsedThumbs[0] : "https://via.placeholder.com/100?text=No+Image";
            catMap.set(p.category, coverImage);
        }
    });

    const categories = Array.from(catMap, ([name, img]) => ({ name, img }));

    if(categories.length === 0){
        DOM.categoriesContainer.innerHTML = `<div class="empty-state">No Categories</div>`;
        return;
    }

    DOM.categoriesContainer.innerHTML = categories.map(c => `
        <div class="category-card" onclick="window.location.href='categories.html?cat=${encodeURIComponent(c.name)}'">
            <div class="category-img-wrap">
                <img src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/100'">
            </div>
            <span class="category-name">${c.name}</span>
        </div>
    `).join("");
}

function renderProductSections() {
    if (!allProducts.length) {
        const emptyUI = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg><h3>No Products Found</h3><p>Check back later for amazing deals!</p></div>`;
        DOM.dealsContainer.innerHTML = emptyUI;
        DOM.popularContainer.innerHTML = emptyUI;
        DOM.newestContainer.innerHTML = emptyUI;
        DOM.featuredContainer.innerHTML = emptyUI;
        return;
    }

    // Logic for sections
    const deals = [...allProducts].filter(p => p.discount && p.discount > 0).sort((a,b) => b.discount - a.discount).slice(0, 4);
    const popular = [...allProducts].sort((a,b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
    const newest = [...allProducts].slice(0, 4); // already ordered by created_at desc
    const featured = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 4); // Random mock for featured

    renderGrid(DOM.dealsContainer, deals);
    renderGrid(DOM.popularContainer, popular);
    renderGrid(DOM.newestContainer, newest);
    renderGrid(DOM.featuredContainer, featured);
}

function renderGrid(container, productsList) {
    if(!productsList.length) {
        container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color:#666;">Items unavailable</p>`;
        return;
    }
    
    container.innerHTML = productsList.map(p => generateProductCardHTML(p)).join("");
}

function generateProductCardHTML(product) {
    const isWishlisted = userWishlist.includes(String(product.id));
    const oldPriceStr = product.old_price > 0 ? `<span class="old-price">₹${product.old_price}</span>` : '';
    const discountStr = product.discount > 0 ? `<div class="discount-badge">${product.discount}% OFF</div>` : '';
    const ratingStr = product.rating ? `<div class="rating-wrap"><div class="rating-badge"><span>★</span> ${product.rating}</div></div>` : '';

    // Handle multiple images from thumbnail column safely across the entire UI
    const parsedThumbs = String(product.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
    const cardThumbUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/300?text=No+Image';

    return `
        <div class="product-card" onclick="window.location.href='project.html?id=${product.id}'">
            ${discountStr}
            <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" onclick="toggleWishlist(event, '${product.id}', this)" aria-label="Wishlist">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
            <div class="card-img-wrap">
                <img src="${cardThumbUrl}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Unavailable'">
            </div>
            <div class="card-info">
                ${ratingStr}
                <div class="product-title">${product.name}</div>
                <div class="price-wrap">
                    <span class="current-price">₹${product.price}</span>
                    ${oldPriceStr}
                </div>
                <button class="add-cart-btn" onclick="addToCart(event, '${product.id}')">Add to Cart</button>
            </div>
        </div>
    `;
}

/* =========================
   WISHLIST & CART ACTIONS
========================= */
async function toggleWishlist(e, productId, btnElement) {
    e.preventDefault();
    e.stopPropagation();
    
    if (userId === "guest") {
        showPopup("Login Required", "Please login to manage your wishlist.");
        return;
    }

    const isActive = btnElement.classList.contains("active");
    
    if (isActive) {
        // Remove
        btnElement.classList.remove("active");
        userWishlist = userWishlist.filter(id => id !== productId);
        await client.from("wishlist").delete().eq("user_id", userId).eq("product_id", productId);
    } else {
        // Add
        btnElement.classList.add("active");
        userWishlist.push(productId);
        await client.from("wishlist").insert([{ user_id: userId, product_id: productId }]);
    }
    updateCounters();
}

function addToCart(e, productId) {
    e.preventDefault();
    e.stopPropagation();
    
    let cart = JSON.parse(localStorage.getItem("localCart") || "[]");
    if (!cart.includes(productId)) {
        cart.push(productId);
        localStorage.setItem("localCart", JSON.stringify(cart));
        showPopup("Success", "Item added to your cart!");
        updateCounters();
    } else {
        showPopup("Info", "Item is already in your cart.");
    }
}

function updateCounters() {
    // Update Wishlist
    DOM.headerWishCount.innerText = userWishlist.length;
    DOM.headerWishCount.style.display = userWishlist.length > 0 ? "flex" : "none";

    // Update Cart
    const cart = JSON.parse(localStorage.getItem("localCart") || "[]");
    DOM.headerCartCount.innerText = cart.length;
    DOM.floatCartCount.innerText = cart.length;
    
    const displayStyle = cart.length > 0 ? "flex" : "none";
    DOM.headerCartCount.style.display = displayStyle;
    DOM.floatCartCount.style.display = displayStyle;
}

/* =========================
   LIVE SEARCH
========================= */
function setupEventListeners() {
    let searchTimeout;
    DOM.searchInput.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        const term = e.target.value.trim().toLowerCase();
        
        if (term.length === 0) {
            DOM.searchResults.style.display = "none";
            return;
        }

        searchTimeout = setTimeout(() => {
            const matches = allProducts.filter(p => 
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.category && p.category.toLowerCase().includes(term)) ||
                (p.description && p.description.toLowerCase().includes(term)) ||
                (p.brand && p.brand.toLowerCase().includes(term)) ||
                (p.slug && p.slug.toLowerCase().includes(term))
            );

            renderSearchResults(matches);
        }, 300); // Debounce
    });

    // Close search on click outside
    document.addEventListener("click", (e) => {
        if(!e.target.closest('.search-container')) {
            DOM.searchResults.style.display = "none";
        }
    });
}

function renderSearchResults(results) {
    if (results.length === 0) {
        DOM.searchResults.innerHTML = `<div style="padding: 15px; text-align: center; color: #666;">No items match your search.</div>`;
    } else {
        DOM.searchResults.innerHTML = results.slice(0, 10).map(p => {
            // Apply similar image splitting safety check for searches
            const parsedThumbs = String(p.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
            const thumbUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/40?text=No+Image';
            
            return `
            <div class="search-result-item" onclick="window.location.href='project.html?id=${p.id}'">
                <img src="${thumbUrl}" alt="${p.name}" onerror="this.src='https://via.placeholder.com/40?text=x'">
                <div class="search-result-info">
                    <span class="search-result-name">${p.name}</span>
                    <span class="search-result-price">₹${p.price}</span>
                </div>
            </div>
            `;
        }).join("");
    }
    DOM.searchResults.style.display = "block";
}

/* =========================
   BOOTSTRAP
========================= */
document.addEventListener("DOMContentLoaded", initApp);
