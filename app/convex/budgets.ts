import { ConvexError, v } from "convex/values";

import { mutation } from "./_generated/server";
import { memberFor } from "./lib/auth";
import { category } from "./schema";

/** Set (or with monthlyCents = 0, remove) the monthly budget of a category. */
export const set = mutation({
  args: { token: v.string(), category, monthlyCents: v.number() },
  handler: async (ctx, { token, category, monthlyCents }) => {
    const member = await memberFor(ctx, token);
    if (!Number.isInteger(monthlyCents) || monthlyCents < 0) throw new ConvexError("invalid amount");
    const existing = await ctx.db
      .query("budgets")
      .withIndex("by_household_category", (q) => q.eq("householdId", member.householdId).eq("category", category))
      .unique();
    if (monthlyCents === 0) {
      if (existing) await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, { monthlyCents });
    } else {
      await ctx.db.insert("budgets", { householdId: member.householdId, category, monthlyCents });
    }
  },
});
