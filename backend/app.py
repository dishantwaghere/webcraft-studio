
import os
import re
import sqlite3
import secrets
from pathlib import Path
from functools import wraps
from datetime import timedelta
from flask_cors import CORS

from flask import (
    Flask, request, jsonify, session, g
)
from werkzeug.security import check_password_hash


# -----------------------------------------
# 1. APPLICATION CONFIGURATION
# -----------------------------------------

BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "webcraft.db"

app = Flask(__name__)
# CORS Configuration
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": [
                "http://127.0.0.1:5500",
                "http://localhost:5500",
                "https://radiant-haupia-a02dcb.netlify.app"
            ]
        }
    },
    supports_credentials=True
)

app.config.update(
    SECRET_KEY=os.getenv("SECRET_KEY", "local-development-only-change-me"),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("FLASK_ENV") == "production",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=2),
    MAX_CONTENT_LENGTH=16 * 1024
)

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "")
ADMIN_PASSWORD_HASH = os.getenv("ADMIN_PASSWORD_HASH", "")


# -----------------------------------------
# 2. DATABASE CONNECTION
# -----------------------------------------

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row

    return g.db


@app.teardown_appcontext
def close_db(error=None):
    db = g.pop("db", None)

    if db is not None:
        db.close()


def init_db():
    db = get_db()

    db.execute("""
        CREATE TABLE IF NOT EXISTS enquiries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            service TEXT NOT NULL,
            message TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'New',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    db.commit()


# Initialize database when application starts
with app.app_context():
    init_db()


# -----------------------------------------
# 3. COMMON RESPONSE HELPERS
# -----------------------------------------

def success_response(message, data=None, status=200):
    response = {
        "success": True,
        "message": message
    }

    if data is not None:
        response["data"] = data

    return jsonify(response), status


def error_response(message, status=400):
    return jsonify({
        "success": False,
        "message": message
    }), status


# -----------------------------------------
# 4. INPUT VALIDATION
# -----------------------------------------

def validate_contact(data):

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    phone = str(data.get("phone", "")).strip()
    service = str(data.get("service", "")).strip()
    message = str(data.get("message", "")).strip()

    if not name or len(name) > 80:
        return None, "Name is required (maximum 80 characters)."

    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return None, "Please enter a valid email address."

    if len(email) > 254:
        return None, "Email address is too long."

    if phone and not re.fullmatch(r"[0-9+\-\s()]{7,20}", phone):
        return None, "Please enter a valid phone number."

    allowed_services = {
        "Website Design",
        "Web Development",
        "Website Maintenance",
        "Other"
    }

    if service not in allowed_services:
        return None, "Please select a valid service."

    if not message or len(message) > 2000:
        return None, "Message is required (maximum 2000 characters)."

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "service": service,
        "message": message
    }, None


# -----------------------------------------
# 5. ADMIN AUTHENTICATION
# -----------------------------------------

def admin_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        if not session.get("admin_logged_in"):
            return error_response("Admin login required.", 401)

        return function(*args, **kwargs)

    return wrapper


def csrf_required(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        token = request.headers.get("X-CSRF-Token", "")
        expected = session.get("csrf_token", "")

        if not expected or not secrets.compare_digest(token, expected):
            return error_response("Invalid security token.", 403)

        return function(*args, **kwargs)

    return wrapper


# -----------------------------------------
# 6. HEALTH CHECK API
# -----------------------------------------

@app.route("/api/health", methods=["GET"])
def health():

    return success_response(
        "WebCraft Studio backend is running.",
        {"status": "online"}
    )


# -----------------------------------------
# 7. CONTACT FORM API
# -----------------------------------------

@app.route("/api/contact", methods=["POST"])
def submit_contact():

    if not request.is_json:
        return error_response("Request must contain JSON data.", 415)

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return error_response("Invalid request data.")

    # Honeypot field: bots should leave this empty.
    if data.get("website", ""):
        return success_response("Your enquiry has been submitted.", status=201)

    contact, validation_error = validate_contact(data)

    if validation_error:
        return error_response(validation_error)

    db = get_db()

    db.execute("""
        INSERT INTO enquiries
        (name, email, phone, service, message)
        VALUES (?, ?, ?, ?, ?)
    """, (
        contact["name"],
        contact["email"],
        contact["phone"],
        contact["service"],
        contact["message"]
    ))

    db.commit()

    return success_response(
        "Thank you! Your enquiry has been submitted successfully.",
        status=201
    )


# -----------------------------------------
# 8. ADMIN LOGIN API
# -----------------------------------------

@app.route("/api/admin/login", methods=["POST"])
def admin_login():

    if not request.is_json:
        return error_response("Invalid request format.", 415)

    data = request.get_json(silent=True) or {}

    username = str(data.get("username", ""))
    password = str(data.get("password", ""))

    if not ADMIN_USERNAME or not ADMIN_PASSWORD_HASH:
        return error_response(
            "Admin credentials are not configured on the server.",
            503
        )

    if (
        not secrets.compare_digest(username, ADMIN_USERNAME)
        or not check_password_hash(ADMIN_PASSWORD_HASH, password)
    ):
        return error_response("Invalid username or password.", 401)

    session.clear()
    session["admin_logged_in"] = True
    session["csrf_token"] = secrets.token_urlsafe(32)
    session.permanent = True

    return success_response(
        "Admin login successful.",
        {"csrf_token": session["csrf_token"]}
    )


# -----------------------------------------
# 9. ADMIN LOGOUT API
# -----------------------------------------

@app.route("/api/admin/logout", methods=["POST"])
@admin_required
@csrf_required
def admin_logout():

    session.clear()

    return success_response("Admin logged out successfully.")


# -----------------------------------------
# 10. VIEW ALL ENQUIRIES
# -----------------------------------------

@app.route("/api/admin/enquiries", methods=["GET"])
@admin_required
def get_enquiries():

    db = get_db()

    enquiries = db.execute("""
        SELECT * FROM enquiries
        ORDER BY created_at DESC
    """).fetchall()

    result = [dict(row) for row in enquiries]

    return success_response(
        "Enquiries retrieved successfully.",
        result
    )


# -----------------------------------------
# 11. UPDATE ENQUIRY STATUS
# -----------------------------------------

@app.route("/api/admin/enquiries/<int:enquiry_id>/status",
           methods=["PATCH"])
@admin_required
@csrf_required
def update_enquiry_status(enquiry_id):

    if not request.is_json:
        return error_response("Invalid request format.", 415)

    data = request.get_json(silent=True) or {}
    status = data.get("status")

    allowed_statuses = {"New", "Contacted", "Completed"}

    if status not in allowed_statuses:
        return error_response("Invalid enquiry status.")

    db = get_db()

    cursor = db.execute("""
        UPDATE enquiries
        SET status = ?
        WHERE id = ?
    """, (status, enquiry_id))

    db.commit()

    if cursor.rowcount == 0:
        return error_response("Enquiry not found.", 404)

    return success_response("Enquiry status updated.")


# -----------------------------------------
# 12. DELETE ENQUIRY
# -----------------------------------------

@app.route("/api/admin/enquiries/<int:enquiry_id>",
           methods=["DELETE"])
@admin_required
@csrf_required
def delete_enquiry(enquiry_id):

    db = get_db()

    cursor = db.execute("""
        DELETE FROM enquiries
        WHERE id = ?
    """, (enquiry_id,))

    db.commit()

    if cursor.rowcount == 0:
        return error_response("Enquiry not found.", 404)

    return success_response("Enquiry deleted successfully.")


# -----------------------------------------
# 13. ERROR HANDLERS
# -----------------------------------------

@app.errorhandler(404)
def not_found(error):
    return error_response("API endpoint not found.", 404)


@app.errorhandler(405)
def method_not_allowed(error):
    return error_response("HTTP method not allowed.", 405)


@app.errorhandler(413)
def request_too_large(error):
    return error_response("Request data is too large.", 413)


@app.errorhandler(500)
def internal_error(error):
    return error_response("Internal server error.", 500)


# -----------------------------------------
# 14. START APPLICATION
# -----------------------------------------

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG") == "1"
    )
