import { Resend } from "resend";
import { createServiceClient } from "./supabase/server";
import { buildSubject, buildHtml, buildText } from "./emailTemplate";
import type { Article } from "./types";

const FROM = "newsletter@agentsnotads.com";
const MAX_ARTICLES = 7;
const MIN_ARTICLES = 3;

interface SendResult {
  skipped?: string;
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendNewsletter(
  cadence: "daily" | "weekly"
): Promise<SendResult> {
  const supabase = createServiceClient();

  // Fetch unsent approved articles
  const { data: articleRows } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "approved")
    .eq("newsletter_sent", false)
    .order("approved_at", { ascending: false })
    .limit(MAX_ARTICLES);

  const articles = (articleRows ?? []) as Article[];

  if (articles.length < MIN_ARTICLES) {
    return {
      skipped: `Only ${articles.length} unsent article(s) — need at least ${MIN_ARTICLES}.`,
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  // Fetch confirmed subscribers for this cadence
  const { data: subscriberRows } = await supabase
    .from("subscribers")
    .select("id, email, confirmation_token")
    .eq("cadence", cadence)
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  const subscribers = subscriberRows ?? [];

  if (subscribers.length === 0) {
    return {
      skipped: `No confirmed ${cadence} subscribers.`,
      sent: 0,
      failed: 0,
      errors: [],
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const now = new Date();
  const subject = buildSubject(cadence, now);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const sub of subscribers) {
    const html = buildHtml(articles, cadence, now).replaceAll(
      "{{UNSUBSCRIBE_TOKEN}}",
      sub.confirmation_token
    );
    const text = buildText(articles, subject).replaceAll(
      "{{UNSUBSCRIBE_TOKEN}}",
      sub.confirmation_token
    );

    const { error } = await resend.emails.send({
      from: FROM,
      to: sub.email,
      subject,
      html,
      text,
    });

    if (error) {
      failed++;
      errors.push(`${sub.email}: ${error.message}`);
    } else {
      sent++;
    }
  }

  // Mark articles as sent
  const articleIds = articles.map((a) => a.id);
  await supabase
    .from("articles")
    .update({ newsletter_sent: true })
    .in("id", articleIds);

  // Record send in newsletter_sends
  await supabase.from("newsletter_sends").insert({
    cadence,
    subject,
    article_ids: articleIds,
    recipient_count: sent,
    sent_at: now.toISOString(),
  });

  return { sent, failed, errors };
}
