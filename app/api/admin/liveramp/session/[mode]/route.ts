import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { mode: string } }
) {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session");
  if (!session || session.value !== "admin:ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("liveramp_sessions")
    .select("*")
    .eq("mode", params.mode)
    .gte("updated_at", sevenDaysAgo)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
