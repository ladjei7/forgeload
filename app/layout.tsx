import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "./BottomNav";
import AuthGate from "./AuthGate";

export const metadata: Metadata = {
  title: "Forgeload",
  description: "Plan. Log. Overload. Built for serious lifters.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#000', color: '#fff', fontFamily: 'sans-serif', paddingBottom: '80px' }}>
        <AuthGate>{children}</AuthGate>

        <BottomNav />
      </body>
    </html>
  );
}