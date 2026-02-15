import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CryptoKnight",
  description: "Smart account session key management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full w-full">
      <body className={`${inter.className} h-full w-full`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
