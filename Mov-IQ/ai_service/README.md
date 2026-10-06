# MOV-IQ Stage 4 Model Handoff Package

Standalone production-ready baseline model and REST inference service for human pose form analysis.

## Package Inventory
- `checkpoints/best_model.pt`: Canonical trained multi-task baseline model weights.
- `config/`: Model architecture (`model_config.json`), preprocessing parameters (`deployment_preprocessing.json`), and metrics summary (`metrics_summary.json`).
- `mov_iq/`: Self-contained portable Python library for feature extraction and model inference.
- `server.py`: Standard library HTTP server entry point (`http://localhost:8000`).
- `test_client.py`: Automated client verification script.
- `sample_request.json`: Real 60-frame landmark sample for verification.
- `API_SPECIFICATION.md`: Complete REST API contract.
- `INTEGRATION_GUIDE.md`: Node.js / React integration examples.
- `requirements.txt`: Minimal runtime dependencies (`torch`, `numpy`, `scipy`).

## Quickstart

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start inference server
python server.py --port 8000

# 3. Test service in another terminal
python test_client.py
```
