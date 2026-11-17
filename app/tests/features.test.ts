import { describe, expect, it } from "vitest";

import golden from "../assets/model/golden_features.json";
import { interpret } from "../src/lib/classifier";
import { DIM, featureStrings, fnv1a, normalize, vectorize } from "../src/lib/features";

describe("feature parity with the Python training pipeline", () => {
  it("uses the same dimension", () => expect(golden.dim).toBe(DIM));

  it.each(golden.cases.map((c) => [JSON.stringify(c.text).slice(0, 40), c] as const))("%s", (_, c) => {
    expect(featureStrings(c.text).slice(0, 12)).toEqual(c.features);
    expect(c.features.map(fnv1a)).toEqual(c.hashes);
    const v = vectorize(c.text);
    const indices = Array.from(v.keys()).filter((i) => v[i] !== 0);
    expect(indices).toEqual(c.indices);
    indices.forEach((i, k) => expect(v[i]).toBeCloseTo(c.values[k], 5));
  });
});

describe("normalize", () => {
  it.each([
    ["Café NOIR", "cafe noir"],
    ["TOTAL: 12,50 DH", "total  0 0 dh"],
    ["المجموع ١٢٠", "المجموع 0"],
    ["مَدْرَسَة", "مدرسه"],
    ["أحمد إلى", "احمد الي"],
  ])("%s", (raw, expected) => expect(normalize(raw)).toBe(expected));
});

it("FNV-1a reference vectors", () => {
  expect(fnv1a("")).toBe(0x811c9dc5);
  expect(fnv1a("a")).toBe(0xe40c292c);
  expect(fnv1a("foobar")).toBe(0xbf9cf968);
});

it("interpret ranks probabilities and flags low confidence", () => {
  const p = interpret(Float32Array.from(golden.cases[0].probabilities));
  expect(p.category).toBe("groceries");
  expect(p.confident).toBe(true);
  const unsure = interpret(Float32Array.from(golden.cases[golden.cases.length - 1].probabilities));
  expect(unsure.confident).toBe(false);
  expect(unsure.ranked).toHaveLength(3);
});
