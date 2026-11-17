import { useMutation, useQuery } from "convex/react";
import { Link, router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { categoryInfo } from "../../convex/categories";
import { Body, BudgetBar, Button, Card, Field, Muted, Screen, Title, usePalette } from "../components/ui";
import { formatMAD, monthRange } from "../lib/receipt";
import { SCAN_SUPPORTED } from "../lib/scan";
import { useToken } from "../lib/session";

export default function Home() {
  const token = useToken();
  const me = useQuery(api.households.me, { token });
  if (me === undefined) return <Screen><Muted>Loading…</Muted></Screen>;
  return me ? <Dashboard /> : <Onboarding />;
}

function Onboarding() {
  const token = useToken();
  const create = useMutation(api.households.create);
  const join = useMutation(api.households.join);
  const [name, setName] = useState("");
  const [home, setHome] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert("Could not continue", e instanceof Error ? e.message.replace(/^.*ConvexError: /, "") : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Title>Track household spending together</Title>
      <Muted>Snap a receipt; HomeTally reads it on your phone, sorts it into a category, and everyone at home sees the totals live.</Muted>
      <View style={{ height: 20 }} />
      <Field label="Your name" value={name} onChangeText={setName} placeholder="Amina" autoComplete="given-name" />
      <Card>
        <Body bold>Start a household</Body>
        <Field label="Household name" value={home} onChangeText={setHome} placeholder="Dar Bennani" />
        <Button title="Create" busy={busy} disabled={!name.trim() || !home.trim()} onPress={() => run(() => create({ name: home, memberName: name, token }))} />
      </Card>
      <Card>
        <Body bold>…or join one</Body>
        <Field label="Invite code" value={code} onChangeText={setCode} placeholder="K7Q2M9XA" autoCapitalize="characters" autoCorrect={false} />
        <Button title="Join" kind="secondary" busy={busy} disabled={!name.trim() || code.trim().length < 6} onPress={() => run(() => join({ inviteCode: code, memberName: name, token }))} />
      </Card>
    </ScrollView>
  );
}

function Dashboard() {
  const token = useToken();
  const c = usePalette();
  const [offset, setOffset] = useState(0);
  const month = monthRange(offset);
  const summary = useQuery(api.expenses.summary, { token, from: month.from, to: month.to });
  const expenses = useQuery(api.expenses.list, { token, from: month.from, to: month.to });

  return (
    <Screen>
      <FlatList
        data={expenses ?? []}
        keyExtractor={(e) => e._id}
        ListHeaderComponent={
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Pressable onPress={() => setOffset(offset - 1)} hitSlop={12}><Text style={{ color: c.accent, fontSize: 22 }}>‹</Text></Pressable>
              <Body bold>{month.label}</Body>
              <Pressable onPress={() => setOffset(Math.min(0, offset + 1))} hitSlop={12} disabled={offset === 0}>
                <Text style={{ color: offset === 0 ? c.line : c.accent, fontSize: 22 }}>›</Text>
              </Pressable>
            </View>
            <Title>{summary ? formatMAD(summary.totalCents) : "…"}</Title>
            {summary && summary.budgetCents > 0 && <BudgetBar spent={summary.totalCents} budget={summary.budgetCents} />}
            <View style={{ flexDirection: "row", gap: 8, marginVertical: 12 }}>
              {SCAN_SUPPORTED && (
                <View style={{ flex: 1 }}><Button title="📷 Scan receipt" onPress={() => router.push({ pathname: "/expense/new", params: { scan: "1" } })} /></View>
              )}
              <View style={{ flex: 1 }}><Button title="Add manually" kind={SCAN_SUPPORTED ? "secondary" : "primary"} onPress={() => router.push("/expense/new")} /></View>
            </View>
            {summary?.byCategory.map((row) => {
              const info = categoryInfo(row.category);
              return (
                <Card key={row.category}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Body>{info.emoji} {info.label}</Body>
                    <Body bold>{formatMAD(row.spentCents)}</Body>
                  </View>
                  <BudgetBar spent={row.spentCents} budget={row.budgetCents} />
                </Card>
              );
            })}
            {summary?.modelAgreement != null && (
              <Muted>Category guessed right on {Math.round(summary.modelAgreement * 100)}% of scanned receipts this month.</Muted>
            )}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 6 }}>
              <Body bold>Expenses</Body>
              <Link href="/household" style={{ color: c.accent }}>Household & budgets ›</Link>
            </View>
          </View>
        }
        ListEmptyComponent={expenses ? <Muted>Nothing yet this month.</Muted> : undefined}
        renderItem={({ item }) => {
          const info = categoryInfo(item.category);
          return (
            <View style={{ flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderColor: c.line }}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>{info.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Body>{item.merchant ?? info.label}</Body>
                <Muted>{new Date(item.spentAt).toLocaleDateString("en-GB")} · {item.memberName}</Muted>
              </View>
              <Body bold>{formatMAD(item.amountCents)}</Body>
            </View>
          );
        }}
      />
    </Screen>
  );
}
