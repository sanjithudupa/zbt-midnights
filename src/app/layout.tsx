import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZBT Midnights Tracker",
  description: "Weekly job and chore tracking for Midnights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
