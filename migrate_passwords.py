import sys
sys.path.insert(0, '.')
from pymongo import MongoClient
import hashlib, re

def hp(p):
    return hashlib.sha256(p.encode()).hexdigest()

pat = re.compile(r'^[a-f0-9]{64}$')
db = MongoClient('mongodb://localhost:27017/')['smart_attendance']
migrated = 0
for u in db.users.find():
    pwd = u.get('password', '')
    if not pat.match(pwd):
        db.users.update_one({'_id': u['_id']}, {'$set': {'password': hp(pwd)}})
        print('Migrated:', u['username'])
        migrated += 1

print('Done.', migrated, 'user(s) migrated.')
