/* =========================
   SUPABASE CONFIG & INIT
========================= */
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const cartContainer = document.getElementById("cartContainer");
const summaryContainer = document.getElementById("cartSummaryContainer");
const clearCartBtn = document.getElementById("clearCartBtn");

/* =========================
   LOAD CART LOGIC
========================= */
async function loadCart() {
    // Apke home.js ke according, array 'localCart' key me hoti hai
    let cartIds = JSON.parse(localStorage.getItem('localCart') || localStorage.getItem('cart') || '[]');

    if (!cartIds || cartIds.length === 0) {
        renderEmptyState();
        return;
    }

    try {
        // Fetch all products matching the IDs in the cart
        const { data: products, error } = await client
            .from("products")
            .select("*")
            .in("id", cartIds);

        if (error) throw error;

        if (!products || products.length === 0) {
            renderEmptyState();
            return;
        }

        let total = 0;
        let oldTotal = 0;
        let html = '';

        // Generate UI for each item in the cart array
        cartIds.forEach(cartId => {
            // Find the product data for this ID
            const product = products.find(p => String(p.id) === String(cartId));
            if (!product) return; // if product was deleted from DB

            // Calculations
            total += Number(product.price || 0);
            oldTotal += Number(product.old_price || 0);
            
            // Image handling (using first image if multiple are comma-separated)
            const parsedThumbs = String(product.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
            const imgUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/150?text=No+Image';

            html += `
            <div class="cart-card" id="cart-item-${product.id}">
                <button class="remove-item-btn" onclick="removeFromCart('${product.id}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <img class="cart-img" src="${imgUrl}" alt="${product.name}">
                <div class="cart-details">
                    <div class="cart-brand">${product.brand || 'Premium Quality'}</div>
                    <div class="cart-title">${product.name || product.description || 'Unknown Product'}</div>
                    
                    <div class="cart-price-row">
                        <span class="new-price">₹${product.price || 0}</span>
                        <span class="old-price">₹${product.old_price || 0}</span>
                        ${product.discount ? `<span class="discount">${product.discount}% OFF</span>` : ''}
                    </div>
                </div>
            </div>`;
        });

        cartContainer.innerHTML = html;
        clearCartBtn.style.display = "inline-block";

        // Summary Section Injection
        summaryContainer.innerHTML = `
        <div class="summary-box">
            <h3>Price Details</h3>
            <div class="summary-row">
                <span>Price (${cartIds.length} items)</span>
                <span>₹${oldTotal}</span>
            </div>
            <div class="summary-row savings">
                <span>Discount</span>
                <span>- ₹${oldTotal - total}</span>
            </div>
            <div class="summary-row">
                <span>Delivery Charges</span>
                <span style="color:var(--success)">FREE</span>
            </div>
            <div class="summary-row total">
                <span>Total Amount</span>
                <span>₹${total}</span>
            </div>
            <button class="checkout-btn ripple" onclick="location.href='buy.html'">
                Proceed to Checkout 
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
        </div>`;

    } catch (err) {
        console.error("Error loading cart:", err);
        cartContainer.innerHTML = `<div class="empty-state"><h3>Failed to load cart.</h3><p>Check your connection and try again.</p></div>`;
    }
}

/* =========================
   ACTIONS (Remove, Clear)
========================= */
window.removeFromCart = function(productId) {
    let cartIds = JSON.parse(localStorage.getItem('localCart') || localStorage.getItem('cart') || '[]');
    
    // Remove the specific ID
    cartIds = cartIds.filter(id => String(id) !== String(productId));
    
    // Update local storage
    localStorage.setItem('localCart', JSON.stringify(cartIds));
    localStorage.setItem('cart', JSON.stringify(cartIds)); // Fail-safe for both keys
    
    // Optimistic UI Removal
    const card = document.getElementById(`cart-item-${productId}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => {
            updateBadges();
            loadCart(); // Reload to update totals
        }, 300);
    }
}

window.clearCart = function() {
    if (confirm("Are you sure you want to remove all items from your cart?")) {
        localStorage.removeItem('localCart');
        localStorage.removeItem('cart');
        updateBadges();
        renderEmptyState();
    }
}

/* =========================
   UI STATES & BADGES
========================= */
function renderEmptyState() {
    clearCartBtn.style.display = "none";
    summaryContainer.innerHTML = "";
    cartContainer.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            <h3>Your cart is empty</h3>
            <p>Looks like you haven't added anything to your cart yet.</p>
            <a href="home.html" class="btn-primary">Start Shopping</a>
        </div>
    `;
}

function updateBadges() {
    const cart = JSON.parse(localStorage.getItem('localCart')) || JSON.parse(localStorage.getItem('cart')) || [];
    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || []; // If you store wishlist locally
    
    const headerCartCount = document.getElementById('headerCartCount');
    const floatCartCount = document.getElementById('floatCartCount');
    const headerWishlistCount = document.getElementById('headerWishlistCount');

    if (headerCartCount && floatCartCount) {
        headerCartCount.textContent = cart.length;
        floatCartCount.textContent = cart.length;
        
        const displayStatusCart = cart.length > 0 ? 'flex' : 'none';
        headerCartCount.style.display = displayStatusCart;
        floatCartCount.style.display = displayStatusCart;
    }
    
    if (headerWishlistCount) {
        headerWishlistCount.textContent = wishlist.length;
        headerWishlistCount.style.display = wishlist.length > 0 ? 'flex' : 'none';
    }
}

// Start Application
document.addEventListener("DOMContentLoaded", () => {
    updateBadges();
    loadCart();
});
