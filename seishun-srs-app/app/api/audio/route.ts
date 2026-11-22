import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Ensure local audio cache directory exists
const CACHE_DIR = path.join(process.cwd(), "..", "scripts", ".cache", "audio");
try {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
} catch {
  // Ignore
}

// Reusable TTS instance
let ttsInstance: MsEdgeTTS | null = null;
let currentVoice: string = "";

async function getTTS(voice: string): Promise<MsEdgeTTS> {
  if (!ttsInstance) {
    ttsInstance = new MsEdgeTTS();
  }
  if (currentVoice !== voice) {
    await ttsInstance.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    currentVoice = voice;
  }
  return ttsInstance;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text")?.trim();
  const voice = searchParams.get("voice") || "ja-JP-NanamiNeural";

  if (!text) {
    return NextResponse.json({ error: "Missing 'text' parameter" }, { status: 400 });
  }

  // 1. Check disk cache
  const hash = crypto
    .createHash("md5")
    .update(`${voice}:${text}`)
    .digest("hex");
  const cacheFile = path.join(CACHE_DIR, `${hash}.mp3`);

  try {
    if (fs.existsSync(cacheFile)) {
      const cachedBuffer = fs.readFileSync(cacheFile);
      return new NextResponse(cachedBuffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": cachedBuffer.length.toString(),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  } catch {
    // Continue to generate
  }

  // 2. Generate neural audio using MsEdgeTTS
  try {
    const tts = await getTTS(voice);
    const { audioStream } = tts.toStream(text);

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: Error) => reject(err));
    });

    const audioBuffer = Buffer.concat(chunks);

    // Write to disk cache asynchronously
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      fs.writeFileSync(cacheFile, audioBuffer);
    } catch {
      // Ignore cache write error
    }

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    console.error("MsEdgeTTS synthesis error:", err);
    return NextResponse.json(
      { error: "Audio synthesis failed", details: err?.message },
      { status: 500 }
    );
  }
}
