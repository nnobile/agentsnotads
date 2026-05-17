"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./subscribe.module.css";

export default function SubscribePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [cadence, setCadence] = useState<"daily" | "weekly">("weekly");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, cadence }),
      });

      const data = await res.json();

      if (data.success) {
        router.push("/subscribe/confirmed");
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.box}>
        <h1 className={styles.headline}>Stay ahead of the agentic shift.</h1>
        <p className={styles.subtext}>
          Curated intelligence on AI agents transforming advertising — delivered
          to your inbox.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label className={styles.fieldLabel} htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={styles.input}
            required
            autoComplete="email"
          />

          <div className={styles.cadenceRow}>
            <label className={styles.cadenceOpt}>
              <input
                type="radio"
                name="cadence"
                value="daily"
                checked={cadence === "daily"}
                onChange={() => setCadence("daily")}
              />
              Daily
            </label>
            <label className={styles.cadenceOpt}>
              <input
                type="radio"
                name="cadence"
                value="weekly"
                checked={cadence === "weekly"}
                onChange={() => setCadence("weekly")}
              />
              Weekly digest
            </label>
          </div>

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? "Subscribing…" : "Subscribe Free"}
          </button>
        </form>
      </div>
    </div>
  );
}
