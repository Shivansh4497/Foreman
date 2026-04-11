import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    // No code param — redirect back to home with error
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', requestUrl.origin))
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Exchange the PKCE auth code for a real session server-side
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession error:', exchangeError.message)
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', requestUrl.origin))
  }

  // Verify the user was actually authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('[auth/callback] getUser error:', userError?.message)
    return NextResponse.redirect(new URL('/?error=auth_callback_failed', requestUrl.origin))
  }

  // Check onboarding state
  const { data: config } = await supabase
    .from('user_llm_config')
    .select('user_id')
    .eq('user_id', user.id)
    .single()

  const destination = config ? '/dashboard' : '/onboarding'
  return NextResponse.redirect(new URL(destination, requestUrl.origin))
}
