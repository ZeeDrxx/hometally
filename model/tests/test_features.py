import numpy as np
import pytest

from hometally_model.features import DIM, feature_strings, fnv1a, normalize, tokens, vectorize
from hometally_model.synth import CATEGORIES, dataset, receipt, split_vocab


def test_fnv1a_reference_values():
    # Published FNV-1a 32-bit test vectors
    assert fnv1a("") == 0x811C9DC5
    assert fnv1a("a") == 0xE40C292C
    assert fnv1a("foobar") == 0xBF9CF968


@pytest.mark.parametrize("raw, expected", [
    ("Café NOIR", "cafe noir"),
    ("TOTAL: 12,50 DH", "total  0 0 dh"),
    ("Lait 1L", "lait 0l"),
    ("المجموع ١٢٠", "المجموع 0"),
    ("مَدْرَسَة", "مدرسه"),
    ("أحمد إلى", "احمد الي"),
    ("Sidi—Ali", "sidi ali"),
])
def test_normalize(raw, expected):
    assert normalize(raw) == expected


def test_tokens_drop_single_characters():
    assert tokens("a TOTAL 5 x Lait") == ["total", "lait"]


def test_feature_strings_words_and_trigrams():
    assert feature_strings("Lait") == ["w:lait", "c:<la", "c:lai", "c:ait", "c:it>"]


def test_vectorize_is_unit_norm_and_deterministic():
    v = vectorize("Marjane lait sucre")
    assert v.shape == (DIM,) and v.dtype == np.float32
    assert np.linalg.norm(v) == pytest.approx(1.0, abs=1e-6)
    assert np.array_equal(v, vectorize("MARJANE Lait Sucre"))
    assert not vectorize("").any()


def test_split_is_disjoint_for_merchants_and_items():
    train, test = split_vocab()
    assert set(train.merchants) == set(test.merchants) == set(CATEGORIES)
    for cat in CATEGORIES:
        assert not set(train.merchants[cat]) & set(test.merchants[cat])
        assert not set(train.items[cat]) & set(test.items[cat])
        assert len(test.merchants[cat]) >= 2 and len(train.merchants[cat]) >= 4


def test_receipts_look_like_receipts():
    import random

    text = receipt("groceries", "Marjane", random.Random(1))
    assert "\n" in text and any(ch.isdigit() for ch in text)
    texts, labels = dataset(5, split_vocab()[0], seed=3)
    assert len(texts) == 50 and sorted(set(labels)) == list(range(10))
