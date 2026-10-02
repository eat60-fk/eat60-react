import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { isSupabaseConfigured, sb } from './lib/supabase'
import PoweredFooter from './components/PoweredFooter'
import LoadingIndicator from './components/LoadingIndicator'
import { resolveAdminAccess } from './lib/adminAccess'
import { updateRouteMetadata } from './lib/routeMetadata'
import { isNetworkError, readOfflineCache, writeOfflineCache } from './lib/offlineCache'

const Customer = lazy(() => import('./features/customer/Customer'))
const Admin = lazy(() => import('./features/admin/Admin'))
const DownloadPage = lazy(() => import('./components/DownloadPage'))
const AboutPage = lazy(() => import('./features/customer/Customer').then((module) => ({ default: module.AboutPage })))
const CareersPage = lazy(() => import('./features/customer/Customer').then((module) => ({ default: module.CareersPage })))

function Login({ adminOnly = false }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [referralCode, setReferralCode] = useState(() => new URLSearchParams(window.location.search).get('ref') || readOfflineCache('signup-referral-code') || '')
  const [msg, setMsg] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [busy, setBusy] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const signup = mode === 'signup'
  useEffect(() => { writeOfflineCache('signup-referral-code', referralCode) }, [referralCode])

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setMsg('')
    setMessageType('error')
  }

  const google = async () => {
    setBusy(true)
    setMsg('')
    setMessageType('error')
    try {
      const redirectUrl = new URL(window.location.pathname, window.location.origin)
      if (signup && referralCode.trim()) redirectUrl.searchParams.set('ref', referralCode.trim().toUpperCase())
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl.toString() } })
      if (error) setMsg(error.message)
    } catch (error) {
      setMsg(error.message || 'Unable to connect to Google sign in.')
    } finally {
      setBusy(false)
    }
  }

  const submit = async (signup) => {
    setMessageType('error')
    if (!email.trim()) return setMsg('Enter your email address to continue.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setMsg('Enter a valid email address.')
    if (!pw) return setMsg('Enter your password to continue.')
    if (signup && pw.length < 6) return setMsg('Your password must be at least 6 characters.')
    setBusy(true)
    setMsg('')
    setMessageType('error')
    try {
      if (signup) sessionStorage.setItem('eat60:account-created-pending', 'yes')
      const { data: authData, error } = signup
        ? await sb.auth.signUp({ email: email.trim(), password: pw, options: { data: { referral_code: referralCode.trim().toUpperCase() } } })
        : await sb.auth.signInWithPassword({ email: email.trim(), password: pw })
      if (error) {
        if (signup) sessionStorage.removeItem('eat60:account-created-pending')
        setMsg(error.message)
      }
      else if (signup) {
        if (!authData.session) sessionStorage.removeItem('eat60:account-created-pending')
        setMessageType('success')
        setSignupSuccess(true)
        setMsg(referralCode.trim()
          ? 'Account created. Check your email to confirm, then log in and claim your 2,500 referral coins from More → Refer.'
          : 'Account created. Check your email for a confirmation link, then log in.')
      } else setMsg('')
    } catch (error) {
      if (signup) sessionStorage.removeItem('eat60:account-created-pending')
      setMsg(error.message || 'Unable to contact the authentication service.')
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    setMessageType('error')
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMsg('Enter your email address above first.')
      return
    }
    setBusy(true)
    setMsg('')
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
      if (error) setMsg(error.message)
      else {
        setMessageType('success')
        setMsg('Password reset link sent. Check your email.')
      }
    } catch (error) {
      setMsg(error.message || 'Unable to send a password reset email.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className={`auth-shell${adminOnly ? ' admin-auth-shell' : ''}`}>
      <div className="auth-layout">
        <section className={`auth-brand${adminOnly ? ' admin-auth-brand' : ''}`}>
          <div className="auth-brand-copy">
            <div className="auth-logo">EAT<span>60</span></div>
            <p className="auth-tagline">{adminOnly ? <>ADMINISTRATOR<br className="desktop-break" /> ACCESS</> : <>BALLIA’S FIRST<br className="desktop-break" /> FOOD DELIVERY APP</>}</p>
            {!adminOnly && <div className="auth-promo"><span>🍕</span><span>Fresh favourites.<br />Right around the corner.</span></div>}
          </div>
          <PoweredFooter className={adminOnly ? 'admin-auth-footnote' : 'auth-footnote'} />
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-heading">
            <p className="auth-eyebrow">{adminOnly ? 'RESTRICTED ADMIN AREA' : 'WELCOME TO EAT60'}</p>
            <h1 id="auth-title">{adminOnly ? 'Admin sign in' : signup ? 'Create your account' : 'Good food starts here.'}</h1>
            <p className="auth-subtitle">{adminOnly ? 'Sign in with an authorized administrator account.' : signup ? 'Sign up to order your local favourites.' : 'Sign in to pick up where your cravings left off.'}</p>
          </div>

          {!adminOnly && <button className="google-button" type="button" disabled={busy} onClick={google}>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.8 6.1-14.9Z"/><path fill="#FF3D00" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5c-1.8 1.2-4 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z"/><path fill="#4CAF50" d="M12.6 27.7a12 12 0 0 1 0-7.4v-5.2H5.8a20 20 0 0 0 0 17.8l6.8-5.2Z"/><path fill="#1976D2" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.1l6.8 5.2C14.2 15.6 18.7 12 24 12Z"/></svg>
            <span>Continue with Google</span>
          </button>}

          {!adminOnly && <div className="auth-divider"><span>or continue with email</span></div>}

          <form onSubmit={(event) => { event.preventDefault(); submit(signup) }}>
            <label className="auth-label" htmlFor="auth-email">{adminOnly ? 'Administrator email' : 'Email address'}</label>
            <div className="auth-input-wrap"><span aria-hidden="true">@</span><input id="auth-email" placeholder="you@example.com" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <div className="auth-input-wrap"><span aria-hidden="true">⌑</span><input id="auth-password" placeholder={signup ? 'At least 6 characters' : 'Enter your password'} type="password" autoComplete={signup ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            {signup && <><label className="auth-label" htmlFor="auth-referral">Referral code <span className="mu">(optional)</span></label><input id="auth-referral" autoCapitalize="characters" maxLength={16} placeholder="EAT-XXXXXXXXXXXX" value={referralCode} onChange={(event) => setReferralCode(event.target.value.toUpperCase())} /></>}
            {!signup && <button className="forgot-link" type="button" disabled={busy} onClick={resetPassword}>Forgot password?</button>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : adminOnly ? 'Sign in to admin panel' : signup ? 'Create account' : 'Log in'}<span aria-hidden="true">→</span></button>
          </form>

          {msg && !signupSuccess && <p className={`auth-message ${messageType}`} role="status">{msg}</p>}
          {adminOnly ? <><p className="auth-switch admin-auth-note">Admin access is granted to approved accounts only.</p><p className="auth-switch"><a href="/download-adminapp">Install the EAT60 admin app</a></p></> : <p className="auth-switch">{signup ? 'Already have an account?' : 'Don’t have an account?'} <button type="button" onClick={() => changeMode(signup ? 'login' : 'signup')}>{signup ? 'Log in' : 'Sign up'}</button></p>}
        </section>
      </div>
      <PoweredFooter className={adminOnly ? 'admin-auth-mobile-footnote' : 'auth-mobile-footnote'} />
      {signupSuccess && <div className="fullscreen-notice is-announcement" role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
        <div className="reward-screen-rays" aria-hidden="true" />
        <div className="notice-animation-icon notice-megaphone" aria-hidden="true"><span>✦</span></div>
        <p className="notice-kicker">YOUR EAT60 JOURNEY STARTS NOW</p>
        <h1 id="signup-success-title">Welcome to EAT60!</h1>
        <p className="notice-detail">{referralCode.trim()
          ? 'Confirm your email and sign in. Your 2,500 referral coins will be ready to claim in More → Refer.'
          : 'Confirm your email to finish setting up your account. Then explore local favourites, games and rewards.'}</p>
        <div className="notice-actions"><button className="reward-claim-primary" onClick={() => { setSignupSuccess(false); changeMode('login') }}>CONTINUE TO SIGN IN</button></div>
      </div>}
    </main>
  )
}

function AdminLogin() {
  return <Login adminOnly />
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [adminRoute, setAdminRoute] = useState(window.location.pathname.replace(/\/$/, '') === '/admineat60')
  const [downloadRoute, setDownloadRoute] = useState(window.location.pathname.replace(/\/$/, '') === '/download')
  const [adminDownloadRoute, setAdminDownloadRoute] = useState(window.location.pathname.replace(/\/$/, '') === '/download-adminapp')
  const [aboutRoute, setAboutRoute] = useState(window.location.pathname.replace(/\/$/, '') === '/about')
  const [careersRoute, setCareersRoute] = useState(window.location.pathname.replace(/\/$/, '') === '/careers')
  const [adminAccess, setAdminAccess] = useState({ status: 'checking' })
  const [adminCheck, setAdminCheck] = useState(0)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installMessage, setInstallMessage] = useState('')

  useEffect(() => {
    const captureInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
      setInstallMessage('')
    }
    const markInstalled = () => {
      setInstallPrompt(null)
      setInstallMessage('EAT60 is installed on your device.')
    }
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', markInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', markInstalled)
    }
  }, [])

  const installApp = async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        const choice = await installPrompt.userChoice
        setInstallMessage(choice.outcome === 'accepted'
          ? 'EAT60 installation started.'
          : 'You can install EAT60 later from your browser menu.')
        setInstallPrompt(null)
      } catch (error) {
        setInstallMessage(error.message || 'Could not start installation. Use your browser menu to install EAT60.')
      }
      return
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setInstallMessage(isIos
      ? 'To install: tap Share in Safari, then choose “Add to Home Screen”.'
      : 'To install: open your browser menu and choose “Install app” or “Add to Home screen”.')
  }

  useEffect(() => {
    if (!sb) return
    let active = true
    const { data } = sb.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setMe(null)
      setProfileError('')
    })
    sb.auth.getSession().then(({ data: result, error }) => {
      if (!active) return
      if (error) setProfileError(error.message)
      setSession(result?.session ?? null)
    }).catch((error) => {
      if (active) {
        setProfileError(error.message || 'Could not check your sign in status.')
        setSession(null)
      }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    const syncRoute = () => {
      const pathname = window.location.pathname.replace(/\/$/, '') || '/'
      setAdminRoute(pathname === '/admineat60')
      setDownloadRoute(pathname === '/download')
      setAdminDownloadRoute(pathname === '/download-adminapp')
      setAboutRoute(pathname === '/about')
      setCareersRoute(pathname === '/careers')
      updateRouteMetadata(pathname)
    }
    window.addEventListener('popstate', syncRoute)
    updateRouteMetadata(window.location.pathname)
    const schema = document.getElementById('eat60-organization-schema')
    if (schema) {
      schema.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'EAT60',
        alternateName: 'EAT60 by Foodverse Kitchen',
        description: 'Local food ordering and delivery app serving Ballia, Uttar Pradesh, India.',
        url: window.location.origin,
        areaServed: { '@type': 'City', name: 'Ballia' }
      })
    }
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const closeDownloadPage = () => {
    window.history.pushState({}, '', '/')
    setDownloadRoute(false)
    updateRouteMetadata('/')
  }

  const closeAdminDownloadPage = () => {
    window.history.pushState({}, '', '/admineat60')
    setAdminDownloadRoute(false)
    setAdminRoute(true)
    updateRouteMetadata('/admineat60')
  }

  const closeAboutPage = () => {
    window.history.pushState({}, '', '/')
    setAboutRoute(false)
    updateRouteMetadata('/')
  }

  const closeCareersPage = () => {
    window.history.pushState({}, '', '/')
    setCareersRoute(false)
    updateRouteMetadata('/')
  }

  useEffect(() => {
    if (!adminRoute || !session) {
      setAdminAccess({ status: 'checking' })
      return
    }

    let active = true
    setAdminAccess({ status: 'checking' })
    sb.rpc('is_admin').then((result) => {
      if (active) setAdminAccess(resolveAdminAccess(result))
    }).catch((error) => {
      if (active) setAdminAccess(resolveAdminAccess({ error }))
    })
    return () => { active = false }
  }, [adminRoute, adminCheck, session])

  const loadMe = useCallback(async () => {
    if (!session) { setMe(null); return }
    setProfileError('')
    try {
      const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('PROFILE_ROW_MISSING')
      setMe(data)
      writeOfflineCache(`profile:${session.user.id}`, data)
    } catch (error) {
      const cachedProfile = readOfflineCache(`profile:${session.user.id}`)
      if (cachedProfile && isNetworkError(error)) {
        setMe(cachedProfile)
        setProfileError('')
      } else {
        setMe(null)
        setProfileError(error.message || 'Could not load your profile.')
      }
    }
  }, [session])

  useEffect(() => { if (session) loadMe() }, [loadMe, session])
  useEffect(() => {
    if (!session) return
    const retryProfileWhenOnline = () => loadMe()
    window.addEventListener('online', retryProfileWhenOnline)
    return () => window.removeEventListener('online', retryProfileWhenOnline)
  }, [loadMe, session])

  if (!isSupabaseConfigured) return <main className="app setup-page"><div className="card"><h2>App setup required</h2><p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment, then restart the app.</p></div><PoweredFooter /></main>
  if (adminDownloadRoute) return <main className="app download-route"><Suspense fallback={<p className="empty">Loading admin app details…</p>}><DownloadPage adminApp onBack={closeAdminDownloadPage} onInstall={installApp} installAvailable={Boolean(installPrompt)} installMessage={installMessage} /></Suspense></main>
  if (downloadRoute) return <main className="app download-route"><Suspense fallback={<p className="empty">Loading EAT60 app details…</p>}><DownloadPage onBack={closeDownloadPage} onInstall={installApp} installAvailable={Boolean(installPrompt)} installMessage={installMessage} /></Suspense></main>
  if (aboutRoute) return <main className="app about-route"><Suspense fallback={<p className="empty">Loading About EAT60…</p>}><AboutPage onBack={closeAboutPage} /></Suspense></main>
  if (careersRoute) return <main className="app about-route"><Suspense fallback={<p className="empty">Loading Careers…</p>}><CareersPage onBack={closeCareersPage} /></Suspense></main>
  if (session === undefined) return <main className="app setup-page"><LoadingIndicator label="Loading EAT60…" /><PoweredFooter /></main>
  if (!session) return adminRoute ? <AdminLogin /> : <Login />
  if (profileError && isNetworkError(new Error(profileError)) && !navigator.onLine) {
    return <main className="app setup-page offline-profile-wait"><LoadingIndicator label="Waiting for a network connection…" /><p>Your profile will load automatically when the connection returns.</p></main>
  }
  if (profileError) {
    const missingSchema = profileError.includes('PGRST205') || profileError.includes("Could not find the table 'public.profiles'")
    const missingProfile = profileError === 'PROFILE_ROW_MISSING' || profileError.includes('Cannot coerce the result to a single JSON object')
    return (
      <main className="app account-error">
        <section className="card">
          <p className="auth-eyebrow">ACCOUNT SETUP</p>
          <h2>{missingSchema ? 'Database setup is incomplete' : missingProfile ? 'Your account profile is missing' : 'Could not load your account'}</h2>
          {missingSchema ? (
            <>
              <p>The Supabase project connected to this app doesn’t have the <code>profiles</code> table available yet.</p>
              <ol>
                <li>Open the Supabase project configured for this app and go to <b>SQL Editor</b>.</li>
                <li>For a new project, run <code>eat60_supabase.sql</code> from the project folder once.</li>
                <li>If the table already exists, run <code>NOTIFY pgrst, 'reload schema';</code> in SQL Editor.</li>
                <li>Return here and try again.</li>
              </ol>
              <p className="mu">Don’t rerun the full setup script on a database that already has these tables.</p>
            </>
          ) : missingProfile ? (
            <>
              <p>Your login is valid, but this account doesn’t have a matching profile row yet.</p>
              <ol>
                <li>Open the Supabase project configured for this app and go to <b>SQL Editor</b>.</li>
                <li>Run <code>profile_fields.sql</code> from the project folder. It adds profile fields and repairs missing profile rows.</li>
                <li>Return here and try again.</li>
              </ol>
            </>
          ) : <p>{profileError}</p>}
          <div className="row">
            <button className="pill" onClick={loadMe}>Try again</button>
            <button className="pill g" onClick={() => sb.auth.signOut()}>Log out</button>
          </div>
        </section>
        <PoweredFooter />
      </main>
    )
  }
  if (!me) return <main className="app setup-page"><LoadingIndicator label="Loading your profile…" /><PoweredFooter /></main>

  if (adminRoute) {
    if (adminAccess.status === 'checking') return <main className="app setup-page"><LoadingIndicator label="Verifying administrator access…" /><PoweredFooter /></main>
    if (adminAccess.status === 'error') return <main className="app account-error"><section className="card"><p className="auth-eyebrow">ADMIN ACCESS CHECK</p><h1>Could not verify administrator access</h1><p>{adminAccess.message}</p><div className="row"><button className="pill" onClick={() => setAdminCheck((current) => current + 1)}>Try again</button><button className="pill g" onClick={() => sb.auth.signOut()}>Sign out</button></div></section><PoweredFooter /></main>
    if (adminAccess.status === 'denied') return <main className="app admin-denied"><section className="card"><p className="auth-eyebrow">RESTRICTED AREA</p><h1>Admin access required</h1><p>Your account does not have permission to open this page.</p><div className="row"><button className="pill" onClick={() => { window.history.replaceState({}, '', '/'); setAdminRoute(false) }}>Back to EAT60</button><button className="pill g" onClick={() => sb.auth.signOut()}>Sign out</button></div></section><PoweredFooter /></main>
    return <Suspense fallback={<main className="app setup-page"><p className="empty">Loading admin dashboard…</p><PoweredFooter /></main>}><Admin onBack={() => { window.history.replaceState({}, '', '/'); setAdminRoute(false) }} /></Suspense>
  }
  return <Suspense fallback={<main className="app setup-page"><p className="empty">Loading your storefront…</p><PoweredFooter /></main>}><Customer me={me} email={session.user.email || ''} reload={loadMe} installAvailable={Boolean(installPrompt)} installMessage={installMessage} /></Suspense>
}
