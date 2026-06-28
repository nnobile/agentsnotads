import Parser from "rss-parser";
import { createServiceClient } from "./supabase/server";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "AgentsNotAds RSS Reader/1.0" },
});

const LIVERAMP_FEEDS = [
  { url: "https://liveramp.com/blog/feed/", source: "LiveRamp Blog" },
  { url: "https://liveramp.com/resources/feed/", source: "LiveRamp Resources" },
];

const ARTICLE_KEYWORDS = [
  "LiveRamp",
  "RampID",
  "Safe Haven",
  "Habu",
  "data collaboration",
  "clean room",
  "Authenticated Traffic",
];

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

async function fetchPageContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "AgentsNotAds RSS Reader/1.0" },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return stripHtml(html).slice(0, 8000);
}

export interface LiveRampFetchResult {
  indexed: number;
  errors: string[];
}

export async function fetchLiveRamp(): Promise<LiveRampFetchResult> {
  const supabase = createServiceClient();
  const result: LiveRampFetchResult = { indexed: 0, errors: [] };

  // 1. RSS feeds
  for (const feed of LIVERAMP_FEEDS) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      result.errors.push(
        `${feed.source} RSS: ${err instanceof Error ? err.message : String(err)}`
      );
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
        content = await fetchPageContent(url);
      } catch {
        content = stripHtml(item.contentSnippet ?? item.summary ?? "").slice(0, 8000);
      }

      const { error: insertError } = await supabase
        .from("liveramp_articles")
        .insert({ url, title, source: feed.source, content, tags: [] });

      if (!insertError) {
        result.indexed++;
      } else {
        result.errors.push(`Insert ${url}: ${insertError.message}`);
      }
    }
  }

  // 2. Cross-reference approved articles table for LiveRamp-relevant content
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
    result.errors.push(`articles cross-ref: ${articlesError.message}`);
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
        result.errors.push(`Insert cross-ref ${article.url}: ${insertError.message}`);
      }
    }
  }

  return result;
}
