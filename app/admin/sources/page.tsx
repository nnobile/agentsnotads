import { createServiceClient } from "@/lib/supabase/server";
import SourcesList from "./SourcesList";
import styles from "./sources.module.css";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("rss_sources")
    .select("id, name, url, coverage_area, active")
    .order("name", { ascending: true });

  const sources = data ?? [];

  const activeCount = sources.filter((s) => s.active).length;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>RSS Sources</h1>
      <p className={styles.subtext}>
        {activeCount} of {sources.length} sources active. Toggle to
        enable/disable individual feeds.
      </p>

      <SourcesList initialSources={sources} />
    </div>
  );
}
