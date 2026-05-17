"use client";

import { useState } from "react";
import styles from "./sources.module.css";

interface Source {
  id: string;
  name: string;
  url: string;
  coverage_area: string | null;
  active: boolean;
}

interface FetchResult {
  fetched?: number;
  candidates?: number;
  errors?: string[];
  error?: string;
}

export default function SourcesList({
  initialSources,
}: {
  initialSources: Source[];
}) {
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [toggling, setToggling] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null);

  async function handleToggle(id: string) {
    setToggling(id);
    const res = await fetch(`/api/admin/sources/${id}/toggle`, {
      method: "POST",
    });
    const data = await res.json();
    if (!data.error) {
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, active: data.active } : s))
      );
    }
    setToggling(null);
  }

  async function handleFetch() {
    setFetching(true);
    setFetchResult(null);
    try {
      const res = await fetch("/api/admin/trigger-fetch", { method: "POST" });
      const data: FetchResult = await res.json();
      setFetchResult(data);
    } catch {
      setFetchResult({ error: "Network error. Please try again." });
    } finally {
      setFetching(false);
    }
  }

  const resultClass =
    fetchResult?.error
      ? `${styles.fetchResult} ${styles.fetchResultError}`
      : styles.fetchResult;

  return (
    <>
      <div className={styles.fetchBar}>
        <button
          className={styles.fetchBtn}
          onClick={handleFetch}
          disabled={fetching}
        >
          {fetching ? "Fetching…" : "Run Fetch Now"}
        </button>
        {fetchResult && (
          <span className={resultClass}>
            {fetchResult.error
              ? fetchResult.error
              : `Fetched ${fetchResult.fetched ?? 0} articles — ${fetchResult.candidates ?? 0} new candidates`}
          </span>
        )}
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th style={{ width: 16 }}></th>
            <th>Source</th>
            <th>Coverage</th>
            <th style={{ width: 100 }}></th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}>
              <td>
                <span
                  className={`${styles.dot} ${s.active ? styles.dotActive : styles.dotInactive}`}
                  title={s.active ? "Active" : "Inactive"}
                />
              </td>
              <td>
                <div className={styles.sourceName}>{s.name}</div>
                <div className={styles.sourceUrl}>{s.url}</div>
              </td>
              <td>
                <span className={styles.coverage}>
                  {s.coverage_area ?? "—"}
                </span>
              </td>
              <td>
                <button
                  className={`${styles.toggleBtn} ${s.active ? styles.toggleBtnDeactivate : ""}`}
                  onClick={() => handleToggle(s.id)}
                  disabled={toggling === s.id}
                >
                  {toggling === s.id
                    ? "…"
                    : s.active
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
