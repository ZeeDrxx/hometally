import labels from "../../assets/model/labels.json";
import type { CategoryId } from "../../convex/categories";
import { vectorize } from "./features";

/** Below this, the app asks the user instead of pre-selecting the model's guess. */
export const CONFIDENCE_THRESHOLD = 0.55;

export type Prediction = {
  category: CategoryId;
  confidence: number;
  confident: boolean;
  ranked: { category: CategoryId; p: number }[];
};

/** Anything that runs a float32[1, DIM] → float32[1, n] model: the TFLite model on a phone, a stub in tests. */
export type RunModel = (input: ArrayBuffer[]) => ArrayBuffer[] | Promise<ArrayBuffer[]>;

export function interpret(probabilities: Float32Array): Prediction {
  const ranked = Array.from(probabilities, (p, i) => ({ category: labels[i] as CategoryId, p }))
    .sort((a, b) => b.p - a.p);
  const best = ranked[0];
  return { category: best.category, confidence: best.p, confident: best.p >= CONFIDENCE_THRESHOLD, ranked: ranked.slice(0, 3) };
}

export async function classify(run: RunModel, receiptText: string): Promise<Prediction> {
  const input = vectorize(receiptText);
  const [out] = await run([input.buffer as ArrayBuffer]);
  return interpret(new Float32Array(out));
}
