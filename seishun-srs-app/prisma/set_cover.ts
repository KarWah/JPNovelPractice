/**
 * One-off script to set a novel's cover image to an already-present file in public/assets/.
 * Usage:  npm run db:set-cover [novelId] [filename]
 * Example: npm run db:set-cover 1 bunny_combined.webp
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const novelId   = parseInt(process.argv[2] ?? "1");
const filename  = process.argv[3] ?? "bunny_combined.webp";
const coverPath = `assets/${filename}`;

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma  = new PrismaClient({ adapter });

  const updated = await prisma.novel.update({
    where: { id: novelId },
    data:  { coverImage: coverPath },
    select: { id: true, title: true, coverImage: true },
  });

  console.log(`✓ Novel ${updated.id} "${updated.title}" → ${updated.coverImage}`);
  await prisma.$disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
