import Parser from "rss-parser";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "./supabase/server";

const parser = new Parser({
  timeout: 10000,
  headers: { "User-Agent": "AgentsNotAds RSS Reader/1.0" },
});

const anthropic = new Anthropic();

const SCORE_PROMPT = `You are a content curator for agentsnotads.com, a publication for
advertising and ad tech executives tracking agentic AI use cases
across the full advertising ecosystem.

Given this article, return ONLY a valid JSON object with no other text:
{
  "relevant": true or false,
  "relevance_score": 0.0 to 1.0,
  "summary": "2-3 sentence plain-English summary for busy executives",
  "tags": ["tag1", "tag2"]
}

Tags must only come from this list: DSP, SSP, Programmatic, Martech,
Publishing, Agency, Agentic AI, LLM, Data & Identity, Creative AI,
Measurement, CTV & Streaming, Retail Media, Out-of-Home,
Search & Social, Brand Strategy

Only mark relevant:true if the article directly relates to agentic AI
being applied to advertising buying, selling, targeting, optimization,
creative, or measurement — including TV/streaming/CTV, retail media,
out-of-home, search, social, brand strategy, and agency operations.
Do NOT mark relevant for general AI news or general advertising news
that does not involve agentic AI specifically.`;

interface ScoreResult {
  relevant: boolean;
  relevance_score: number;
  summary: string;
  tags: string[];
}

export interface FetchResult {
  fetched: number;
  candidates: number;
  errors: Array<{ source: string; error: string }>;
}

function extractJSON(text: string): string {
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlock) return codeBlock[1];
  const jsonObject = text.match(/\{[\s\S]*\}/);
  if (jsonObject) return jsonObject[0];
  return text;
}

async function scoreArticle(
  title: string,
  description: string
): Promise<ScoreResult | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `${SCORE_PROMPT}\n\nArticle title: ${title}\nArticle description: ${description}`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== "text") return null;

    return JSON.parse(extractJSON(block.text)) as ScoreResult;
  } catch {
    return null;
  }
}

export async function fetchAndScore(): Promise<FetchResult> {
  const supabase = createServiceClient();
  const result: FetchResult = { fetched: 0, candidates: 0, errors: [] };

  const { data: sources, error: sourcesError } = await supabase
    .from("rss_sources")
    .select("id, name, url")
    .eq("active", true);

  if (sourcesError || !sources) {
    throw new Error(`Failed to load RSS sources: ${sourcesError?.message}`);
  }

  for (const source of sources) {
    try {
      let feed;
      try {
        feed = await parser.parseURL(source.url);
      } catch (feedErr) {
        const msg =
          feedErr instanceof Error ? feedErr.message : String(feedErr);
        result.errors.push({ source: source.name, error: msg });
        continue;
      }

      const items = (feed.items ?? []).slice(0, 20);

      for (const item of items) {
        const url = item.link?.trim();
        const title = item.title?.trim();
        if (!url || !title) continue;

        const { data: existing } = await supabase
          .from("articles")
          .select("id")
          .eq("url", url)
          .maybeSingle();

        if (existing) continue;

        result.fetched++;

        const description = (
          item.contentSnippet ??
          item.summary ??
          ""
        ).slice(0, 1000);

        const score = await scoreArticle(title, description);
        if (!score || !score.relevant || score.relevance_score < 0.6) continue;

        const publishedAt =
          item.isoDate ??
          (item.pubDate ? new Date(item.pubDate).toISOString() : null);

        const { error: insertError } = await supabase.from("articles").insert({
          url,
          title,
          source: source.name,
          published_at: publishedAt,
          summary: score.summary,
          tags: score.tags,
          relevance_score: score.relevance_score,
          status: "candidate",
        });

        if (!insertError) {
          result.candidates++;
        } else {
          console.error(`Insert failed for ${url}:`, insertError.message);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push({ source: source.name, error: msg });
    }
  }

  return result;
}
