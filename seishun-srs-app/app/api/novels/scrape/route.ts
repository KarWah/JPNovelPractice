import { NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { Role } from "@prisma/client";
import { spawn } from "child_process";
import { readFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { prisma } from "@/lib/prisma";
import { blacklistCrossNovel } from "@/lib/services/blacklist";

const SCRAPE_SCRIPT = resolve(process.cwd(), "..", "Scrape.py");

// POST /api/novels/scrape
// Body: { url: string, title: string, slug: string, autoBlacklist?: boolean }
// Responds with text/event-stream (SSE). Each event is a JSON object:
//   {"type":"progress","scraped":N,"offset":X}
//   {"type":"complete","novelId":N}
//   {"type":"error","message":"..."}
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (user?.role !== Role.ADMIN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { url, title, slug, autoBlacklist = true } = body as {
    url: string;
    title: string;
    slug: string;
    autoBlacklist?: boolean;
  };

  if (!url || !title || !slug) {
    return Response.json({ error: "url, title, and slug are required" }, { status: 400 });
  }
  if (!url.startsWith("https://jpdb.io/")) {
    return Response.json({ error: "URL must be a jpdb.io URL" }, { status: 400 });
  }

  // Check for slug conflict before starting the scrape — returns a plain JSON error
  // so the client can display it on the form without entering the loading state.
  const existing = await prisma.novel.findUnique({ where: { slug }, select: { id: true, title: true } });
  if (existing) {
    return Response.json(
      { error: `A novel with this title already exists (slug "${slug}" is taken). Please use a different title.` },
      { status: 409 }
    );
  }

  const tmpOutput = join(tmpdir(), `jpdb_${slug}_${Date.now()}.json`);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (obj: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const child = spawn("python", [SCRAPE_SCRIPT, "--url", url, "--output", tmpOutput], {
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      let errorBuf = "";

      child.stdout.setEncoding("utf-8");
      child.stdout.on("data", (chunk: string) => {
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed);
            if (msg.type === "error") {
              send({ type: "error", message: msg.message });
              child.kill();
            } else if (msg.type === "progress" || msg.type === "done") {
              send(msg);
            }
          } catch {
            // non-JSON debug line from Python — ignore
          }
        }
      });

      child.stderr.setEncoding("utf-8");
      child.stderr.on("data", (d: string) => { errorBuf += d; });

      child.on("close", async (code) => {
        if (code !== 0) {
          send({ type: "error", message: errorBuf || `Process exited with code ${code}` });
          controller.close();
          return;
        }

        try {
          // Read scraped data and import into DB
          const raw = readFileSync(tmpOutput, "utf-8");
          const vocabList: { spelling: string; meaning: string; occurrences: number }[] =
            JSON.parse(raw);

          // Create the novel (auto-increment sort order)
          const maxOrder = await prisma.novel.aggregate({ _max: { sortOrder: true } });
          const novel = await prisma.novel.create({
            data: {
              slug,
              title,
              sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
            },
          });

          // Transform and bulk-insert vocab
          const vocabData = vocabList.map((entry) => {
            const parts = entry.spelling.trim().split(" ");
            const kanji = parts.length > 1 ? parts[0] : null;
            const kana  = parts.length > 1 ? parts[1] : parts[0];
            return { kanji, kana, meaning: entry.meaning, occurrences: entry.occurrences, novelId: novel.id };
          });

          await prisma.vocabEntry.createMany({ data: vocabData, skipDuplicates: true });

          if (autoBlacklist) {
            await blacklistCrossNovel(novel.id, user.id);
          }

          send({ type: "complete", novelId: novel.id });
        } catch (err) {
          send({ type: "error", message: String(err) });
        } finally {
          if (existsSync(tmpOutput)) unlinkSync(tmpOutput);
          controller.close();
        }
      });

      child.on("error", (err) => {
        send({ type: "error", message: `Failed to start Python: ${err.message}` });
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
