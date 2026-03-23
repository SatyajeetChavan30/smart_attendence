import urllib.request
import os

models_dir = "models"
os.makedirs(models_dir, exist_ok=True)

base_url = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
files = [
    "ssd_mobilenetv1_model-weights_manifest.json",
    "ssd_mobilenetv1_model-shard1",
    "ssd_mobilenetv1_model-shard2",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
]

print("Downloading face-api.js models...")
for file in files:
    url = base_url + file
    dest = os.path.join(models_dir, file)
    print(f"Downloading {file}...")
    try:
        urllib.request.urlretrieve(url, dest)
    except Exception as e:
        print(f"Error downloading {file}: {e}")

print("Done downloading models.")
