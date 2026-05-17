import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types";
import styles from "./article.module.css";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("articles")
    .select("title, summary")
    .eq("id", params.id)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) return { title: "Agents, Not Ads" };

  return {
    title: `${data.title} — Agents, Not Ads`,
    description: data.summary ?? undefined,
  };
}

const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  Programmatic: { bg: "#dbeafe", color: "#1e40af" },
  "CTV & Streaming": { bg: "#ede9fe", color: "#5b21b6" },
  "Retail Media": { bg: "#ffedd5", color: "#9a3412" },
  Agency: { bg: "#d1fae5", color: "#065f46" },
  "Agentic AI": { bg: "#fce7f3", color: "#9d174d" },
  Martech: { bg: "#cffafe", color: "#155e75" },
  Measurement: { bg: "#fef9c3", color: "#854d0e" },
  "Out-of-Home": { bg: "#ccfbf1", color: "#134e4a" },
  "Search & Social": { bg: "#fee2e2", color: "#991b1b" },
  "Brand Strategy": { bg: "#dcfce7", color: "#166534" },
  "Creative AI": { bg: "#fdf4ff", color: "#7e22ce" },
  "Data & Identity": { bg: "#fff7ed", color: "#c2410c" },
  LLM: { bg: "#e0e7ff", color: "#3730a3" },
  DSP: { bg: "#dbeafe", color: "#1e3a8a" },
  SSP: { bg: "#e0f2fe", color: "#075985" },
  Publishing: { bg: "#f0fdf4", color: "#15803d" },
};

export default async function ArticlePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("articles")
    .select("*")
    .eq("id", params.id)
    .eq("status", "approved")
    .maybeSingle();

  if (!data) notFound();

  const article = data as Article;

  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.back}>
          ← Back
        </Link>

        <div className={styles.meta}>
          <span className={styles.source}>{article.source}</span>
          {pubDate && (
            <>
              <span className={styles.metaDivider}>·</span>
              <span className={styles.date}>{pubDate}</span>
            </>
          )}
        </div>

        <h1 className={styles.title}>{article.title}</h1>

        {article.tags && article.tags.length > 0 && (
          <div className={styles.tags}>
            {article.tags.map((tag) => {
              const colors = TAG_COLORS[tag] ?? { bg: "#f3f4f6", color: "#374151" };
              return (
                <span
                  key={tag}
                  className={styles.tagPill}
                  style={{ backgroundColor: colors.bg, color: colors.color }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}

        {article.summary && (
          <div className={styles.summaryBlock}>
            <p className={styles.summaryLabel}>AI Summary</p>
            <p className={styles.summaryText}>{article.summary}</p>
          </div>
        )}

        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.readBtn}
        >
          Read the full article →
        </a>

        <div className={styles.subscribeCta}>
          <p className={styles.ctaText}>
            Enjoying this? Get stories like this in your inbox.
          </p>
          <Link href="/subscribe" className={styles.ctaLink}>
            Subscribe free →
          </Link>
        </div>
      </div>
    </div>
  );
}
