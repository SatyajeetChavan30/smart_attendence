from database import get_db
from datetime import datetime, timedelta

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

    @staticmethod
    def get_weekly_trend(user_id):
        """Returns attendance data for the last 7 days as chart bars."""
        db = get_db()
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        day_labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        trend = []

        for i in range(6, -1, -1):
            day_start = today - timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            record = db.attendance.find_one({
                "user_id": user_id,
                "timestamp": {"$gte": day_start, "$lt": day_end}
            })
            label = day_labels[day_start.weekday() % 7 if day_start.weekday() < 6 else 6]
            label = day_labels[day_start.isoweekday() % 7]  # isoweekday: Mon=1..Sun=7, %7 → Sun=0
            if record:
                status = record.get("status", "Present")
                value = 100 if status == "Present" else (60 if status == "Late" else 0)
            else:
                value = 0
            trend.append({"day": day_start.strftime("%a")[0], "value": value, "status": record["status"] if record else "None"})

        return trend

    @staticmethod
    def get_dashboard_stats(user_id):
        """Returns overall attendance %, today's status, and late count."""
        db = get_db()

        total = db.attendance.count_documents({"user_id": user_id})
        present = db.attendance.count_documents({"user_id": user_id, "status": "Present"})
        late = db.attendance.count_documents({"user_id": user_id, "status": "Late"})

        overall_pct = round((present / total) * 100) if total > 0 else 0

        # Today's status
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        today_record = db.attendance.find_one({
            "user_id": user_id,
            "timestamp": {"$gte": today_start, "$lt": today_end}
        })
        today_status = today_record["status"] if today_record else "Not Marked"

        return {
            "overall_pct": overall_pct,
            "today_status": today_status,
            "late_count": late,
            "total": total
        }
