'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase, RECOVERY_KEY } from './lib/supabase';
import { ensureInit, startAutoSync, syncNow } from './lib/outboxSync';
import { setUnitLocal } from './lib/units';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  // Design preview is mock-data only and needs no session.
  const isPreview = pathname?.startsWith('/design-preview') ?? false;
  // Pages that work without being signed in.
  const isPublic = pathname === '/login' || pathname === '/reset-password';

  useEffect(() => {
    if (isPreview) return;
    // A password-reset link always ends on the reset page, wherever Supabase sent it.
    let recovering = false;
    try { recovering = !!sessionStorage.getItem(RECOVERY_KEY); } catch { /* storage blocked */ }
    if (recovering && pathname !== '/reset-password') { router.replace('/reset-password'); return; }
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && !isPublic) router.replace('/login');
      else {
        setReady(true);
        // Durable saving: send any sets stored on this device from an earlier visit, and keep retrying.
        if (data.session) {
          void ensureInit().then(() => { startAutoSync(); void syncNow(); });
          // The weight unit follows the account, so every device shows the same.
          supabase.from('user_training_prefs').select('*').maybeSingle().then(({ data: p }) => { if (p?.unit === 'kg' || p?.unit === 'lb') setUnitLocal(p.unit); }, () => {});
        }
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && pathname !== '/reset-password') { router.replace('/reset-password'); return; }
      if (!session && !isPublic) router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router, isPreview, isPublic]);

  if (isPreview) return <>{children}</>;
  if (!ready && !isPublic) return null;
  return <>{children}</>;
}