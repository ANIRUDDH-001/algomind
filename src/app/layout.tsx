import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClientProviders } from "@/components/providers/ClientProviders";
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: "AlgoMind - AI-Powered DSA Interview Practice",
  description: "Master Data Structures and Algorithms with AI-powered voice interviews, cognitive assessment, and personalized learning paths.",
  keywords: ["DSA", "interview", "practice", "AI", "coding", "algorithms", "data structures"],
  authors: [{ name: "AlgoMind Team" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AlgoMind",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "AlgoMind - AI-Powered DSA Interview Practice",
    description: "Master DSA with AI voice interviews and cognitive assessment",
    type: "website",
  },
  icons: {
    icon: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192x192.png",
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192" },
    ],
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
          <ClientProviders>
            <ErrorBoundary>
              <Navbar />
              <main className="overflow-x-hidden">
                {children}
              </main>
              <Toaster />
            </ErrorBoundary>
          </ClientProviders>
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    // SW registration failed silently
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
