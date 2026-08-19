import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project Vault",
  description:
    "One protected final version of your group project. Everyone works on their own copy, and nothing changes until a teammate agrees.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions (Grammarly, password managers) add their own
          attributes to <body> before React hydrates, which React then
          reports as a server/client mismatch. It's their markup, not
          ours, and nothing we render can prevent it — so the warning is
          suppressed on this element only. Mismatches anywhere else in
          the app are still reported normally. */}
      <body
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-bg text-text"
      >
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
