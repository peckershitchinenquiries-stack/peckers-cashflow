import { Metadata } from "next";

export const metadata: Metadata = {
  title: "VM Analytics — Peckers",
  description: "Weekly performance analytics dashboard",
};

export default function VmAnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
