import type { Metadata } from "next";
import Link from "next/link";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About — Agents, Not Ads",
  description:
    "Agents, Not Ads is a curated intelligence feed for advertising and ad tech executives tracking how agentic AI is reshaping the business of buying and selling advertising.",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/" className={styles.backLink}>
          ← Home
        </Link>

        <h1 className={styles.heading}>About Agents, Not Ads.</h1>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>What this is</p>
          <p className={styles.sectionBody}>
            Agents, Not Ads is a curated intelligence feed for advertising and
            ad tech executives tracking how agentic AI is reshaping the business
            of buying and selling advertising. Every story is scored and
            summarized by AI, reviewed by a human editor, and published only if
            it&rsquo;s directly relevant to how agentic AI is being applied
            across programmatic, CTV, retail media, search, social,
            out-of-home, agency, and brand.
          </p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>Who it&rsquo;s for</p>
          <p className={styles.sectionBody}>
            Executives, operators, and investors across the advertising
            ecosystem who need signal, not noise. If you&rsquo;re making
            decisions about media, technology, or strategy in advertising, this
            is for you.
          </p>
        </div>

        <div className={styles.section}>
          <p className={styles.sectionLabel}>How it works</p>
          <p className={styles.sectionBody}>
            Our pipeline monitors 16+ industry publications around the clock.
            Every article is evaluated by Claude &mdash; Anthropic&rsquo;s AI
            &mdash; for relevance to agentic AI in advertising, scored,
            summarized, and tagged. A human editor reviews every candidate
            before it publishes. The result is a tight, high-signal feed
            updated throughout the day.
          </p>
        </div>

        <div className={styles.cta}>
          <p className={styles.ctaText}>
            Get the best stories in your inbox — free.
          </p>
          <Link href="/subscribe" className={styles.ctaBtn}>
            Subscribe Free
          </Link>
        </div>
      </div>
    </div>
  );
}
