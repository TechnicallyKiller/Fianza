import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ShaderBackground from "@/components/ShaderBackground";
import { WalletProvider } from "@/components/WalletProvider";

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
      className={`dark ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <ShaderBackground />
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
