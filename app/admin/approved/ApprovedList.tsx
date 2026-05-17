"use client";

import { useState } from "react";
import type { Article } from "@/lib/types";
import styles from "../queue/queue.module.css";

function ArticleCard({
  article,
  onRevert,
  isPending,
}: {
  article: Article;
  onRevert: () => void;
  isPending: boolean;
}) {
  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const approvedDate = article.approved_at
    ? new Date(article.approved_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className={`${styles.card} ${isPending ? styles.pending : ""}`}>
      <div className={styles.cardMeta}>
        {article.relevance_score !== null && (
          <span
            className={`${styles.score} ${
              article.relevance_score >= 0.8
                ? styles.scoreGreen
                : styles.scoreYellow
            }`}
          >
            {(article.relevance_score * 100).toFixed(0)}% match
          </span>
        )}
        <span className={styles.metaDivider}>·</span>
        <span className={styles.cardSource}>{article.source}</span>
        {pubDate && (
          <>
            <span className={styles.metaDivider}>·</span>
            <span className={styles.cardDate}>{pubDate}</span>
          </>
        )}
        {approvedDate && (
          <>
            <span className={styles.metaDivider}>·</span>
            <span className={styles.approvedDate}>Approved {approvedDate}</span>
          </>
        )}
      </div>

      <h2 className={styles.cardTitle}>
        <a href={article.url} target="_blank" rel="noopener noreferrer">
          {article.title}
        </a>
      </h2>

      {article.summary && (
        <p className={styles.cardSummary}>{article.summary}</p>
      )}

      {article.tags && article.tags.length > 0 && (
        <div className={styles.tags}>
          {article.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.revertBtn}
          onClick={onRevert}
          disabled={isPending}
        >
          Revert to candidate
        </button>
      </div>
    </div>
  );
}

export default function ApprovedList({ articles: initial }: { articles: Article[] }) {
  const [articles, setArticles] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleRevert(id: string) {
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/articles/${id}/revert`, {
        method: "POST",
      });
      if (res.ok) {
        setArticles((prev) => prev.filter((a) => a.id !== id));
      }
    } finally {
      setPendingId(null);
    }
  }

  if (articles.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>📋</div>
        No approved articles yet. Start reviewing the queue.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {articles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          isPending={pendingId === article.id}
          onRevert={() => handleRevert(article.id)}
        />
      ))}
    </div>
  );
}
