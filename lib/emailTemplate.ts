import type { Article } from "./types";

export function buildSubject(cadence: "daily" | "weekly", date: Date): string {
  if (cadence === "daily") {
    const day = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const d = date.getDate();
    return `Agents, Not Ads — ${day}, ${month} ${d}`;
  }

  // Weekly: "May 11–17"
  const end = new Date(date);
  const start = new Date(date);
  start.setDate(date.getDate() - 6);

  const startMonth = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  const startD = start.getDate();
  const endD = end.getDate();

  const range =
    startMonth === endMonth
      ? `${startMonth} ${startD}–${endD}`
      : `${startMonth} ${startD} – ${endMonth} ${endD}`;

  return `Agents, Not Ads — Weekly Brief ${range}`;
}

export function buildHtml(
  articles: Article[],
  cadence: "daily" | "weekly",
  date: Date
): string {
  const subject = buildSubject(cadence, date);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentsnotads.com";

  const articleRows = articles
    .map((a) => {
      const tags = (a.tags ?? []).slice(0, 2).join(" · ");
      const pubDate = a.published_at
        ? new Date(a.published_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "";
      const meta = [a.source, pubDate, tags].filter(Boolean).join(" · ");

      return `
      <tr>
        <td style="padding:0 0 28px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#888888;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:6px;">
                ${meta}
              </td>
            </tr>
            <tr>
              <td style="font-family:'Instrument Serif',Georgia,serif;font-size:22px;line-height:1.3;color:#1a1a1a;padding-bottom:8px;">
                <a href="${siteUrl}/article/${a.id}" style="color:#1a1a1a;text-decoration:none;">${a.title}</a>
              </td>
            </tr>
            ${
              a.summary
                ? `<tr>
              <td style="font-family:'DM Sans',Arial,sans-serif;font-size:15px;line-height:1.6;color:#444444;padding-bottom:10px;">
                ${a.summary}
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td>
                <a href="${siteUrl}/article/${a.id}" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:600;color:#1a1a2e;text-decoration:underline;text-transform:uppercase;letter-spacing:0.08em;">Read →</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding-bottom:28px;border-bottom:1px solid #e8e8e2;font-size:0;line-height:0;">&nbsp;</td>
      </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafaf8;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf8;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Outer card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e8e8e2;">

          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'Instrument Serif',Georgia,serif;font-size:26px;color:#ffffff;font-style:italic;">
                    Agents, Not Ads.
                  </td>
                  <td align="right" style="font-family:'DM Sans',Arial,sans-serif;font-size:11px;color:#aaaaaa;text-transform:uppercase;letter-spacing:0.08em;vertical-align:middle;">
                    ${cadence === "weekly" ? "Weekly Brief" : "Daily Brief"}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tagline bar -->
          <tr>
            <td style="background-color:#f3f3ef;padding:10px 40px;font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#888888;border-bottom:1px solid #e8e8e2;">
              Agentic AI intelligence for advertising executives
            </td>
          </tr>

          <!-- Articles -->
          <tr>
            <td style="padding:32px 40px 4px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${articleRows}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:'DM Sans',Arial,sans-serif;font-size:12px;color:#aaaaaa;line-height:1.6;">
                    You're receiving this because you subscribed at
                    <a href="${siteUrl}" style="color:#aaaaaa;">${siteUrl.replace(/^https?:\/\//, "")}</a>.<br />
                    <a href="${siteUrl}/unsubscribe/{{UNSUBSCRIBE_TOKEN}}" style="color:#aaaaaa;text-decoration:underline;">Unsubscribe</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /outer card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildText(articles: Article[], subject: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agentsnotads.com";

  const lines: string[] = [
    subject,
    "Agentic AI intelligence for advertising executives",
    "─".repeat(60),
    "",
  ];

  for (const a of articles) {
    lines.push(a.title);
    if (a.source) lines.push(`Source: ${a.source}`);
    if (a.summary) lines.push(a.summary);
    lines.push(`${siteUrl}/article/${a.id}`);
    lines.push("");
    lines.push("─".repeat(60));
    lines.push("");
  }

  lines.push(`Unsubscribe: ${siteUrl}/unsubscribe/{{UNSUBSCRIBE_TOKEN}}`);
  return lines.join("\n");
}
