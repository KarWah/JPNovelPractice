import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

function createClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL || "";
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: url,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const g = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = g.prisma ?? createClient(process.env.DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
}

// Legacy alias — remove once all callers are updated
export const adminPrisma = prisma;
