from flask import Flask, request, jsonify, send_from_directory, redirect
import sqlite3
import os

app = Flask(__name__, static_folder='.', static_url_path='')
DB_FILE = 'attendance.db'

# Initialize database if not exists
from database import init_db
init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# ---- Static File Routes ----
@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ---- API Endpoints ----
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password)).fetchone()
    conn.close()

    if user:
        return jsonify({
            "success": True,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "name": user['name']
            }
        })
    else:
        return jsonify({"success": False, "message": "Invalid username or password"}), 401

@app.route('/api/mark-attendance', methods=['POST'])
def mark_attendance():
    data = request.json
    user_id = data.get('user_id')
    status = data.get('status', 'Present')
    location = data.get('location', 'Unknown')

    if not user_id:
        return jsonify({"success": False, "message": "Missing user_id"}), 400

    conn = get_db_connection()
    conn.execute(
        "INSERT INTO attendance (user_id, status, location) VALUES (?, ?, ?)",
        (user_id, status, location)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "Attendance marked successfully"})

if __name__ == '__main__':
    print("Starting Smart Attendance ERP Server on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
