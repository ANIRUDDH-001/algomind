/**
 * @codesage
 * @file      src/app/layout.tsx
 * @purpose   Root layout wrapping application with providers and global UI
 * @tech      Next.js, React, Tailwind CSS
 * @connects  Providers, Navbar, ErrorBoundary
 * @apis      None
 * @db        None
 * @state     Global context via providers
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import '@/lib/env';
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { Navbar } from "@/components/layout/Navbar";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";

import { Toaster } from "@/components/ui/toaster";
import { TourProvider } from "@/components/tour/TourProvider";
import { TourOverlay } from "@/components/tour/TourOverlay";

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
  maximumScale: 5,
  userScalable: true,
  themeColor: '#6366f1',
};

export const metadata: Metadata = {
  title: {
    default: "AlgoMind",
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
    title: "AlgoMind",
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

import { headers } from 'next/headers';

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  const hdrs = await headers();
  const hideNavbar = hdrs.get('x-hide-navbar') === 'true';

  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-full`}
      >
        <QueryProvider>
          <AuthProvider>
            <ClientProviders>
              <TooltipProvider>
                <ErrorBoundary>
                  <TourProvider>
                    <ServiceWorkerRegistration />
                    {!hideNavbar && <Navbar />}
                    {/* Main Content Area */}
                    <main className={`flex-1 flex flex-col overflow-x-hidden overflow-y-auto scroll-container scrollbar-thin scrollbar-track-transparent scrollbar-thumb-indigo-500/20 pb-0 md:pb-0 ${hideNavbar ? 'pt-0' : 'pt-[var(--navbar-h,64px)]'}`}>
                      {children}
                    </main>
                    <TourOverlay />
                    <Toaster />
                  </TourProvider>
                </ErrorBoundary>
              </TooltipProvider>
            </ClientProviders>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html >
  );
}
