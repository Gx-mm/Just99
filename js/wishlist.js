/* =========================
   SUPABASE CONFIG & INIT
========================= */
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const container = document.getElementById("wishlistContainer");

/* =========================
   LOAD WISHLIST LOGIC (From your old code)
========================= */
async function loadWishlist() {
    const userId = localStorage.getItem("userId");
    
    if (!userId || userId === "guest" || userId === "null") {
        renderLoginRequired();
        return;
    }

    try {
        // Fetch User's Wishlist Items
        const { data: wishlist, error } = await client
            .from("wishlist")
            .select("id, product_id")
            .eq("user_id", userId);

        if (error) throw error;

        if (!wishlist || wishlist.length === 0) {
            renderEmptyState();
            return;
        }

        let total = 0;
        let oldTotal = 0;
        let html = '';

        // Exact Old Logic: Loop through wishlist and fetch product details
        for (const item of wishlist) {
            const { data: product } = await client
                .from("products")
                .select("*")
                .eq("id", item.product_id)
                .single();

            if (!product) continue;

            // Calculations
            total += Number(product.price || 0);
            oldTotal += Number(product.old_price || 0);
            
            // Image handling (using first image if multiple are comma-separated)
            const parsedThumbs = String(product.thumbnail || "").split(",").map(u => u.trim()).filter(Boolean);
            const imgUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/300?text=No+Image';

            html += `
            <div class="wish-card" id="wish-item-${item.id}">
                <img class="wish-img" src="${imgUrl}" alt="Product">
                <div class="wish-details">
                    <div class="wish-brand">${product.brand || 'Premium Quality'}</div>
                    <div class="wish-title">${product.name || product.description || 'Unknown Product'}</div>
                    <div class="wish-rating">⭐ ${product.rating || 4.5}</div>
                    
                    <div class="wish-price-row">
                        <span class="new-price">₹${product.price || 0}</span>
                        <span class="old-price">₹${product.old_price || 0}</span>
                        <span class="discount">${product.discount || 0}% OFF</span>
                    </div>
                    
                    <div class="wish-actions">
                        <button class="btn-remove ripple" onclick="removeWish(${item.id})">Remove</button>
                        <button class="btn-buy ripple" onclick="location.href='buy.html?id=${product.id}'">Buy Now</button>
                    </div>
                </div>
            </div>`;
        }

        // Summary Section Injection
        html += `
        <div class="summary-box">
            <h3>Wishlist Summary</h3>
            <div class="summary-row">
                <span>Total Items</span>
                <span>${wishlist.length}</span>
            </div>
            <div class="summary-row">
                <span>Total MRP</span>
                <span>₹${oldTotal}</span>
            </div>
            <div class="summary-row savings">
                <span>Total Savings</span>
                <span>- ₹${oldTotal - total}</span>
            </div>
            <div class="summary-row total">
                <span>Estimated Total</span>
                <span>₹${total}</span>
            </div>
        </div>`;

        container.innerHTML = html;

    } catch (err) {
        console.error("Error loading wishlist:", err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load wishlist.</h3><p>Check your connection and try again.</p></div>`;
    }
}

/* =========================
   REMOVE FROM WISHLIST (Global Function)
========================= */
window.removeWish = async function(id) {
    // Optimistic UI Removal (Turant hata dega UI se bina reload kiye)
    const card = document.getElementById(`wish-item-${id}`);
    if (card) {
        card.style.opacity = '0';
        setTimeout(() => card.remove(), 300);
    }
    
    // Background Database Removal
    await client.from("wishlist").delete().eq("id", id);
    
    // Page wapas reload karke summary update karne ke liye:
    setTimeout(() => location.reload(), 300); 
}

/* =========================
   UI STATES (Empty & Login)
========================= */
function renderEmptyState() {
    container.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <h3>Your wishlist is empty</h3>
            <p>Looks like you haven't added any items yet.</p>
            <a href="home.html" class="btn-primary">Explore Products</a>
        </div>
    `;
}

function renderLoginRequired() {
    container.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <h3>Login Required</h3>
            <p>Please log in to view your saved items.</p>
            <a href="login.html" class="btn-primary">Log In Now</a>
        </div>
    `;
}

/* =========================
   CART & HEADER BADGES
========================= */
function updateBadges() {
    const cart = JSON.parse(localStorage.getItem('localCart')) || JSON.parse(localStorage.getItem('cart')) || [];
    
    const headerCartCount = document.getElementById('headerCartCount');
    const floatCartCount = document.getElementById('floatCartCount');

    if (headerCartCount && floatCartCount) {
        headerCartCount.textContent = cart.length;
        floatCartCount.textContent = cart.length;
        
        const displayStatus = cart.length > 0 ? 'flex' : 'none';
        headerCartCount.style.display = displayStatus;
        floatCartCount.style.display = displayStatus;
    }
}

// Start Application
document.addEventListener("DOMContentLoaded", () => {
    updateBadges();
    loadWishlist();
});
