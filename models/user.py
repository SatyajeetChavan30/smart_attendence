from database import get_db, hash_password
from bson import ObjectId

class User:
    @staticmethod
    def find_by_username(username):
        db = get_db()
        return db.users.find_one({"username": username})

    @staticmethod
    def find_by_id(user_id):
        db = get_db()
        from bson.errors import InvalidId
        try:
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            return db.users.find_one({"_id": user_id})
        except InvalidId:
            return None

    @staticmethod
    def verify_login(username, password):
        db = get_db()
        return db.users.find_one({"username": username, "password": hash_password(password)})

    @staticmethod
    def create_user(username, password, name, face_descriptor=None):
        db = get_db()
        # Check if username exists
        if db.users.find_one({"username": username}):
            raise Exception("Username already exists")
        
        user_doc = {
            "username": username,
            "password": hash_password(password),
            "name": name,
            "face_descriptor": face_descriptor  # array of 128 floats
        }
        result = db.users.insert_one(user_doc)
        return result.inserted_id
    @staticmethod
    def get_all_descriptors():
        db = get_db()
        # Find all users who have a face descriptor
        users = list(db.users.find({"face_descriptor": {"$ne": None}}, {"name": 1, "face_descriptor": 1}))
        return users
