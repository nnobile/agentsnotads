import { NextRequest, NextResponse } from "next/server";
import { sendNewsletter } from "@/lib/sendNewsletter";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = request.cookies.get("admin_session");
  if (!session || session.value !== "admin:ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { cadence?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const cadence = body.cadence === "daily" ? "daily" : "weekly";
  const result = await sendNewsletter(cadence);
  return NextResponse.json(result);
}
