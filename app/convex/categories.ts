// Shared by the Convex backend and the app. The order matches the model's labels.json.
export const CATEGORIES = [
  { id: "groceries", label: "Groceries", emoji: "🛒" },
  { id: "restaurants", label: "Cafés & restaurants", emoji: "☕" },
  { id: "transport", label: "Transport & fuel", emoji: "🚕" },
  { id: "utilities", label: "Water & electricity", emoji: "💡" },
  { id: "telecom", label: "Phone & internet", emoji: "📶" },
  { id: "health", label: "Health & pharmacy", emoji: "💊" },
  { id: "clothing", label: "Clothing", emoji: "👕" },
  { id: "household", label: "Home & DIY", emoji: "🛋️" },
  { id: "education", label: "School & books", emoji: "📚" },
  { id: "leisure", label: "Leisure", emoji: "🎬" },
  { id: "other", label: "Other", emoji: "📦" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function categoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
