import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session");
  if (!session || session.value !== "admin:ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; mode: string; difficulty?: string; topic?: string; messages: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, mode, difficulty, topic, messages } = body;

  if (!mode || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (id) {
    const { error } = await supabase
      .from("liveramp_sessions")
      .update({ messages, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id });
  }

  const { data, error } = await supabase
    .from("liveramp_sessions")
    .insert({ mode, difficulty: difficulty ?? null, topic: topic ?? null, messages })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
