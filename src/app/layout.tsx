import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "PrintNow — Your next print, sorted.",
    template: "%s · PrintNow",
  },
  description:
    "Post your print request, compare offers from local printers, and choose pickup or delivery.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
