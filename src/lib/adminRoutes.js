const ADMIN_ROOT = '/admin';

const adminTabPaths = {
  orders: `${ADMIN_ROOT}/orders`,
  history: `${ADMIN_ROOT}/order-history`,
  overview: `${ADMIN_ROOT}/dashboard`,
  growth: `${ADMIN_ROOT}/growth`,
  menu: `${ADMIN_ROOT}/menu`,
  outlets: `${ADMIN_ROOT}/outlets`,
  promos: `${ADMIN_ROOT}/promos`,
  rewards: `${ADMIN_ROOT}/rewards`,
  feed: `${ADMIN_ROOT}/feed`,
  explore: `${ADMIN_ROOT}/more`,
  settings: `${ADMIN_ROOT}/setting`
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
  if (isAdminSettingsPath(path)) return 'settings';
  return tabByPath[path] || 'orders';
}

export function adminPathForTab(tab) {
  return adminTabPaths[tab] || adminTabPaths.orders;
}

export function isAdminSettingsPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === `${ADMIN_ROOT}/setting`
    || path.startsWith(`${ADMIN_ROOT}/setting/`)
    || path === `${ADMIN_ROOT}/settings`
    || path.startsWith(`${ADMIN_ROOT}/settings/`);
}

export function adminSettingsSectionForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const section = path.split('/').at(-1);
  if (section === 'about') return 'about';
  if (section === 'app') return 'app';
  if (section === 'home' || section === 'business') return 'business';
  return 'delivery';
}

export function adminPathForSettingsSection(section) {
  if (section === 'about' || section === 'business' || section === 'app') return `${ADMIN_ROOT}/setting/${section}`;
  return `${ADMIN_ROOT}/setting`;
}

export function canonicalAdminPath(pathname) {
  if (isAdminSettingsPath(pathname)) {
    return adminPathForSettingsSection(adminSettingsSectionForPath(pathname));
  }
  return adminPathForTab(adminTabForPath(pathname));
}
