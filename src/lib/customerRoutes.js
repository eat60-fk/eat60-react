export const CUSTOMER_TAB_PATHS = {
  home: '/',
  hist: '/order-history',
  cart: '/cart',
  feed: '/announcements',
  games: '/games',
  wallet: '/wallet',
  more: '/setting'
};
const MORE_PAGE_PATHS = {
  refer: '/refer',
  rewards: '/rewards',
  coupons: '/coupons',
  profile: '/profile',
  socials: '/socials',
  about: '/about',
  support: '/support',
  bugs: '/report-issue',
  careers: '/careers'
};
const CUSTOMER_ROUTES = {
  '/': {
    tab: 'home'
  },
  '/menu': {
    tab: 'home'
  },
  '/order': {
    tab: 'home'
  },
  '/wallet': {
    tab: 'wallet'
  },
  '/order-history': {
    tab: 'hist'
  },
  '/orders': {
    tab: 'hist'
  },
  '/cart': {
    tab: 'cart'
  },
  '/announcements': {
    tab: 'feed'
  },
  '/feed': {
    tab: 'feed'
  },
  '/games': {
    tab: 'games',
    gameView: 'games'
  },
  '/leaderboard': {
    tab: 'games',
    gameView: 'rankings'
  },
  '/game-scores': {
    tab: 'games',
    gameView: 'scores'
  },
  '/setting': {
    tab: 'more'
  },
  '/settings': {
    tab: 'more'
  },
  '/more': {
    tab: 'more'
  },
  '/refer': {
    tab: 'more',
    morePage: 'refer'
  },
  '/profile': {
    tab: 'more',
    morePage: 'profile'
  },
  '/rewards': {
    tab: 'more',
    morePage: 'rewards'
  },
  '/coupons': {
    tab: 'more',
    morePage: 'coupons'
  },
  '/socials': {
    tab: 'more',
    morePage: 'socials'
  },
  '/about': {
    tab: 'more',
    morePage: 'about'
  },
  '/support': {
    tab: 'more',
    morePage: 'support'
  },
  '/report-issue': {
    tab: 'more',
    morePage: 'bugs'
  },
  '/careers': {
    tab: 'more',
    morePage: 'careers'
  }
};
export function resolveCustomerRoute(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return CUSTOMER_ROUTES[path] || {
    tab: 'home'
  };
}
export function pathForMorePage(page) {
  return MORE_PAGE_PATHS[page] || CUSTOMER_TAB_PATHS.more;
}
