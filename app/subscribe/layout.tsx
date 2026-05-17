import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscribe — Agents, Not Ads",
  description:
    "Get curated intelligence on agentic AI in advertising delivered to your inbox. Free daily or weekly digest.",
};

export default function SubscribeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
