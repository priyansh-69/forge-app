import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Bug #19: Validate redirect target is a safe relative path (prevent open redirect)
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  // Determine host using proxy headers if available, otherwise fallback to request origin
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const redirectBase = forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`)
    }
  }

  // Redirect to login with error parameter
  return NextResponse.redirect(`${redirectBase}/login?error=Authentication failed`)
}
