import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { email?: string; cadence?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const cadence = body.cadence === "daily" ? "daily" : "weekly";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("subscribers")
    .select("id, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  const token = crypto.randomUUID();

  if (existing) {
    if (!existing.unsubscribed_at) {
      return NextResponse.json(
        { error: "This email is already subscribed." },
        { status: 409 }
      );
    }

    // Previously unsubscribed — allow re-subscribe
    const { error } = await supabase
      .from("subscribers")
      .update({
        cadence,
        confirmed: false,
        confirmation_token: token,
        unsubscribed_at: null,
        subscribed_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      return NextResponse.json(
        { error: "Failed to subscribe. Please try again." },
        { status: 500 }
      );
    }
  } else {
    const { error } = await supabase.from("subscribers").insert({
      email,
      cadence,
      confirmed: false,
      confirmation_token: token,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to subscribe. Please try again." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
