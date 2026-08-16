/* =========================
   CHECK LOGIN FIRST
========================= */
document.addEventListener("DOMContentLoaded", () => {
    const userId = localStorage.getItem("userId");
    const isLoggedIn = localStorage.getItem("isLoggedIn");

    // Agar User logged in hai, toh guest landing page mat dikhao, home.html par bhej do
    if (userId && isLoggedIn === "true") {
        window.location.replace("home.html");
    } else {
        initApp(); // Agar login nahi hai, tabhi guest page load karo
    }
});

/* =========================
   SUPABASE CONFIG
========================= */
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allProducts = [];

const DOM = {
    bannerSlider: document.getElementById("bannerSlider"),
    bannerIndicators: document.getElementById("bannerIndicators"),
    categoriesContainer: document.getElementById("categoriesContainer"),
    dealsContainer: document.getElementById("dealsContainer"),
    popularContainer: document.getElementById("popularContainer"),
    newestContainer: document.getElementById("newestContainer"),
    featuredContainer: document.getElementById("featuredContainer"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults")
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
}

/* =========================
   BANNER LOGIC
========================= */
async function fetchBanners() {
    const { data, error } = await client
        .from("banner")
        .select("*")
        .order("created_at", { ascending: false });

    if (error || !data || data.length === 0) {
        DOM.bannerSlider.innerHTML = `<div class="banner-slide"><img src="https://via.placeholder.com/1200x400?text=99Shops+Premium" alt="Banner" onclick="window.location.href='login.html'"></div>`;
        return;
    }

    DOM.bannerSlider.innerHTML = data.map(b => `
        <div class="banner-slide" onclick="window.location.href='login.html'">
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
    const { data: products, error } = await client
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Failed to load products");
        return;
    }

    allProducts = products || [];

    renderCategories();
    renderProductSections();
}

function renderCategories() {
    if(!allProducts.length) return;
    
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
        DOM.categoriesContainer.innerHTML = `<div style="padding:15px; color:#666;">No Categories</div>`;
        return;
    }

    // Har category click par login bhejega
    DOM.categoriesContainer.innerHTML = categories.map(c => `
        <div class="category-card" onclick="window.location.href='login.html'">
            <div class="category-img-wrap">
                <img src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/100'">
            </div>
            <span class="category-name">${c.name}</span>
        </div>
    `).join("");
}

function renderProductSections() {
    if (!allProducts.length) return;

    const deals = [...allProducts].filter(p => p.discount && p.discount > 0).sort((a,b) => b.discount - a.discount).slice(0, 4);
    const popular = [...allProducts].sort((a,b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4);
    const newest = [...allProducts].slice(0, 4); 
    const featured = [...allProducts].sort(() => 0.5 - Math.random()).slice(0, 4);

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
    const oldPriceStr = product.old_price > 0 ? `<span class="old-price">₹${product.old_price}</span>` : '';
    const discountStr = product.discount > 0 ? `<div class="discount-badge">${product.discount}% OFF</div>` : '';
    const ratingStr = product.rating ? `<div class="rating-wrap"><div class="rating-badge"><span>★</span> ${product.rating}</div></div>` : '';

    const parsedThumbs = String(product.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
    const cardThumbUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/300?text=No+Image';

    // Click on Card, Wishlist Button, or Add to Cart Button -> sab par Login Redirect
    return `
        <div class="product-card" onclick="window.location.href='login.html'">
            ${discountStr}
            <button class="wishlist-btn" onclick="forceLogin(event)" aria-label="Wishlist">
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
                <button class="add-cart-btn" onclick="forceLogin(event)">Add to Cart</button>
            </div>
        </div>
    `;
}

function forceLogin(e) {
    e.preventDefault();
    e.stopPropagation();
    window.location.href = 'login.html';
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
                (p.brand && p.brand.toLowerCase().includes(term))
            );
            renderSearchResults(matches);
        }, 300); 
    });

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
            const parsedThumbs = String(p.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
            const thumbUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/40?text=No+Image';
            
            // Search result par click karne par bhi login.html
            return `
            <div class="search-result-item" onclick="window.location.href='login.html'">
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
