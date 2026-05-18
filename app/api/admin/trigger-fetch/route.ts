import { NextRequest, NextResponse } from "next/server";
import { fetchAndScore } from "@/lib/fetchAndScore";

export const runtime = "nodejs";
export const maxDuration = 300;

function isAuthorized(request: NextRequest): boolean {
  // Admin UI: cookie-based auth
  const session = request.cookies.get("admin_session");
  if (session?.value === "admin:ok") return true;

  // Cron / external: Bearer token auth
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.warn("[trigger-fetch] CRON_SECRET env var is not set");
    return false;
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const received = authHeader.replace("Bearer ", "");
  console.log(
    `[trigger-fetch] auth check — received[:5]="${received.slice(0, 5)}" env[:5]="${cronSecret.slice(0, 5)}"`
  );
  return received === cronSecret;
}

async function run() {
  try {
    const result = await fetchAndScore();
    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      candidates: result.candidates,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[trigger-fetch] fetchAndScore threw:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// Admin UI calls POST (no Bearer token, uses admin_session cookie)
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

// Vercel cron calls GET with Authorization: Bearer <CRON_SECRET>
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}
