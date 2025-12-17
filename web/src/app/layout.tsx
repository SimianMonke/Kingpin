import type { Metadata } from "next";
import { Orbitron, Space_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Kingpin | Stream RPG Economy Game",
  description: "A persistent RPG economy game embedded in your streaming chat. Compete, rob, collect, and become the ultimate Kingpin.",
  keywords: ["streaming", "chat game", "RPG", "economy", "Kick", "Twitch", "Discord"],
  authors: [{ name: "SimianMonke" }],
  openGraph: {
    title: "Kingpin | Stream RPG Economy Game",
    description: "A persistent RPG economy game embedded in your streaming chat.",
    url: "https://kingpin.simianmonke.com",
    siteName: "Kingpin",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${orbitron.variable} ${spaceMono.variable} antialiased min-h-screen`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
