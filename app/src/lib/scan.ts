/**
 * Receipt photo → text → category, entirely on the phone.
 *
 * OCR: Google ML Kit text recognition (Latin script). ML Kit has no Arabic-script recogniser,
 * so Arabic lines on a receipt are not read from photos; French lines, prices and totals are.
 * Classification: the TFLite model in assets/model, run by react-native-fast-tflite.
 */
import TextRecognition from "@react-native-ml-kit/text-recognition";
import * as ImagePicker from "expo-image-picker";
import { useTensorflowModel } from "react-native-fast-tflite";

import { classify, type Prediction } from "./classifier";
import { extractDate, extractMerchant, extractTotalCents } from "./receipt";

export const SCAN_SUPPORTED = true;

export type ScanResult = {
  text: string;
  totalCents: number | null;
  merchant: string | null;
  date: Date | null;
  prediction: Prediction | null;
};

export function useReceiptModel() {
  const plugin = useTensorflowModel(require("../../assets/model/receipt_classifier.tflite"), []);
  return plugin.state === "loaded" ? plugin.model : null;
}

/** Opens the camera (or the photo library) and reads the receipt. Returns null if the user cancels. */
export async function scanReceipt(
  model: ReturnType<typeof useReceiptModel>,
  from: "camera" | "library",
): Promise<ScanResult | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
  if (from === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error("Camera permission is needed to scan receipts.");
  }
  const picked = from === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets.length) return null;

  const { text } = await TextRecognition.recognize(picked.assets[0].uri);
  return {
    text,
    totalCents: extractTotalCents(text),
    merchant: extractMerchant(text),
    date: extractDate(text),
    prediction: model && text.trim() ? await classify((input) => model.run(input), text) : null,
  };
}
