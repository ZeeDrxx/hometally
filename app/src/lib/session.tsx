/**
 * The phone's identity: a random 64-hex-char token made on first launch and kept in the OS keychain
 * (expo-secure-store). Convex only ever stores its SHA-256 hash. Losing the phone means losing the
 * session, not the household: another member can share the invite code again.
 */
import * as Crypto from "expo-crypto";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { getToken, setToken } from "./token-store";

const KEY = "hometally.token";

async function loadOrCreateToken(): Promise<string> {
  const existing = await getToken(KEY);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  await setToken(KEY, token);
  return token;
}

const SessionContext = createContext<string | null>(null);

export function SessionProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    loadOrCreateToken().then(setToken);
  }, []);
  return token ? <SessionContext.Provider value={token}>{children}</SessionContext.Provider> : <>{fallback}</>;
}

export function useToken(): string {
  const token = useContext(SessionContext);
  if (!token) throw new Error("useToken outside SessionProvider");
  return token;
}
