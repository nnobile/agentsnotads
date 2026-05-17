import { NextRequest, NextResponse } from "next/server";
import { sendNewsletter } from "@/lib/sendNewsletter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendNewsletter("daily");
  return NextResponse.json(result);
}
