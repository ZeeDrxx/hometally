"""Receipt text → fixed-size feature vector, with NumPy.

This module is a CONTRACT with the mobile app: app/src/lib/features.ts implements the same steps,
character for character, so the model sees identical vectors on the phone and in training.
`golden_features.json` (written by export.py) is checked by the app's tests to prove it.

Steps
1. normalise: Unicode NFKD, lower-case, drop combining marks (accents, Arabic harakat/hamza marks),
   fold ة→ه and ى→ي, map every digit (ASCII, Arabic-Indic, Persian) to "0" and collapse runs of
   zeros: prices and dates carry no category signal, but "0g" or "0l" does.
   Anything that is not a–z, 0, or an Arabic letter becomes a space.
2. tokens: split on spaces, keep tokens of 2+ characters.
3. features: "w:<token>" for each token and "c:<trigram>" for each character trigram of "<token>".
4. hashing: FNV-1a 32-bit over the UTF-8 bytes of each feature, modulo DIM (the hashing trick:
   no vocabulary file to ship or keep in sync).
5. weights: log(1 + count), then L2 normalisation.
"""

from __future__ import annotations

import unicodedata

import numpy as np

DIM = 4096
FNV_OFFSET = 0x811C9DC5
FNV_PRIME = 0x01000193

_ARABIC_LETTERS = range(0x0621, 0x064B)  # ء … ي
_DROP = {*range(0x0300, 0x0370), *range(0x064B, 0x0660), 0x0670, 0x0640}  # combining marks, harakat, tatweel
_DIGITS = {*range(0x30, 0x3A), *range(0x0660, 0x066A), *range(0x06F0, 0x06FA)}
_FOLD = {0x0629: "ه", 0x0649: "ي"}


def normalize(text: str) -> str:
    out: list[str] = []
    for ch in unicodedata.normalize("NFKD", text).lower():
        cp = ord(ch)
        if cp in _DROP:
            continue
        if cp in _DIGITS:
            if not out or out[-1] != "0":
                out.append("0")
        elif 0x61 <= cp <= 0x7A or cp in _ARABIC_LETTERS:
            out.append(_FOLD.get(cp, ch))
        else:
            out.append(" ")
    return "".join(out)


def tokens(text: str) -> list[str]:
    return [t for t in normalize(text).split(" ") if len(t) >= 2]


def feature_strings(text: str) -> list[str]:
    feats: list[str] = []
    for tok in tokens(text):
        feats.append("w:" + tok)
        padded = "<" + tok + ">"
        feats.extend("c:" + padded[i:i + 3] for i in range(len(padded) - 2))
    return feats


def fnv1a(s: str) -> int:
    h = FNV_OFFSET
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * FNV_PRIME) & 0xFFFFFFFF
    return h


def vectorize(text: str, dim: int = DIM) -> np.ndarray:
    v = np.zeros(dim, dtype=np.float32)
    idx = np.fromiter((fnv1a(f) % dim for f in feature_strings(text)), dtype=np.int64)
    if idx.size:
        np.add.at(v, idx, 1.0)
        v = np.log1p(v)
        v /= np.linalg.norm(v)
    return v


def vectorize_many(texts: list[str], dim: int = DIM) -> np.ndarray:
    return np.stack([vectorize(t, dim) for t in texts]) if texts else np.zeros((0, dim), np.float32)
