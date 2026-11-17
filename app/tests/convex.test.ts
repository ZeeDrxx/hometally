// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const tokenA = "a".repeat(40);
const tokenB = "b".repeat(40);
const tokenX = "x".repeat(40);

async function household() {
  const t = convexTest(schema, modules);
  const { inviteCode } = await t.mutation(api.households.create, { name: "Dar Bennani", memberName: "Amina", token: tokenA });
  await t.mutation(api.households.join, { inviteCode: inviteCode.toLowerCase(), memberName: "Youssef", token: tokenB });
  return { t, inviteCode };
}

const NOV = { from: new Date(2026, 10, 1).getTime(), to: new Date(2026, 11, 1).getTime() };
const day = (d: number) => new Date(2026, 10, d, 12).getTime();

describe("households", () => {
  it("create + join share one household; codes avoid ambiguous letters", async () => {
    const { t, inviteCode } = await household();
    expect(inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    const me = await t.query(api.households.me, { token: tokenB });
    expect(me?.household.name).toBe("Dar Bennani");
    expect(me?.members.map((m) => m.name).sort()).toEqual(["Amina", "Youssef"]);
  });

  it("stores only a hash of the device token", async () => {
    const { t } = await household();
    const members = await t.run((ctx) => ctx.db.query("members").collect());
    expect(members.every((m) => /^[0-9a-f]{64}$/.test(m.tokenHash) && !m.tokenHash.includes("aaaaaaaaaa"))).toBe(true);
  });

  it("rejects unknown codes, short tokens and double joins", async () => {
    const { t, inviteCode } = await household();
    await expect(t.mutation(api.households.join, { inviteCode: "NOPE2345", memberName: "X", token: tokenX })).rejects.toThrow(/no household/);
    await expect(t.mutation(api.households.create, { name: "H", memberName: "X", token: "short" })).rejects.toThrow(/invalid session/);
    await expect(t.mutation(api.households.join, { inviteCode, memberName: "Again", token: tokenB })).rejects.toThrow(/already/);
    expect(await t.query(api.households.me, { token: tokenX })).toBeNull();
  });
});

describe("expenses and budgets", () => {
  it("both members see the same totals, with budgets", async () => {
    const { t } = await household();
    await t.mutation(api.expenses.add, {
      token: tokenA, amountCents: 19550, category: "groceries", merchant: " Marjane ", spentAt: day(3),
      source: "scan", predictedCategory: "groceries", confidence: 0.97,
    });
    await t.mutation(api.expenses.add, {
      token: tokenB, amountCents: 3200, category: "restaurants", spentAt: day(4), source: "scan",
      predictedCategory: "leisure", confidence: 0.6,
    });
    await t.mutation(api.expenses.add, {
      token: tokenB, amountCents: 50000, category: "groceries", spentAt: new Date(2026, 9, 30).getTime(), source: "manual",
    });
    await t.mutation(api.budgets.set, { token: tokenA, category: "groceries", monthlyCents: 300000 });

    const s = await t.query(api.expenses.summary, { token: tokenB, ...NOV });
    expect(s.totalCents).toBe(22750); // the October expense is outside the range
    expect(s.byCategory[0]).toEqual({ category: "groceries", spentCents: 19550, budgetCents: 300000 });
    expect(s.modelAgreement).toBe(0.5);

    const list = await t.query(api.expenses.list, { token: tokenA, ...NOV });
    expect(list.map((e) => [e.merchant, e.memberName])).toEqual([[undefined, "Youssef"], ["Marjane", "Amina"]]);
  });

  it("validates amounts and keeps households apart", async () => {
    const { t } = await household();
    await expect(
      t.mutation(api.expenses.add, { token: tokenA, amountCents: 12.5, category: "other", spentAt: day(1), source: "manual" }),
    ).rejects.toThrow(/invalid amount/);

    const id = await t.mutation(api.expenses.add, { token: tokenA, amountCents: 1000, category: "other", spentAt: day(1), source: "manual" });
    await t.mutation(api.households.create, { name: "Other home", memberName: "Intruder", token: tokenX });
    await expect(t.mutation(api.expenses.remove, { token: tokenX, id })).rejects.toThrow(/not found/);
    expect((await t.query(api.expenses.summary, { token: tokenX, ...NOV })).totalCents).toBe(0);

    await t.mutation(api.expenses.update, { token: tokenB, id, category: "household" });
    const [e] = await t.query(api.expenses.list, { token: tokenA, ...NOV });
    expect(e.category).toBe("household");
    await t.mutation(api.expenses.remove, { token: tokenB, id });
    expect(await t.query(api.expenses.list, { token: tokenA, ...NOV })).toEqual([]);
  });

  it("budget 0 removes the budget", async () => {
    const { t } = await household();
    await t.mutation(api.budgets.set, { token: tokenA, category: "leisure", monthlyCents: 40000 });
    await t.mutation(api.budgets.set, { token: tokenA, category: "leisure", monthlyCents: 0 });
    expect((await t.query(api.expenses.summary, { token: tokenA, ...NOV })).budgetCents).toBe(0);
  });
});
