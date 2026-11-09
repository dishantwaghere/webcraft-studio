
// =====================================
// WEBCRAFT STUDIO
// ADMIN LOGIN JAVASCRIPT
// =====================================

const API_BASE_URL = "http://127.0.0.1:5000";

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

// =====================================
// ADMIN LOGIN
// =====================================

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";
    loginMessage.textContent = "";

    try {

        const response = await fetch(`${API_BASE_URL}/api/admin/login`, {

            method: "POST",

            credentials: "include",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || data.error || "Invalid username or password."
            );
        }

        // Get CSRF token from nested backend response
        const csrfToken = data.data?.csrf_token;

        if (!csrfToken) {
            throw new Error("Security token missing. Please try again.");
        }

        // Save CSRF token for dashboard actions
        sessionStorage.setItem("adminCsrfToken", csrfToken);

        loginMessage.textContent = "Login successful! Redirecting...";
        loginMessage.style.color = "#60a5fa";

        // Open Admin Dashboard
        window.location.href = "dashboard.html";

    } catch (error) {

        loginMessage.textContent = error.message;
        loginMessage.style.color = "#f87171";

    } finally {

        loginBtn.disabled = false;
        loginBtn.textContent = "Sign In";
    }
});
