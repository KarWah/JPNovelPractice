import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function createClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

const g = globalThis as unknown as {
  adminPrisma: PrismaClient | undefined;
  demoPrisma: PrismaClient | undefined;
};

export const adminPrisma =
  g.adminPrisma ?? createClient(process.env.DATABASE_URL!);

export const demoPrisma =
  g.demoPrisma ??
  createClient(process.env.DEMO_DATABASE_URL ?? process.env.DATABASE_URL!);

if (process.env.NODE_ENV !== "production") {
  g.adminPrisma = adminPrisma;
  g.demoPrisma = demoPrisma;
}

// Default export kept for write-only paths that are always admin
export const prisma = adminPrisma;
