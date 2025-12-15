import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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
        className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-gray-950 text-gray-100 min-h-screen`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
