import { useMutation, useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Share, View } from "react-native";

import { api } from "../../convex/_generated/api";
import { CATEGORIES, type CategoryId } from "../../convex/categories";
import { Body, Button, Card, Field, Muted, Title } from "../components/ui";
import { formatMAD, monthRange, parseUserAmount } from "../lib/receipt";
import { useToken } from "../lib/session";

export default function Household() {
  const token = useToken();
  const me = useQuery(api.households.me, { token });
  const month = monthRange(0);
  const summary = useQuery(api.expenses.summary, { token, from: month.from, to: month.to });
  const setBudget = useMutation(api.budgets.set);
  const leave = useMutation(api.households.leave);
  const [drafts, setDrafts] = useState<Partial<Record<CategoryId, string>>>({});

  if (!me) return null;
  const budgetOf = (id: CategoryId) => summary?.byCategory.find((r) => r.category === id)?.budgetCents ?? null;

  async function saveBudget(id: CategoryId) {
    const text = drafts[id] ?? "";
    const cents = text.trim() === "" ? 0 : parseUserAmount(text);
    if (cents === null) return Alert.alert("Budget", "Enter an amount such as 1500");
    await setBudget({ token, category: id, monthlyCents: cents });
    setDrafts((d) => ({ ...d, [id]: undefined }));
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Title>{me.household.name}</Title>
      <Card>
        <Muted>Invite code</Muted>
        <Body bold>{me.household.inviteCode}</Body>
        <Button
          title="Share invite"
          kind="secondary"
          onPress={() => Share.share({ message: `Join our household on HomeTally with the code ${me.household.inviteCode}` })}
        />
      </Card>
      <Card>
        <Muted>Members</Muted>
        {me.members.map((m) => <Body key={m.id}>{m.name}{m.id === me.me.id ? " (you)" : ""}</Body>)}
      </Card>

      <Body bold>Monthly budgets</Body>
      <Muted>Leave empty for no budget. Everyone in the household sees the same budgets.</Muted>
      <View style={{ height: 10 }} />
      {CATEGORIES.map((cat) => {
        const current = budgetOf(cat.id);
        const draft = drafts[cat.id];
        return (
          <View key={cat.id} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field
                label={`${cat.emoji} ${cat.label}${current ? ` · ${formatMAD(current)}` : ""}`}
                value={draft ?? (current ? String(current / 100) : "")}
                onChangeText={(t) => setDrafts((d) => ({ ...d, [cat.id]: t }))}
                keyboardType="decimal-pad"
                placeholder="no budget"
              />
            </View>
            {draft !== undefined && <View style={{ marginBottom: 12 }}><Button title="Save" onPress={() => saveBudget(cat.id)} /></View>}
          </View>
        );
      })}

      <View style={{ height: 24 }} />
      <Button
        title="Leave household"
        kind="danger"
        onPress={() =>
          Alert.alert("Leave household?", "Your past expenses stay with the household.", [
            { text: "Cancel", style: "cancel" },
            { text: "Leave", style: "destructive", onPress: async () => { await leave({ token }); router.replace("/"); } },
          ])
        }
      />
    </ScrollView>
  );
}
