#!/usr/bin/env python3
"""
VaidyaAI — Real Gemini Live Inference Smoke Test
Verifies live Vertex AI inference with real Gemini 2.5 Pro and Gemini 2.5 Flash models.
Strictly fails non-zero on any error or fallback attempt.
"""
import os
import sys
import time
from datetime import datetime, timezone

# Ensure backend directory is in python module search path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from config import settings

try:
    import vertexai
    from vertexai.generative_models import GenerativeModel, GenerationConfig
except ImportError as e:
    print(f"FATAL: Vertex AI SDK not installed: {e}", file=sys.stderr)
    sys.exit(1)


def run_live_smoke_test(model_name: str, location: str, test_prompt: str = "Respond with exactly: LIVE_INFERENCE_VERIFIED") -> bool:
    print("\n" + "=" * 65)
    print(f"VERIFYING LIVE MODEL: {model_name} @ {location}")
    print("=" * 65)
    
    provider = "Google Cloud Vertex AI"
    project = settings.GOOGLE_CLOUD_PROJECT
    
    start_utc = datetime.now(timezone.utc).isoformat()
    t0 = time.monotonic()
    
    try:
        vertexai.init(project=project, location=location)
        model = GenerativeModel(
            model_name,
            generation_config=GenerationConfig(
                temperature=0.1,
                top_p=0.9,
                max_output_tokens=256
            )
        )
        
        response = model.generate_content(test_prompt)
        t1 = time.monotonic()
        end_utc = datetime.now(timezone.utc).isoformat()
        latency_ms = int((t1 - t0) * 1000)
        
        response_text = response.text.strip() if response and response.text else ""
        
        # Extract finish reason if available
        finish_reason = "unavailable"
        if hasattr(response, "candidates") and response.candidates:
            c = response.candidates[0]
            finish_reason = str(getattr(c, "finish_reason", "STOP"))
            
        # Extract usage metadata if available
        usage_metadata = {}
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            u = response.usage_metadata
            usage_metadata = {
                "prompt_token_count": getattr(u, "prompt_token_count", None),
                "candidates_token_count": getattr(u, "candidates_token_count", None),
                "total_token_count": getattr(u, "total_token_count", None)
            }
        
        print(f"  • Provider:           {provider}")
        print(f"  • Project:            {project}")
        print(f"  • Location:           {location}")
        print(f"  • Model:              {model_name}")
        print(f"  • Request Start (UTC):{start_utc}")
        print(f"  • Request End (UTC):  {end_utc}")
        print(f"  • Measured Latency:   {latency_ms} ms")
        print(f"  • Finish Reason:      {finish_reason}")
        print(f"  • Usage Metadata:     {usage_metadata if usage_metadata else 'Unavailable'}")
        print(f"  • Raw Response:       {response_text[:120]}")
        print(f"  • Live Execution:     VERIFIED [PASS]")
        return True
        
    except Exception as e:
        t1 = time.monotonic()
        end_utc = datetime.now(timezone.utc).isoformat()
        latency_ms = int((t1 - t0) * 1000)
        print(f"  • Provider:           {provider}", file=sys.stderr)
        print(f"  • Project:            {project}", file=sys.stderr)
        print(f"  • Location:           {location}", file=sys.stderr)
        print(f"  • Model:              {model_name}", file=sys.stderr)
        print(f"  • Latency on Failure: {latency_ms} ms", file=sys.stderr)
        print(f"  • Error Details:      {e}", file=sys.stderr)
        print(f"  • Live Execution:     FAILED [NON-ZERO EXIT]", file=sys.stderr)
        return False


def main():
    print("=================================================================")
    print("  VAIDYAAI — GOOGLE CLOUD VERTEX AI LIVE SMOKE TEST")
    print("=================================================================")
    print(f"Configuration:")
    print(f"  Reasoning Model:    {settings.GEMINI_REASONING_MODEL} (Location: {settings.GEMINI_REASONING_LOCATION})")
    print(f"  Fast Model:         {settings.GEMINI_FAST_MODEL} (Location: {settings.GEMINI_FAST_LOCATION})")
    print(f"  Live Clinical AI:   {settings.LIVE_CLINICAL_AI}")
    print(f"  Allow Mock Fallback:{settings.AI_ALLOW_MOCK_FALLBACK}")
    
    # 1. Smoke test Clinical Reasoning Model (Gemini 2.5 Pro)
    pro_ok = run_live_smoke_test(
        model_name=settings.GEMINI_REASONING_MODEL,
        location=settings.GEMINI_REASONING_LOCATION,
        test_prompt="Perform a harmless test verification for VaidyaAI clinical agent pipeline. Output: REASONING_MODEL_ONLINE"
    )
    
    # 2. Smoke test Fast Model (Gemini 2.5 Flash)
    flash_ok = run_live_smoke_test(
        model_name=settings.GEMINI_FAST_MODEL,
        location=settings.GEMINI_FAST_LOCATION,
        test_prompt="Perform a harmless test verification for VaidyaAI fast agent pipeline. Output: FAST_MODEL_ONLINE"
    )
    
    print("\n" + "=" * 65)
    if pro_ok and flash_ok:
        print("  ✓ ALL LIVE GEMINI MODELS RESPONDED SUCCESSFULLY.")
        print("  ✓ Real inference verified. No mock fallback used.")
        print("=" * 65 + "\n")
        sys.exit(0)
    else:
        print("  ✕ ONE OR MORE LIVE GEMINI INFERENCES FAILED.", file=sys.stderr)
        print("=" * 65 + "\n", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
