import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PrivyProvider from "@/components/providers/PrivyProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "viDAO",
  description: "Decentralized video streaming with fair creator payouts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0f] text-white">
        <PrivyProvider>{children}</PrivyProvider>
      </body>
    </html>
  );
}
