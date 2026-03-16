# ScriptNode Vault

## Deploy on Render

### Backend (Web Service)
- Root Directory: backend
- Build: pip install -r requirements.txt  
- Start: uvicorn server:app --host 0.0.0.0 --port $PORT
- Add env vars from backend/.env

### Frontend (Static Site)
- Root Directory: frontend
- Build: npm install && npm run build
- Publish: build
- Set REACT_APP_BACKEND_URL to your backend URL
