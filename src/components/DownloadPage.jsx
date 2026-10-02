import PoweredFooter from './PoweredFooter'

function DownloadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12m-5-5 5 5 5-5" />
    <path d="M5 17v3h14v-3" />
  </svg>
}

function CoinIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#ffbf43" stroke="#ffe08b" strokeWidth="2"/><circle cx="16" cy="16" r="9" fill="none" stroke="#d88917" strokeWidth="1.6"/><path d="M18.8 11.6c-.7-.7-1.6-1-2.8-1-1.6 0-2.6.8-2.6 2.1 0 3.2 5.4 1.4 5.4 4.8 0 1.4-1.1 2.4-2.9 2.4-1.2 0-2.2-.4-3-1.2M16 9v14" fill="none" stroke="#9a5b0c" strokeWidth="1.5" strokeLinecap="round"/></svg>
}

function PlayStoreIcon() {
  return <svg className="download-play-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#34A853" d="M7 4.8v38.4c0 .8.3 1.5.8 2l21-21L7.8 2.8A2.8 2.8 0 0 0 7 4.8Z"/>
    <path fill="#4285F4" d="m28.8 24.2 8.1-8.1L11.1 2.3c-1.2-.7-2.5-.4-3.3.5l21 21.4Z"/>
    <path fill="#FBBC04" d="m28.8 24.2-21 21c.8.9 2.1 1.2 3.3.5l25.8-13.8-8.1-7.7Z"/>
    <path fill="#EA4335" d="m43.4 21.3-6.5-3.5-8.1 8.1 8.1 7.7 6.5-3.5c2.8-1.5 2.8-7.3 0-8.8Z"/>
  </svg>
}

export default function DownloadPage({ onBack, onInstall, installAvailable, installMessage, adminApp = false }) {
  return <>
    <section className="more-subpage download-page">
      <header className="download-page-header">
        <button className="download-back" type="button" onClick={onBack} aria-label={adminApp ? 'Back to admin sign in' : 'Back to EAT60'}>←</button>
        <h1>{adminApp ? 'ADMIN APP' : 'GET THE APP'}</h1>
      </header>
      <section className="download-hero">
        <img className="download-app-icon" src="/pwa-192.svg" alt="EAT60 app logo" />
        <p className="download-eyebrow">{adminApp ? 'MANAGE EAT60 ON THE GO' : 'GOOD FOOD. JUST A TAP AWAY.'}</p>
        <h2>{adminApp ? 'EAT60 Admin app' : 'Take EAT60 with you'}</h2>
        <p className="download-description">{adminApp
          ? 'Install the admin app for quick access to orders, menu controls, and your dashboard. Sign in with an authorized admin account.'
          : 'Install the EAT60 app on your device for a quicker way to order your local favourites.'}</p>
        <button type="button" className="download-pwa-button" onClick={onInstall}>
          <DownloadIcon />
          {installAvailable ? `INSTALL EAT60${adminApp ? ' ADMIN' : ''} APP` : `ADD EAT60${adminApp ? ' ADMIN' : ''} TO HOME SCREEN`}
        </button>
        {installMessage && <p className="download-install-message" role="status">{installMessage}</p>}
      </section>
      {adminApp
        ? <section className="download-store-card admin-app-destination">
          <div className="download-coin-icon"><span aria-hidden="true">↗</span></div>
          <div className="download-store-copy"><b>Admin dashboard</b><span>Installed app opens /admineat60</span></div>
          <span className="download-coming-soon">ADMIN SIGN-IN</span>
        </section>
        : <section className="download-coin-offer">
        <div className="download-coin-icon"><CoinIcon /></div>
        <div><span>NEW MEMBER OFFER</span><h3>Get 2,500 coins</h3><p>Install EAT60 and register a new account to get 2,500 coins.</p></div>
        <strong>2,500</strong>
      </section>
      }
      {!adminApp && <section className="download-store-card" aria-label="Android app availability">
        <PlayStoreIcon />
        <div className="download-store-copy"><b>Android app</b><span>Google Play Store</span></div>
        <span className="download-coming-soon">COMING SOON</span>
      </section>}
    </section>
    <PoweredFooter />
  </>
}
