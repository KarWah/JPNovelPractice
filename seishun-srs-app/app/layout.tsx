import type { Metadata } from "next";
import { Noto_Sans_JP, Geist_Mono } from "next/font/google";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import AdminBar from "@/components/AdminBar";
import { isAdmin } from "@/lib/auth";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "青春豚野郎 SRS",
  description: "Spaced repetition vocabulary trainer for Seishun Buta Yarou",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await isAdmin();

  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 font-[var(--font-noto-jp)] ${admin ? "pt-8" : ""}`}>
        <ServiceWorkerRegistrar />
        {admin && <AdminBar />}
        {children}
      </body>
    </html>
  );
}
