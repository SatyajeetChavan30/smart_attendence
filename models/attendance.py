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

    @staticmethod
    def get_stats(user_id):
        db = get_db()
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$status",
                "count": {"$sum": 1}
            }}
        ]
        results = list(db.attendance.aggregate(pipeline))
        
        stats = {"Present": 0, "Absent": 0, "Late": 0}
        for res in results:
            if res["_id"] in stats:
                stats[res["_id"]] = res["count"]
        
        return stats
