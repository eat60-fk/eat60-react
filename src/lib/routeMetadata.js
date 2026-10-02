const metadata = {
  '/': ['EAT60 | Food delivery in Ballia', 'Order local favourites with EAT60, Ballia’s food ordering and delivery app.'],
  '/download': ['Download the EAT60 App', 'Install EAT60 on your device and order local food in Ballia. Android app coming soon.'],
  '/download-adminapp': ['Download the EAT60 Admin App', 'Install the EAT60 admin app for quick access to orders and dashboard controls.'],
  '/admin/install': ['Install EAT60 Kitchen Admin', 'Install EAT60 Kitchen Admin as a separate app for orders and store management.'],
  '/admineat60': ['EAT60 Admin Sign In', 'Sign in to the EAT60 administrator dashboard.'],
  '/admin': ['Orders | EAT60 Admin', 'Review and manage new EAT60 customer orders.'],
  '/admin/orders': ['Orders | EAT60 Admin', 'Review and manage new EAT60 customer orders.'],
  '/admin/dashboard': ['Dashboard | EAT60 Admin', 'Monitor EAT60 orders, store availability, and daily performance.'],
  '/admin/growth': ['Growth | EAT60 Admin', 'Review EAT60 sales and customer activity.'],
  '/admin/menu': ['Menu | EAT60 Admin', 'Manage the EAT60 menu, prices, and availability.'],
  '/admin/outlets': ['Outlets | EAT60 Admin', 'Manage EAT60 outlets and public store details.'],
  '/admin/promos': ['Promos | EAT60 Admin', 'Manage EAT60 promo codes and offers.'],
  '/admin/rewards': ['Rewards | EAT60 Admin', 'Manage customer loyalty rewards.'],
  '/admin/feed': ['Feed | EAT60 Admin', 'Publish EAT60 customer announcements and posts.'],
  '/admin/more': ['More tools | EAT60 Admin', 'Open additional EAT60 admin tools.'],
  '/admin/setting': ['Settings | EAT60 Admin', 'Manage EAT60 delivery and business settings.'],
  '/admin/setting/business': ['Home and business | EAT60 Admin', 'Manage offers, partner ads, and business links.'],
  '/admin/setting/about': ['About page | EAT60 Admin', 'Manage the public EAT60 About page.'],
  '/admin/settings': ['Settings | EAT60 Admin', 'Manage EAT60 delivery and business settings.'],
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
  '/refer': ['Refer & Earn | EAT60', 'Invite friends to EAT60 and claim referral coins.'],
  '/support': ['Support | EAT60', 'Get help with EAT60 orders and delivery.'],
  '/about': ['About EAT60', 'Learn about EAT60, a local food ordering app serving Ballia.'],
  '/socials': ['EAT60 Community', 'Connect with the EAT60 community.'],
  '/careers': ['Careers at EAT60', 'Future career opportunities at EAT60 by Foodverse Kitchen.'],
  '/report-issue': ['Report an Issue | EAT60', 'Report a problem with the EAT60 app or ordering experience.']
};
export function updateRouteMetadata(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const [title, description] = metadata[path] || ['EAT60 | Food delivery in Ballia', metadata['/'][1]];
  const adminAppPage = path.startsWith('/admin/') || path === '/admineat60' || path === '/download-adminapp';
  const publicPage = path === '/download' || path === '/download-adminapp' || path === '/admin/install' || path === '/about' || path === '/careers';
  document.title = title;
  let manifestLink = document.head.querySelector('link[rel="manifest"]');
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.href = adminAppPage ? '/eat60-admin.webmanifest' : '/manifest.webmanifest';
  const setMeta = (selector, attribute, key, content) => {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement('meta');
      document.head.appendChild(element);
    }
    element.setAttribute(attribute, key);
    element.content = content;
  };
  setMeta('meta[name="description"]', 'name', 'description', description);
  setMeta('meta[name="robots"]', 'name', 'robots', publicPage ? 'index, follow' : 'noindex, nofollow');
  setMeta('meta[property="og:title"]', 'property', 'og:title', title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', description);
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}${path}`;
}
