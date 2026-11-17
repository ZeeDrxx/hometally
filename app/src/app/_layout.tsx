import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";

import { usePalette } from "../components/ui";
import { SessionProvider } from "../lib/session";

const url = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!url) throw new Error("EXPO_PUBLIC_CONVEX_URL is not set: run `npx convex dev` once to create .env.local");
const convex = new ConvexReactClient(url, { unsavedChangesWarning: false });

export default function RootLayout() {
  const c = usePalette();
  return (
    <ConvexProvider client={convex}>
      <SessionProvider fallback={<View style={{ flex: 1, justifyContent: "center", backgroundColor: c.bg }}><ActivityIndicator /></View>}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.fg,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: c.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: "HomeTally" }} />
          <Stack.Screen name="expense/new" options={{ title: "New expense", presentation: "modal" }} />
          <Stack.Screen name="household" options={{ title: "Household" }} />
        </Stack>
      </SessionProvider>
    </ConvexProvider>
  );
}
