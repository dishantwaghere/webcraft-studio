
// ========================================
// WEBCRAFT STUDIO - MAIN JAVASCRIPT
// ========================================

// 1. API Configuration
const API_BASE_URL = "http://127.0.0.1:5000";

// 2. Automatically Update Footer Year
const yearElement = document.getElementById("year");

if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
}

// 3. Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", function (event) {

        const targetId = this.getAttribute("href");
        const target = document.querySelector(targetId);

        if (target) {
            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});

// 4. Contact Form Backend Integration
const contactForm = document.getElementById("contactForm");

if (contactForm) {

    contactForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const submitBtn = document.getElementById("submitBtn");
        const formMessage = document.getElementById("formMessage");

        // Read form values
        const formData = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            service: document.getElementById("service").value,
            message: document.getElementById("message").value.trim(),
            website: contactForm.querySelector('[name="website"]').value
        };

        // Show sending status
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";

        formMessage.textContent = "Sending your enquiry...";
        formMessage.className = "";

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/contact`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(formData)
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to submit your enquiry."
                );
            }

            // Success
            formMessage.textContent =
                "Thank you! Your enquiry has been submitted successfully.";

            formMessage.className = "success";

            contactForm.reset();

        } catch (error) {

            console.error("Contact Form Error:", error);

            formMessage.textContent =
                error.message || "Something went wrong. Please try again.";

            formMessage.className = "error";

        } finally {

            submitBtn.disabled = false;
            submitBtn.textContent = "Send Message";
        }
    });
}

// 5. Website Loaded Successfully
console.log("Welcome to WebCraft Studio!");
console.log("Website loaded successfully.");
console.log("Contact form integration initialized.");
