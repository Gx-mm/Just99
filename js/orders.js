/* =========================
   SUPABASE CONFIG & INIT
========================= */
const client = supabase.createClient(
    "https://xjiwwapiqszpnoqaripq.supabase.co",
    "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe"
);

/* =========================
   STATUS INFO LOGIC
========================= */
function statusInfo(status){
    if(status==="Pending") return { text: "Pending", class: "status-pending", icon: "🕒" };
    if(status==="Processing") return { text: "Processing", class: "status-processing", icon: "⚙️" };
    if(status==="Shipped") return { text: "Shipped", class: "status-shipped", icon: "📦" };
    if(status==="Delivered") return { text: "Delivered", class: "status-delivered", icon: "✅" };
    if(status==="Cancelled") return { text: "Cancelled", class: "status-cancelled", icon: "❌" };
    return { text: status || "Unknown", class: "status-pending", icon: "📌" };
}

/* =========================
   EXACT OLD FETCH LOGIC WITH NEW UI & IMAGE FIX
========================= */
async function loadOrders(){
    const userId = localStorage.getItem("userId");
    const box = document.getElementById("mainContainer");

    // Start with a premium loading message (skeleton)
    box.innerHTML = `
        <div class="skeleton-order skeleton">
            <div class="sk-header"><div class="sk-line" style="width: 40%"></div><div class="sk-line" style="width: 20%"></div></div>
            <div class="sk-body">
                <div class="sk-img skeleton"></div>
                <div class="sk-content">
                    <div class="sk-line" style="width: 80%"></div><div class="sk-line" style="width: 50%"></div>
                </div>
            </div>
        </div>`;

    const {data, error} = await client
        .from("orders")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", {ascending: false});

    if(error){
        box.innerHTML='<div class="empty-state" style="text-align:center; margin-top:50px;">Failed to load orders</div>';
        return;
    }

    if(!data || !data.length){
        box.innerHTML=`
            <div class="auth-card">
                <svg class="auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M16 16s-1.5-2-4-2-4 2-4 2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                <h3>No orders found</h3>
                <p>Login or start shopping to see your orders here.</p>
                <div style="margin-top: 15px;">
                    <a href="login.html" class="btn-primary" style="margin-right: 10px;">Log In</a>
                    <a href="home.html" class="btn-primary" style="background:var(--secondary); color:var(--primary);">Go Home</a>
                </div>
            </div>`;
        return;
    }

    let html = '<div class="orders-grid">';
    
    data.forEach((order, index) => {
        const statusData = statusInfo(order.order_status);
        const animDelay = index * 0.05;
        
        // ===============================================
        // IMAGE FIX: Parse comma-separated images & pick 1st URL
        // ===============================================
        const parsedThumbs = String(order.product_image || "").split(",").map(u => u.trim()).filter(Boolean);
        const firstImageUrl = parsedThumbs.length > 0 ? parsedThumbs[0] : 'https://via.placeholder.com/150?text=No+Image';
        
        html += `
        <div class="order-card" style="animation-delay: ${animDelay}s">
            <div class="order-header">
                <div class="order-id-date">
                    <span class="order-id">Order #${order.id}</span>
                    <span class="order-date">${new Date(order.created_at).toLocaleString()}</span>
                </div>
                <div class="status-badge ${statusData.class}">
                    ${statusData.icon} ${statusData.text}
                </div>
            </div>
            
            <div class="order-body">
                <div class="order-img-wrap">
                    <!-- Yaha hum fixed image URL use kar rahe hain -->
                    <img src="${firstImageUrl}" alt="${order.product_name || 'Product'}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                </div>
                <div class="order-details">
                    <div class="order-product-name">${order.product_name || ''}</div>
                    <div class="order-meta-grid">
                        <div class="meta-item">Qty: <strong>${order.quantity || 1}</strong></div>
                        <div class="meta-item">Price: <strong>₹${order.price || 0}</strong></div>
                        <div class="meta-item">Customer: <strong>${order.coustomer_name || ''}</strong></div>
                        <div class="meta-item">Phone: <strong>${order.coustomer_phone || ''}</strong></div>
                        <div class="meta-item" style="grid-column: 1 / -1;">Payment: <strong>${order.payment_method || ''}</strong></div>
                    </div>
                    <div class="order-total-highlight">Total: ₹${order.total_amount || 0}</div>
                </div>
            </div>
        </div>`;
    });

    html += '</div>';
    box.innerHTML = html;
}

/* =========================
   CART & WISHLIST COUNTERS
========================= */
function updateHeaderCounters() {
    const cart = JSON.parse(localStorage.getItem("localCart") || "[]");
    const headerCartCount = document.getElementById("headerCartCount");
    const floatCartCount = document.getElementById("floatCartCount");
    
    if (headerCartCount && floatCartCount) {
        headerCartCount.innerText = cart.length;
        floatCartCount.innerText = cart.length;
        const displayStyle = cart.length > 0 ? "flex" : "none";
        headerCartCount.style.display = displayStyle;
        floatCartCount.style.display = displayStyle;
    }
}

// Start application
updateHeaderCounters();
loadOrders();
