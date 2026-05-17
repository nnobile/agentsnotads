import type { Metadata } from "next";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Agents, Not Ads — Agentic AI intelligence for advertising executives",
  description:
    "Curated intelligence on AI agents transforming advertising — scored by AI, reviewed by humans. Programmatic, CTV, retail media, agency, and more.",
};

export const dynamic = "force-dynamic";

const TICKER_ITEMS = [
  "Agentic AI is rewriting every layer of the ad stack",
  "DSPs deploy autonomous bidding agents across CTV inventory",
  "Retail media networks pilot AI-driven campaign optimization",
  "Agencies prototype AI agents for media planning and buying",
  "Publishers use AI agents to automate yield management",
  "Brand safety shifts from rules to real-time agent judgment",
  "Search ads evolve as AI agents conduct product research",
  "Measurement enters the agentic era with unified cross-platform reach",
];

// Values match Claude's exact tag taxonomy stored in the database
const NAV_TAGS = [
  { label: "All", value: "all" },
  { label: "Programmatic", value: "Programmatic" },
  { label: "CTV & Streaming", value: "CTV & Streaming" },
  { label: "Retail Media", value: "Retail Media" },
  { label: "Agency", value: "Agency" },
  { label: "Agentic AI", value: "Agentic AI" },
  { label: "Martech", value: "Martech" },
  { label: "Measurement", value: "Measurement" },
  { label: "Out-of-Home", value: "Out-of-Home" },
  { label: "Search & Social", value: "Search & Social" },
  { label: "Brand Strategy", value: "Brand Strategy" },
  { label: "Creative AI", value: "Creative AI" },
  { label: "Data & Identity", value: "Data & Identity" },
];

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

function TagPill({ tag }: { tag: string }) {
  const colors = TAG_COLORS[tag] ?? { bg: "#f3f4f6", color: "#374151" };
  return (
    <span
      className={styles.tagPill}
      style={{ backgroundColor: colors.bg, color: colors.color }}
    >
      {tag}
    </span>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const pubDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <article className={styles.articleCard}>
      <div className={styles.articleMeta}>
        {article.tags && article.tags.length > 0 && (
          <div className={styles.articleTags}>
            {article.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
          </div>
        )}
        {pubDate && (
          <>
            <span className={styles.metaDivider}>·</span>
            <span className={styles.articleDate}>{pubDate}</span>
          </>
        )}
        <span className={styles.metaDivider}>·</span>
        <span className={styles.articleSource}>{article.source}</span>
      </div>
      <h2 className={styles.articleTitle}>
        <Link href={`/article/${article.id}`}>{article.title}</Link>
      </h2>
      {article.summary && (
        <p className={styles.articleSummary}>{article.summary}</p>
      )}
      <Link href={`/article/${article.id}`} className={styles.readLink}>
        Read →
      </Link>
    </article>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { tag?: string };
}) {
  const activeTag = searchParams.tag ?? "all";

  const supabase = createServiceClient();

  let query = supabase
    .from("articles")
    .select("*")
    .eq("status", "approved")
    .order("approved_at", { ascending: false });

  if (activeTag !== "all") {
    query = query.contains("tags", [activeTag]);
  }

  const { data } = await query;
  const articles = (data ?? []) as Article[];

  const storyLabel =
    articles.length === 1 ? "1 story" : `${articles.length} stories`;

  return (
    <>
      {/* Ticker */}
      <div className={styles.ticker} aria-hidden="true">
        <div className={styles.tickerTrack}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.tickerDot}>●</span>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <div>
              <h1 className={styles.siteTitle}>Agents, Not Ads.</h1>
              <p className={styles.tagline}>
                Agentic AI intelligence for advertising executives
              </p>
              {articles.length > 0 && (
                <p className={styles.storyCount}>
                  {storyLabel} · Updated throughout the day
                </p>
              )}
            </div>
            <div className={styles.headerActions}>
              <Link href="/about" className={styles.aboutLink}>
                About
              </Link>
              <Link href="/subscribe" className={styles.subscribeBtn}>
                Subscribe Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Tag filter nav — links drive server-side filtering via ?tag= */}
      <nav className={styles.tagNav} aria-label="Filter by topic">
        <div className={styles.tagNavInner}>
          {NAV_TAGS.map((tag) => {
            const isActive =
              tag.value === "all" ? activeTag === "all" : activeTag === tag.value;
            const href =
              tag.value === "all"
                ? "/"
                : `/?tag=${encodeURIComponent(tag.value)}`;
            return (
              <Link
                key={tag.value}
                href={href}
                className={`${styles.tagNavItem} ${isActive ? styles.tagNavItemActive : ""}`}
              >
                {tag.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Article list */}
      <main className={styles.main}>
        <div className={styles.container}>
          {articles.length === 0 ? (
            <p className={styles.emptyState}>
              {activeTag === "all"
                ? "Check back soon — new stories coming shortly."
                : `No stories tagged "${activeTag}" yet. Check back soon.`}
            </p>
          ) : (
            <div className={styles.articleList}>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Subscribe block */}
      <section className={styles.subscribeBlock} aria-label="Newsletter signup">
        <div className={styles.container}>
          <div className={styles.subscribeContent}>
            <div className={styles.subscribeCopy}>
              <h2 className={styles.subscribeTitle}>
                Stay ahead of the agentic shift.
              </h2>
              <p className={styles.subscribeDesc}>
                Curated intelligence on AI agents transforming advertising —
                delivered to your inbox. No noise, no ads.
              </p>
            </div>
            <form className={styles.subscribeForm}>
              <input
                type="email"
                placeholder="your@email.com"
                className={styles.subscribeInput}
                aria-label="Email address"
              />
              <button type="submit" className={styles.subscribeSubmitBtn}>
                Subscribe Free
              </button>
              <div className={styles.cadenceToggle}>
                <span className={styles.cadenceLabel}>Send me:</span>
                <label className={styles.cadenceOption}>
                  <input type="radio" name="cadence" value="daily" />
                  Daily
                </label>
                <label className={styles.cadenceOption}>
                  <input
                    type="radio"
                    name="cadence"
                    value="weekly"
                    defaultChecked
                  />
                  Weekly digest
                </label>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerInner}>
            <span className={styles.footerBrand}>Agents, Not Ads.</span>
            <nav className={styles.footerNav} aria-label="Footer navigation">
              <Link href="/about">About</Link>
              <Link href="/subscribe">Subscribe</Link>
              <Link href="/unsubscribe">Unsubscribe</Link>
            </nav>
          </div>
          <p className={styles.footerCopy}>
            © 2025 AgentsNotAds.com · Curated intelligence on agentic AI in
            advertising
          </p>
        </div>
      </footer>
    </>
  );
}
