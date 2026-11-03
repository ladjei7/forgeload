import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "./BottomNav";
import AuthGate from "./AuthGate";

export const metadata: Metadata = {
  title: "Forgeload",
  description: "Plan. Log. Overload. Built for serious lifters.",
  appleWebApp: { capable: true, title: "Forgeload", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#101419" };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('fl-theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}" }} />
      </head>
      <body style={{ margin: 0, paddingBottom: 'calc(92px + env(safe-area-inset-bottom))' }}>
        <AuthGate>{children}</AuthGate>

        <BottomNav />
      </body>
    </html>
  );
}