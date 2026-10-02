const ADMIN_ROOT = '/admin';

const adminTabPaths = {
  orders: `${ADMIN_ROOT}/orders`,
  overview: `${ADMIN_ROOT}/dashboard`,
  growth: `${ADMIN_ROOT}/growth`,
  menu: `${ADMIN_ROOT}/menu`,
  outlets: `${ADMIN_ROOT}/outlets`,
  promos: `${ADMIN_ROOT}/promos`,
  rewards: `${ADMIN_ROOT}/rewards`,
  feed: `${ADMIN_ROOT}/feed`,
  explore: `${ADMIN_ROOT}/more`,
  settings: `${ADMIN_ROOT}/settings`
};

const tabByPath = Object.fromEntries(Object.entries(adminTabPaths).map(([tab, path]) => [path, tab]));

export function isAdminPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/admineat60' || path === ADMIN_ROOT || path.startsWith(`${ADMIN_ROOT}/`);
}

export function adminTabForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/admineat60' || path === ADMIN_ROOT) return 'orders';
  if (path === `${ADMIN_ROOT}/overview`) return 'overview';
  return tabByPath[path] || 'orders';
}

export function adminPathForTab(tab) {
  return adminTabPaths[tab] || adminTabPaths.orders;
}

export function canonicalAdminPath(pathname) {
  return adminPathForTab(adminTabForPath(pathname));
}
