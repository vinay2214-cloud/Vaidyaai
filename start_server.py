import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)
os.chdir(backend_path)

import uvicorn

if __name__ == "__main__":
    print(f"Starting VaidyaAI Backend on http://127.0.0.1:8000 from {backend_path}...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info", reload=False)
