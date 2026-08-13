import sys
import os
sys.path.insert(0, os.path.abspath("backend"))
import uvicorn

if __name__ == "__main__":
    print("Starting Uvicorn directly from script...")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, log_level="info")
