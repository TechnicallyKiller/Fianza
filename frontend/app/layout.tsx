import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk, Spectral, Space_Mono } from "next/font/google";
import "./globals.css";
import ShaderBackground from "@/components/ShaderBackground";
import { WalletProvider } from "@/components/WalletProvider";
import TLFooter from "@/components/tl/TLFooter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Distinctive display face for headlines — techy geometric grotesk that pairs
// with JetBrains Mono. Body stays Inter, data stays JetBrains Mono.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// TrustLine.dc.html type system (landing/underwrite/borrower/lender only) —
// Spectral for editorial serif headlines/verdicts, Space Mono for labels/data.
const spectral = Spectral({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrustLine — On-chain credit for AI agents",
  description:
    "TrustLine turns an AI agent's verifiable, trailing revenue into an uncollateralized credit line. Underwritten by proven income, settled in USDC over x402 on Stellar.",
  openGraph: {
    title: "TrustLine — On-chain credit for AI agents",
    description:
      "Borrowing power underwritten by verified revenue, not wallet history. Settled autonomously in USDC over x402 on Stellar.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${spectral.variable} ${spaceMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <ShaderBackground />
        <WalletProvider>{children}</WalletProvider>
        <TLFooter />
      </body>
    </html>
  );
}
