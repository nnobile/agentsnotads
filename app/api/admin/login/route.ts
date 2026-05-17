import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = (formData.get("password") as string) ?? "";

  const storedHash = (process.env.ADMIN_PASSWORD_HASH ?? "").trim();

  if (!storedHash) {
    return NextResponse.redirect(
      new URL("/admin/login?error=config", request.url)
    );
  }

  const submittedHash = createHash("sha256").update(password).digest("hex");
  const valid = submittedHash === storedHash;

  if (!valid) {
    return NextResponse.redirect(
      new URL("/admin/login?error=1", request.url)
    );
  }

  const response = NextResponse.redirect(
    new URL("/admin/queue", request.url)
  );
  response.cookies.set("admin_session", "admin:ok", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    sameSite: "lax",
  });
  return response;
}
