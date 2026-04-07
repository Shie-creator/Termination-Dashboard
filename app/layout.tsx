import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Termination Dashboard",
  description: "Public Nao Medical dashboard for offboarding and turnover analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
