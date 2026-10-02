const metadata = {
  '/': ['EAT60 | Food delivery in Ballia', 'Order local favourites with EAT60, Ballia’s food ordering and delivery app.'],
  '/download': ['Download the EAT60 App', 'Install EAT60 on your device and order local food in Ballia. Android app coming soon.'],
  '/download-adminapp': ['Download the EAT60 Admin App', 'Install the EAT60 admin app for quick access to orders and dashboard controls.'],
  '/admineat60': ['EAT60 Admin Sign In', 'Sign in to the EAT60 administrator dashboard.'],
  '/wallet': ['My Wallet | EAT60', 'View your EAT60 coins and rewards wallet.'],
  '/order-history': ['Order History | EAT60', 'View your EAT60 orders, delivery progress, ratings, and reviews.'],
  '/cart': ['Your Cart | EAT60', 'Review your EAT60 cart and delivery details.'],
  '/order': ['Order Food in Ballia | EAT60', 'Browse local food and place an order with EAT60.'],
  '/announcements': ['Announcements | EAT60', 'See updates and announcements from EAT60.'],
  '/games': ['Games | EAT60', 'Play EAT60 games and earn points, coins, and rewards.'],
  '/leaderboard': ['Weekly Leaderboard | EAT60', 'View your EAT60 weekly game rankings.'],
  '/game-scores': ['Game Scores | EAT60', 'See your EAT60 game scores and achievements.'],
  '/setting': ['Settings | EAT60', 'Manage your EAT60 account, app, and support settings.'],
  '/profile': ['My Profile | EAT60', 'Manage your EAT60 account profile and contact details.'],
  '/rewards': ['Rewards | EAT60', 'View your EAT60 rewards, streaks, and available offers.'],
  '/coupons': ['Coupons | EAT60', 'View available EAT60 vouchers and coupons.'],
  '/support': ['Support | EAT60', 'Get help with EAT60 orders and delivery.'],
  '/about': ['About EAT60', 'Learn about EAT60, a local food ordering app serving Ballia.'],
  '/socials': ['EAT60 Community', 'Connect with the EAT60 community.'],
  '/report-issue': ['Report an Issue | EAT60', 'Report a problem with the EAT60 app or ordering experience.']
}

export function updateRouteMetadata(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  const [title, description] = metadata[path] || ['EAT60 | Food delivery in Ballia', metadata['/'][1]]
  const publicPage = path === '/download' || path === '/download-adminapp' || path === '/about'
  document.title = title

  const setMeta = (selector, attribute, key, content) => {
    let element = document.head.querySelector(selector)
    if (!element) {
      element = document.createElement('meta')
      document.head.appendChild(element)
    }
    element.setAttribute(attribute, key)
    element.content = content
  }

  setMeta('meta[name="description"]', 'name', 'description', description)
  setMeta('meta[name="robots"]', 'name', 'robots', publicPage ? 'index, follow' : 'noindex, nofollow')
  setMeta('meta[property="og:title"]', 'property', 'og:title', title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', description)

  let canonical = document.head.querySelector('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.appendChild(canonical)
  }
  canonical.href = `${window.location.origin}${path}`
}
