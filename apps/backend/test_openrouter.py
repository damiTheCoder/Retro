import os
import httpx
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('OPENROUTER_API_KEY')
model = os.getenv('AI_MODEL', 'nex-agi/nex-n2.5-pro:free')

print(f'API key present: {bool(api_key)}')
print(f'API key prefix: {api_key[:10] if api_key else "NONE"}...')
print(f'Model: {model}')

response = httpx.post(
  'https://openrouter.ai/api/v1/chat/completions',
  headers={
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:5173',
    'X-Title': 'Chart Rabbit',
  },
  json={
    'model': model,
    'messages': [{'role': 'user', 'content': 'Say exactly: OPENROUTER_WORKS'}],
    'stream': False,
  },
  timeout=120.0,
)

print(f'Status: {response.status_code}')
print(f'Body: {response.text[:2000]}')
