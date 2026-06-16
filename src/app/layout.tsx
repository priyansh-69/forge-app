import type { Metadata, Viewport } from "next";
import "./globals.css";
import { APP } from "@/lib/constants";
import { AuthProvider } from "@/components/layout/AuthProvider";
import { Toaster } from "sonner";

// ============================================================
// Root Layout — Wraps the entire application
// ============================================================


export const metadata: Metadata = {
  title: APP.NAME,
  description: APP.DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP.NAME,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0d10",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster theme="dark" position="top-center" closeButton richColors toastOptions={{ style: { background: "rgba(20, 24, 32, 0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid var(--border-default)" } }} />
      </body>
    </html>
  );
}

