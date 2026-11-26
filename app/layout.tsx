import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "./BottomNav";
import AuthGate from "./AuthGate";

export const metadata: Metadata = {
  title: "Forgeload",
  description: "Plan. Log. Overload. Built for serious lifters.",
  appleWebApp: { capable: true, title: "Forgeload", statusBarStyle: "black-translucent" },
};

// viewportFit 'cover' + the black-translucent status bar: iPhone draws the page under the status bar,
// so the body reserves env(safe-area-inset-top) and a solid strip covers it while scrolling.
export const viewport: Viewport = { themeColor: "#101419", viewportFit: "cover" };

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
      <body style={{ margin: 0, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(92px + env(safe-area-inset-bottom))', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[120] bg-fl-bg" style={{ height: 'env(safe-area-inset-top)' }} />
        <AuthGate>{children}</AuthGate>

        <BottomNav />
      </body>
    </html>
  );
}