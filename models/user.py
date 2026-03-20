from database import get_db
from bson import ObjectId

class User:
    @staticmethod
    def find_by_username(username):
        db = get_db()
        return db.users.find_one({"username": username})

    @staticmethod
    def find_by_id(user_id):
        db = get_db()
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
        return db.users.find_one({"_id": user_id})

    @staticmethod
    def verify_login(username, password):
        db = get_db()
        return db.users.find_one({"username": username, "password": password})
