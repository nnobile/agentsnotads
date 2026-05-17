"use client";

import { useState } from "react";
import styles from "./newsletter.module.css";

interface SendResult {
  skipped?: string;
  sent?: number;
  failed?: number;
  errors?: string[];
}

interface Props {
  unsentCount: number;
}

export default function NewsletterActions({ unsentCount }: Props) {
  const [loading, setLoading] = useState<"daily" | "weekly" | null>(null);
  const [result, setResult] = useState<{ cadence: string; data: SendResult } | null>(null);

  const canSend = unsentCount >= 3;

  async function handleSend(cadence: "daily" | "weekly") {
    setLoading(cadence);
    setResult(null);

    try {
      const res = await fetch("/api/admin/send-newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence }),
      });
      const data: SendResult = await res.json();
      setResult({ cadence, data });
    } catch {
      setResult({
        cadence,
        data: { skipped: "Network error. Please try again." },
      });
    } finally {
      setLoading(null);
    }
  }

  let resultClass = styles.result;
  if (result) {
    if (result.data.skipped) resultClass += " " + styles.resultSkipped;
    else if (result.data.failed && result.data.sent === 0) resultClass += " " + styles.resultError;
    else resultClass += " " + styles.resultSuccess;
  }

  return (
    <>
      <div className={styles.actions}>
        <button
          className={styles.sendBtn}
          onClick={() => handleSend("daily")}
          disabled={loading !== null || !canSend}
        >
          {loading === "daily" ? "Sending…" : "Send Daily Brief"}
        </button>
        <button
          className={`${styles.sendBtn} ${styles.sendBtnSecondary}`}
          onClick={() => handleSend("weekly")}
          disabled={loading !== null || !canSend}
        >
          {loading === "weekly" ? "Sending…" : "Send Weekly Brief"}
        </button>
      </div>

      {!canSend && (
        <p style={{ fontSize: 13, color: "#b45309", marginBottom: 20 }}>
          Need at least 3 unsent articles to send.
        </p>
      )}

      {result && (
        <div className={resultClass}>
          <div className={styles.resultLabel}>
            {result.cadence.charAt(0).toUpperCase() + result.cadence.slice(1)} send result
          </div>
          {result.data.skipped ? (
            <p style={{ margin: 0 }}>{result.data.skipped}</p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                Sent to <strong>{result.data.sent}</strong> subscriber
                {result.data.sent !== 1 ? "s" : ""}.
                {(result.data.failed ?? 0) > 0 && (
                  <> {result.data.failed} failed.</>
                )}
              </p>
              {result.data.errors && result.data.errors.length > 0 && (
                <ul className={styles.errorList}>
                  {result.data.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
