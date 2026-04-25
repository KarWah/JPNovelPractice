import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const g = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = g.prisma ?? createClient(process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
}

// Legacy alias — remove once all callers are updated
export const adminPrisma = prisma;
