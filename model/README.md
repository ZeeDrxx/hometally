# HomeTally receipt model

Trains the on-device classifier that turns a receipt's OCR text into a spending category.

```bash
uv sync
uv run pytest
uv run python -m hometally_model.train      # writes ../app/assets/model/
```

| File | Role |
|---|---|
| `features.py` | text → 4,096-dim hashed feature vector with NumPy (normalisation, FNV-1a hashing, log-scaling, L2 norm) |
| `synth.py` | synthetic OCR'd receipts: Moroccan merchants, French/Arabic lines, MAD prices, OCR noise |
| `train.py` | Keras model, held-out evaluation, TFLite export, model card, golden vectors |

`features.py` has a TypeScript twin in `app/src/lib/features.ts`. The training script writes
`golden_features.json` (texts with their exact vectors), and the app's test suite checks the TypeScript
implementation against it, so a change on one side that is not mirrored on the other fails CI.

See `app/assets/model/model_card.json` for the latest metrics.
