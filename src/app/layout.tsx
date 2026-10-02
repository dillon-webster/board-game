import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mystery Auction · The Auction House",
  description: "A local, four-player auction board game prototype. A little evidence. A lot of speculation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
