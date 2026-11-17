import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { cleanName, memberFor, sha256 } from "./lib/auth";

// No 0/O or 1/I/L: codes are read aloud and typed on phones.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function inviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Start a household. The phone generates `token` (random, 32+ chars) and keeps it in secure storage. */
export const create = mutation({
  args: { name: v.string(), memberName: v.string(), token: v.string() },
  handler: async (ctx, { name, memberName, token }) => {
    if (token.length < 32) throw new ConvexError("invalid session");
    let code = inviteCode();
    while (await ctx.db.query("households").withIndex("by_inviteCode", (q) => q.eq("inviteCode", code)).unique()) {
      code = inviteCode();
    }
    const householdId = await ctx.db.insert("households", { name: cleanName(name), inviteCode: code, currency: "MAD" });
    await ctx.db.insert("members", { householdId, name: cleanName(memberName), tokenHash: await sha256(token) });
    return { householdId, inviteCode: code };
  },
});

export const join = mutation({
  args: { inviteCode: v.string(), memberName: v.string(), token: v.string() },
  handler: async (ctx, { inviteCode: raw, memberName, token }) => {
    if (token.length < 32) throw new ConvexError("invalid session");
    const code = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const household = await ctx.db.query("households").withIndex("by_inviteCode", (q) => q.eq("inviteCode", code)).unique();
    if (!household) throw new ConvexError("no household with this code");
    const tokenHash = await sha256(token);
    const existing = await ctx.db.query("members").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
    if (existing) throw new ConvexError("this phone already belongs to a household");
    await ctx.db.insert("members", { householdId: household._id, name: cleanName(memberName), tokenHash });
    return { householdId: household._id };
  },
});

/** The caller's household and its members, or null when this phone has not joined one yet. */
export const me = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const member = await memberFor(ctx, token).catch(() => null);
    if (!member) return null;
    const household = await ctx.db.get(member.householdId);
    if (!household) return null;
    const members = await ctx.db.query("members").withIndex("by_household", (q) => q.eq("householdId", household._id)).collect();
    return {
      me: { id: member._id, name: member.name },
      household: { id: household._id, name: household.name, inviteCode: household.inviteCode, currency: household.currency },
      members: members.map((m) => ({ id: m._id, name: m.name })),
    };
  },
});

export const leave = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const member = await memberFor(ctx, token);
    await ctx.db.delete(member._id); // their expenses stay: the household's history is shared
  },
});
