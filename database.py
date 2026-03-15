import sqlite3
import os

DB_FILE = "attendance.db"

def init_db():
    if os.path.exists(DB_FILE):
        return # DB already exists

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL
        )
    ''')

    # Create Attendance table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL,
            location TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    ''')

    # Insert a dummy admin user
    cursor.execute("INSERT INTO users (username, password, name) VALUES ('admin', 'admin', 'Satyajeet Chavan')")

    conn.commit()
    conn.close()
    print("Database initialized with dummy user 'admin'.")

if __name__ == '__main__':
    init_db()
