// Initialize Icons
feather.replace();

// Set Current Date
const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', dateOptions);

// Sidebar Toggle for Mobile
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Toast Notification System
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toast-container');
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
    feather.replace();

    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3.5s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// --- Supabase Integration ---
const SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";

// FIX 1: Variable ka naam supabaseClient rakha gaya hai taaki redeclaration error na aaye
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let chartInstance = null;

// Formatting utilities
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute:'2-digit' }).format(new Date(dateString));
};

const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    if(s.includes('approve') || s.includes('success') || s.includes('delivered') || s.includes('completed')) return `<span class="badge success">${status}</span>`;
    if(s.includes('reject') || s.includes('fail') || s.includes('cancel')) return `<span class="badge danger">${status}</span>`;
    if(s.includes('pend') || s.includes('process')) return `<span class="badge warning">${status}</span>`;
    return `<span class="badge neutral">${status || 'Unknown'}</span>`;
};

// Empty State Generator
const getEmptyState = (message) => `
    <tr>
        <td colspan="100%">
            <div class="empty-state">
                <i data-feather="inbox" class="empty-icon"></i>
                <h3>No Data Found</h3>
                <p>${message}</p>
            </div>
        </td>
    </tr>
`;

// Fetch and Initialize Dashboard
async function initDashboard() {
    try {
        // Fetch everything in parallel using supabaseClient
        const [
            { data: products, count: productsCount, error: pErr },
            { data: orders, count: ordersCount, error: oErr },
            { data: users, count: usersCount, error: uErr },
            { data: walletReqs, count: walletReqsCount, error: wErr }
        ] = await Promise.all([
            supabaseClient.from('products').select('id', { count: 'exact', head: true }),
            supabaseClient.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false }),
            supabaseClient.from('users').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(5),
            supabaseClient.from('wallet_requests').select('*').order('created_at', { ascending: false }).limit(10)
        ]);

        if (pErr) throw pErr;
        if (oErr) throw oErr;
        if (uErr) throw uErr;
        if (wErr) throw wErr;

        // FIX 2: ordersCount ko correctly pass kiya gaya hai
        processStats(productsCount, orders, ordersCount, usersCount, walletReqs);
        
        renderChart(orders);
        renderOrdersTable(orders.slice(0, 5));
        renderUsersTable(users);
        renderWalletTable(walletReqs);
        
        feather.replace(); 

    } catch (error) {
        console.error(error);
        showToast('Connection Error', 'Failed to fetch live data from Supabase', 'error');
        document.querySelectorAll('.stat-value').forEach(el => el.innerHTML = '-');
        document.querySelectorAll('tbody').forEach(el => el.innerHTML = getEmptyState('Failed to load data.'));
        feather.replace();
    }
}

// Process Top Cards
// FIX 2: ordersCount ko arguments mein accept kiya gaya hai
function processStats(productsCount, orders, ordersCount, usersCount, walletReqs) {
    const today = new Date().toISOString().split('T')[0];
    
    let totalRev = 0;
    let todayOrdersCount = 0;

    orders.forEach(o => {
        const amt = Number(o.amount || o.total_amount || 0);
        totalRev += amt;
        if (o.created_at && o.created_at.startsWith(today)) {
            todayOrdersCount++;
        }
    });

    const pendingWallets = walletReqs.filter(w => (w.status || '').toLowerCase() === 'pending').length;

    document.getElementById('stat-revenue').textContent = formatCurrency(totalRev);
    document.getElementById('stat-orders').textContent = ordersCount || 0;
    document.getElementById('stat-today-orders').textContent = todayOrdersCount;
    document.getElementById('stat-users').textContent = usersCount || 0;
    document.getElementById('stat-products').textContent = productsCount || 0;
    document.getElementById('stat-pending-wallets').textContent = pendingWallets;
}

// Render Analytics Chart
function renderChart(orders) {
    const ctx = document.getElementById('ordersChart').getContext('2d');
    
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
    }).reverse();

    const dataPoints = last7Days.map(date => {
        return orders.filter(o => o.created_at && o.created_at.startsWith(date))
                     .reduce((sum, o) => sum + Number(o.amount || o.total_amount || 0), 0);
    });

    const labels = last7Days.map(date => {
        return new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Revenue',
                data: dataPoints,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111827',
                    padding: 12,
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 14, weight: 'bold' },
                    callbacks: {
                        label: (context) => formatCurrency(context.raw)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6', drawBorder: false },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#9ca3af',
                        callback: (value) => '₹' + value
                    }
                },
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: '#9ca3af'
                    }
                }
            }
        }
    });
}

// Render Orders Table
function renderOrdersTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    if (!orders || orders.length === 0) {
        tbody.innerHTML = getEmptyState('No orders placed yet.');
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>
                <div class="product-cell">
                    ${order.product_image ? `<img src="${order.product_image}" class="product-img" alt="Product">` : `<div class="product-img" style="display:flex; align-items:center; justify-content:center; color:#9ca3af;"><i data-feather="image" style="width:20px;height:20px;"></i></div>`}
                    <div class="product-info">
                        <span class="product-name">${order.product_name || `Order #${order.id.toString().substring(0,6)}`}</span>
                        <span class="product-meta">${order.payment_method || 'Standard Payment'}</span>
                    </div>
                </div>
            </td>
            <td>
                <div class="product-info">
                    <span class="product-name">${order.customer_name || 'Guest User'}</span>
                </div>
            </td>
            <td style="font-weight: 600;">${formatCurrency(order.amount || order.total_amount)}</td>
            <td>${getStatusBadge(order.status)}</td>
            <td style="color: var(--text-secondary); font-size: 13px;">${formatDate(order.created_at)}</td>
        </tr>
    `).join('');
}

// Render Users Table
function renderUsersTable(users) {
    const tbody = document.getElementById('users-table-body');
    if (!users || users.length === 0) {
        tbody.innerHTML = getEmptyState('No users registered.');
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="product-info">
                    <span class="product-name">${user.name || user.email || 'Anonymous'}</span>
                    <span class="product-meta">ID: ${user.id.toString().substring(0,8)}...</span>
                </div>
            </td>
            <td style="font-weight: 600; color: var(--success);">${formatCurrency(user.smart_balance || 0)}</td>
        </tr>
    `).join('');
}

// Render Wallet Requests Table
function renderWalletTable(requests) {
    const tbody = document.getElementById('wallet-table-body');
    if (!requests || requests.length === 0) {
        tbody.innerHTML = getEmptyState('No wallet requests pending.');
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const isPending = (req.status || '').toLowerCase() === 'pending';
        return `
        <tr>
            <td style="font-family: monospace; font-size: 12px;">${req.user_id ? req.user_id.toString().substring(0,8)+'...' : 'N/A'}</td>
            <td style="font-weight:500;">${req.utr || 'N/A'}</td>
            <td style="font-weight: 600;">${formatCurrency(req.amount)}</td>
            <td style="color: var(--text-secondary); font-size: 13px;">${formatDate(req.created_at)}</td>
            <td>${getStatusBadge(req.status)}</td>
            <td>
                ${isPending ? `
                    <div class="action-btns">
                        <button class="btn btn-approve" onclick="approveWallet('${req.id}', '${req.user_id}', ${req.amount}, this)">
                            <i data-feather="check"></i> Approve
                        </button>
                        <button class="btn btn-reject" onclick="rejectWallet('${req.id}', this)">
                            <i data-feather="x"></i> Reject
                        </button>
                    </div>
                ` : `
                    <span style="font-size:13px; color: var(--text-tertiary);">Actioned</span>
                `}
            </td>
        </tr>
    `}).join('');
}

// --- Action Functions ---

const setBtnLoading = (btn) => {
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i data-feather="loader" style="animation: spin 1s linear infinite;"></i> Processing...`;
    feather.replace();
    return () => {
        btn.innerHTML = originalContent;
        btn.disabled = false;
        feather.replace();
    };
};

const style = document.createElement('style');
style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

// Approve Wallet Logic
window.approveWallet = async (requestId, userId, amount, btnEl) => {
    if(!confirm(`Are you sure you want to approve ${formatCurrency(amount)}?`)) return;
    
    const resetBtn = setBtnLoading(btnEl);

    try {
        const { data: user, error: userErr } = await supabaseClient
            .from('users')
            .select('smart_balance')
            .eq('id', userId)
            .single();

        if (userErr && userErr.code !== 'PGRST116') throw userErr;

        const currentBalance = user ? Number(user.smart_balance || 0) : 0;
        const newBalance = currentBalance + Number(amount);

        const { error: updateUsrErr } = await supabaseClient
            .from('users')
            .update({ smart_balance: newBalance })
            .eq('id', userId);
        
        if (updateUsrErr) throw updateUsrErr;

        const { error: updateReqErr } = await supabaseClient
            .from('wallet_requests')
            .update({ status: 'Approved' })
            .eq('id', requestId);

        if (updateReqErr) throw updateReqErr;

        showToast('Success', 'Wallet request approved & balance updated successfully.');
        initDashboard(); 

    } catch (error) {
        console.error(error);
        showToast('Action Failed', error.message || 'Could not approve request.', 'error');
        resetBtn();
    }
};

// Reject Wallet Logic
window.rejectWallet = async (requestId, btnEl) => {
    if(!confirm('Are you sure you want to reject this request?')) return;
    
    const resetBtn = setBtnLoading(btnEl);

    try {
        const { error } = await supabaseClient
            .from('wallet_requests')
            .update({ status: 'Rejected' })
            .eq('id', requestId);

        if (error) throw error;

        showToast('Rejected', 'Wallet request has been rejected.');
        initDashboard(); 

    } catch (error) {
        console.error(error);
        showToast('Action Failed', error.message || 'Could not reject request.', 'error');
        resetBtn();
    }
};

// Start App
document.addEventListener('DOMContentLoaded', initDashboard);
