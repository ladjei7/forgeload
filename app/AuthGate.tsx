'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from './lib/supabase';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && pathname !== '/login') router.replace('/login');
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session && pathname !== '/login') router.replace('/login');
    });
    return () => sub.subscription.unsubscribe();
  }, [pathname, router]);

  if (!ready && pathname !== '/login') return null;
  return <>{children}</>;
}