import { useMutation } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { categoryInfo, type CategoryId } from "../../../convex/categories";
import { Body, Button, Card, CategoryPicker, Field, Muted } from "../../components/ui";
import type { Prediction } from "../../lib/classifier";
import { parseUserAmount } from "../../lib/receipt";
import { SCAN_SUPPORTED, scanReceipt, useReceiptModel } from "../../lib/scan";
import { useToken } from "../../lib/session";

export default function NewExpense() {
  const token = useToken();
  const { scan } = useLocalSearchParams<{ scan?: string }>();
  const model = useReceiptModel();
  const add = useMutation(api.expenses.add);

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<CategoryId>("other");
  const [date, setDate] = useState(new Date());
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoScanned = useRef(false);

  async function doScan(from: "camera" | "library") {
    setScanning(true);
    try {
      const r = await scanReceipt(model, from);
      if (!r) return;
      if (r.totalCents) setAmount((r.totalCents / 100).toFixed(2).replace(".", ","));
      if (r.merchant) setMerchant(r.merchant);
      if (r.date) setDate(r.date);
      setPrediction(r.prediction);
      if (r.prediction?.confident) setCategory(r.prediction.category);
      if (!r.text.trim()) Alert.alert("No text found", "Try again with the whole receipt flat and well lit.");
    } catch (e) {
      Alert.alert("Scan failed", e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }

  // Opened from "Scan receipt": go straight to the camera once the model is ready.
  useEffect(() => {
    if (scan === "1" && model && !autoScanned.current) {
      autoScanned.current = true;
      doScan("camera");
    }
  }, [scan, model]);

  async function save() {
    const cents = parseUserAmount(amount);
    if (!cents) return Alert.alert("Amount", "Enter an amount such as 125,50");
    setSaving(true);
    try {
      await add({
        token,
        amountCents: cents,
        category,
        merchant: merchant || undefined,
        note: note || undefined,
        spentAt: date.getTime(),
        source: prediction ? "scan" : "manual",
        predictedCategory: prediction?.category,
        confidence: prediction?.confidence,
      });
      router.back();
    } catch (e) {
      Alert.alert("Could not save", e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      {SCAN_SUPPORTED ? (
        <>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="📷 Camera" kind="secondary" busy={scanning} disabled={!model} onPress={() => doScan("camera")} /></View>
            <View style={{ flex: 1 }}><Button title="🖼️ Photo" kind="secondary" busy={scanning} disabled={!model} onPress={() => doScan("library")} /></View>
          </View>
          {!model && <Muted>Loading the receipt model…</Muted>}
        </>
      ) : (
        <Card><Muted>Receipt scanning runs on the phone (on-device OCR and model). Here, add the expense by hand.</Muted></Card>
      )}

      {prediction && (
        <Card>
          <Body>
            {prediction.confident
              ? `Looks like ${categoryInfo(prediction.category).label.toLowerCase()} (${Math.round(prediction.confidence * 100)}%)`
              : "Not sure about this one: pick a category below."}
          </Body>
          <Muted>Read on this phone; the photo is not uploaded.</Muted>
        </Card>
      )}

      <Field label="Amount (MAD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="125,50" />
      <Field label="Shop" value={merchant} onChangeText={setMerchant} placeholder="Marjane" />
      <Muted>Category</Muted>
      <View style={{ height: 6 }} />
      <CategoryPicker value={category} onChange={setCategory} suggested={prediction?.ranked.map((r) => r.category)} />
      <Field label="Note" value={note} onChangeText={setNote} placeholder="optional" />
      <Muted>Date: {date.toLocaleDateString("en-GB")}</Muted>
      <View style={{ height: 12 }} />
      <Button title="Save" busy={saving} onPress={save} />
    </ScrollView>
  );
}
