import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

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
        {children}

        {/* Bottom Navigation */}
        <nav style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#111',
          borderTop: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: '70px',
          zIndex: 100
        }}>
          <Link href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#fff', textDecoration: 'none' }}>
            <span style={{ fontSize: '22px' }}>🏠</span>
            <span style={{ fontSize: '11px', color: '#666' }}>Home</span>
          </Link>
          <Link href="/plan" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#fff', textDecoration: 'none' }}>
            <span style={{ fontSize: '22px' }}>📋</span>
            <span style={{ fontSize: '11px', color: '#666' }}>Plan</span>
          </Link>
          <Link href="/log" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#fff', textDecoration: 'none' }}>
            <span style={{ fontSize: '22px' }}>💪</span>
            <span style={{ fontSize: '11px', color: '#666' }}>Log</span>
          </Link>
          <Link href="/history" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#fff', textDecoration: 'none' }}>
            <span style={{ fontSize: '22px' }}>📈</span>
            <span style={{ fontSize: '11px', color: '#666' }}>History</span>
          </Link>
        </nav>
      </body>
    </html>
  );
}