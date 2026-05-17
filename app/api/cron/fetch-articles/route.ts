import { NextRequest, NextResponse } from "next/server";
import { fetchAndScore } from "@/lib/fetchAndScore";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await fetchAndScore();
    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      candidates: result.candidates,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
