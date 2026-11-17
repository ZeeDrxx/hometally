import { ConvexError } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The member a device token belongs to. Every household-scoped function goes through this. */
export async function memberFor(ctx: QueryCtx, token: string): Promise<Doc<"members">> {
  if (token.length < 32) throw new ConvexError("invalid session");
  const tokenHash = await sha256(token);
  const member = await ctx.db.query("members").withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash)).unique();
  if (!member) throw new ConvexError("invalid session");
  return member;
}

export function cleanName(name: string, max = 40): string {
  const s = name.trim().replace(/\s+/g, " ");
  if (!s) throw new ConvexError("name is required");
  return s.slice(0, max);
}
