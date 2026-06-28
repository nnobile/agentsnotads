export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";

const anthropic = new Anthropic();

const ALLOWED_EXTENSIONS = ["pdf", "txt", "docx"] as const;
type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function extractText(buffer: Buffer, ext: AllowedExt): Promise<string> {
  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // PDF: send to Claude as a base64 document block for extraction
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: buffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: "Extract and return all text content from this document. Return only the extracted text, no commentary.",
          },
        ],
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude");
  return block.text;
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session");
  if (!session || session.value !== "admin:ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExt)) {
    return NextResponse.json(
      { error: "Only PDF, TXT, and DOCX files are supported." },
      { status: 400 }
    );
  }

  // Read once — used for both extraction and storage upload
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name;
  const storagePath = `${Date.now()}-${filename}`;

  let content: string;
  try {
    content = await extractText(buffer, ext as AllowedExt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Text extraction failed: ${msg}` }, { status: 500 });
  }

  const supabase = createServiceClient();

  const { error: storageError } = await supabase.storage
    .from("liveramp-docs")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (storageError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 }
    );
  }

  const { error: dbError } = await supabase.from("liveramp_documents").insert({
    filename,
    storage_path: storagePath,
    content,
    active: true,
  });

  if (dbError) {
    return NextResponse.json(
      { error: `Database insert failed: ${dbError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    filename,
    contentLength: content.length,
  });
}
