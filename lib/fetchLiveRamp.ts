import Parser from "rss-parser";
import { createServiceClient } from "./supabase/server";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentsNotAds/1.0)" },
});

// RSS feeds — attempted first, errors are non-fatal
const LIVERAMP_FEEDS = [
  { url: "https://liveramp.com/blog/feed/", source: "LiveRamp Blog RSS" },
  { url: "https://liveramp.com/resources/feed/", source: "LiveRamp Resources RSS" },
];

// Pages to scrape directly via fetch
const DIRECT_SCRAPE_PAGES = [
  { url: "https://liveramp.com/blog/", source: "LiveRamp Blog" },
  { url: "https://liveramp.com/blog/page/2/", source: "LiveRamp Blog" },
  { url: "https://liveramp.com/blog/page/3/", source: "LiveRamp Blog" },
  { url: "https://liveramp.com/blog/page/4/", source: "LiveRamp Blog" },
  { url: "https://liveramp.com/blog/page/5/", source: "LiveRamp Blog" },
  { url: "https://liveramp.com/resources/", source: "LiveRamp Resources" },
  { url: "https://liveramp.com/product/", source: "LiveRamp Product" },
  { url: "https://liveramp.com/data-collaboration-platform/", source: "LiveRamp Platform" },
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
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return match[1]
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
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

  // ── 1. RSS feeds ──────────────────────────────────────────────────────────
  for (const feed of LIVERAMP_FEEDS) {
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
        result.errors.push(`[RSS insert] ${url}: ${insertError.message}`);
      }
    }
  }

  // ── 2. Direct page scraping ───────────────────────────────────────────────
  for (const page of DIRECT_SCRAPE_PAGES) {
    let html: string;
    try {
      html = await fetchHtml(page.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`[Scrape ${page.url}] ${msg}`);
      continue;
    }

    const { data: existing } = await supabase
      .from("liveramp_articles")
      .select("id")
      .eq("url", page.url)
      .maybeSingle();

    if (existing) continue;

    const title = extractTitle(html) || page.source;
    const content = stripHtml(html).slice(0, 8000);

    const { error: insertError } = await supabase
      .from("liveramp_articles")
      .insert({ url: page.url, title, source: page.source, content, tags: [] });

    if (!insertError) {
      result.indexed++;
    } else {
      result.errors.push(`[Scrape insert] ${page.url}: ${insertError.message}`);
    }
  }

  // ── 3. Cross-reference approved articles table ────────────────────────────
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
