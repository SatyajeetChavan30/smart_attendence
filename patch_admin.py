import sys
sys.path.insert(0, '.')
from pymongo import MongoClient

db = MongoClient('mongodb://localhost:27017/')['smart_attendance']
db.users.update_one({'username': 'admin'}, {'$set': {'face_descriptor': [0.0]*128}})
print('Admin user patched with dummy descriptor')
