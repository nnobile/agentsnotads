import { createServiceClient } from "@/lib/supabase/server";
import LiveRampClient from "./LiveRampClient";
import styles from "./liveramp.module.css";

export const dynamic = "force-dynamic";

export default async function LiveRampPage() {
  const supabase = createServiceClient();

  const [articleResult, documentResult] = await Promise.all([
    supabase.from("liveramp_articles").select("*", { count: "exact", head: true }),
    supabase.from("liveramp_documents").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>LiveRamp Assistant</h1>
        <p className={styles.pageDesc}>
          BD onboarding tool for the Ecosystems &amp; AI team — product quiz, competitive intel, and scenario practice.
        </p>
      </div>
      <LiveRampClient
        articleCount={articleResult.count ?? 0}
        documentCount={documentResult.count ?? 0}
      />
    </div>
  );
}
