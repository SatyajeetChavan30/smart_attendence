from flask import Flask, request, jsonify, send_from_directory, redirect
import os
from database import init_db
from models.user import User
from models.attendance import Attendance

app = Flask(__name__, static_folder='.', static_url_path='')

# Initialize database
init_db()

# Custom JSON encoder to handle MongoDB ObjectId
from flask.json.provider import DefaultJSONProvider
from bson import ObjectId

class CustomJSONProvider(DefaultJSONProvider):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        return super().default(obj)

app.json = CustomJSONProvider(app)

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

    user = User.verify_login(username, password)

    if user:
        return jsonify({
            "success": True,
            "user": {
                "id": str(user['_id']),
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

    try:
        attendance_id = Attendance.mark(user_id, status, location)
        return jsonify({
            "success": True, 
            "message": "Attendance marked successfully",
            "attendance_id": str(attendance_id)
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    print("Starting Smart Attendance ERP Server with MongoDB on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
