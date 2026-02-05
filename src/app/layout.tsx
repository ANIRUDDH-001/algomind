import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AlgoMind - AI-Powered DSA Interview Practice",
  description: "Master Data Structures and Algorithms with AI-powered voice interviews, cognitive assessment, and personalized learning paths.",
  keywords: ["DSA", "interview", "practice", "AI", "coding", "algorithms", "data structures"],
  authors: [{ name: "AlgoMind Team" }],
  openGraph: {
    title: "AlgoMind - AI-Powered DSA Interview Practice",
    description: "Master DSA with AI voice interviews and cognitive assessment",
    type: "website",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ErrorBoundary>
            <Navbar />
            <main className="overflow-x-hidden">
              {children}
            </main>
            <Toaster />
          </ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
