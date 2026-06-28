import Parser from "rss-parser";
import { createServiceClient } from "./supabase/server";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentsNotAds/1.0)" },
});

// Trade press RSS feeds — tag/search pages covering LiveRamp
const TRADE_PRESS_FEEDS = [
  { url: "https://adexchanger.com/tag/liveramp/feed/", source: "AdExchanger" },
  { url: "https://www.exchangewire.com/tag/liveramp/feed/", source: "ExchangeWire" },
  { url: "https://digiday.com/tag/liveramp/feed/", source: "Digiday" },
  { url: "https://martech.org/tag/liveramp/feed/", source: "Martech.org" },
];

// Keywords used to cross-reference the existing articles table
const ARTICLE_KEYWORDS = [
  "LiveRamp",
  "RampID",
  "Safe Haven",
  "Habu",
  "data collaboration",
  "clean room",
  "Authenticated Traffic",
];

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentsNotAds/1.0)" },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface LiveRampFetchResult {
  indexed: number;
  errors: string[];
}

export async function fetchLiveRamp(): Promise<LiveRampFetchResult> {
  const supabase = createServiceClient();
  const result: LiveRampFetchResult = { indexed: 0, errors: [] };

  // ── 1. Trade press RSS feeds ──────────────────────────────────────────────
  for (const feed of TRADE_PRESS_FEEDS) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`[RSS ${feed.source}] ${msg}`);
      continue;
    }

    const items = (parsed.items ?? []).slice(0, 30);

    for (const item of items) {
      const url = item.link?.trim();
      const title = item.title?.trim();
      if (!url || !title) continue;

      const { data: existing } = await supabase
        .from("liveramp_articles")
        .select("id")
        .eq("url", url)
        .maybeSingle();

      if (existing) continue;

      let content = "";
      try {
        const html = await fetchHtml(url);
        content = stripHtml(html).slice(0, 8000);
      } catch {
        content = stripHtml(item.contentSnippet ?? item.summary ?? "").slice(0, 8000);
      }

      const { error: insertError } = await supabase
        .from("liveramp_articles")
        .insert({ url, title, source: feed.source, content, tags: [] });

      if (!insertError) {
        result.indexed++;
      } else {
        result.errors.push(`[RSS insert ${feed.source}] ${url}: ${insertError.message}`);
      }
    }
  }

  // ── 2. Cross-reference approved articles table ────────────────────────────
  const orConditions = ARTICLE_KEYWORDS.flatMap((kw) => [
    `title.ilike.%${kw}%`,
    `summary.ilike.%${kw}%`,
  ]).join(",");

  const { data: relatedArticles, error: articlesError } = await supabase
    .from("articles")
    .select("url, title, source, summary, tags")
    .or(orConditions)
    .eq("status", "approved")
    .limit(50);

  if (articlesError) {
    result.errors.push(`[Cross-ref] ${articlesError.message}`);
  } else if (relatedArticles) {
    for (const article of relatedArticles) {
      const { data: existing } = await supabase
        .from("liveramp_articles")
        .select("id")
        .eq("url", article.url)
        .maybeSingle();

      if (existing) continue;

      const { error: insertError } = await supabase
        .from("liveramp_articles")
        .insert({
          url: article.url,
          title: article.title,
          source: article.source,
          content: article.summary ?? "",
          tags: article.tags ?? [],
        });

      if (!insertError) {
        result.indexed++;
      } else {
        result.errors.push(`[Cross-ref insert] ${article.url}: ${insertError.message}`);
      }
    }
  }

  return result;
}
