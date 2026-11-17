import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme, type TextInputProps } from "react-native";

import { CATEGORIES, categoryInfo, type CategoryId } from "../../convex/categories";
import { formatMAD } from "../lib/receipt";

const light = { bg: "#FBFAF6", card: "#FFFFFF", fg: "#1C1B18", muted: "#6A675E", line: "#E6E2D6", accent: "#0F6B5C", accentSoft: "#E3F1EE", danger: "#A33A2B", warn: "#B7791F" };
const dark = { bg: "#131311", card: "#1C1C19", fg: "#ECEBE5", muted: "#A29F95", line: "#2D2C28", accent: "#5CC2AD", accentSoft: "#17302B", danger: "#E28474", warn: "#E0B062" };
export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

export function Screen({ children }: { children: ReactNode }) {
  const c = usePalette();
  return <View style={[styles.screen, { backgroundColor: c.bg }]}>{children}</View>;
}

export function Card({ children }: { children: ReactNode }) {
  const c = usePalette();
  return <View style={[styles.card, { backgroundColor: c.card, borderColor: c.line }]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[styles.title, { color: usePalette().fg }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <Text style={[styles.muted, { color: usePalette().muted }]}>{children}</Text>;
}

export function Body({ children, bold }: { children: ReactNode; bold?: boolean }) {
  return <Text style={[styles.body, { color: usePalette().fg }, bold && { fontWeight: "600" }]}>{children}</Text>;
}

export function Button({ title, onPress, kind = "primary", busy, disabled }: {
  title: string; onPress: () => void; kind?: "primary" | "secondary" | "danger"; busy?: boolean; disabled?: boolean;
}) {
  const c = usePalette();
  const bg = kind === "primary" ? c.accent : kind === "danger" ? c.danger : "transparent";
  const fg = kind === "secondary" ? c.fg : c.bg;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [styles.button, { backgroundColor: bg, borderColor: c.line, opacity: pressed || disabled ? 0.6 : 1 }, kind === "secondary" && { borderWidth: 1 }]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = usePalette();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <TextInput placeholderTextColor={c.muted} {...props} style={[styles.input, { color: c.fg, borderColor: c.line, backgroundColor: c.card }]} />
    </View>
  );
}

export function CategoryPicker({ value, onChange, suggested }: { value: CategoryId; onChange: (id: CategoryId) => void; suggested?: CategoryId[] }) {
  const c = usePalette();
  const order = [...(suggested ?? []), ...CATEGORIES.map((x) => x.id).filter((id) => !suggested?.includes(id))];
  return (
    <View style={styles.chips}>
      {order.map((id) => {
        const info = categoryInfo(id);
        const selected = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(id)}
            style={[styles.chip, { borderColor: selected ? c.accent : c.line, backgroundColor: selected ? c.accentSoft : c.card }]}
          >
            <Text style={{ color: c.fg }}>{info.emoji} {info.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BudgetBar({ spent, budget }: { spent: number; budget: number | null }) {
  const c = usePalette();
  if (!budget) return null;
  const ratio = spent / budget;
  const color = ratio > 1 ? c.danger : ratio > 0.8 ? c.warn : c.accent;
  return (
    <View style={{ marginTop: 6 }}>
      <View style={[styles.barTrack, { backgroundColor: c.line }]}>
        <View style={[styles.barFill, { width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.muted, { color: ratio > 1 ? c.danger : c.muted }]}>
        {ratio > 1 ? `${formatMAD(spent - budget)} over budget` : `${formatMAD(budget - spent)} left of ${formatMAD(budget)}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  muted: { fontSize: 13, marginTop: 2 },
  body: { fontSize: 16 },
  button: { borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", marginVertical: 5 },
  buttonText: { fontSize: 16, fontWeight: "600" },
  label: { fontSize: 13, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
});
