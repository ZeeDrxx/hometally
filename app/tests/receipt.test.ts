import { describe, expect, it } from "vitest";

import {
  extractDate, extractMerchant, extractTotalCents, formatMAD, monthRange, parseAmounts, parseUserAmount,
} from "../src/lib/receipt";

describe("extractTotalCents", () => {
  it.each([
    ["MARJANE\nLait 7,50\nSucre 12,00\nTOTAL 19,50\nEspeces 20,00\nRendu 0,50", 1950],
    ["Cafe\nCafe noir 12.00\nNET A PAYER 32.00 DH", 3200],
    ["LYDEC\nMontant TTC\n1 245,80", 124580],
    ["Pharmacie\nDoliprane 15,60\nTVA 7% 1,02\nTOTAL TTC 15,60", 1560],
    ["صيدلية\nالمجموع 120 درهم", 12000],
    ["BIM\n12/03/2026 18:40\nPates 6,50\nHuile 21,90", 2190], // no total line: largest amount, not the date
    ["", null],
  ])("case %#", (text, cents) => expect(extractTotalCents(text)).toBe(cents));
});

it("parseAmounts handles thousands separators and DH", () => {
  expect(parseAmounts("1.234,50 DH")).toEqual([123450]);
  expect(parseAmounts("4 500 MAD")).toEqual([450000]);
  expect(parseAmounts("Gasoil 38.12 Prix/L 12.89")).toEqual([3812, 1289]);
});

it("extractMerchant skips addresses and dates", () => {
  expect(extractMerchant("12/03/2026\n  Carrefour Market  \n12 Bd Zerktouni")).toBe("Carrefour Market");
  expect(extractMerchant("12 Bd Anfa\n0522000000")).toBeNull();
});

it("extractDate validates the calendar and rejects the future", () => {
  const now = new Date(2026, 10, 17);
  expect(extractDate("Le 05/11/2026 a 10:00", now)?.getDate()).toBe(5);
  expect(extractDate("31/02/2026", now)).toBeNull();
  expect(extractDate("01/12/2026", now)).toBeNull();
  expect(extractDate("05-11-26", now)?.getFullYear()).toBe(2026);
});

it("money formatting and input", () => {
  expect(formatMAD(123450)).toBe("1 234,50 MAD");
  expect(parseUserAmount("12,5")).toBe(1250);
  expect(parseUserAmount("1 200")).toBe(120000);
  expect(parseUserAmount("abc")).toBeNull();
  expect(parseUserAmount("0")).toBeNull();
});

it("monthRange gives local month boundaries", () => {
  const r = monthRange(-1, new Date(2026, 0, 15));
  expect(new Date(r.from).getMonth()).toBe(11);
  expect(new Date(r.to).getMonth()).toBe(0);
});
