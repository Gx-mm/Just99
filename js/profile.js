/* ==========================================
   SUPABASE CONFIGURATION
========================================== */
var SUPABASE_URL = "https://xjiwwapiqszpnoqaripq.supabase.co";
var SUPABASE_ANON_KEY = "sb_publishable_TJQTU1yv270qrVAEW6Ygwg_HxRtmCTe";
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var uid = localStorage.getItem("userId");

/* ==========================================
   DOM ELEMENTS
========================================== */
const profileSkeleton = document.getElementById('profileSkeleton');
const profileContent = document.getElementById('profileContent');

const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const userPhoneEl = document.getElementById('userPhone');
const userEmailRow = document.getElementById('userEmailRow');
const userPhoneRow = document.getElementById('userPhoneRow');
const smartBalanceEl = document.getElementById('smartBalance');

const statTotal = document.getElementById('statTotal');
const statShipped = document.getElementById('statShipped');
const statDelivered = document.getElementById('statDelivered');
const statReturned = document.getElementById('statReturned');

const modal = document.getElementById('modal');
const customPopup = document.getElementById('customPopup');
const popupTitle = document.getElementById('popupTitle');
const popupMessage = document.getElementById('popupMessage');
const popupActions = document.getElementById('popupActions');
const saveAddressBtn = document.getElementById('saveAddressBtn');

// Address Form Elements
const f_name = document.getElementById('full_name');
const f_phone = document.getElementById('phone');
const f_address = document.getElementById('address');
const f_city = document.getElementById('city');
const f_state = document.getElementById('state');
const f_pin = document.getElementById('pincode');
const f_country = document.getElementById('country');

/* ==========================================
   INITIALIZATION
========================================== */
document.addEventListener('DOMContentLoaded', () => {
    if (!uid) {
        window.location.href = 'login.html';
        return;
    }
    
    updateBadges();
    loadProfile();
    loadOrderStats();
});

/* ==========================================
   DATA FETCHING (Profile & Address)
========================================== */
async function loadProfile() {
    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", uid)
            .single();
            
        if (userError) throw userError;

        if (user) {
            userNameEl.innerText = user.name || "Customer";
            smartBalanceEl.innerText = "₹" + Number(user.smart_balance || 0).toFixed(2);
            smartBalanceEl.classList.remove('skeleton-text');
            
            if (user.email) {
                userEmailEl.innerText = user.email;
            } else {
                userEmailRow.style.display = 'none';
            }
            
            if (user.phone) {
                userPhoneEl.innerText = user.phone;
            } else {
                userPhoneRow.style.display = 'none';
            }
        }

        const { data: addr } = await supabase
            .from("addresses")
            .select("*")
            .eq("user_id", uid)
            .single();

        if (addr) {
            f_name.value = addr.full_name || "";
            f_phone.value = addr.phone || "";
            f_address.value = addr.address || "";
            f_city.value = addr.city || "";
            f_state.value = addr.state || "";
            f_pin.value = addr.pincode || "";
            f_country.value = addr.country || "";
            
            if (!user.name && addr.full_name) userNameEl.innerText = addr.full_name;
            if (!user.phone && addr.phone) {
                userPhoneEl.innerText = addr.phone;
                userPhoneRow.style.display = 'flex';
            }
        }

        profileSkeleton.style.display = 'none';
        profileContent.style.display = 'flex';

    } catch (error) {
        console.error("Error loading profile:", error);
        profileSkeleton.style.display = 'none';
        profileContent.style.display = 'flex';
        userNameEl.innerText = "Account Error";
        smartBalanceEl.classList.remove('skeleton-text');
    }
}

/* ==========================================
   DATA FETCHING (Order Statistics)
========================================== */
async function loadOrderStats() {
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('order_status')
            .eq('user_id', uid);

        if (error) throw error;

        const allOrders = orders || [];
        const total = allOrders.length;
        let shipped = 0, delivered = 0, returned = 0;

        allOrders.forEach(o => {
            const status = (o.status || '').toLowerCase();
            if (status.includes('ship')) shipped++;
            if (status.includes('deliver')) delivered++;
            if (status.includes('return') || status.includes('cancel')) returned++;
        });

        [statTotal, statShipped, statDelivered, statReturned].forEach(el => el.classList.remove('skeleton-text'));

        statTotal.innerText = total;
        statShipped.innerText = shipped;
        statDelivered.innerText = delivered;
        statReturned.innerText = returned;

    } catch (error) {
        console.error("Error loading stats:", error);
        [statTotal, statShipped, statDelivered, statReturned].forEach(el => {
            el.classList.remove('skeleton-text');
            el.innerText = "-";
        });
    }
}

/* ==========================================
   MODAL & SAVING LOGIC
========================================== */
function openModal() { modal.classList.add('show'); }
function closeModal() { modal.classList.remove('show'); }

window.onclick = (e) => {
    if (e.target === modal) closeModal();
    if (e.target === customPopup) closePopup();
}

async function saveAddress() {
    const originalText = saveAddressBtn.innerText;
    saveAddressBtn.innerText = "Saving...";
    saveAddressBtn.disabled = true;

    try {
        const payload = {
            user_id: uid,
            full_name: f_name.value.trim(),
            phone: f_phone.value.trim(),
            address: f_address.value.trim(),
            city: f_city.value.trim(),
            state: f_state.value.trim(),
            pincode: f_pin.value.trim(),
            country: f_country.value.trim()
        };

        const { data } = await supabase.from("addresses").select("id").eq("user_id", uid);
        
        let errorObj = null;
        if (data && data.length > 0) {
            const { error } = await supabase.from("addresses").update(payload).eq("user_id", uid);
            errorObj = error;
        } else {
            const { error } = await supabase.from("addresses").insert([payload]);
            errorObj = error;
        }

        if (errorObj) throw errorObj;

        closeModal();
        showPopup("Success", "Your profile & address have been updated.");
        loadProfile(); 

    } catch (error) {
        console.error("Save Address Error:", error);
        showPopup("Error", "Failed to save details. Please try again.");
    } finally {
        saveAddressBtn.innerText = originalText;
        saveAddressBtn.disabled = false;
    }
}

/* ==========================================
   POPUP & LOGOUT LOGIC
========================================== */
function showPopup(title, message) {
    popupTitle.innerText = title;
    popupMessage.innerText = message;
    popupActions.innerHTML = `<button class="save-btn ripple" onclick="closePopup()">OK</button>`;
    customPopup.classList.add('show');
}

function closePopup() {
    customPopup.classList.remove('show');
}

function confirmLogout() {
    popupTitle.innerText = "Sign Out";
    popupMessage.innerText = "Are you sure you want to log out of your account?";
    popupActions.innerHTML = `
        <button class="btn-cancel ripple" onclick="closePopup()">Cancel</button>
        <button class="btn-danger ripple" onclick="executeLogout()">Logout</button>
    `;
    customPopup.classList.add('show');
}

// YAHAN LOGOUT LOOP FIX KIYA GAYA HAI
function executeLogout() {
    // Sare authentication variables properly delete karein
    localStorage.removeItem("userId");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userPhone");
    
    // Supabase auth tokens delete karein
    for (let key in localStorage) {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
        }
    }
    window.location.replace("login.html");
}

/* ==========================================
   BADGE UI HELPERS
========================================== */
function updateBadges() {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    
    const headerCartCount = document.getElementById('headerCartCount');
    const floatCartCount = document.getElementById('floatCartCount');
    const headerWishlistCount = document.getElementById('headerWishlistCount');

    if (headerCartCount) {
        headerCartCount.textContent = cart.length;
        headerCartCount.style.display = cart.length > 0 ? 'flex' : 'none';
    }
    if (floatCartCount) {
        floatCartCount.textContent = cart.length;
        floatCartCount.style.display = cart.length > 0 ? 'flex' : 'none';
    }
    if (headerWishlistCount) {
        headerWishlistCount.textContent = wishlist.length;
        headerWishlistCount.style.display = wishlist.length > 0 ? 'flex' : 'none';
    }
}
