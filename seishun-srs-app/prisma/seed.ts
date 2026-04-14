import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Reading vocabulary data...');
  const filePath = path.join(process.cwd(), '..', 'seishun_buta_vocab.json');
  
  // Read and parse the JSON
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const vocabList = JSON.parse(rawData);

  console.log(`Found ${vocabList.length} words to import. Processing...`);

  // Transform the data to match our schema
  const processedData = vocabList.map((entry: any) => {
    // Split the spelling string by space
    const parts = entry.spelling.trim().split(' ');
    let kanji = null;
    let kana = '';

    if (parts.length > 1) {
      // Has both kanji and kana (e.g., "青春 せいしゅん")
      kanji = parts[0];
      kana = parts[1];
    } else {
      // Kana only (e.g., "やっぱり" or "ね")
      kana = parts[0];
    }

    return {
      kanji,
      kana,
      meaning: entry.meaning,
      occurrences: entry.occurrences,
      novelId: 1,
    };
  });

  // Bulk insert into the database
  console.log('Injecting into PostgreSQL...');
  const result = await prisma.vocabEntry.createMany({
    data: processedData,
    skipDuplicates: true, // Prevents crashing if you run this twice
  });

  console.log(`Success! ${result.count} vocabulary words seeded into the database.`);
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });