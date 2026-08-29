import type { Metadata } from "next";
import { Noto_Sans_JP, Geist_Mono } from "next/font/google";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import AdminBar from "@/components/AdminBar";
import GuestBar from "@/components/GuestBar";
import { getUser } from "@/lib/auth";
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
  const user = await getUser();

  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className={`min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 font-[var(--font-noto-jp)] pt-8`}>
        <ServiceWorkerRegistrar />
        {user ? <AdminBar email={user.email} isAdmin={user.role === "ADMIN"} /> : <GuestBar />}
        {children}
      </body>
    </html>
  );
}
