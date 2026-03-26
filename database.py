from pymongo import MongoClient
import hashlib
import os

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "smart_attendance"

def get_db():
    client = MongoClient(MONGO_URI)
    return client[DB_NAME]

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def init_db():
    db = get_db()

    db.users.create_index("username", unique=True)
    db.attendance.create_index("user_id")
    db.attendance.create_index("timestamp")

    if db.users.count_documents({"username": "admin"}) == 0:
        db.users.insert_one({
            "username": "admin",
            "password": hash_password("admin"),
            "name": "Satyajeet Chavan"
        })
        print("Database initialized with default user 'admin' (password: admin).")
    else:
        print("Database already initialized.")

if __name__ == '__main__':
    init_db()
