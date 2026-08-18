import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "GitPulse",
  description:
    "GitHub repository intelligence — AI-powered PR & issue analysis, workspace management, and developer insights.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

import { Providers } from "@/components/providers";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${spaceGrotesk.variable}`}>
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
