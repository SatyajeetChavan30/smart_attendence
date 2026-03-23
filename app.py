from flask import Flask, request, jsonify, send_from_directory
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

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    name = data.get('name')
    face_descriptor = data.get('face_descriptor') # array of 128 floats

    if not all([username, password, name, face_descriptor]):
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    try:
        user_id = User.create_user(username, password, name, face_descriptor)
        return jsonify({"success": True, "message": "User registered successfully", "user_id": str(user_id)})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 400

@app.route('/api/user-descriptor', methods=['GET'])
def get_user_descriptor():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Missing user_id"}), 400
    
    user = User.find_by_id(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    return jsonify({
        "success": True,
        "face_descriptor": user.get('face_descriptor')
    })

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

@app.route('/api/attendance-history', methods=['GET'])
def get_attendance_history():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Missing user_id"}), 400

    try:
        history = Attendance.get_user_history(user_id)
        return jsonify({
            "success": True,
            "history": history
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/attendance-stats', methods=['GET'])
def get_attendance_stats():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Missing user_id"}), 400

    try:
        stats = Attendance.get_stats(user_id)
        trend = Attendance.get_weekly_trend(user_id)
        return jsonify({
            "success": True,
            "stats": stats,
            "trend": trend
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/dashboard-stats', methods=['GET'])
def get_dashboard_stats():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "Missing user_id"}), 400

    try:
        stats = Attendance.get_dashboard_stats(user_id)
        return jsonify({"success": True, **stats})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    print("Starting Smart Attendance ERP Server with MongoDB on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=True)
