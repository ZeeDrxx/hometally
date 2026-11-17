# HomeTally

**Household spending, shared live.** Snap a receipt and HomeTally reads it on your phone, picks out the
total and the shop, and guesses the category with an on-device model. Everyone in the household sees
the month's totals and budgets update in real time.

| | |
|---|---|
| **App** | React Native with Expo (SDK 58, Expo Router, TypeScript) |
| **Sync** | **Convex**: reactive queries, so every phone in the household updates the moment someone adds an expense |
| **On-device ML** | Google ML Kit OCR → **TensorFlow Lite** classifier (`react-native-fast-tflite`) |
| **Model training** | Python, **NumPy** feature hashing, **TensorFlow/Keras**, exported to a 261 KiB quantised `.tflite` |

```
 photo ──► ML Kit OCR ──► text ──► features.ts (NumPy-identical) ──► TFLite model ──► category + confidence
   (never uploaded)        └──► receipt.ts: total, shop, date                        │
                                                                                     ▼
                                       user confirms ──► Convex mutation ──► live queries on every phone
```

## What runs where

| On the phone | In Convex |
|---|---|
| Camera / photo, OCR, total and date extraction, classification | Households, members, expenses, budgets |
| A random device token in the OS keychain | Only the token's SHA-256 hash |

Receipt photos and their text never leave the phone. Convex stores the amount, the category, the
shop name and what the model guessed (so its accuracy on real receipts can be measured).

## The model ([`model/`](model/README.md))

There is no public dataset of Moroccan receipts, and real receipts are personal data. So the training
set is **synthetic**: receipts from typical merchants per category (Marjane, Afriquia, Lydec, Pharmacie…),
with French and Arabic lines, MAD prices, and OCR noise (`O`↔`0`, dropped letters, merged words).

- **Features** ([`features.py`](model/src/hometally_model/features.py)):
  1. Unicode-normalise, fold Arabic letter variants, map all digits to `0`.
  2. Take word and character-trigram features.
  3. FNV-1a hash them into 4,096 buckets with NumPy, then apply `log1p` and L2 normalisation.

  The hashing trick means there is no vocabulary file to ship.
- **Model:** Dropout → Dense(64, ReLU) → Dropout → Dense(10, softmax). It is converted to TFLite with dynamic-range quantisation (int8 weights), 261 KiB.
- **Honest evaluation:** the test set uses **shops and products the model never saw**. Each category holds out a quarter of its merchants and a quarter of its items.

| Held-out accuracy (unseen merchants + items) | Keras | TFLite (quantised) |
|---|---|---|
| 10 categories | 71.4% | 71.3% |

That number is the useful one: it says how the approach copes with novelty. Health and clothing are the
hardest classes. With its few distinctive items held out, a pharmacy receipt mostly reads like any other
shop's. The model **shipped in the app** is retrained on the full vocabulary. In an earlier run where only the shop
was new and the products were known, accuracy was 99.5%. On real receipts, expect something between the two.

Because of that, the app treats the model as a suggestion:
- Below 55% confidence it asks the user to pick a category instead of choosing one itself.
- Its top 3 guesses are listed first in the category picker.
- Every scanned expense records the model's guess. The home screen shows how often it was right (e.g. "Category guessed right on 83% of scanned receipts"), and those corrections are the dataset a v2 would train on.

**Parity between Python and the phone.** [`app/src/lib/features.ts`](app/src/lib/features.ts) re-implements
the NumPy pipeline. The training script writes `golden_features.json`, and the app's tests check the
TypeScript output against it bucket for bucket, including Arabic text.

## Known limits

- **No Arabic OCR from photos.** ML Kit's on-device recogniser covers Latin, Chinese, Devanagari, Japanese and Korean scripts, but not Arabic. French lines, totals and prices on Moroccan receipts are read; Arabic-only lines are not. The classifier itself understands Arabic text.
- **Device-token sessions instead of accounts.** Joining needs the 8-character invite code (31⁸ ≈ 850 billion combinations). Moving to Convex Auth with phone sign-in is the natural next step.
- **A development build is required for scanning.** OCR and TFLite are native modules, so the full app runs in a [development build](https://docs.expo.dev/develop/development-builds/introduction/), not in Expo Go. The web build (below) has no scanning.

## Run it

```bash
# 1. Backend: a local Convex deployment, no account needed (writes app/.env.local)
cd app
npm install
npx convex dev                     # keep it running

# 2. App: build and install the development client (Android Studio or Xcode required)
npx expo run:android               # or: npx expo run:ios
```

**In a browser, without Android Studio:** keep `npx convex dev` running, then

```bash
npm run web                        # http://localhost:8081
```

The web build is the same app (households, live totals, budgets, manual expenses) with receipt
scanning switched off. Platform files supply the web stand-ins: `scan.web.ts` replaces the OCR and
TFLite pipeline, and `token-store.web.ts` keeps the device token in `localStorage`, since a browser
has no keychain. Open it in two browsers, join the same household with the invite code, and watch
an expense added in one appear in the other.

To test on a physical phone on your Wi-Fi, set `EXPO_PUBLIC_CONVEX_URL` in `app/.env.local` to your
computer's LAN address. For a hosted backend, run `npx convex login` and `npx convex deploy`, then point
the variable at the deployment URL.

To retrain the model:

```bash
cd model && uv sync && uv run python -m hometally_model.train
```

## Tests

```bash
cd app && npm test        # 35 tests
cd model && uv run pytest # 13 tests
```

- **App:**
  - feature parity with Python (golden vectors)
  - total, shop and date extraction on French and Arabic receipts
  - Convex functions via `convex-test`: household isolation, token hashing, budgets, model-agreement stats
- **Model:**
  - normalisation rules, FNV-1a reference vectors
  - the train/test split leaks no merchant or item

CI also runs `expo-doctor` and bundles the Android app with the model asset.

## Layout

```
app/
  convex/            schema, households, expenses, budgets, token auth (Convex backend)
  src/app/           screens: home/onboarding, new expense (scan or manual), household & budgets
  src/lib/           features.ts, classifier.ts, receipt.ts, scan.ts (OCR + TFLite), session.tsx
  assets/model/      receipt_classifier.tflite, labels.json, model_card.json, golden_features.json
  tests/
model/
  src/hometally_model/   features.py, synth.py, train.py
```

## License

MIT
