import { ConvexError, v } from "convex/values";

import { CATEGORY_IDS } from "./categories";
import { mutation, query } from "./_generated/server";
import { memberFor } from "./lib/auth";
import { category } from "./schema";

const MAX_CENTS = 10_000_000_00; // 10 million MAD: anything above is a typo

function checkAmount(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0 || cents > MAX_CENTS) throw new ConvexError("invalid amount");
}

export const add = mutation({
  args: {
    token: v.string(),
    amountCents: v.number(),
    category,
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    spentAt: v.number(),
    source: v.union(v.literal("scan"), v.literal("manual")),
    predictedCategory: v.optional(category),
    confidence: v.optional(v.number()),
  },
  handler: async (ctx, { token, ...args }) => {
    const member = await memberFor(ctx, token);
    checkAmount(args.amountCents);
    return ctx.db.insert("expenses", {
      ...args,
      merchant: args.merchant?.trim().slice(0, 80) || undefined,
      note: args.note?.trim().slice(0, 200) || undefined,
      householdId: member.householdId,
      memberId: member._id,
    });
  },
});

async function ownExpense(ctx: Parameters<typeof memberFor>[0], token: string, id: string) {
  const member = await memberFor(ctx, token);
  const expenseId = ctx.db.normalizeId("expenses", id);
  const expense = expenseId && (await ctx.db.get(expenseId));
  if (!expense || expense.householdId !== member.householdId) throw new ConvexError("expense not found");
  return expense;
}

/** Fix the category (or amount) of an expense: corrections show how the model does on real receipts. */
export const update = mutation({
  args: { token: v.string(), id: v.string(), category: v.optional(category), amountCents: v.optional(v.number()) },
  handler: async (ctx, { token, id, ...patch }) => {
    const expense = await ownExpense(ctx, token, id);
    if (patch.amountCents !== undefined) checkAmount(patch.amountCents);
    await ctx.db.patch(expense._id, patch);
  },
});

export const remove = mutation({
  args: { token: v.string(), id: v.string() },
  handler: async (ctx, { token, id }) => {
    const expense = await ownExpense(ctx, token, id);
    await ctx.db.delete(expense._id);
  },
});

/** Expenses in [from, to), newest first, with who paid. The app passes local month boundaries. */
export const list = query({
  args: { token: v.string(), from: v.number(), to: v.number() },
  handler: async (ctx, { token, from, to }) => {
    const member = await memberFor(ctx, token);
    const rows = await ctx.db
      .query("expenses")
      .withIndex("by_household_spentAt", (q) => q.eq("householdId", member.householdId).gte("spentAt", from).lt("spentAt", to))
      .order("desc")
      .collect();
    const names = new Map<string, string>();
    for (const r of rows) {
      if (!names.has(r.memberId)) names.set(r.memberId, (await ctx.db.get(r.memberId))?.name ?? "former member");
    }
    return rows.map((r) => ({ ...r, memberName: names.get(r.memberId)! }));
  },
});

/** Totals per category for [from, to) next to each budget: what the home screen shows, live. */
export const summary = query({
  args: { token: v.string(), from: v.number(), to: v.number() },
  handler: async (ctx, { token, from, to }) => {
    const member = await memberFor(ctx, token);
    const rows = await ctx.db
      .query("expenses")
      .withIndex("by_household_spentAt", (q) => q.eq("householdId", member.householdId).gte("spentAt", from).lt("spentAt", to))
      .collect();
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_household_category", (q) => q.eq("householdId", member.householdId))
      .collect();
    const spent = new Map<string, number>();
    for (const r of rows) spent.set(r.category, (spent.get(r.category) ?? 0) + r.amountCents);
    const byCategory = CATEGORY_IDS.map((id) => ({
      category: id,
      spentCents: spent.get(id) ?? 0,
      budgetCents: budgets.find((b) => b.category === id)?.monthlyCents ?? null,
    })).filter((c) => c.spentCents > 0 || c.budgetCents !== null);
    return {
      totalCents: rows.reduce((s, r) => s + r.amountCents, 0),
      budgetCents: budgets.reduce((s, b) => s + b.monthlyCents, 0),
      count: rows.length,
      byCategory: byCategory.sort((a, b) => b.spentCents - a.spentCents),
      // share of scanned receipts where the model's first guess was kept
      modelAgreement: (() => {
        const scanned = rows.filter((r) => r.source === "scan" && r.predictedCategory);
        return scanned.length ? scanned.filter((r) => r.predictedCategory === r.category).length / scanned.length : null;
      })(),
    };
  },
});
