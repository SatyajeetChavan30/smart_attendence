from pymongo import MongoClient
import os

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "smart_attendance"

def get_db():
    client = MongoClient(MONGO_URI)
    return client[DB_NAME]

def init_db():
    db = get_db()
    
    # Create indexes for performance and uniqueness
    db.users.create_index("username", unique=True)
    db.attendance.create_index("user_id")
    
    # Insert a dummy admin user if not exists
    if db.users.count_documents({"username": "admin"}) == 0:
        db.users.insert_one({
            "username": "admin",
            "password": "admin",
            "name": "Satyajeet Chavan"
        })
        print("Database initialized with dummy user 'admin'.")
    else:
        print("Database already initialized.")

if __name__ == '__main__':
    init_db()
