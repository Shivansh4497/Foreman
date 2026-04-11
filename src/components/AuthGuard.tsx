'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Create a fresh browser client per component mount so session cookies
    // are always read from the latest state (avoids stale singleton issues).
    const supabase = createSupabaseBrowserClient();

    const checkAuthAndRoute = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        if (mounted) router.push('/signin');
        return;
      }

      // Check onboarding state from user_llm_config
      const { data: config } = await supabase
        .from('user_llm_config')
        .select('user_id')
        .eq('user_id', user.id)
        .single();

      if (!mounted) return;

      if (!config && !pathname.startsWith('/onboarding')) {
        router.push('/onboarding');
      } else if (config && pathname.startsWith('/onboarding')) {
        router.push('/dashboard');
      } else {
        setAuthorized(true);
      }
    };

    checkAuthAndRoute();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === 'SIGNED_OUT') {
          if (mounted) router.push('/signin');
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          checkAuthAndRoute();
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (!authorized) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-tertiary)' }}>
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
