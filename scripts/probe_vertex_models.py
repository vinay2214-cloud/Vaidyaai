import sys
import time
import os

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import vertexai
from vertexai.generative_models import GenerativeModel
from config import settings

projects = [settings.GOOGLE_CLOUD_PROJECT, "crisisroute-2026-498212", "vaidyaai-xprize"]
# De-duplicate while preserving order
seen = set()
unique_projects = [p for p in projects if p and not (p in seen or seen.add(p))]

locations = ["us-central1", "asia-south1", "global", "europe-west4", "us-east4"]
models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"]

print(f"Testing projects: {unique_projects}", flush=True)

for proj in unique_projects:
    print(f"\n==========================================", flush=True)
    print(f"Project: {proj}", flush=True)
    print(f"==========================================", flush=True)
    for loc in locations:
        print(f"\n--- Location: {loc} ---", flush=True)
        try:
            vertexai.init(project=proj, location=loc)
        except Exception as e:
            print(f"  Init failed for {loc}: {e}", flush=True)
            continue
        
        for m_name in models:
            try:
                t0 = time.time()
                m = GenerativeModel(m_name)
                res = m.generate_content("Respond with exactly: LIVE OK")
                lat = int((time.time() - t0) * 1000)
                print(f"  [PASS] {m_name} @ {loc} -> {lat}ms | Response: {res.text.strip()[:60]}", flush=True)
            except Exception as e:
                err_str = str(e).replace("\n", " ")
                print(f"  [FAIL] {m_name} @ {loc} -> {err_str[:120]}", flush=True)
