import { buildInsights, buildClaudePrompt, type InsightInput } from "@/lib/vm-analytics/insights";
import type { Insight } from "@/lib/vm-analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  let input: InsightInput;
  try {
    const body = await req.json();
    input = body.input as InsightInput;
    if (!input || !input.dashboard) throw new Error("missing input.dashboard");
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(buildInsights(input) satisfies Insight);
  }

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

    const msg = await client.messages.create({
      model,
      max_tokens: 700,
      messages: [{ role: "user", content: buildClaudePrompt(input) }],
    });

    const text = msg.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const json = extractJson(text);
    if (
      json &&
      typeof json.summary === "string" &&
      Array.isArray(json.bullets)
    ) {
      return Response.json({
        source: "claude",
        summary: json.summary,
        bullets: json.bullets.map(String),
      } satisfies Insight);
    }
    return Response.json(buildInsights(input) satisfies Insight);
  } catch (err) {
    console.error("[insights] Claude call failed, using rules:", err);
    return Response.json(buildInsights(input) satisfies Insight);
  }
}

function extractJson(text: string): { summary?: unknown; bullets?: unknown } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
