import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';

export const metadata: Metadata = {
  title: 'Forgeload design preview',
  robots: { index: false, follow: false },
};

// Geist is self-hosted by the `geist` package (next/font/local under the hood): no runtime network request.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className={GeistSans.variable} style={{ ['--font-geist' as string]: 'var(--font-geist-sans)' }}>{children}</div>;
}
