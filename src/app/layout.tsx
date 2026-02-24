import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { Navbar } from "@/components/layout/Navbar";

import { Toaster } from "@/components/ui/toaster";
import { TourProvider } from "@/components/tour/TourContext";
import { IntroTour } from "@/components/tour/IntroTour";
import { validateDB } from "@/lib/startup/validateEnv";

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
  userScalable: true,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: {
    default: "AlgoMind - AI-Powered DSA Interview Practice",
    template: "%s | AlgoMind",
  },
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

import { QueryProvider } from "@/components/providers/QueryProvider";
import { TooltipProvider } from "@/components/ui/tooltip"; // Assuming TooltipProvider is needed based on the provided snippet

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Run critical initial database checks on the server immediately
  void validateDB();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            <ClientProviders>
              <TooltipProvider>
                <ErrorBoundary>
                  <TourProvider>
                    <Navbar />
                    {/* Main Content Area */}
                    <main className="flex-1 flex flex-col min-h-0 pt-[var(--navbar-h)] pb-0 md:pb-0">
                      {children}
                    </main>
                    <IntroTour />
                    <Toaster />
                  </TourProvider>
                </ErrorBoundary>
              </TooltipProvider>
            </ClientProviders>
          </AuthProvider>
        </QueryProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.error('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html >
  );
}
