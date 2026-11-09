
// =====================================
// WEBCRAFT STUDIO
// ADMIN DASHBOARD JAVASCRIPT
// =====================================

const API_BASE_URL = "http://127.0.0.1:5000";

const csrfToken = sessionStorage.getItem("adminCsrfToken");

const enquiriesTable = document.getElementById("enquiriesTable");
const dashboardMessage = document.getElementById("dashboardMessage");

// =====================================
// 1. CHECK ADMIN LOGIN
// =====================================

if (!csrfToken) {
    window.location.href = "admin.html";
}

// =====================================
// 2. LOAD CUSTOMER ENQUIRIES
// =====================================

async function loadEnquiries() {

    try {
        dashboardMessage.textContent = "Loading enquiries...";

        const response = await fetch(
            `${API_BASE_URL}/api/admin/enquiries`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || result.error || "Unable to load enquiries."
            );
        }

        // Backend sends enquiries inside result.data
        const enquiries = Array.isArray(result.data)
            ? result.data
            : [];

        displayEnquiries(enquiries);
        updateStatistics(enquiries);

        dashboardMessage.textContent =
            enquiries.length === 0
                ? "No customer enquiries found."
                : "Enquiries loaded successfully.";

    } catch (error) {

        dashboardMessage.textContent = error.message;

        enquiriesTable.innerHTML = `
            <tr>
                <td colspan="6">Unable to load enquiries.</td>
            </tr>
        `;
    }
}

// =====================================
// 3. DISPLAY ENQUIRIES
// =====================================

function displayEnquiries(enquiries) {

    enquiriesTable.innerHTML = "";

    if (enquiries.length === 0) {

        enquiriesTable.innerHTML = `
            <tr>
                <td colspan="6">No enquiries available.</td>
            </tr>
        `;

        return;
    }

    enquiries.forEach(enquiry => {

        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.textContent = enquiry.name || "";

        const emailCell = document.createElement("td");
        emailCell.textContent = enquiry.email || "";

        const serviceCell = document.createElement("td");
        serviceCell.textContent = enquiry.service || "";

        const messageCell = document.createElement("td");
        messageCell.textContent = enquiry.message || "";

        // Status dropdown
        const statusCell = document.createElement("td");
        const statusSelect = document.createElement("select");

        ["New", "Contacted", "Completed"].forEach(status => {

            const option = document.createElement("option");

            option.value = status;
            option.textContent = status;
            option.selected = enquiry.status === status;

            statusSelect.appendChild(option);
        });

        statusSelect.addEventListener("change", () => {
            updateStatus(enquiry.id, statusSelect.value);
        });

        statusCell.appendChild(statusSelect);

        // Delete button
        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");

        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteEnquiry(enquiry.id);
        });

        actionCell.appendChild(deleteButton);

        row.append(
            nameCell,
            emailCell,
            serviceCell,
            messageCell,
            statusCell,
            actionCell
        );

        enquiriesTable.appendChild(row);
    });
}

// =====================================
// 4. UPDATE STATISTICS
// =====================================

function updateStatistics(enquiries) {

    document.getElementById("totalCount").textContent =
        enquiries.length;

    document.getElementById("newCount").textContent =
        enquiries.filter(item => item.status === "New").length;

    document.getElementById("completedCount").textContent =
        enquiries.filter(item => item.status === "Completed").length;
}

// =====================================
// 5. UPDATE ENQUIRY STATUS
// =====================================

async function updateStatus(id, status) {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/enquiries/${id}/status`,
            {
                method: "PATCH",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken
                },
                body: JSON.stringify({ status: status })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || result.error || "Status update failed."
            );
        }

        dashboardMessage.textContent = "Status updated successfully.";

        await loadEnquiries();

    } catch (error) {

        dashboardMessage.textContent = error.message;
    }
}

// =====================================
// 6. DELETE ENQUIRY
// =====================================

async function deleteEnquiry(id) {

    const confirmDelete = confirm(
        "Are you sure you want to delete this enquiry?"
    );

    if (!confirmDelete) return;

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/enquiries/${id}`,
            {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "X-CSRF-Token": csrfToken
                }
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || result.error || "Delete failed."
            );
        }

        dashboardMessage.textContent = "Enquiry deleted successfully.";

        await loadEnquiries();

    } catch (error) {

        dashboardMessage.textContent = error.message;
    }
}

// =====================================
// 7. ADMIN LOGOUT
// =====================================

document.getElementById("logoutBtn").addEventListener("click", async () => {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/logout`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "X-CSRF-Token": csrfToken
                }
            }
        );

        if (!response.ok) {
            throw new Error("Logout failed. Please try again.");
        }

        sessionStorage.removeItem("adminCsrfToken");

        window.location.href = "admin.html";

    } catch (error) {

        dashboardMessage.textContent = error.message;
    }
});

// =====================================
// 8. INITIALIZE DASHBOARD
// =====================================

if (csrfToken) {
    loadEnquiries();
}
