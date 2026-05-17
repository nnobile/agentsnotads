import { createServiceClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types";
import ApprovedList from "./ApprovedList";
import styles from "../queue/queue.module.css";

export const dynamic = "force-dynamic";

export default async function ApprovedPage() {
  const supabase = createServiceClient();

  const { data: articles, error } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (error) {
    return (
      <div>
        <p style={{ color: "#dc2626" }}>
          Failed to load approved articles: {error.message}
        </p>
      </div>
    );
  }

  const list = (articles ?? []) as Article[];

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Approved Articles</h1>
        <p className={styles.pageCount}>
          {list.length === 0
            ? "No approved articles"
            : `${list.length} article${list.length === 1 ? "" : "s"} approved`}
        </p>
      </div>
      <ApprovedList articles={list} />
    </div>
  );
}
