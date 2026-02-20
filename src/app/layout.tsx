import type { Metadata } from "next";
import "./globals.css";
import { logSheetNamesIfEnabled } from "@/lib/sheetsPolling";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "ZBT Midnights Tracker",
  description: "Weekly job and chore tracking for Midnights.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await logSheetNamesIfEnabled();
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
