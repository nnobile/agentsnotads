import { createServiceClient } from "@/lib/supabase/server";
import NewsletterActions from "./NewsletterActions";
import styles from "./newsletter.module.css";

export const dynamic = "force-dynamic";

export default async function NewsletterPage() {
  const supabase = createServiceClient();

  const [{ count: unsentCount }, { data: subRows }] = await Promise.all([
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("newsletter_sent", false),
    supabase
      .from("subscribers")
      .select("cadence")
      .eq("confirmed", true)
      .is("unsubscribed_at", null),
  ]);

  const rows = subRows ?? [];
  const dailyCount = rows.filter((r) => r.cadence === "daily").length;
  const weeklyCount = rows.filter((r) => r.cadence === "weekly").length;
  const totalConfirmed = rows.length;
  const unsent = unsentCount ?? 0;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Newsletter</h1>
      <p className={styles.subtext}>
        Send to confirmed subscribers. Minimum 3 unsent articles required.
      </p>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Unsent Articles</div>
          <div className={`${styles.statValue} ${unsent < 3 ? styles.statValueWarn : ""}`}>
            {unsent}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Daily Subscribers</div>
          <div className={styles.statValue}>{dailyCount}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Weekly Subscribers</div>
          <div className={styles.statValue}>{weeklyCount}</div>
        </div>
      </div>

      <NewsletterActions unsentCount={unsent} />

      <p style={{ marginTop: 32, fontSize: 12, color: "#aaa" }}>
        {totalConfirmed} total confirmed subscriber{totalConfirmed !== 1 ? "s" : ""}.
        Sending marks all unsent articles as sent.
      </p>
    </div>
  );
}
