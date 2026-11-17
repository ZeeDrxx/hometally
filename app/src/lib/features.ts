/**
 * Receipt text → feature vector. MUST stay identical to model/src/hometally_model/features.py:
 * the TFLite model only understands vectors built exactly this way. tests/features.test.ts checks
 * this file against golden vectors written by the Python training script.
 */

export const DIM = 4096;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const isArabicLetter = (cp: number) => cp >= 0x0621 && cp < 0x064b;
const isDropped = (cp: number) =>
  (cp >= 0x0300 && cp < 0x0370) || (cp >= 0x064b && cp < 0x0660) || cp === 0x0670 || cp === 0x0640;
const isDigit = (cp: number) =>
  (cp >= 0x30 && cp < 0x3a) || (cp >= 0x0660 && cp < 0x066a) || (cp >= 0x06f0 && cp < 0x06fa);
const FOLD: Record<number, string> = { 0x0629: "ه", 0x0649: "ي" };

export function normalize(text: string): string {
  const out: string[] = [];
  for (const ch of text.normalize("NFKD").toLowerCase()) {
    const cp = ch.codePointAt(0)!;
    if (isDropped(cp)) continue;
    if (isDigit(cp)) {
      if (out.length === 0 || out[out.length - 1] !== "0") out.push("0");
    } else if ((cp >= 0x61 && cp <= 0x7a) || isArabicLetter(cp)) {
      out.push(FOLD[cp] ?? ch);
    } else {
      out.push(" ");
    }
  }
  return out.join("");
}

export function tokens(text: string): string[] {
  return normalize(text).split(" ").filter((t) => Array.from(t).length >= 2);
}

export function featureStrings(text: string): string[] {
  const feats: string[] = [];
  for (const tok of tokens(text)) {
    feats.push("w:" + tok);
    const padded = Array.from("<" + tok + ">");
    for (let i = 0; i + 3 <= padded.length; i++) feats.push("c:" + padded.slice(i, i + 3).join(""));
  }
  return feats;
}

const encoder = new TextEncoder();

export function fnv1a(s: string): number {
  let h = FNV_OFFSET;
  for (const b of encoder.encode(s)) {
    h ^= b;
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function vectorize(text: string, dim = DIM): Float32Array {
  const v = new Float32Array(dim);
  for (const f of featureStrings(text)) v[fnv1a(f) % dim] += 1;
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    if (v[i] !== 0) {
      v[i] = Math.log1p(v[i]);
      norm += v[i] * v[i];
    }
  }
  if (norm > 0) {
    const inv = 1 / Math.sqrt(norm);
    for (let i = 0; i < dim; i++) v[i] *= inv;
  }
  return v;
}
