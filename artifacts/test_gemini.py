import os
import requests
import dotenv

# Load from backend/.env
dotenv.load_dotenv("backend/.env")

api_key = os.environ.get('GEMINI_API_KEY')
print(f"Loaded API key prefix: {api_key[:10] if api_key else 'None'}... Length: {len(api_key) if api_key else 0}")

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
headers = {
    "Authorization": f"Bearer {api_key}"
}
payload = {
    "contents": [{
        "parts": [{"text": "Hello, this is a test. Answer with exactly the word SUCCESS."}]
    }]
}

try:
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    print(f"Bearer Token Request: Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
