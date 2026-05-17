import { createServiceClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types";
import QueueList from "./QueueList";
import styles from "./queue.module.css";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const supabase = createServiceClient();

  const { data: articles, error } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "candidate")
    .order("fetched_at", { ascending: false });

  if (error) {
    return (
      <div>
        <p style={{ color: "#dc2626" }}>
          Failed to load queue: {error.message}
        </p>
      </div>
    );
  }

  const list = (articles ?? []) as Article[];

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Approval Queue</h1>
        <p className={styles.pageCount}>
          {list.length === 0
            ? "No articles awaiting review"
            : `${list.length} article${list.length === 1 ? "" : "s"} awaiting review`}
        </p>
      </div>
      <QueueList articles={list} />
    </div>
  );
}
