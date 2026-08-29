import { NextRequest } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "qwen/qwen3.6-27b";

// POST /api/chat
// Body: { question: string, vocabContext?: { word, reading, meaning } }
// Streams NDJSON lines: { message: { content: "token" } }
export async function POST(req: NextRequest) {
  const { question, vocabContext } = await req.json();

  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ error: "AI tutor is not configured." }, { status: 503 });
  }

  const systemPrompt = vocabContext
    ? `You are a friendly Japanese language tutor. IMPORTANT: Always respond in English. You may include Japanese words, kanji, or example sentences, but all explanations and commentary must be written in English.

The student is studying the word: ${JSON.stringify(vocabContext)}. Answer their question specifically about this word. Keep answers concise and naturally nuanced.

CRITICAL FORMATTING RULES FOR JAPANESE TEXT:
1. ZERO ROMAJI: You are strictly forbidden from using English letters to show pronunciation (e.g., NEVER write "kiku", "nyūsu", or "sensei").
2. BRACKET NOTATION: Every single Japanese word — including single-kanji words — must use this exact format: [Kanji](hiragana). This applies EVERY time a kanji appears, no exceptions.
3. NEVER write a kanji and its reading as plain text side by side (e.g., NEVER "声 こえ" or "声(こえ)"). The ONLY valid form is [声](こえ).
4. OKURIGANA: Keep verb endings outside the brackets. Example: [聞](き)く not [聞く](きく).

BAD (forbidden): "The word 声 こえ means voice."
GOOD (required): "The word [声](こえ) means voice."`
    : `You are a friendly Japanese language tutor. IMPORTANT: Always respond in English. Keep answers concise and naturally nuanced.

CRITICAL FORMATTING RULES FOR JAPANESE TEXT:
1. ZERO ROMAJI: You are strictly forbidden from using English letters to show pronunciation.
2. BRACKET NOTATION: Every single Japanese word — including single-kanji words — must use this exact format: [Kanji](hiragana). This applies EVERY time a kanji appears, no exceptions.
3. NEVER write a kanji and its reading as plain text side by side (e.g., NEVER "声 こえ" or "声(こえ)"). The ONLY valid form is [声](こえ).
4. OKURIGANA: Keep verb endings outside the brackets. Example: [聞](き)く not [聞く](きく).`;

  const stream = await groq.chat.completions.create({
    model: MODEL,
    reasoning_effort: "none",
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
  });

  // Transform Groq SSE chunks into the same NDJSON format the client already expects
  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? "";
        if (token) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ message: { content: token } }) + "\n")
          );
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}
