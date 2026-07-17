import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Let's Feast — Restaurant Dashboard",
  description: "Order management for restaurant staff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
