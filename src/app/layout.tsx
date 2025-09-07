import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChordSnap - Real-time Chord Recognition",
  description: "Hear it. See it. Play it. Live chord recognition from your mic or audio files—fast, clean, on your phone.",
  keywords: ["chord recognition", "music", "guitar", "piano", "audio analysis", "real-time"],
  authors: [{ name: "ChordSnap" }],
  creator: "ChordSnap",
  publisher: "ChordSnap",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://chordsnap.app",
    siteName: "ChordSnap",
    title: "ChordSnap - Real-time Chord Recognition",
    description: "Live chord recognition from your mic or audio files—fast, clean, on your phone.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChordSnap - Real-time Chord Recognition",
    description: "Live chord recognition from your mic or audio files—fast, clean, on your phone.",
  },
  manifest: "/manifest.json",
  themeColor: "#10b981",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ChordSnap" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#10b981" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-background flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}