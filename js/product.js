/* =========================
   product.js
   ========================= */

// Supabase Configuration
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global State
let currentProduct = null;
let userWishlist = [];
const userId = localStorage.getItem("userId") || "guest"; // Simple auth mock
const urlParams = new URLSearchParams(window.location.search);
const productId = urlParams.get("id");

// Image Gallery State
let productImages = [];
let currentImageIndex = 0;
let touchstartX = 0;
let touchendX = 0;

// DOM Elements
const DOM = {
    skeleton: document.getElementById("productSkeleton"),
    content: document.getElementById("productContent"),
    errorState: document.getElementById("errorState"),
    
    // Product UI Elements
    breadcrumbs: document.getElementById("breadcrumbs"),
    title: document.getElementById("productTitle"),
    
    // Gallery Elements
    mainImgContainer: document.getElementById("mainImageContainer"),
    image: document.getElementById("mainImage"),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    imageCounter: document.getElementById("imageCounter"),
    thumbnailContainer: document.getElementById("thumbnailContainer"),
    
    price: document.getElementById("productPrice"),
    oldPrice: document.getElementById("productOldPrice"),
    discountText: document.getElementById("productDiscountText"),
    discountBadge: document.getElementById("productDiscountBadge"),
    rating: document.getElementById("productRating"),
    description: document.getElementById("productDescription"),
    
    // Spec Elements
    specBrand: document.getElementById("specBrand"),
    specCategory: document.getElementById("specCategory"),
    specStock: document.getElementById("specStock"),
    
    // Action Buttons
    mainWishBtn: document.getElementById("mainWishlistBtn"),
    actionWishBtn: document.getElementById("actionWishlistBtn"),
    
    // Similar Products
    similarContainer: document.getElementById("similarProductsContainer"),
    
    // Counters
    headerWishCount: document.getElementById("headerWishlistCount"),
    headerCartCount: document.getElementById("headerCartCount"),
    floatCartCount: document.getElementById("floatCartCount"),
    
    // Popup
    popupOverlay: document.getElementById("customPopup"),
    popupTitle: document.getElementById("popupTitle"),
    popupMessage: document.getElementById("popupMessage"),
    popupBtn: document.getElementById("popupBtn")
};

// Initialize App
async function initApp() {
    updateCounters();
    
    if (!productId) {
        showError("Invalid Product", "No product ID was provided.");
        return;
    }

    setupGalleryListeners();
    await loadWishlist();
    await fetchProductDetails();
}

// Show Custom Popup
function showPopup(title, message) {
    DOM.popupTitle.innerText = title;
    DOM.popupMessage.innerText = message;
    DOM.popupOverlay.classList.add("show");
}
DOM.popupBtn.addEventListener("click", () => DOM.popupOverlay.classList.remove("show"));

// Error State
function showError(title, message) {
    DOM.skeleton.style.display = "none";
    DOM.content.style.display = "none";
    document.getElementById("errorTitle").innerText = title;
    document.getElementById("errorMessage").innerText = message;
    DOM.errorState.style.display = "block";
}

// Fetch Product Details
async function fetchProductDetails() {
    try {
        const { data, error } = await client
            .from("products")
            .select("*")
            .eq("id", productId)
            .single();

        if (error || !data) {
            showError("Product Not Found", "The item you are looking for does not exist.");
            return;
        }

        currentProduct = data;
        renderProduct(data);
        fetchSimilarProducts(data.category, data.id);

    } catch (err) {
        showError("Network Error", "Failed to load product. Please try again.");
    }
}

// Global Image Error Handler (Broken Image Cleanup)
window.handleBrokenImage = function(failedUrl) {
    const origLength = productImages.length;
    productImages = productImages.filter(url => url !== failedUrl);
    
    if (productImages.length < origLength) {
        if (productImages.length === 0) {
            productImages = ["https://via.placeholder.com/600?text=Image+Unavailable"];
        }
        if (currentImageIndex >= productImages.length) {
            currentImageIndex = Math.max(0, productImages.length - 1);
        }
        renderGalleryUI();
    }
};

// Setup Gallery Event Listeners
function setupGalleryListeners() {
    // Buttons
    DOM.prevBtn.addEventListener("click", () => changeImageIndex(-1));
    DOM.nextBtn.addEventListener("click", () => changeImageIndex(1));
    
    // Main image broken handler
    DOM.image.onerror = function() {
        if(this.src) {
            window.handleBrokenImage(this.src);
        }
    };

    // Mobile Swipe Events
    DOM.mainImgContainer.addEventListener('touchstart', e => {
        touchstartX = e.changedTouches[0].screenX;
    }, {passive: true});

    DOM.mainImgContainer.addEventListener('touchend', e => {
        touchendX = e.changedTouches[0].screenX;
        handleSwipe();
    }, {passive: true});
}

function handleSwipe() {
    const threshold = 50; // Minimum pixel swipe distance
    if (touchendX < touchstartX - threshold) {
        // Swiped Left - Next
        changeImageIndex(1);
    }
    if (touchendX > touchstartX + threshold) {
        // Swiped Right - Previous
        changeImageIndex(-1);
    }
}

function changeImageIndex(direction) {
    if (productImages.length <= 1) return;
    
    currentImageIndex += direction;
    if (currentImageIndex < 0) {
        currentImageIndex = productImages.length - 1;
    } else if (currentImageIndex >= productImages.length) {
        currentImageIndex = 0;
    }
    updateGalleryView();
}

function setMainImage(index) {
    if (index >= 0 && index < productImages.length) {
        currentImageIndex = index;
        updateGalleryView();
    }
}

function renderGalleryUI() {
    DOM.thumbnailContainer.innerHTML = "";
    
    if (productImages.length <= 1) {
        // Single Image Mode
        DOM.prevBtn.style.display = "none";
        DOM.nextBtn.style.display = "none";
        DOM.imageCounter.style.display = "none";
        DOM.thumbnailContainer.style.display = "none";
    } else {
        // Multiple Images Mode
        DOM.prevBtn.style.display = "flex";
        DOM.nextBtn.style.display = "flex";
        DOM.imageCounter.style.display = "block";
        DOM.thumbnailContainer.style.display = "flex";
        
        // Render Thumbnails
        productImages.forEach((url, idx) => {
            const thumbDiv = document.createElement('div');
            thumbDiv.className = `thumbnail-item ${idx === currentImageIndex ? 'active' : ''}`;
            thumbDiv.onclick = () => setMainImage(idx);
            
            const img = document.createElement('img');
            img.src = url;
            img.alt = `Thumbnail ${idx + 1}`;
            img.loading = "lazy";
            img.onerror = () => window.handleBrokenImage(url);
            
            thumbDiv.appendChild(img);
            DOM.thumbnailContainer.appendChild(thumbDiv);
        });
    }
    
    updateGalleryView();
}

function updateGalleryView() {
    if (productImages.length === 0) return;
    
    // Update Main Image
    DOM.image.style.opacity = 0.5;
    setTimeout(() => {
        DOM.image.src = productImages[currentImageIndex];
        DOM.image.style.opacity = 1;
    }, 100);

    // Update Counter
    DOM.imageCounter.innerText = `${currentImageIndex + 1} / ${productImages.length}`;

    // Update Active Thumbnail
    if (productImages.length > 1) {
        const thumbs = DOM.thumbnailContainer.querySelectorAll('.thumbnail-item');
        thumbs.forEach((thumb, idx) => {
            if (idx === currentImageIndex) {
                thumb.classList.add('active');
                // Scroll thumbnail into view if needed
                thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                thumb.classList.remove('active');
            }
        });
    }
}

// Render Product UI
function renderProduct(product) {
    // Hide skeleton, show content
    DOM.skeleton.style.display = "none";
    DOM.content.style.display = "block";
    DOM.errorState.style.display = "none";

    // Dynamic Title Update
    document.title = `${product.name} - 99Shops`;

    // Breadcrumbs
    const cat = product.category || 'All Categories';
    DOM.breadcrumbs.innerHTML = `
        <a href="home.html">Home</a>
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none"><path stroke-width="2" d="M9 18l6-6-6-6"></path></svg>
        <a href="categories.html?cat=${encodeURIComponent(cat)}">${cat}</a>
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none"><path stroke-width="2" d="M9 18l6-6-6-6"></path></svg>
        <span>${product.name}</span>
    `;

    // Basic Info
    DOM.title.innerText = product.name || "Unknown Product";
    DOM.description.innerText = product.description || "No description available for this product.";
    
    // Parse Images
    const rawThumbs = product.thumbnail || "";
    productImages = String(rawThumbs)
        .split(",")
        .map(url => url.trim())
        .filter(Boolean);
        
    if (productImages.length === 0) {
        productImages = ["https://via.placeholder.com/600?text=No+Image"];
    }
    
    currentImageIndex = 0;
    renderGalleryUI();
    
    // Rating
    const r = product.rating || 4.5;
    DOM.rating.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> ${r}`;

    // Pricing
    DOM.price.innerText = `₹${product.price || 0}`;
    
    if (product.old_price && product.old_price > product.price) {
        DOM.oldPrice.innerText = `₹${product.old_price}`;
        DOM.oldPrice.style.display = "inline";
    } else {
        DOM.oldPrice.style.display = "none";
    }

    if (product.discount && product.discount > 0) {
        const discountStr = `${product.discount}% OFF`;
        DOM.discountText.innerText = discountStr;
        DOM.discountBadge.innerText = discountStr;
        DOM.discountText.style.display = "inline";
        DOM.discountBadge.style.display = "block";
    } else {
        DOM.discountText.style.display = "none";
        DOM.discountBadge.style.display = "none";
    }

    // Specs
    DOM.specBrand.innerText = product.brand || "99Shops";
    DOM.specCategory.innerText = product.category || "N/A";
    DOM.specStock.innerText = (product.stock > 0) ? `In Stock (${product.stock})` : "Out of Stock";

    // Setup Wishlist Buttons
    checkWishlistState();
    
    DOM.mainWishBtn.onclick = toggleWishlist;
    DOM.actionWishBtn.onclick = toggleWishlist;
}

// Wishlist Logic
async function loadWishlist() {
    if (userId === "guest") return;
    const { data } = await client.from("wishlist").select("product_id").eq("user_id", userId);
    userWishlist = (data || []).map(w => String(w.product_id));
}

function checkWishlistState() {
    const isWished = userWishlist.includes(String(productId));
    if (isWished) {
        DOM.mainWishBtn.classList.add("active");
        DOM.actionWishBtn.classList.add("active");
        DOM.actionWishBtn.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Added to Wishlist`;
    } else {
        DOM.mainWishBtn.classList.remove("active");
        DOM.actionWishBtn.classList.remove("active");
        DOM.actionWishBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Add to Wishlist`;
    }
}

async function toggleWishlist(e) {
    if (e) e.preventDefault();
    if (userId === "guest") {
        showPopup("Login Required", "Please login to manage your wishlist.");
        return;
    }

    const isWished = userWishlist.includes(String(productId));
    
    if (isWished) {
        userWishlist = userWishlist.filter(id => id !== String(productId));
        checkWishlistState();
        await client.from("wishlist").delete().eq("user_id", userId).eq("product_id", productId);
    } else {
        userWishlist.push(String(productId));
        checkWishlistState();
        await client.from("wishlist").insert([{ user_id: userId, product_id: productId }]);
    }
    updateCounters();
}

// Cart & Buy Logic
function buyNow() {
    if(!productId) return;
    
    // Add to local cart mock for counters immediately
    let cart = JSON.parse(localStorage.getItem("localCart") || "[]");
    if (!cart.includes(String(productId))) {
        cart.push(String(productId));
        localStorage.setItem("localCart", JSON.stringify(cart));
    }
    
    window.location.href = `buy.html?id=${productId}`;
}

function updateCounters() {
    DOM.headerWishCount.innerText = userWishlist.length;
    DOM.headerWishCount.style.display = userWishlist.length > 0 ? "flex" : "none";

    const cart = JSON.parse(localStorage.getItem("localCart") || "[]");
    DOM.headerCartCount.innerText = cart.length;
    DOM.floatCartCount.innerText = cart.length;
    
    const displayStyle = cart.length > 0 ? "flex" : "none";
    DOM.headerCartCount.style.display = displayStyle;
    DOM.floatCartCount.style.display = displayStyle;
}

// Similar Products
async function fetchSimilarProducts(category, excludeId) {
    // Show Skeletons
    DOM.similarContainer.innerHTML = `
        <div class="skeleton product-card" style="height: 250px;"></div>
        <div class="skeleton product-card" style="height: 250px;"></div>
        <div class="skeleton product-card" style="height: 250px;"></div>
        <div class="skeleton product-card" style="height: 250px;"></div>
    `;

    try {
        let query = client.from("products").select("*").neq("id", excludeId);
        
        if (category) {
            query = query.eq("category", category);
        }

        const { data, error } = await query.limit(8);

        if (error || !data || data.length === 0) {
            DOM.similarContainer.innerHTML = `<p style="grid-column: 1/-1; color: #666; text-align: center;">No similar products found.</p>`;
            return;
        }

        renderSimilarProducts(data);
    } catch(e) {
        DOM.similarContainer.innerHTML = ``;
    }
}

function renderSimilarProducts(products) {
    DOM.similarContainer.innerHTML = products.map(p => {
        const oldPrice = p.old_price > 0 ? `<span class="card-old">₹${p.old_price}</span>` : '';
        const discount = p.discount > 0 ? `<div class="card-discount">${p.discount}% OFF</div>` : '';
        const rating = p.rating ? `<div class="card-rating"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> ${p.rating}</div>` : '';
        
        // Ensure similar products only render the FIRST image from the comma-separated string
        const parsedThumbs = String(p.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
        const cardThumbUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/300?text=No+Image';

        // Wishlist visual for similar products based on global state
        const isWished = userWishlist.includes(String(p.id));
        const activeClass = isWished ? 'active' : '';

        return `
            <div class="product-card" onclick="window.location.href='project.html?id=${p.id}'">
                ${discount}
                <div class="card-wishlist ${activeClass}" onclick="event.stopPropagation(); window.location.href='project.html?id=${p.id}'">
                    <svg viewBox="0 0 24 24" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                </div>
                <div class="card-img-wrap">
                    <img src="${cardThumbUrl}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/300?text=Unavailable'">
                </div>
                <div class="card-info">
                    <div class="card-title">${p.name}</div>
                    <div class="card-price-row">
                        <span class="card-price">₹${p.price}</span>
                        ${oldPrice}
                    </div>
                    ${rating}
                </div>
            </div>
        `;
    }).join("");
}

// Bootstrap
document.addEventListener("DOMContentLoaded", initApp);
