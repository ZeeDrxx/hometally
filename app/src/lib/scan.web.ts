/**
 * Web build: no receipt scanning. ML Kit OCR and the TFLite runtime are native modules, so the
 * browser version (a demo of the shared budget) only supports manual entry. Same exports as scan.ts.
 */
import type { Prediction } from "./classifier";

export const SCAN_SUPPORTED = false;

export type ScanResult = {
  text: string;
  totalCents: number | null;
  merchant: string | null;
  date: Date | null;
  prediction: Prediction | null;
};

export function useReceiptModel(): null {
  return null;
}

export async function scanReceipt(): Promise<ScanResult | null> {
  throw new Error("Receipt scanning runs in the phone app. On the web, add expenses manually.");
}
