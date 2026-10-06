"""MOV-IQ Standalone REST Inference Server Entry Point.

Run:
    python server.py --port 8000
"""

import argparse
import sys
from pathlib import Path

# Add current directory to python path
pkg_root = Path(__file__).resolve().parent
if str(pkg_root) not in sys.path:
    sys.path.insert(0, str(pkg_root))

from mov_iq.service.inference_server import run_server

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MOV-IQ REST Inference Service")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host interface (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port number (default: 8000)")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default=str(pkg_root / "checkpoints" / "best_model.pt"),
        help="Path to model checkpoint (.pt)",
    )
    parser.add_argument("--device", type=str, default="cpu", help="Compute device ('cpu' or 'cuda')")

    args = parser.parse_args()
    print(f"Starting MOV-IQ Inference Server on http://{args.host}:{args.port}...")
    run_server(host=args.host, port=args.port, checkpoint_path=args.checkpoint, device=args.device)
