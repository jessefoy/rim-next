import type { Metadata, Viewport } from "next";
import Nav from "@/components/Nav";
import FooterWrapper from "@/components/FooterWrapper";
import SessionProvider from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Rooted In Mindfulness",
  description: "Community Insight Meditation Center — Brookfield, WI",
};

/** Viewport — required so mobile browsers render at the device's actual
    width instead of the ~980px "desktop" default. Without this, every
    media query in custom.css is silently ignored on phones. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/custom.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300..800;1,300..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SessionProvider>
          <Nav />
          <main>{children}</main>
          <FooterWrapper />
        </SessionProvider>
      </body>
    </html>
  );
}
