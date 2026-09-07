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
  title: "Dynamic Poster Studio",
  description: "Generate personalized poster batches from your templates and contact CSV entirely in the browser.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={dmSans.variable}>{children}</body>
    </html>
  );
}
