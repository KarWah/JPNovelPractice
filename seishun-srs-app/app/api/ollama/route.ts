import { NextRequest } from "next/server";

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = "gemma4:e2b";

// POST /api/ollama
// Body: { question: string, vocabContext: { kanji, kana, meaning } }
// Streams the Ollama response back to the client.
export async function POST(req: NextRequest) {
  const { question, vocabContext } = await req.json();

  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  const systemPrompt = vocabContext
      ? `You are a friendly Japanese language tutor. IMPORTANT: Always respond in English. You may include Japanese words, kanji, or example sentences, but all explanations and commentary must be written in English. 
  
  The student is studying the word: ${JSON.stringify(vocabContext)}. Answer their question specifically about this word. Keep answers concise and naturally nuanced.
  
  CRITICAL FORMATTING RULES FOR JAPANESE TEXT:
  1. ZERO ROMAJI: You are strictly forbidden from using English letters to show pronunciation (e.g., NEVER write "kiku", "nyūsu", or "sensei").
  2. BRACKET NOTATION: Every single Japanese word must use this exact furigana format: [Kanji](hiragana).
  3. OKURIGANA: Keep verb endings outside the brackets. Example: [聞](き)く.
  
  Correct formatting example:
  "Instead of [聞](き)く, you should use [聴](き)く when listening to music."`
      : `You are a friendly Japanese language tutor. IMPORTANT: Always respond in English. Keep answers concise and naturally nuanced.
  
  CRITICAL FORMATTING RULES FOR JAPANESE TEXT:
  1. ZERO ROMAJI: You are strictly forbidden from using English letters to show pronunciation.
  2. BRACKET NOTATION: Every single Japanese word must use this exact furigana format: [Kanji](hiragana).
  3. OKURIGANA: Keep verb endings outside the brackets. Example: [聞](き)く.`;
  
  const ollamaRes = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  }).catch(() => null);

  if (!ollamaRes || !ollamaRes.ok) {
    return Response.json(
      { error: "Ollama unavailable — make sure it is running locally." },
      { status: 503 }
    );
  }

  // Pass the NDJSON stream straight through to the client
  return new Response(ollamaRes.body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8" },
  });
}
