"""Train the receipt classifier and export it for the app.

    uv run python -m hometally_model.train            # writes ../app/assets/model/

Outputs
  receipt_classifier.tflite   dynamic-range quantised model (int8 weights, float32 in/out)
  labels.json                 class index → category id
  model_card.json             data, architecture, held-out metrics
  golden_features.json        sample texts with their exact feature vectors, for the app's parity test
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf

from .features import DIM, feature_strings, fnv1a, vectorize, vectorize_many
from .synth import CATEGORIES, Vocab, dataset, split_vocab

OUT = Path(__file__).resolve().parents[3] / "app" / "assets" / "model"
GOLDEN_TEXTS = [
    "MARJANE\nLait Centrale 1L 7,50\nTOTAL 7,50",
    "Pharmacie Al Amal — Doliprane 1000mg 15.60 DH",
    "صيدلية الشفاء المجموع ١٢٠ درهم",
    "Café Al Andalous: café noir, msemen — NET A PAYER 32,00",
    "AFRIQUIA Gasoil 50 Litres 38.12 Prix/L 12.89",
    "Électricité Lydec   Consommation kWh 245",
    "خدمة الإنترنت إتصالات المغرب",
    "",
    "!!! 12 34 ---",
]


def build_model(n_classes: int, dim: int = DIM) -> tf.keras.Model:
    model = tf.keras.Sequential([
        tf.keras.Input(shape=(dim,), name="features"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(64, activation="relu", kernel_regularizer=tf.keras.regularizers.l2(1e-5)),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(n_classes, activation="softmax", name="probabilities"),
    ])
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    return model


def confusion(y_true: np.ndarray, y_pred: np.ndarray, n: int) -> np.ndarray:
    m = np.zeros((n, n), dtype=np.int64)
    np.add.at(m, (y_true, y_pred), 1)
    return m


def per_class(m: np.ndarray) -> dict[str, dict[str, float]]:
    tp = np.diag(m).astype(float)
    precision = np.divide(tp, m.sum(axis=0), out=np.zeros_like(tp), where=m.sum(axis=0) > 0)
    recall = np.divide(tp, m.sum(axis=1), out=np.zeros_like(tp), where=m.sum(axis=1) > 0)
    f1 = np.divide(2 * precision * recall, precision + recall, out=np.zeros_like(tp), where=(precision + recall) > 0)
    return {c: {"precision": round(float(p), 3), "recall": round(float(r), 3), "f1": round(float(f), 3)}
            for c, p, r, f in zip(CATEGORIES, precision, recall, f1)}


def tflite_predict(model_bytes: bytes, x: np.ndarray) -> np.ndarray:
    interp = tf.lite.Interpreter(model_content=model_bytes)
    inp, out = interp.get_input_details()[0], interp.get_output_details()[0]
    interp.resize_tensor_input(inp["index"], [1, x.shape[1]])
    interp.allocate_tensors()
    probs = np.empty((len(x), out["shape"][-1]), dtype=np.float32)
    for i, row in enumerate(x):
        interp.set_tensor(inp["index"], row[None, :])
        interp.invoke()
        probs[i] = interp.get_tensor(out["index"])[0]
    return probs


def fit(x: np.ndarray, y: np.ndarray, epochs: int) -> tf.keras.Model:
    model = build_model(len(CATEGORIES))
    model.fit(x, y, validation_split=0.1, epochs=epochs, batch_size=64, verbose=0,
              callbacks=[tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True)])
    return model


def to_tflite(model: tf.keras.Model) -> bytes:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]  # int8 weights, float activations
    return converter.convert()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-class", type=int, default=1500)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    tf.keras.utils.set_random_seed(args.seed)
    train_v, test_v = split_vocab(seed=args.seed)
    train_texts, y_train = dataset(args.per_class, train_v, seed=args.seed)
    test_texts, y_test = dataset(args.per_class // 5, test_v, seed=args.seed + 1)
    x_train, x_test = vectorize_many(train_texts), vectorize_many(test_texts)
    y_train, y_test = np.array(y_train), np.array(y_test)
    print(f"train {x_train.shape}, test {x_test.shape} (test merchants and items never seen in training)")

    # 1. Evaluation run: how well does the approach generalise to unseen shops and products?
    model = fit(x_train, y_train, args.epochs)
    keras_acc = float((model.predict(x_test, verbose=0).argmax(1) == y_test).mean())
    pred = tflite_predict(to_tflite(model), x_test).argmax(1)
    tflite_acc = float((pred == y_test).mean())
    m = confusion(y_test, pred, len(CATEGORIES))
    print(f"held-out accuracy (unseen merchants + items): keras {keras_acc:.4f}, tflite {tflite_acc:.4f}")
    print("confusion (rows = true):\n", m)

    # 2. Shipped model: the same recipe, trained on every merchant and item we know.
    full = Vocab(
        {c: train_v.merchants[c] + test_v.merchants[c] for c in CATEGORIES},
        {c: train_v.items[c] + test_v.items[c] for c in CATEGORIES},
    )
    full_texts, y_full = dataset(args.per_class, full, seed=args.seed + 2)
    tflite = to_tflite(fit(vectorize_many(full_texts), np.array(y_full), args.epochs))

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "receipt_classifier.tflite").write_bytes(tflite)
    (args.out / "labels.json").write_text(json.dumps(CATEGORIES, indent=2) + "\n", encoding="utf-8")
    card = {
        "task": "receipt text → spending category",
        "input": {"name": "features", "shape": [1, DIM], "dtype": "float32",
                  "pipeline": "hometally_model/features.py ≡ app/src/lib/features.ts"},
        "output": {"name": "probabilities", "shape": [1, len(CATEGORIES)], "labels": "labels.json"},
        "architecture": "Dropout(0.2) → Dense(64, relu) → Dropout(0.3) → Dense(10, softmax)",
        "quantisation": "dynamic range (int8 weights)",
        "size_bytes": len(tflite),
        "data": {"source": "synthetic OCR'd receipts (synth.py)",
                 "evaluation": {"train": len(train_texts), "test": len(test_texts),
                                "split": "by merchant and by item: test receipts use shops and products unseen in training",
                                "test_merchants": test_v.merchants, "test_items": test_v.items},
                 "shipped_model": {"train": len(full_texts), "vocabulary": "all merchants and items"}},
        "metrics": {"note": "from the evaluation run; the shipped model is retrained on the full vocabulary",
                    "keras_accuracy": round(keras_acc, 4), "tflite_accuracy": round(tflite_acc, 4),
                    "per_class": per_class(m), "confusion": m.tolist()},
        "caveat": "Scores are on synthetic data. Expect lower accuracy on real receipts; the app lets users correct the "
                  "category and keeps the corrected text for future retraining.",
    }
    (args.out / "model_card.json").write_text(json.dumps(card, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    golden = []
    for text in GOLDEN_TEXTS:
        v = vectorize(text)
        nz = np.flatnonzero(v)
        golden.append({
            "text": text,
            "features": feature_strings(text)[:12],
            "hashes": [fnv1a(f) for f in feature_strings(text)[:12]],
            "indices": nz.tolist(),
            "values": [round(float(x), 6) for x in v[nz]],
            "probabilities": [round(float(p), 4) for p in tflite_predict(tflite, v[None, :])[0]],
        })
    (args.out / "golden_features.json").write_text(json.dumps({"dim": DIM, "cases": golden}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {args.out} ({len(tflite) / 1024:.0f} KiB model)")


if __name__ == "__main__":
    main()
