import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
// pdf-parse is CJS-only; use require so the bundler resolver doesn't pick the ESM stub
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
import mammoth from "mammoth";

const ALLOWED_EXTENSIONS = ["pdf", "txt", "docx"] as const;

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = getExtension(file.name);

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported file type: .${ext}`);
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
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return NextResponse.json(
      { error: "Only PDF, TXT, and DOCX files are supported." },
      { status: 400 }
    );
  }

  // Extract text content
  let content: string;
  try {
    content = await extractText(file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Text extraction failed: ${msg}` }, { status: 500 });
  }

  const supabase = createServiceClient();
  const filename = file.name;
  const storagePath = `${Date.now()}-${filename}`;

  // Upload original file to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer());
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

  // Insert metadata + extracted text into liveramp_documents
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
