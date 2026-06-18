import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Makeup Transfer Tool",
  description: "A local mock interface for AI makeup transfer workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
