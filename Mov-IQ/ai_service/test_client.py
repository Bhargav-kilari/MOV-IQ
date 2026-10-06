"""Test Client for MOV-IQ REST Inference Service."""

import json
import time
import urllib.request
import urllib.error
from pathlib import Path

def test_service(base_url="http://127.0.0.1:8000"):
    print(f"Connecting to MOV-IQ Inference Service at {base_url}...")

    # 1. Health check
    req = urllib.request.Request(f"{base_url}/health")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"  [+] /health  -> Status: {data.get('status')}, Model: {data.get('checkpoint')}")

    # 2. Models
    req = urllib.request.Request(f"{base_url}/models")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        ex_count = len(data.get("active_model", {}).get("exercise_classes", []))
        print(f"  [+] /models  -> Active Model: {data['active_model']['architecture']} ({ex_count} exercises)")

    # 3. Predict using sample request
    sample_path = Path(__file__).parent / "sample_request.json"
    if sample_path.is_file():
        with open(sample_path, "r", encoding="utf-8") as f:
            payload_data = f.read()

        t0 = time.perf_counter()
        req = urllib.request.Request(
            f"{base_url}/predict",
            data=payload_data.encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            pred = json.loads(resp.read().decode())
            ms = (time.perf_counter() - t0) * 1000.0
            print(f"  [+] /predict -> Exercise: {pred['exercise']['prediction']} ({pred['exercise']['confidence']*100:.1f}%), "
                  f"Form: {pred['form']['prediction']} ({pred['form']['confidence']*100:.1f}%), "
                  f"Latency: {ms:.1f}ms")
    else:
        print("  [!] sample_request.json not found, skipping prediction test.")

    print("\n[SUCCESS] MOV-IQ Inference Service is fully operational!")

if __name__ == "__main__":
    import sys
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    test_service(url)
