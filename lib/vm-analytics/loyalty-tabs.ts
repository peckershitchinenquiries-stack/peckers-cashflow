// Kept out of the client tab strip so the server page can call isLoyaltyTab.
export type LoyaltyTab = "overview" | "members" | "retention" | "value" | "behaviour";

export const LOYALTY_TABS: Array<{ id: LoyaltyTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "members", label: "Members" },
  { id: "retention", label: "Retention" },
  { id: "value", label: "Value" },
  { id: "behaviour", label: "Behaviour" },
];

export function isLoyaltyTab(v: unknown): v is LoyaltyTab {
  return LOYALTY_TABS.some((t) => t.id === v);
}
