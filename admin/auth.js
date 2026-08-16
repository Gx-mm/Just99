const adminLogin = localStorage.getItem("admin_login");
const adminId = localStorage.getItem("admin_id");

if (adminLogin !== "true" || !adminId) {
    localStorage.clear();
    window.location.replace("login.html");
}