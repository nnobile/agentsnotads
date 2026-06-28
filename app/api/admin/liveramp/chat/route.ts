import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic();

type Mode = "product" | "competitive" | "scenario";
type Difficulty = "Beginner" | "Intermediate" | "Expert";

interface ChatRequest {
  mode: Mode;
  difficulty?: Difficulty;
  topic?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  sessionContext?: string;
}

function buildSystemPrompt(
  mode: Mode,
  difficulty: Difficulty,
  topic: string,
  knowledgeBase: string
): string {
  const kbBlock = knowledgeBase
    ? `\n\n---\nKNOWLEDGE BASE (recent LiveRamp content — cite this when relevant):\n${knowledgeBase}\n---`
    : "";

  if (mode === "product") {
    return `You are a LiveRamp product expert running a training quiz for a new BD Lead joining LiveRamp's Ecosystems & AI team.

Your knowledge base includes publicly available LiveRamp documentation, blog posts, case studies, and trade press coverage from AdExchanger, Digiday, and ExchangeWire.

Mode: Product Knowledge Quiz — ${difficulty} difficulty, topic focus: ${topic || "all topics"}

Rules:
- Begin immediately with your first question. Do not introduce yourself or explain the rules.
- Ask one question at a time.
- After the user answers, evaluate correctness, explain the right answer with specifics, and cite whether it came from LiveRamp's own content or trade press.
- Give a score (correct/incorrect) and move to the next question.
- Track weak areas and mention them in your evaluation.
- Questions should be specific and practical, not generic.
- At question 10, output a session summary with score and weak areas wrapped in <session_summary> tags.${kbBlock}`;
  }

  if (mode === "competitive") {
    return `You are a strategic advisor helping a LiveRamp BD Lead prepare for competitive conversations.

Cover: LiveRamp vs Snowflake Data Clean Room, vs Google PAIR, vs Amazon Marketing Cloud, vs Epsilon CORE ID. Also cover the Gravity Theory of Data Trade framework, the Publicis/Epsilon acquisition rationale, and LiveRamp's valuation positioning.

Draw from public sources — cite trade press vs LiveRamp owned content.

Begin immediately with your first competitive question. Do not introduce yourself.
Ask one question at a time, evaluate answers, explain correct positioning, move to next question.
At question 10, output <session_summary> with score and weak areas.${kbBlock}`;
  }

  return `You are a senior LiveRamp BD mentor running realistic scenario practice for a new BD Lead on the Ecosystems & AI team.

Begin immediately with your first scenario. Do not introduce yourself or explain the format.

Present one scenario at a time from this list (randomize order):
- A DSP partner asks why they should integrate with LiveRamp instead of building their own identity layer
- A publisher asks about the difference between Maintained vs Derived RampID and what it means for their international expansion
- An internal product team pushes back on a partner's custom integration request
- A clean room prospect asks how Safe Haven differs from Snowflake's native clean room
- A large agency holding company asks about the Publicis deal and whether LiveRamp will still serve other agencies fairly
- A data partner asks how LiveRamp's Data Marketplace commission structure works
- A prospect asks how LiveRamp handles consent and data residency requirements in the EU

After the user responds, coach them: what was strong, what was missing, what a senior BD person would have said differently. Be specific and cite real LiveRamp positioning where relevant.

After 5 scenarios, output <session_summary> with performance notes.${kbBlock}`;
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session");
  if (!session || session.value !== "admin:ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { mode, difficulty = "Intermediate", topic = "", messages } = body;

  if (!mode || !messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Fetch knowledge base context — documents first, then articles
  const supabase = createServiceClient();

  const [{ data: documents }, { data: articles }] = await Promise.all([
    supabase
      .from("liveramp_documents")
      .select("filename, content")
      .eq("active", true)
      .order("uploaded_at", { ascending: false })
      .limit(5),
    supabase
      .from("liveramp_articles")
      .select("title, source, content")
      .order("indexed_at", { ascending: false })
      .limit(20),
  ]);

  let knowledgeBase = "";

  if (documents && documents.length > 0) {
    knowledgeBase += documents
      .map(
        (d) =>
          `--- UPLOADED DOCUMENT: ${d.filename} ---\n${(d.content ?? "").slice(0, 1000)}`
      )
      .join("\n\n");
  }

  if (articles && articles.length > 0) {
    if (knowledgeBase) knowledgeBase += "\n\n";
    knowledgeBase += articles
      .map((a) => `[${a.source}] ${a.title}\n${(a.content ?? "").slice(0, 500)}`)
      .join("\n\n");
  }

  const systemPrompt = buildSystemPrompt(mode, difficulty, topic, knowledgeBase);

  let stream;
  try {
    stream = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages,
      stream: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
