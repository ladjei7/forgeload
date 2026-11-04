'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';
import { ensureInit, startAutoSync, syncNow } from './lib/outboxSync';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // Design preview is mock-data only and needs no session.
  const isPreview = pathname?.startsWith('/design-preview') ?? false;

  useEffect(() => {
    if (isPreview) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && pathname !== '/login') router.replace('/login');
      else {
        setReady(true);
        // Durable saving: send any sets stored on this device from an earlier visit, and keep retrying.
        if (data.session) void ensureInit().then(() => { startAutoSync(); void syncNow(); });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session && pathname !== '/login') router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router, isPreview]);

  if (isPreview) return <>{children}</>;
  if (!ready && pathname !== '/login') return null;
  return <>{children}</>;
}