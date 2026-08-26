import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = localFont({
  src: [
    {
      path: "../DM_Sans/DMSans-VariableFont_opsz,wght.ttf",
      style: "normal",
      weight: "100 1000",
    },
    {
      path: "../DM_Sans/DMSans-Italic-VariableFont_opsz,wght.ttf",
      style: "italic",
      weight: "100 1000",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InsureBuddy Poster Studio",
  description: "Create polished, ready-to-share POSP onboarding posters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={dmSans.variable}>{children}</body>
    </html>
  );
}
