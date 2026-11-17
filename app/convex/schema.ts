import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { CATEGORY_IDS } from "./categories";

export const category = v.union(...CATEGORY_IDS.map((id) => v.literal(id)));

export default defineSchema({
  households: defineTable({
    name: v.string(),
    inviteCode: v.string(),
    currency: v.literal("MAD"),
  }).index("by_inviteCode", ["inviteCode"]),

  members: defineTable({
    householdId: v.id("households"),
    name: v.string(),
    tokenHash: v.string(), // SHA-256 of the device token; the token itself never reaches the database
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_household", ["householdId"]),

  expenses: defineTable({
    householdId: v.id("households"),
    memberId: v.id("members"),
    amountCents: v.number(), // integer centimes: 12.50 MAD = 1250
    category,
    merchant: v.optional(v.string()),
    note: v.optional(v.string()),
    spentAt: v.number(), // ms since epoch
    source: v.union(v.literal("scan"), v.literal("manual")),
    // What the on-device model guessed, kept so accuracy on real receipts can be measured.
    predictedCategory: v.optional(category),
    confidence: v.optional(v.number()),
  }).index("by_household_spentAt", ["householdId", "spentAt"]),

  budgets: defineTable({
    householdId: v.id("households"),
    category,
    monthlyCents: v.number(),
  }).index("by_household_category", ["householdId", "category"]),
});
