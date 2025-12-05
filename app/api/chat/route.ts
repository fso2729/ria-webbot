import OpenAI from "openai";
import { NextRequest } from "next/server";
import { RIA_SYSTEM_PROMPT, FRIENDLY_STYLE_HINT, RIA_FEWSHOT, RIA_OUTPUT_CHECKLIST } from "@/lib/riaPrompt";
export const runtime = "edge";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { history = [], userMessage = "" } = body as {
      history: { role: "user" | "assistant"; content: string }[];
      userMessage: string;
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 700,
      messages: [
        { role: "system", content: RIA_SYSTEM_PROMPT },
        { role: "system", content: FRIENDLY_STYLE_HINT },
        ...RIA_FEWSHOT,
        ...history,
        { role: "user", content: userMessage },
        { role: "system", content: RIA_OUTPUT_CHECKLIST },
      ],
    });

    const reply = completion.choices[0].message.content ?? "(応答なし)";
    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}