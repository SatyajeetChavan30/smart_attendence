from database import get_db
from datetime import datetime

class Attendance:
    @staticmethod
    def mark(user_id, status='Present', location='Unknown'):
        db = get_db()
        attendance_record = {
            "user_id": user_id,
            "timestamp": datetime.utcnow(),
            "status": status,
            "location": location
        }
        result = db.attendance.insert_one(attendance_record)
        return result.inserted_id

    @staticmethod
    def get_user_history(user_id):
        db = get_db()
        return list(db.attendance.find({"user_id": user_id}).sort("timestamp", -1))
