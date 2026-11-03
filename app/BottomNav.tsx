'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const TABS = [
  { href: '/', label: 'Home', d: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
  { href: '/plan', label: 'Plan', d: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { href: '/log', label: 'Log', d: 'M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11' },
  { href: '/history', label: 'History', d: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/start' || pathname?.startsWith('/design-preview')) return null;
  const on = (h: string) => (h === '/' ? pathname === '/' : pathname?.startsWith(h));
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-[100] mx-3 mb-[calc(10px+env(safe-area-inset-bottom))] flex h-16 items-center justify-around rounded-[20px] border border-fl-line bg-fl-s1 p-1.5">
      {TABS.map(t => (
        <Link key={t.href} href={t.href} aria-current={on(t.href) ? 'page' : undefined}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[14px] text-[11px] no-underline ${on(t.href) ? 'font-bold text-fl-tx' : 'text-fl-tx2'}`}>
          <span className={`flex h-[26px] w-11 items-center justify-center rounded-[13px] ${t.href === '/log' ? 'bg-fl-acc text-fl-on-acc' : on(t.href) ? 'bg-fl-s2' : ''}`}><Icon d={t.d} /></span>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
