
import requests
import json
import os

url = "http://localhost:8002/document-parser/parse-onboarding-doc"
file_path = "test_onboarding_doc.txt"

if not os.path.exists(file_path):
    print(f"File not found: {file_path}")
    exit(1)

files = {'file': open(file_path, 'rb')}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, files=files)
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\nExtracted Data:")
        print(json.dumps(data, indent=2))
    else:
        print(f"\nFAILED: {response.text}")

except Exception as e:
    print(f"Error: {e}")
finally:
    files['file'].close()
