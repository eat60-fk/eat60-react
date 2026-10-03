import { Fragment, useEffect, useState, useCallback, useRef, useId } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { sb } from '../../lib/supabase';
import PoweredFooter from '../../components/PoweredFooter';
import LoadingIndicator from '../../components/LoadingIndicator';
import { CUSTOMER_TAB_PATHS, pathForMorePage, resolveCustomerRoute } from '../../lib/customerRoutes';
import { isNetworkError, readOfflineCache, writeOfflineCache } from '../../lib/offlineCache';
import { updateRouteMetadata } from '../../lib/routeMetadata';
import './catalog.css';
import HungrySnakes from './games/HungrySnakes';
import FlyingBurger from './games/FlyingBurger';
import QuickMathGame from './games/QuickMath';
import RiderRush from './games/RiderRush';

// Shared customer data, display labels, and small UI helpers.
const today = () => new Date().toLocaleDateString('en-CA', {
  timeZone: 'Asia/Kolkata'
});
const offerExpiry = cfg => {
  if (cfg.offer_ends_at) return new Date(cfg.offer_ends_at).getTime();
  if (!cfg.offer_date) return 0;
  const [year, month, day] = cfg.offer_date.split('-').map(Number);
  return Date.UTC(year, month - 1, day + 1) - 330 * 60 * 1000;
};
const LABEL = {
  placed: 'Placed',
  pending: 'Awaiting kitchen',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  payment_received: 'Payment received',
  delivered: 'Delivered',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};
const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'payment_received', 'delivered'];
const EMPTY_FEED = {
  p: [],
  pr: [],
  rc: [],
  cm: [],
  mv: [],
  mr: [],
  vc: []
};
const feedCacheKey = userId => `customer-feed-${userId}`;
const feedRequests = new Map();
const CATEGORY_ICONS = {
  Pizza: '🍕',
  Burger: '🍔',
  Sandwich: '🥪',
  Wraps: '🌯',
  Maggie: '🍜',
  Chinese: '🥡'
};
// Convert common YouTube URLs, including Shorts links, into a quiet inline embed.
function getYouTubeEmbedUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host !== 'youtube.com' && host !== 'youtu.be') return '';
    const segments = url.pathname.split('/').filter(Boolean);
    const videoId = host === 'youtu.be'
      ? segments[0]
      : url.searchParams.get('v') || (['shorts', 'embed', 'live'].includes(segments[0]) ? segments[1] : '');
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return '';
    const params = new URLSearchParams({ autoplay: '1', controls: '0', disablekb: '1', fs: '0', playsinline: '1', rel: '0' });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  } catch {
    return '';
  }
}
const PROFILE_AVATAR_COUNT = 10;
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }
];
const DELIVERY_POINT = {
  latitude: 25.764105,
  longitude: 84.151860
};
const DEFAULT_DELIVERY_RADIUS_KM = 5;
function distanceInKm(from, to) {
  const radians = degrees => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function ProfileAvatar({
  avatarId = 1
}) {
  const selectedAvatarId = Math.min(PROFILE_AVATAR_COUNT, Math.max(1, Number(avatarId) || 1));
  return <img className="profile-portrait" src={`/avatars/profile-${selectedAvatarId}.png`} alt={`Avatar ${selectedAvatarId}`} />;
}
function GenderIcon({ gender }) {
  const shared = {
    width: 17,
    height: 17,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  if (gender === 'male') return <svg {...shared}><circle cx="8" cy="12" r="4" /><path d="m11 9 5-5m0 0h-4m4 0v4" /></svg>;
  if (gender === 'female') return <svg {...shared}><circle cx="10" cy="7" r="4" /><path d="M10 11v7m-3.5-3.5h7" /></svg>;
  return <svg {...shared}><circle cx="10" cy="6" r="3" /><path d="M4 17c.7-3.2 2.7-5 6-5s5.3 1.8 6 5" /></svg>;
}
function NavigationIcon({
  name
}) {
  const common = {
    width: 23,
    height: 23,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  const paths = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5.5 9v11h13V9M9 20v-6h6v6" /></>,
    hist: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    cart: <><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    feed: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    more: <><path d="M4 6h16M4 12h16M4 18h16" /></>
  };
  return <svg {...common}>{paths[name]}</svg>;
}
function FloatingBack({
  onClick,
  label = 'Go back'
}) {
  return <button className="floating-back" type="button" onClick={onClick} aria-label={label}><span aria-hidden="true">×</span></button>;
}
function fetchFeedSnapshot(userId) {
  const pending = feedRequests.get(userId);
  if (pending) return pending;
  const request = (async () => {
    const r = await Promise.all([sb.from('feed_posts').select('*, poll_options(*)').order('created_at', {
      ascending: false
    }), sb.from('poll_results').select('*'), sb.from('reaction_counts').select('*'), sb.from('feed_comments').select('*').order('created_at'), sb.from('poll_votes').select('post_id,option_id'), sb.from('reactions').select('post_id,emoji'), sb.from('feed_view_counts').select('*')]);
    const failed = r.find(result => result.error);
    if (failed) throw failed.error;
    const posts = r[0].data || [];
    let viewCounts = r[6].data || [];
    if (posts.length) {
      const {
        error
      } = await sb.from('feed_views').upsert(posts.map(post => ({
        post_id: post.id,
        user_id: userId
      })), {
        onConflict: 'post_id,user_id',
        ignoreDuplicates: true
      });
      if (error) throw error;
      const views = await sb.from('feed_view_counts').select('*');
      if (views.error) throw views.error;
      viewCounts = views.data || viewCounts;
    }
    return {
      p: posts,
      pr: r[1].data || [],
      rc: r[2].data || [],
      cm: r[3].data || [],
      mv: r[4].data || [],
      mr: r[5].data || [],
      vc: viewCounts
    };
  })();
  feedRequests.set(userId, request);
  request.finally(() => {
    if (feedRequests.get(userId) === request) feedRequests.delete(userId);
  }).catch(() => {});
  return request;
}
function BackConfirmation({
  kind,
  onCancel,
  onConfirm
}) {
  useEffect(() => {
    if (!kind) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [kind, onCancel]);
  if (!kind) return null;
  const copy = {
    exit: {
      message: 'Do you want to exit the app?',
      action: 'EXIT APP'
    },
    game: {
      message: 'Do you want to quit the game?',
      action: 'QUIT GAME'
    },
    order: {
      message: 'Do you want to cancel this order?',
      action: 'CANCEL ORDER'
    }
  }[kind];
  return <div className="back-confirm-backdrop" onClick={onCancel}>
    <section className="back-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="back-confirm-title" aria-describedby="back-confirm-message" onClick={event => event.stopPropagation()}>
      <span className="back-confirm-icon" aria-hidden="true">!</span>
      <h2 id="back-confirm-title">Hold On!</h2>
      <p id="back-confirm-message">{copy.message}</p>
      <div className="back-confirm-actions">
        <button type="button" className="back-confirm-stay" onClick={onCancel}>STAY</button>
        <button type="button" className="back-confirm-leave" onClick={onConfirm}>{copy.action}</button>
      </div>
    </section>
  </div>;
}
function CoinIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#ffbf43" stroke="#ffe08b" strokeWidth="2" /><circle cx="16" cy="16" r="9" fill="none" stroke="#d88917" strokeWidth="1.6" /><path d="M18.8 11.6c-.7-.7-1.6-1-2.8-1-1.6 0-2.6.8-2.6 2.1 0 3.2 5.4 1.4 5.4 4.8 0 1.4-1.1 2.4-2.9 2.4-1.2 0-2.2-.4-3-1.2M16 9v14" fill="none" stroke="#9a5b0c" strokeWidth="1.5" strokeLinecap="round" /></svg>;
}
function ActionIcon({
  name
}) {
  const props = {
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  if (name === 'game') return <svg {...props}><path d="M14 15h20a9 9 0 0 1 8 12l-3 8a4 4 0 0 1-6 1l-7-5h-7l-7 5a4 4 0 0 1-6-1l-3-8a9 9 0 0 1 8-12Z" /><path d="M13 21v10m-5-5h10" /><circle cx="32" cy="23" r="1.5" fill="currentColor" /><circle cx="36" cy="28" r="1.5" fill="currentColor" /></svg>;
  if (name === 'tiffin') return <svg {...props}><path d="M18 11V7h12v4M10 15h28v5H10zM12 20v17a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3V20M12 28h24M12 35h24" /><path d="M7 17h34" /></svg>;
  return <svg {...props}><path d="M7 10h34v7a4 4 0 0 0 0 8v7H7v-7a4 4 0 0 0 0-8v-7Z" /><path d="M25 12v3m0 6v3m0 6v3" /></svg>;
}
// Owns the signed-in customer shell, navigation, and shared app state.
export default function Customer({
  me,
  email,
  reload,
  installAvailable,
  installMessage
}) {
  const [initialRoute] = useState(() => resolveCustomerRoute(window.location.pathname));
  const [tab, setTab] = useState(initialRoute.tab);
  const [gameView, setGameView] = useState(initialRoute.gameView || 'games');
  const [gameFocus, setGameFocus] = useState(false);
  const [moreInitialPage, setMoreInitialPage] = useState(initialRoute.morePage || null);
  const [cart, setCart] = useState(() => readOfflineCache(`cart:${me.id}`) || []);
  const [selectedVoucher, setSelectedVoucher] = useState(() => readOfflineCache(`voucher:${me.id}`) || '');
  const [orderInsights, setOrderInsights] = useState(() => readOfflineCache(`order-insights:${me.id}`) || []);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [rank, setRank] = useState(null);
  const [fullscreenNotice, setFullscreenNotice] = useState(null);
  const [data, setData] = useState(() => readOfflineCache('catalog') || {
    brands: [],
    items: [],
    cfg: {},
    ratings: {},
    ratingError: ''
  });
  const [catalogLoaded, setCatalogLoaded] = useState(() => Boolean(readOfflineCache('catalog')));
  const [catalogError, setCatalogError] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(null);
  const contentRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const toastSequence = useRef(0);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationLabel, setLocationLabel] = useState('Harpur, Ballia');
  const [backConfirmation, setBackConfirmation] = useState(null);
  const currentPathRef = useRef(window.location.pathname);
  const allowNextBackRef = useRef(false);
  const exitRequestedRef = useRef(false);
  const gameQuitRef = useRef(null);
  const say = useCallback((message, action = null) => {
    window.clearTimeout(toastTimer.current);
    const id = ++toastSequence.current;
    const duration = action ? 6000 : 3000;
    setToast({
      message,
      id,
      action
    });
    toastTimer.current = window.setTimeout(() => setToast(null), duration);
  }, []);
  const announce = useCallback(notice => setFullscreenNotice(notice), []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const handleDelivered = useCallback(orderId => {
    const key = `eat60:delivered:${orderId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'shown');
    setFullscreenNotice({
      type: 'order-delivered',
      id: orderId
    });
  }, []);
  useEffect(() => {
    if (!sessionStorage.getItem('eat60:account-created-pending')) return;
    sessionStorage.removeItem('eat60:account-created-pending');
    setFullscreenNotice({
      type: 'reward',
      title: 'Welcome to EAT60!',
      message: 'Your account is ready. Check More → Refer for any invitation coins waiting to be claimed.'
    });
  }, []);
  const reloadRatings = useCallback(async () => {
    const {
      data: ratings,
      error
    } = await sb.from('menu_item_ratings').select('menu_item_id,average_rating,review_count');
    setData(current => ({
      ...current,
      ratings: Object.fromEntries((ratings || []).map(rating => [rating.menu_item_id, rating])),
      ratingError: error?.message || ''
    }));
  }, []);
  const loadCatalog = useCallback(async () => {
    const [b, i, s, ratings] = await Promise.all([sb.from('brands').select('*').order('name'), sb.from('menu_items').select('*, item_variants(*), item_extras(*)').order('id'), sb.from('settings').select('*').single(), sb.from('menu_item_ratings').select('menu_item_id,average_rating,review_count')]);
    const failed = [b, i, s, ratings].find(result => result.error);
    if (failed) {
      const cached = readOfflineCache('catalog');
      if (cached && isNetworkError(failed.error)) {
        setData(cached);
        setCatalogLoaded(true);
        setCatalogError('Could not refresh the menu. Showing saved content instead.');
      } else {
        setCatalogError(failed.error.message);
      }
      return;
    }
    const nextData = {
      brands: b.data || [],
      items: i.data || [],
      cfg: s.data || {},
      ratings: Object.fromEntries((ratings.data || []).map(rating => [rating.menu_item_id, rating])),
      ratingError: ''
    };
    setData(nextData);
    setCatalogLoaded(true);
    setCatalogError('');
    writeOfflineCache('catalog', nextData);
  }, []);
  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);
  useEffect(() => {
    let active = true;
    sb.from('orders').select('created_at,order_items(menu_item_id,qty)').eq('user_id', me.id).order('created_at', { ascending: false }).limit(40).then(({ data: orders, error }) => {
      if (!active || error) return;
      const insights = (orders || []).map(order => ({
        created_at: order.created_at,
        items: (order.order_items || []).filter(item => item.menu_item_id).map(item => ({
          menu_item_id: String(item.menu_item_id),
          qty: Number(item.qty) || 1
        }))
      }));
      setOrderInsights(insights);
      writeOfflineCache(`order-insights:${me.id}`, insights);
    });
    return () => {
      active = false;
    };
  }, [me.id]);
  useEffect(() => {
    writeOfflineCache(`cart:${me.id}`, cart);
  }, [cart, me.id]);
  useEffect(() => {
    writeOfflineCache(`voucher:${me.id}`, selectedVoucher);
  }, [selectedVoucher, me.id]);
  useEffect(() => {
    const key = feedCacheKey(me.id);
    if (readOfflineCache(key)) return;
    let active = true;
    fetchFeedSnapshot(me.id).then(snapshot => {
      if (active) writeOfflineCache(key, snapshot);
    }).catch(error => {
      if (active) console.warn('Could not preload the customer feed.', error);
    });
    return () => {
      active = false;
    };
  }, [me.id]);
  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      loadCatalog();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadCatalog]);
  const refreshApp = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([loadCatalog(), reload(), reloadRatings()]);
      if (tab === 'feed') setFeedRefreshKey(key => key + 1);
      const failed = results.find(result => result.status === 'rejected');
      if (failed) setCatalogError(failed.reason?.message || 'Some EAT60 content could not be refreshed.');
    } finally {
      setRefreshing(false);
    }
  }, [loadCatalog, reload, reloadRatings, tab]);
  const onTouchStart = event => {
    if (!gameFocus && window.scrollY <= 0 && event.touches.length === 1) touchStartY.current = event.touches[0].clientY;else touchStartY.current = null;
  };
  const onTouchEnd = event => {
    if (touchStartY.current === null) return;
    const pullDistance = event.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (pullDistance > 86 && window.scrollY <= 0 && !refreshing) {
      if (!reduceMotion && navigator.vibrate) navigator.vibrate(10);
      refreshApp();
    }
  };
  useEffect(() => {
    sb.rpc('get_leaderboard').then(({
      data
    }) => {
      const currentPlayer = data?.find(row => row.is_me);
      setRank(currentPlayer?.rank ?? null);
    });
  }, []);
  useEffect(() => {
    const channel = sb.channel(`customer-announcements-${me.id}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'feed_posts'
    }, ({
      new: post
    }) => {
      if (post.kind !== 'news') return;
      const key = `eat60:announcement:${post.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, 'shown');
      setFullscreenNotice({
        type: 'announcement',
        id: post.id,
        message: post.body
      });
    }).subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [me.id]);
  useEffect(() => {
    const channel = sb.channel(`customer-order-milestones-${me.id}`).on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `user_id=eq.${me.id}`
    }, ({
      new: order
    }) => {
      if (order.order_stage === 'delivered') handleDelivered(order.id);
    }).subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [handleDelivered, me.id]);
  const price = v => Number(v.id) === Number(data.cfg.offer_variant_id) && data.cfg.offer_date && data.cfg.offer_date <= today() && (!data.cfg.offer_ends_at || new Date(data.cfg.offer_ends_at).getTime() > Date.now()) ? data.cfg.offer_price : v.price;
  const add = (item, v, extras = []) => {
    const b = data.brands.find(x => x.id === item.brand_id);
    if (!item.is_available || !b?.is_open) return say('This outlet is closed right now');
    setCart(c => {
      const extraIds = extras.map(x => x.id).sort();
      const l = c.find(x => x.vid === v.id && JSON.stringify((x.extras || []).map(z => z.id).sort()) === JSON.stringify(extraIds));
      return l ? c.map(x => x === l ? {
        ...x,
        qty: x.qty + 1
      } : x) : [...c, {
        vid: v.id,
        name: `${item.name} (${v.label})`,
        price: price(v) + extras.reduce((sum, x) => sum + Number(x.price), 0),
        regularPrice: Number(v.price) + extras.reduce((sum, x) => sum + Number(x.price), 0),
        extras,
        qty: 1
      }];
    });
    say('Added to cart');
  };
  const n = cart.reduce((a, x) => a + x.qty, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const floatingDeliveryFee = data.cfg.delivery_free === true || Number(data.cfg.free_delivery_minimum) > 0 && cartSubtotal >= Number(data.cfg.free_delivery_minimum) ? 0 : Number(data.cfg.delivery_fee || 0);
  const floatingCartTotal = cartSubtotal + floatingDeliveryFee;
  const navigatePath = path => {
    if (window.location.pathname !== path) window.history.pushState({
      eat60Route: path
    }, '', path);
    currentPathRef.current = path;
    updateRouteMetadata(path);
  };
  const go = (t, path = CUSTOMER_TAB_PATHS[t]) => {
    if (t !== 'games') setGameFocus(false);
    setTab(t);
    if (t !== 'more') setMoreInitialPage(null);
    navigatePath(path);
    window.scrollTo(0, 0);
  };
  const goGames = (view = 'games') => {
    setGameView(view);
    go('games', view === 'rankings' ? '/leaderboard' : view === 'scores' ? '/game-scores' : '/games');
  };
  const goMore = (page = null) => {
    setMoreInitialPage(page);
    go('more', pathForMorePage(page));
  };
  useEffect(() => {
    if (me.address?.trim() && me.area?.trim() && me.phone?.trim()) return;
    const key = `eat60:profile-reminder:${me.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'shown');
    const missing = [!me.address?.trim() && 'delivery address', !me.area?.trim() && 'area', !me.phone?.trim() && 'phone number'].filter(Boolean);
    say(`Add your ${missing.join(', ')} for a smoother checkout.`, {
      label: 'UPDATE PROFILE',
      onClick: () => goMore('profile')
    });
  }, [me.id, me.address, me.area, me.phone, say]);
  useEffect(() => {
    const syncCustomerRoute = () => {
      if (exitRequestedRef.current) {
        if (window.history.state?.eat60Route) {
          window.history.back();
          return;
        }
        exitRequestedRef.current = false;
        allowNextBackRef.current = true;
      }
      if (allowNextBackRef.current) {
        allowNextBackRef.current = false;
      } else {
        const confirmation = gameFocus ? 'game' : tab === 'cart' && cart.length > 0 ? 'order' : tab === 'home' ? 'exit' : null;
        if (confirmation) {
          window.history.pushState({
            eat60Route: currentPathRef.current
          }, '', currentPathRef.current);
          setBackConfirmation(confirmation);
          return;
        }
      }
      const route = resolveCustomerRoute(window.location.pathname);
      setTab(route.tab);
      setGameView(route.gameView || 'games');
      setMoreInitialPage(route.morePage || null);
      setGameFocus(false);
      currentPathRef.current = window.location.pathname;
      updateRouteMetadata(window.location.pathname);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', syncCustomerRoute);
    window.history.replaceState({
      ...window.history.state,
      eat60Route: window.location.pathname
    }, '', window.location.href);
    updateRouteMetadata(window.location.pathname);
    return () => window.removeEventListener('popstate', syncCustomerRoute);
  }, [cart.length, gameFocus, tab]);
  const leaveCart = () => {
    setBackConfirmation('order');
  };
  const confirmBackAction = () => {
    const action = backConfirmation;
    setBackConfirmation(null);
    if (action === 'game') {
      gameQuitRef.current?.();
    } else if (action === 'order') {
      setCart([]);
      setSelectedVoucher('');
      if (window.history.length > 1) {
        allowNextBackRef.current = true;
        window.history.back();
      } else {
        window.history.replaceState({}, '', CUSTOMER_TAB_PATHS.home);
        currentPathRef.current = CUSTOMER_TAB_PATHS.home;
        setTab('home');
        updateRouteMetadata(CUSTOMER_TAB_PATHS.home);
      }
    } else if (action === 'exit') {
      exitRequestedRef.current = true;
      window.history.back();
    }
  };
  const navigateMorePage = page => navigatePath(pathForMorePage(page));
  const checkDeliveryArea = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return say('Location is not supported by this browser.');
    }
    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(({
      coords
    }) => {
      const distance = distanceInKm({
        latitude: coords.latitude,
        longitude: coords.longitude
      }, DELIVERY_POINT);
      const roundedDistance = distance.toFixed(1);
      const deliveryRadius = Number(data.cfg.max_delivery_km) || DEFAULT_DELIVERY_RADIUS_KM;
      const available = distance <= deliveryRadius;
      setLocationStatus(available ? 'available' : 'unavailable');
      setLocationLabel(available ? 'Delivery available' : 'Delivery unavailable');
      say(available ? `You’re ${roundedDistance} km away. Delivery is available.` : `Delivery is not available at your location (${roundedDistance} km away; ${deliveryRadius} km limit).`);
    }, error => {
      setLocationStatus('error');
      if (error.code === error.PERMISSION_DENIED) return say('Allow location access to check delivery in your area.');
      if (error.code === error.TIMEOUT) return say('Location check timed out. Please try again.');
      return say('Could not detect your location. Please try again.');
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    });
  };
  return <div className={`app customer-app${gameFocus ? ' game-focus-app' : ''}`} ref={contentRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <AnimatePresence>
        {refreshing && <motion.div className="pull-refresh-indicator" initial={{
        opacity: 0,
        y: -36
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: -20
      }}><LoadingIndicator label="Refreshing EAT60…" compact /></motion.div>}
      </AnimatePresence>
      {(!online || catalogError) && <motion.div className={`network-status-banner${online ? ' has-error' : ''}`} initial={{
      opacity: 0,
      y: -12
    }} animate={{
      opacity: 1,
      y: 0
    }} exit={{
      opacity: 0,
      y: -12
    }}>
        <span className="network-status-dot" />{!online ? 'Offline mode · showing saved content' : catalogError}
        {online && catalogError && <button onClick={refreshApp}>RETRY</button>}
      </motion.div>}
      {tab === 'home' && <>
        <header className="customer-header">
          <button className="wordmark-button" onClick={() => go('home')} aria-label="EAT60 home">
            <span className="logo">EAT<b>60</b></span>
            <small>Ballia’s first food delivery app</small>
          </button>
          <button className={`location-button location-${locationStatus}`} onClick={checkDeliveryArea} aria-label="Check delivery availability using your location" disabled={locationStatus === 'checking'}>
            <span>{locationStatus === 'checking' ? 'Checking location…' : locationLabel}</span><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" fill="currentColor" /><circle cx="12" cy="10" r="2.5" fill="#171717" /></svg></i>
          </button>
        </header>
        <div className="stat-pills">
          <button className="stat-wallet" onClick={() => go('wallet')}><i><CoinIcon /></i><span><small>YOUR WALLET</small><b>{me.coins} COINS</b></span></button>
          <button className="stat-streak" onClick={() => goMore('rewards')}><i><FlameAnimation /></i><span><small>ORDER STREAK</small><b>{me.streak} DAYS</b></span></button>
          <button className="stat-rank" onClick={() => goGames('rankings')}><i><MoreIcon name="ranks" /></i><span><small>WEEKLY LEAGUE</small><b>{rank ? `#${rank} RANK` : 'PLAY TO RANK'}</b></span></button>
          <button className="stat-track" onClick={() => go('hist')}><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 18-9-7 18-3-7-8-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="m11 14 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></i><span><small>YOUR DELIVERY</small><b>TRACK ORDER</b></span></button>
        </div>
      </>}

      <motion.div className="customer-screen-transition" initial={false} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: reduceMotion ? 0 : 0.2,
      ease: 'easeOut'
    }}>
        <div hidden={tab !== 'home'}><Home data={data} add={add} price={price} go={go} goMore={goMore} goGames={goGames} say={say} me={me} orderInsights={orderInsights} reloadRatings={reloadRatings} /></div>
        <div hidden={tab !== 'cart'}>
          <Cart cart={cart} setCart={setCart} cfg={data.cfg} catalogItems={data.items} me={me} say={say} voucherCode={selectedVoucher} onBack={() => cart.length ? leaveCart() : go('home')} done={orderId => {
          setSelectedVoucher('');
          reload();
          setFullscreenNotice({
            type: 'order-placed',
            id: orderId
          });
        }} />
        </div>
        <div hidden={tab !== 'hist'}><History me={me} /></div>
        <div hidden={tab !== 'feed'}><Feed me={me} say={say} refreshKey={feedRefreshKey} /></div>
        {tab === 'games' && <div className={`game-focus-surface${gameFocus ? ' focused' : ''}`}><Games reload={reload} say={say} me={me} initialView={gameView} onFocus={setGameFocus} onViewChange={goGames} onRequestQuit={() => setBackConfirmation('game')} quitRef={gameQuitRef} onAnnounce={announce} /></div>}
        <div hidden={tab !== 'wallet'}><Wallet me={me} onBack={() => go('home')} /></div>
        <div hidden={tab !== 'more'}><More me={me} email={email} reload={reload} go={go} goGames={goGames} say={say} initialPage={moreInitialPage} onNavigatePath={navigateMorePage} onSelectVoucher={code => {
          setSelectedVoucher(code);
          go('cart');
        }} installAvailable={installAvailable} installMessage={installMessage} socialLinks={data.cfg.social_links || {}} supportPhone={data.cfg.social_links?.support_phone || ''} onAnnounce={announce} /></div>
      </motion.div>
      <BackConfirmation kind={backConfirmation} onCancel={() => setBackConfirmation(null)} onConfirm={confirmBackAction} />
      {!catalogLoaded && (!online || catalogError) && <div className="offline-wait-screen">
        <LoadingIndicator label={online ? 'Waiting for EAT60 data…' : 'Waiting for a network connection…'} />
        <p>{online ? catalogError : 'Your saved app shell is ready. We’ll reconnect and load your menu automatically.'}</p>
        {online && <button className="pill" onClick={loadCatalog}>TRY AGAIN</button>}
      </div>}

      <PoweredFooter />

      <nav className="customer-nav" aria-label="Main navigation">
        {[['home', 'Home'], ['hist', 'History'], ['cart', 'Cart'], ['feed', 'Feed'], ['more', 'More']].map(([k, l]) => <button key={k} className={tab === k || tab === 'wallet' && k === 'home' ? 'on' : ''} onClick={() => k === 'more' ? goMore() : go(k)} aria-current={tab === k ? 'page' : undefined}>
            <i><NavigationIcon name={k} /></i><span>{l}</span>{k === 'cart' && n > 0 && <b>{n}</b>}
          </button>)}
      </nav>
      {n > 0 && tab !== 'cart' && <button className="floating-cart" onClick={() => go('cart')} aria-label={`Open cart, ${n} items, estimated total ₹${floatingCartTotal}`}>
        <span className="floating-cart-icon"><NavigationIcon name="cart" /><b>{n}</b></span><span className="floating-cart-copy"><small>{n} {n === 1 ? 'ITEM' : 'ITEMS'}</small><strong>₹{floatingCartTotal.toLocaleString('en-IN')}</strong></span><span className="floating-cart-arrow">→</span>
      </button>}
      {toast && <div key={toast.id} className="toast" role="status" style={{
      '--toast-duration': `${toast.action ? 6000 : 3000}ms`
    }}>{toast.message}{toast.action && <button className="toast-action" onClick={() => {
        window.clearTimeout(toastTimer.current);
        setToast(null);
        toast.action.onClick();
      }}>{toast.action.label}</button>}<span className="toast-progress" aria-hidden="true" /></div>}
      {fullscreenNotice && <FullscreenNotice notice={fullscreenNotice} onClose={() => {
      const goHome = fullscreenNotice.type === 'order-placed';
      setFullscreenNotice(null);
      if (goHome) go('home');
    }} onTrackOrder={() => {
      setFullscreenNotice(null);
      go('hist');
    }} onViewFeed={() => {
      setFullscreenNotice(null);
      go('feed');
    }} />}
    </div>;
}
function FullscreenNotice({
  notice,
  onClose,
  onTrackOrder,
  onViewFeed
}) {
  const announcement = notice.type === 'announcement';
  const delivered = notice.type === 'order-delivered';
  const gameScore = notice.type === 'game-score';
  const reward = notice.type === 'reward';
  const special = gameScore || reward;
  const title = notice.title || (announcement ? 'A note from EAT60' : delivered ? 'Order delivered!' : 'Order placed!');
  const detail = announcement ? notice.message : special ? notice.message : delivered ? `Order #${notice.id} has arrived. Enjoy your meal!` : `Order #${notice.id} is with the kitchen. We’ll keep you updated as it moves along.`;
  return <div className={`fullscreen-notice${special || announcement ? ' is-announcement' : ''}`} role="dialog" aria-modal="true" aria-labelledby="fullscreen-notice-title">
    <div className="reward-screen-rays" aria-hidden="true" />
    <div className={`notice-animation-icon ${special || announcement ? 'notice-megaphone' : delivered ? 'notice-delivered' : 'notice-placed'}`} aria-hidden="true">
      <span>{special ? reward ? '✦' : gameScore ? '★' : '✳' : '✓'}</span>
      {!special && <i />}
    </div>
    <p className="notice-kicker">{notice.kicker || (announcement ? 'ANNOUNCEMENT' : reward ? 'REWARD CLAIMED' : gameScore ? 'GAME SCORE SAVED' : delivered ? 'GOOD FOOD, RIGHT ON TIME' : 'THANK YOU FOR YOUR ORDER')}</p>
    <h1 id="fullscreen-notice-title">{title}</h1>
    <p className="notice-detail">{detail}</p>
    <div className="notice-progress" aria-hidden="true"><i /></div>
    <div className="notice-actions">
      {special ? <button className="reward-claim-primary" onClick={onClose}>CONTINUE</button> : announcement ? <button className="reward-claim-primary" onClick={onViewFeed}>VIEW FEED</button> : <button className="reward-claim-primary" onClick={onTrackOrder}>{delivered ? 'VIEW ORDER' : 'TRACK YOUR ORDER'}</button>}
      {!special && <button className="reward-claim-later" onClick={onClose}>CONTINUE</button>}
    </div>
  </div>;
}
// Storefront and checkout components.
function Home({
  data,
  add,
  price,
  go,
  goMore,
  goGames,
  say,
  me,
  orderInsights,
  reloadRatings
}) {
  const [b, setB] = useState('');
  const [c, setC] = useState('');
  const reduceMotion = useReducedMotion();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState([]);
  const [stockFilter, setStockFilter] = useState('in-stock');
  const [shuffleIds, setShuffleIds] = useState([]);
  const [clock, setClock] = useState(Date.now());
  const [stories, setStories] = useState([]);
  const [seenStoryIds, setSeenStoryIds] = useState([]);
  const [storyIndex, setStoryIndex] = useState(null);
  const [storyDuration, setStoryDuration] = useState(6000);
  const offerRef = useRef(null);
  const menuRef = useRef(null);
  const storyTimer = useRef(null);
  const loadStories = useCallback(async () => {
    const { data: rows, error } = await sb.from('feed_stories')
      .select('id,media_url,media_type,caption,created_at,expires_at')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });
    if (error) return;
    const activeStories = rows || [];
    setStories(activeStories);
    if (activeStories.length) {
      const { data: views, error: viewsError } = await sb.from('feed_story_views')
        .select('story_id')
        .eq('user_id', me.id)
        .in('story_id', activeStories.map(story => story.id));
      if (!viewsError) setSeenStoryIds((views || []).map(view => String(view.story_id)));
    } else setSeenStoryIds([]);
  }, [me.id]);
  useEffect(() => {
    loadStories();
    const channel = sb.channel('customer-feed-stories')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_stories' }, loadStories)
      .subscribe();
    return () => {
      sb.removeChannel(channel);
      window.clearTimeout(storyTimer.current);
    };
  }, [loadStories]);
  const closeStory = useCallback(() => {
    setStoryIndex(null);
    window.clearTimeout(storyTimer.current);
  }, []);
  const advanceStory = useCallback(() => {
    setStoryIndex(index => {
      if (index === null) return null;
      if (index + 1 >= stories.length) return null;
      return index + 1;
    });
  }, [stories.length]);
  useEffect(() => {
    if (storyIndex === null) return undefined;
    const onKeyDown = event => {
      if (event.key === 'Escape') closeStory();
      if (event.key === 'ArrowRight') advanceStory();
      if (event.key === 'ArrowLeft') setStoryIndex(index => Math.max(0, (index ?? 0) - 1));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [storyIndex, closeStory, advanceStory]);
  useEffect(() => {
    if (storyIndex === null || !stories[storyIndex]) return undefined;
    const story = stories[storyIndex];
    const duration = story.media_type === 'video' ? 30000 : 6000;
    setStoryDuration(duration);
    sb.rpc('record_feed_story_view', { p_story_id: story.id }).then(({ error }) => {
      if (!error) setSeenStoryIds(current => current.includes(String(story.id)) ? current : [...current, String(story.id)]);
    });
    return undefined;
  }, [storyIndex, stories, advanceStory]);
  useEffect(() => {
    if (storyIndex === null) return undefined;
    storyTimer.current = window.setTimeout(advanceStory, storyDuration);
    return () => window.clearTimeout(storyTimer.current);
  }, [storyIndex, storyDuration, advanceStory]);
  useEffect(() => {
    if (!data.cfg.offer_variant_id || !data.cfg.offer_date || data.cfg.offer_date > today() || offerExpiry(data.cfg) <= Date.now()) return undefined;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [data.cfg.offer_date, data.cfg.offer_ends_at, data.cfg.offer_variant_id]);
  const brand = id => data.brands.find(x => x.id === id);
  const categories = [...new Set(data.items.map(item => String(item.category || '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const matchingItems = data.items.filter(i => (!b || i.brand_id === b) && (!c || i.category === c) && (i.name + (i.description || '')).toLowerCase().includes(q.toLowerCase()));
  const stockItems = matchingItems.filter(item => stockFilter === 'out-of-stock' ? item.is_available === false : item.is_available !== false);
  const shuffleRank = new Map(shuffleIds.map((id, index) => [String(id), index]));
  const items = shuffleIds.length ? [...stockItems].sort((left, right) => (shuffleRank.get(String(left.id)) ?? Number.MAX_SAFE_INTEGER) - (shuffleRank.get(String(right.id)) ?? Number.MAX_SAFE_INTEGER)) : stockItems;
  const scheduledOffer = data.cfg.offer_date && data.cfg.offer_date <= today() && data.items.find(i => i.item_variants.some(v => Number(v.id) === Number(data.cfg.offer_variant_id)));
  const offerEndsAt = offerExpiry(data.cfg);
  const offerItem = scheduledOffer && clock < offerEndsAt ? scheduledOffer : null;
  const offerRemaining = Math.max(0, offerEndsAt - clock);
  const offerHours = Math.floor(offerRemaining / 3600000);
  const offerMinutes = Math.floor(offerRemaining % 3600000 / 60000);
  const offerSeconds = Math.floor(offerRemaining % 60000 / 1000);
  const offerCountdown = `${String(offerHours).padStart(2, '0')}:${String(offerMinutes).padStart(2, '0')}:${String(offerSeconds).padStart(2, '0')}`;
  const allStoriesSeen = stories.length > 0 && stories.every(story => seenStoryIds.includes(String(story.id)));
  const adImage = String(data.cfg.home_ad_image_url || '').trim();
  const adStart = data.cfg.home_ad_starts_at ? new Date(data.cfg.home_ad_starts_at).getTime() : null;
  const adEnd = data.cfg.home_ad_ends_at ? new Date(data.cfg.home_ad_ends_at).getTime() : null;
  const adLink = /^https?:\/\//i.test(data.cfg.home_ad_link || '') ? data.cfg.home_ad_link : '';
  const showPartnerAd = data.cfg.home_ad_active === true && /^https?:\/\//i.test(adImage) && (adStart === null || !Number.isNaN(adStart) && Date.now() >= adStart) && (adEnd === null || !Number.isNaN(adEnd) && Date.now() < adEnd);
  const sorted = i => [...i.item_variants].sort((x, y) => x.price - y.price);
  const activeVariant = item => item?.item_variants?.find(v => Number(v.id) === Number(data.cfg.offer_variant_id));
  const recentCutoff = Date.now() - 60 * 86400000;
  const purchasedItemIds = new Set((orderInsights || []).filter(order => new Date(order.created_at).getTime() >= recentCutoff).flatMap(order => order.items.map(item => item.menu_item_id)));
  const purchaseCounts = (orderInsights || []).flatMap(order => order.items).reduce((counts, item) => counts.set(item.menu_item_id, (counts.get(item.menu_item_id) || 0) + item.qty), new Map());
  const favouriteEntry = [...purchaseCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const favouriteItemId = favouriteEntry?.[1] > 1 ? favouriteEntry[0] : null;
  const scrollToOffer = () => {
    if (!offerItem) return say('No active offer right now. Check back soon!');
    offerRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };
  const scrollToMenu = () => {
    window.requestAnimationFrame(() => menuRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start'
    }));
  };
  const addFromCard = item => {
    if (!item.is_available || !brand(item.brand_id)?.is_open) return say('This outlet is closed right now');
    const variants = sorted(item);
    if (!variants.length) return say('This item has no sizes available yet');
    if (variants.length === 1 && !(item.item_extras || []).some(e => e.is_available)) add(item, variants[0]);else {
      setOpen(item);
      setSelectedExtras([]);
    }
  };
  return <>
      <div className={`quick-actions${stories.length ? ' has-active-story' : ''}`}>
        <button onClick={() => goMore('profile')}><i className="quick-icon profile-icon"><ProfileAvatar avatarId={me.avatar_id} /></i><span>{me.username || me.name || 'My Profile'}</span></button>
        {stories.length > 0 && <button className="quick-story-button" type="button" onClick={() => setStoryIndex(0)} aria-label={`Watch ${stories.length} EAT60 stories${allStoriesSeen ? ', viewed' : ''}`}><i className={`quick-icon story-active-icon${allStoriesSeen ? ' story-seen' : ''}`}><span className="brand-story-logo">EAT<b>60</b></span></i><span>@eat60.in</span></button>}
        <button onClick={() => goGames()}><i className="quick-icon game-icon"><ActionIcon name="game" /></i><span>Play Game</span></button>
        <button onClick={scrollToOffer}><i className="quick-icon offer-icon"><b>50%</b><small>OFF</small></i><span>Offers & Coupon</span></button>
        <button onClick={() => data.cfg.tiffin_url ? window.open(data.cfg.tiffin_url, '_blank', 'noopener,noreferrer') : say('Tiffin service details are coming soon')}><i className="quick-icon tiffin-icon"><ActionIcon name="tiffin" /></i><span>Tiffin Service</span></button>
      </div>

      <AnimatePresence>
        {storyIndex !== null && stories[storyIndex] && <motion.div className={`story-viewer${stories[storyIndex].media_type === 'video' ? ' story-video-only' : ''}`} role="dialog" aria-modal="true" aria-label="EAT60 story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeStory}>
          <div className="story-viewer-content" onClick={event => event.stopPropagation()}>
            <div className="story-progress" aria-hidden="true">{stories.map((story, index) => <i key={story.id} className={`${index < storyIndex ? 'complete' : ''}${index === storyIndex ? ' current' : ''}`} style={index === storyIndex ? { '--story-duration': `${storyDuration}ms` } : undefined} />)}</div>
            {stories[storyIndex].media_type !== 'video' && <>
              <header className="story-viewer-header"><span className="story-viewer-logo">EAT<b>60</b></span><strong>@eat60.in</strong><button type="button" onClick={closeStory} aria-label="Close story">×</button></header>
            </>}
            {stories[storyIndex].media_type === 'video' ? (getYouTubeEmbedUrl(stories[storyIndex].media_url)
              ? <iframe key={stories[storyIndex].id} className="story-youtube-embed" src={getYouTubeEmbedUrl(stories[storyIndex].media_url)} title="EAT60 story video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              : <video key={stories[storyIndex].id} className="story-direct-video" src={stories[storyIndex].media_url} autoPlay playsInline onLoadedMetadata={event => Number.isFinite(event.currentTarget.duration) && setStoryDuration(event.currentTarget.duration * 1000)} onEnded={advanceStory} />)
              : <img src={stories[storyIndex].media_url} alt={stories[storyIndex].caption || 'EAT60 story'} />}
            {stories[storyIndex].media_type === 'video' && <button className="story-video-close" type="button" onClick={closeStory} aria-label="Close story">×</button>}
            {stories[storyIndex].media_type !== 'video' && stories[storyIndex].caption && <p className="story-viewer-caption">{stories[storyIndex].caption}</p>}
            <button className="story-hit story-hit-prev" type="button" aria-label="Previous story" onClick={() => setStoryIndex(index => Math.max(0, index - 1))} />
            <button className="story-hit story-hit-next" type="button" aria-label="Next story" onClick={advanceStory} />
          </div>
        </motion.div>}
      </AnimatePresence>

      {showPartnerAd && (adLink ? <a className="home-partner-ad" href={adLink} target="_blank" rel="noopener noreferrer" aria-label={data.cfg.home_ad_alt || 'Partner promotion'}>
          <img src={adImage} alt={data.cfg.home_ad_alt || 'Partner promotion'} loading="lazy" />
          <span>PARTNER SPOTLIGHT <i aria-hidden="true">↗</i></span>
        </a> : <div className="home-partner-ad"><img src={adImage} alt={data.cfg.home_ad_alt || 'Partner promotion'} loading="lazy" /><span>PARTNER SPOTLIGHT</span></div>)}

      {offerItem && <div className="offer-wrap">
        <small className="offer-countdown" aria-live="off"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>ENDS IN {offerCountdown}</small>
        <div className="offer-card" id="daily-offer" ref={offerRef}>
          <div>
            <h2>{data.cfg.offer_title || 'OFFER OF THE DAY'}</h2>
            <small>{data.cfg.offer_message || 'GRAB THIS OFFER BEFORE IT ENDS'}</small>
            <p>GET {offerItem.name.toUpperCase()} <span className="offer-price-line">@ ₹{data.cfg.offer_price}/-</span>{Number(data.cfg.offer_price) < Number(activeVariant(offerItem)?.price) && <s className="offer-original-price">₹{Number(activeVariant(offerItem)?.price).toLocaleString('en-IN')}</s>}</p>
            <button className="offer-add" onClick={() => add(offerItem, activeVariant(offerItem))}>Add to cart <span>→</span></button>
          </div>
          <div className="offer-art" aria-hidden="true">🍕</div>
        </div>
      </div>}

      <section className="category-section">
        <div className="section-heading"><h2>CATEGORIES</h2>{(c || b) && <button onClick={() => {
          setC('');
          setB('');
        }}>Clear filters</button>}</div>
        <div className="category-scroller">
          {categories.map(x => <button key={x} className={`category-button${c === x ? ' selected' : ''}`} onClick={() => {
            setC(c === x ? '' : x);
            scrollToMenu();
          }}>
              <i>{CATEGORY_ICONS[x] || '🍽️'}</i><span>{x}</span>
            </button>)}
        </div>
        <div className="brand-scroller" aria-label="Filter by restaurant">
          {data.brands.map(x => <button key={x.id} className={`brand-chip${b === x.id ? ' selected' : ''}`} onClick={() => {
            setB(b === x.id ? '' : x.id);
            scrollToMenu();
          }}>{x.emoji} {x.name}</button>)}
        </div>
      </section>

      <label className="menu-search">
        <span aria-hidden="true">⌕</span>
        <input aria-label="Search menu" placeholder="PANEER MAKHANI PIZZA" value={q} onChange={e => setQ(e.target.value)} />
        {q && <button onClick={() => setQ('')} aria-label="Clear search">×</button>}
      </label>

      <section className="menu-section" ref={menuRef}>
        <div className="section-heading menu-section-heading"><h2>{c || b ? 'MENU' : 'OUR MENU'}</h2><div className="menu-display-controls" role="group" aria-label="Menu stock filter"><button type="button" aria-pressed={stockFilter === 'in-stock'} className={stockFilter === 'in-stock' ? 'selected' : ''} onClick={() => setStockFilter('in-stock')}>In stock <b>{matchingItems.filter(item => item.is_available !== false).length}</b></button><button type="button" aria-pressed={stockFilter === 'out-of-stock'} className={stockFilter === 'out-of-stock' ? 'selected' : ''} onClick={() => setStockFilter('out-of-stock')}>Out of stock <b>{matchingItems.filter(item => item.is_available === false).length}</b></button><button type="button" className="menu-shuffle-button" onClick={() => {
          const next = [...stockItems].map(item => item.id);
          for (let index = next.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
          }
          setShuffleIds(next);
        }}>↕ Surprise me</button></div></div>
        {data.ratingError && <div className="menu-rating-error" role="alert">
          <b>Customer ratings could not be loaded.</b>
          <p>{data.ratingError}</p>
          <small>In the Supabase project connected to this app, run order_reviews.sql, then rerun admin_operations.sql. If both have already completed, run <code>NOTIFY pgrst, 'reload schema';</code>, wait briefly, and retry.</small>
          <button type="button" onClick={reloadRatings}>Retry ratings</button>
        </div>}
        {items.length === 0 && <div className="empty">{matchingItems.length === 0 ? 'No items match. Clear a filter or try another search.' : stockFilter === 'in-stock' ? 'No items are in stock right now.' : 'There are no out-of-stock items right now.'}</div>}
        <div className="menu-grid">
          <AnimatePresence initial={false} mode="popLayout">
          {items.map(i => {
          const ok = i.is_available && brand(i.brand_id)?.is_open;
          const variants = sorted(i);
          const offer = activeVariant(i);
          const hasDeal = offer && Number(price(offer)) < Number(offer.price);
          const displayVariant = hasDeal ? offer : variants[0];
          const recentlyOrdered = purchasedItemIds.has(String(i.id));
          const favourite = favouriteItemId === String(i.id);
          return <motion.article key={i.id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }} className={`menu-card${ok ? '' : ' unavailable'}`}>
                {(recentlyOrdered || favourite || hasDeal) && <div className="menu-card-badges">{favourite && <span className="menu-badge favorite">♥ Your favourite</span>}{recentlyOrdered && <span className="menu-badge recent">↺ Recently ordered</span>}{hasDeal && <span className="menu-badge deal">Offer</span>}</div>}
                <button className="menu-card-main" onClick={() => ok && setOpen(i)} disabled={!ok} aria-label={`View ${i.name}`}>
                  {i.image_url ? <img className="menu-image" src={i.image_url} alt={i.name} loading="lazy" /> : <span className="menu-image menu-image-fallback">{CATEGORY_ICONS[i.category] || brand(i.brand_id)?.emoji || '🍽️'}</span>}
                  <span className="menu-card-copy">
                    <small>{brand(i.brand_id)?.name || 'OUTLET DATA UNAVAILABLE'}</small>
                    <b>{i.name}</b>
                    <span className="menu-item-rating" aria-label={data.ratings[i.id] ? `${data.ratings[i.id].average_rating} out of 5 based on ${data.ratings[i.id].review_count} order ratings` : 'No customer ratings yet'}>
                      <span aria-hidden="true">{data.ratings[i.id] ? '★' : '☆'}</span>
                      {data.ratings[i.id] ? `${Number(data.ratings[i.id].average_rating).toFixed(1)} · ${data.ratings[i.id].review_count} ${data.ratings[i.id].review_count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}
                    </span>
                    <span>{i.description || i.category}</span>
                    <strong>{!ok ? 'CLOSED RIGHT NOW' : displayVariant ? <span className="menu-price-line">{displayVariant === offer ? '' : 'FROM ' }₹{price(displayVariant)}{displayVariant === offer && Number(price(displayVariant)) < Number(displayVariant.price) && <s>₹{Number(displayVariant.price).toLocaleString('en-IN')}</s>}</span> : 'TEMPORARILY UNAVAILABLE'}</strong>
                  </span>
                </button>
                <button className="menu-add" disabled={!ok || !variants.length} onClick={() => addFromCard(i)} aria-label={`Add ${i.name} to cart`}>
                  ADD <span>+</span>
                </button>
              </motion.article>;
        })}
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {open && <>
          <motion.div className="bk" onClick={() => setOpen(null)} initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} transition={{
          duration: reduceMotion ? 0 : 0.18
        }} />
          <motion.div className="sheet" role="dialog" aria-modal="true" aria-label={`${open.name} options`} initial={reduceMotion ? false : {
          y: '100%'
        }} animate={{
          y: 0,
          opacity: 1
        }} exit={reduceMotion ? {
          opacity: 0
        } : {
          y: '100%'
        }} transition={{
          duration: reduceMotion ? 0 : 0.24,
          ease: [0.22, 1, 0.36, 1]
        }}>
            <button type="button" className="grab" onClick={() => setOpen(null)} aria-label="Close item options" />
            <div className="sheet-item-heading">
              {open.image_url && <img className="sheet-item-image" src={open.image_url} alt={open.name} />}
              <div className="sheet-item-copy">
                <h2>{open.name}</h2>
                {open.description && <small>{open.description}</small>}
              </div>
            </div>
            {(open.item_extras || []).some(e => e.is_available) && <div className="extra-picker"><b>Add extras</b>{open.item_extras.filter(e => e.is_available).map(x => <label key={x.id}><input type="checkbox" checked={selectedExtras.some(e => e.id === x.id)} onChange={e => setSelectedExtras(a => e.target.checked ? [...a, x] : a.filter(y => y.id !== x.id))} /><span>{x.name}</span><strong>+₹{x.price}</strong></label>)}</div>}
            {sorted(open).map(v => <div key={v.id} className="vr">
                <span>{Number(price(v)) < Number(v.price) && <s>₹{Number(v.price).toLocaleString('en-IN')}</s>} ₹{price(v)} &nbsp; {v.label}</span>
                <button className="pill" onClick={() => {
              add(open, v, selectedExtras);
              setOpen(null);
            }}>Add +</button>
              </div>)}
          </motion.div>
        </>}
      </AnimatePresence>
    </>;
}
function Cart({
  cart,
  setCart,
  cfg,
  catalogItems,
  me,
  say,
  done,
  voucherCode,
  onBack
}) {
  const reduceMotion = useReducedMotion();
  const [draft] = useState(() => readOfflineCache(`checkout:${me.id}`) || {});
  const [useCoins, setUseCoins] = useState(draft.useCoins ?? false);
  const [customerName, setCustomerName] = useState(draft.customerName ?? me.name ?? '');
  const [addr, setAddr] = useState(draft.addr ?? [me.address, me.area, me.city].filter(Boolean).join(', '));
  const [ph, setPh] = useState(draft.ph ?? me.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [coupon, setCoupon] = useState(draft.coupon || '');
  const [couponResult, setCouponResult] = useState(null);
  const [deliveryDistance, setDeliveryDistance] = useState(null);
  const [locationMessage, setLocationMessage] = useState('');
  useEffect(() => {
    writeOfflineCache(`checkout:${me.id}`, {
      useCoins,
      customerName,
      addr,
      ph,
      coupon
    });
  }, [addr, coupon, customerName, me.id, ph, useCoins]);

  const regularUnitPrice = item => {
    const variant = catalogItems.flatMap(menuItem => menuItem.item_variants || []).find(value => String(value.id) === String(item.vid));
    const base = Number(item.regularPrice ?? variant?.price ?? item.price);
    return base + (item.regularPrice == null && variant ? (item.extras || []).reduce((sum, extra) => sum + Number(extra.price || 0), 0) : 0);
  };
  const offerIsActive = cfg.offer_variant_id && cfg.offer_date && cfg.offer_date <= today() && (!cfg.offer_ends_at || new Date(cfg.offer_ends_at).getTime() > Date.now());
  const selectedUnitPrice = (item, useDailyOffer) => {
    if (useDailyOffer && offerIsActive && String(item.vid) === String(cfg.offer_variant_id)) {
      const extras = (item.extras || []).reduce((sum, extra) => sum + Number(extra.price || 0), 0);
      return Number(cfg.offer_price) + extras;
    }
    return regularUnitPrice(item);
  };
  // The daily deal, one coupon, and wallet coins are exclusive savings.
  const useDailyOffer = !couponResult?.code && !useCoins;
  const sub = cart.reduce((sum, item) => sum + selectedUnitPrice(item, useDailyOffer) * item.qty, 0);
  const regularSubtotal = cart.reduce((sum, item) => sum + regularUnitPrice(item) * item.qty, 0);
  const couponDisc = Number(couponResult?.discount_amount || 0);
  const minDistance = Number(cfg.min_delivery_km || 0);
  const extraDistance = Math.max(0, (deliveryDistance ?? minDistance) - minDistance);
  const distanceFee = Math.ceil(extraDistance * Number(cfg.delivery_per_km || 0));
  const deliveryFeeBeforeDiscount = Number(cfg.delivery_fee || 0) + distanceFee;
  const freeDeliveryMinimum = Number(cfg.free_delivery_minimum || 0);
  const freeDelivery = cfg.delivery_free === true || freeDeliveryMinimum > 0 && sub >= freeDeliveryMinimum;
  const deliveryFee = freeDelivery ? 0 : deliveryFeeBeforeDiscount;
  const deliveryRadius = Number(cfg.max_delivery_km) || DEFAULT_DELIVERY_RADIUS_KM;
  const beyondDeliveryRadius = deliveryDistance !== null && deliveryDistance > deliveryRadius;
  const minimumOrder = Number(cfg.min_order || 0);
  const minimumOrderMet = sub >= minimumOrder;
  const disc = useCoins && !couponResult ? Math.min(Math.floor(me.coins / 100), Math.floor(Math.max(0, sub) * (cfg.max_coin_pct || 20) / 100)) : 0;
  const gstIncluded = Math.round(sub * 5 / 105);
  const total = Math.max(0, sub + deliveryFee - disc - couponDisc);
  const qty = (k, d) => {
    setCouponResult(null);
    setCart(c => c.map((x, i) => i === k ? {
      ...x,
      qty: x.qty + d
    } : x).filter(x => x.qty > 0));
  };
  const place = async () => {
    if (!navigator.onLine) return say('You’re offline. Your cart and checkout details are saved; reconnect to place the order.');
    if (!customerName.trim() || !ph.trim() || !addr.trim()) return say('Enter your name, phone number, and delivery address.');
    if (!minimumOrderMet) return say(`Minimum order is ₹${minimumOrder}.`);
    if (deliveryDistance === null) return say('Confirm your delivery location before placing the order.');
    if (beyondDeliveryRadius) return say(`Delivery is available only within ${deliveryRadius} km.`);
    setBusy(true);
    try {
      const {
        data: orderId,
        error
      } = await sb.rpc('place_order_with_coupon', {
        p_items: cart.map(x => ({
          variant_id: x.vid,
          qty: x.qty,
          extras: (x.extras || []).map(e => ({
            id: e.id
          }))
        })),
        p_use_coins: useCoins,
        p_address: addr,
        p_phone: ph,
        p_coupon_code: couponResult?.code || null,
        p_customer_name: customerName,
        p_distance_km: deliveryDistance === null ? null : Number(deliveryDistance.toFixed(2)),
        p_use_offer: useDailyOffer
      });
      if (error) return say(error.message);
      setCart([]);
      setCoupon('');
      setCouponResult(null);
      setUseCoins(false);
      setDeliveryDistance(null);
      setLocationMessage('');
      done(orderId);
    } catch (error) {
      say(error.message || 'Could not place the order. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const validateCoupon = useCallback(async (code = coupon) => {
    if (!navigator.onLine) return say('Reconnect to validate this coupon. Your cart is saved.');
    try {
      const {
        data,
        error
      } = await sb.rpc('validate_coupon', {
        p_code: code,
        p_subtotal: regularSubtotal
      });
      if (error) {
        setCouponResult(null);
        return say(error.message);
      }
      if (!data?.valid) {
        setCouponResult(null);
        return say(data?.message || 'Coupon unavailable');
      }
      setCouponResult(data);
      setCoupon(data.code);
      setUseCoins(false);
      say(`Voucher applied · save ₹${data.discount_amount}`);
    } catch (error) {
      setCouponResult(null);
      say(error.message || 'Could not validate the voucher. Please try again.');
    }
  }, [coupon, regularSubtotal, say]);
  useEffect(() => {
    if (voucherCode) {
      setCoupon(voucherCode);
      validateCoupon(voucherCode);
    }
  }, [voucherCode]);
  useEffect(() => {
    setCustomerName(me.name || '');
    setAddr([me.address, me.area, me.city].filter(Boolean).join(', '));
    setPh(me.phone || '');
  }, [me.id, me.name, me.address, me.area, me.city, me.phone]);
  const checkDeliveryDistance = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported. Enable location services to confirm delivery availability.');
      return;
    }
    setLocationMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(({
      coords
    }) => {
      const distance = distanceInKm({
        latitude: coords.latitude,
        longitude: coords.longitude
      }, DELIVERY_POINT);
      const roundedDistance = Number(distance.toFixed(2));
      setDeliveryDistance(roundedDistance);
      if (roundedDistance > deliveryRadius) setLocationMessage(`You are ${roundedDistance.toFixed(1)} km away; delivery is available within ${deliveryRadius} km.`);else setLocationMessage(`Estimated distance: ${roundedDistance.toFixed(1)} km.`);
    }, error => {
      setDeliveryDistance(null);
      setLocationMessage(error.code === error.PERMISSION_DENIED ? 'Location permission was denied. Allow location access to confirm delivery availability.' : 'Could not detect your location. Try again to confirm delivery availability.');
    }, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    });
  };
  if (!cart.length) return <><FloatingBack onClick={onBack} label="Back to home" /><div className="empty">Your cart is empty. Add something from Home.</div></>;
  return <>
      <FloatingBack onClick={onBack} label="Back from checkout" />
      <h1 className="cart-page-title">YOUR CART</h1>
      <AnimatePresence initial={false} mode="popLayout">
      {cart.map((x, k) => <motion.div layout key={`${x.vid}-${(x.extras || []).map(e => e.id).sort().join('-')}`} className="card row between customer-checkout-item" initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? undefined : { opacity: 0, x: -18, scale: 0.97 }} transition={{ duration: 0.22 }}>
          <div className="fx"><b>{x.name}</b>{(x.extras || []).length > 0 && <small>{x.extras.map(e => e.name).join(', ')}</small>}</div>
          <div className="row">
            <button className="pill g" onClick={() => qty(k, -1)}>-</button><b>{x.qty}</b>
            <button className="pill g" onClick={() => qty(k, 1)}>+</button>
          </div>
          <b style={{
        width: 60,
        textAlign: 'right'
      }}>₹{selectedUnitPrice(x, useDailyOffer) * x.qty}</b>
        </motion.div>)}
      </AnimatePresence>
      <motion.div className="card customer-checkout-details" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.06 }}>
        <div className="cart-customer-fields">
          <label>Full name<input autoComplete="name" maxLength={80} value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Full name" required /></label>
          <label>Delivery address<input autoComplete="street-address" maxLength={240} value={addr} onChange={event => setAddr(event.target.value)} placeholder="House, street, landmark" required /></label>
          <label>Phone number<input autoComplete="tel" inputMode="tel" maxLength={20} value={ph} onChange={event => setPh(event.target.value)} placeholder="Phone number" required /></label>
        </div>
        <button type="button" className="delivery-location-button" onClick={checkDeliveryDistance}>⌖ Use current location for distance</button>
        {locationMessage && <small className={`delivery-location-message${beyondDeliveryRadius ? ' unavailable' : ''}`} role="status">{locationMessage}</small>}
        <label className="row">
          <input type="checkbox" style={{
          width: 20
        }} checked={useCoins} onChange={e => {
          const checked = e.target.checked;
          setUseCoins(checked);
          if (checked) {
            setCouponResult(null);
            setCoupon('');
          }
        }} />
          <span>Use coins (100 coins = ₹1). You have {me.coins}.</span>
        </label>
        <small className="checkout-savings-note">Choose one saving per order: the daily deal, a coupon, or wallet coins.</small>
        <div className="coupon-entry"><input aria-label="Voucher code" placeholder="Coupon / voucher code" value={coupon} onChange={e => {
          setCoupon(e.target.value.toUpperCase());
          setCouponResult(null);
        }} /><button type="button" className="pill" onClick={() => validateCoupon()}>Apply</button></div>
        {couponResult && <small className="coupon-applied">{couponResult.code} applied · save ₹{couponDisc}</small>}
        <section className="checkout-payment" aria-labelledby="checkout-payment-heading">
          <div className="checkout-payment-heading"><h3 id="checkout-payment-heading">Payment method</h3><small>Choose how you’ll pay</small></div>
          <div className="checkout-payment-options" role="group" aria-label="Payment methods">
            <div className="checkout-payment-option selected" aria-current="true">
              <span className="checkout-payment-icon" aria-hidden="true">₹</span>
              <span className="checkout-payment-copy"><b>Cash on delivery</b><small>Pay when your order arrives</small></span>
              <span className="checkout-payment-check" aria-label="Selected">✓</span>
            </div>
            <div className="checkout-payment-option unavailable" aria-disabled="true">
              <span className="checkout-payment-icon" aria-hidden="true">↗</span>
              <span className="checkout-payment-copy"><b>UPI</b><small>Pay online from your UPI app</small></span>
              <span className="checkout-coming-soon">Coming soon</span>
            </div>
            <div className="checkout-payment-option unavailable" aria-disabled="true">
              <span className="checkout-payment-icon" aria-hidden="true">◷</span>
              <span className="checkout-payment-copy"><b>Pay later</b><small>Pay after your order</small></span>
              <span className="checkout-coming-soon">Coming soon</span>
            </div>
          </div>
        </section>
        <div className="cart-price-breakdown">
          {!minimumOrderMet && <p className="cart-minimum-note">Add ₹{minimumOrder - sub} more to meet the ₹{minimumOrder} minimum order.</p>}
          <div className="row between"><span>Items (GST included)</span><span>₹{sub}</span></div>
          <div className="row between cart-gst-row"><span>GST included (5%)</span><span>₹{gstIncluded}</span></div>
          {couponDisc > 0 && <div className="row between ac"><span>Voucher discount</span><span>-₹{couponDisc}</span></div>}
          <div className="row between"><span>Delivery{deliveryDistance !== null ? ` · ${deliveryDistance.toFixed(1)} km` : ''}</span>
            {freeDelivery ? <span className="delivery-waived"><s>₹{deliveryFeeBeforeDiscount}</s> <b>FREE · ₹0</b></span> : <span>₹{deliveryFee}</span>}
          </div>
          {disc > 0 && <div className="row between ac"><span>Coin discount</span><span>-₹{disc}</span></div>}
          <div className="row between"><h3>Total</h3><h3>₹{total}</h3></div>
        </div>
        {!cfg.store_online && <p className="offline-banner">{cfg.offline_message || 'Ordering is offline right now. Please try later.'}</p>}
        <motion.button className="pill wide checkout-place-order" whileTap={reduceMotion ? undefined : { scale: 0.98 }} disabled={busy || !customerName.trim() || !ph.trim() || !addr.trim() || !minimumOrderMet || deliveryDistance === null || beyondDeliveryRadius || cfg.store_online === false} onClick={place}>{busy ? <><span className="checkout-spinner" aria-hidden="true" /> Placing your COD order…</> : cfg.store_online === false ? 'Ordering unavailable' : beyondDeliveryRadius ? 'Outside delivery area' : !minimumOrderMet ? `Minimum order ₹${minimumOrder}` : deliveryDistance === null ? 'Confirm delivery location' : 'Place COD order'}</motion.button>
      </motion.div>
    </>;
}
function CustomerOrderJourney({
  order
}) {
  const events = [...(order.order_stage_events || [])].sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
  if (!events.length) return null;
  return <details className="customer-order-journey"><summary><b>ORDER JOURNEY</b><span>{events.length} updates <i aria-hidden="true">⌄</i></span></summary>{events.map((event, index) => <div className="customer-order-event" key={event.id}><i /><span><strong>{LABEL[event.stage] || event.stage.replaceAll('_', ' ')}</strong><small>{new Date(event.occurred_at).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit'
          })}{index < events.length - 1 ? ` · ${Math.max(0, Math.round((new Date(events[index + 1].occurred_at) - new Date(event.occurred_at)) / 60000))} min` : ''}</small>{event.stage === 'rejected' && event.note && <small>{event.note}</small>}</span></div>)}</details>;
}
// Order tracking and customer community components.
function History({
  me
}) {
  const cacheKey = `order-history:${me.id}`;
  const [cachedHistory] = useState(() => readOfflineCache(cacheKey) || {});
  const [rows, setRows] = useState(cachedHistory.rows || []);
  const [reviews, setReviews] = useState(cachedHistory.reviews || {});
  const [drafts, setDrafts] = useState(() => readOfflineCache(`review-drafts:${me.id}`) || {});
  const [saving, setSaving] = useState(null);
  const [feedbackError, setFeedbackError] = useState('');
  const [reviewLoadError, setReviewLoadError] = useState('');
  const [orderLoadError, setOrderLoadError] = useState('');
  useEffect(() => {
    writeOfflineCache(cacheKey, {
      rows,
      reviews
    });
  }, [cacheKey, reviews, rows]);
  useEffect(() => {
    writeOfflineCache(`review-drafts:${me.id}`, drafts);
  }, [drafts, me.id]);
  const load = useCallback(async () => {
    let result = await sb.from('orders').select('*, order_items(*), order_stage_events(*)').order('created_at', {
      ascending: false
    });
    if (result.error) result = await sb.from('orders').select('*, order_items(*)').order('created_at', {
      ascending: false
    });
    if (result.error) {
      setOrderLoadError(result.error.message);
      return;
    }
    setOrderLoadError('');
    setRows(result.data || []);
    if (me?.id) {
      const reviewResult = await sb.from('order_reviews').select('order_id,rating,feedback').eq('user_id', me.id);
      if (reviewResult.error) setReviewLoadError(reviewResult.error.message);else {
        setReviewLoadError('');
        setReviews(Object.fromEntries((reviewResult.data || []).map(review => [review.order_id, review])));
      }
    }
  }, [me?.id]);
  const submitReview = async order => {
    const draft = drafts[order.id] || {};
    if (!draft.rating) return setFeedbackError('Choose a star rating before submitting.');
    setSaving(order.id);
    setFeedbackError('');
    try {
      const {
        data,
        error
      } = await sb.from('order_reviews').insert({
        order_id: order.id,
        user_id: me.id,
        rating: draft.rating,
        feedback: (draft.feedback || '').trim() || null
      }).select('order_id,rating,feedback').single();
      if (error) setFeedbackError(error.message);else {
        setReviews(current => ({
          ...current,
          [order.id]: data
        }));
        setDrafts(current => {
          const next = {
            ...current
          };
          delete next[order.id];
          return next;
        });
      }
    } catch (error) {
      setFeedbackError(error.message || 'Could not send your feedback. Please try again.');
    } finally {
      setSaving(null);
    }
  };
  useEffect(() => {
    load();
    const ch = sb.channel('my-orders').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `user_id=eq.${me.id}`
    }, load).subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [load, me.id]);
  if (orderLoadError && !rows.length) return <div className="card" role="alert"><b>Order history could not be loaded.</b><p>{orderLoadError}</p><button className="pill" onClick={load}>Try again</button></div>;
  if (!rows.length) return <div className="empty">No orders yet. Your first delivered order starts your streak.</div>;
  return <>
    {orderLoadError && <p className="feature-offline" role="status">Showing saved order history. Reconnect to refresh status.</p>}
    {reviewLoadError && <div className="card" role="alert"><b>Ratings and reviews are unavailable.</b><p>{reviewLoadError}</p><small>Ask the administrator to run order_reviews.sql in the Supabase SQL Editor.</small><button className="pill" onClick={load}>Try again</button></div>}
    {rows.map(o => <div key={o.id} className="card">
      <div className="row between"><b>Order #{o.id}</b><span className="ac">{LABEL[o.order_stage] || LABEL[o.status] || o.status}</span></div>
      <small>{new Date(o.created_at).toLocaleString()}</small>
      {o.order_stage && !['rejected', 'cancelled'].includes(o.order_stage) && <div className="stp">{STEPS.map((s, i) => <i key={s} className={i <= STEPS.indexOf(o.order_stage) ? 'on' : ''} />)}</div>}
      <CustomerOrderJourney order={o} />
      {!['delivered', 'rejected', 'cancelled'].includes(o.order_stage || 'pending') && <small className="customer-eta">Estimated arrival around {new Date(new Date(o.created_at).getTime() + (Number(o.prep_time_minutes) || 15) * 60000 + 30 * 60000).toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit'
        })} · includes {Number(o.prep_time_minutes) || 15} minutes preparation</small>}
      {o.rejection_reason && <p className="order-rejection">{o.rejection_reason}</p>}
      {o.payment_type && <small>Paid by {o.payment_type}</small>}
      {o.order_items.map(x => <div key={x.id}>{x.item_name} x{x.qty}</div>)}
      <b>₹{o.total}</b>
      {(o.order_stage || o.status) === 'delivered' && <div className="order-feedback">
        {reviews[o.id] ? <><strong>Thanks for your feedback</strong><div className="order-feedback-stars" aria-label={`${reviews[o.id].rating} out of 5 stars`}>{Array.from({
              length: 5
            }, (_, index) => <span key={index} className={index < reviews[o.id].rating ? 'selected' : ''}>★</span>)}</div>{reviews[o.id].feedback && <small>{reviews[o.id].feedback}</small>}</> : <>
          <strong>How was this order?</strong>
          <div className="order-feedback-stars" role="group" aria-label="Rate your order">{[1, 2, 3, 4, 5].map(rating => <button type="button" key={rating} className={(drafts[o.id]?.rating || 0) >= rating ? 'selected' : ''} aria-label={`${rating} star${rating === 1 ? '' : 's'}`} aria-pressed={(drafts[o.id]?.rating || 0) === rating} onClick={() => setDrafts(current => ({
              ...current,
              [o.id]: {
                ...current[o.id],
                rating
              }
            }))}>★</button>)}</div>
          <textarea maxLength={500} value={drafts[o.id]?.feedback || ''} onChange={event => setDrafts(current => ({
            ...current,
            [o.id]: {
              ...current[o.id],
              feedback: event.target.value
            }
          }))} placeholder="Share a comment about your food or delivery (optional)" />
          <button className="admin-primary" disabled={saving === o.id} onClick={() => submitReview(o)}>{saving === o.id ? 'Sending…' : 'Send feedback'} <span>→</span></button>
          {feedbackError && <small role="alert">{feedbackError}</small>}
        </>}
      </div>}
    </div>)}
  </>;
}
function Feed({
  me,
  say,
  refreshKey
}) {
  const key = feedCacheKey(me.id);
  const [initialSnapshot] = useState(() => readOfflineCache(key));
  const [d, setD] = useState(initialSnapshot || EMPTY_FEED);
  const [txt, setTxt] = useState({});
  const [commentOpen, setCommentOpen] = useState({});
  const [loading, setLoading] = useState(!initialSnapshot);
  const [loadError, setLoadError] = useState('');
  const hasSnapshot = useRef(Boolean(initialSnapshot));
  const lastRefreshKey = useRef(refreshKey);
  const load = useCallback(async () => {
    if (!hasSnapshot.current) setLoading(true);
    setLoadError('');
    try {
      const snapshot = await fetchFeedSnapshot(me.id);
      setD(snapshot);
      hasSnapshot.current = true;
      writeOfflineCache(key, snapshot);
    } catch (error) {
      setLoadError(error.message || 'Could not load feed updates.');
      say(error.message || 'Could not load feed updates.');
    } finally {
      setLoading(false);
    }
  }, [key, me.id, say]);
  useEffect(() => {
    // Keep cached posts visible while refreshing them when the Feed opens.
    load();
  }, [load]);
  useEffect(() => {
    if (lastRefreshKey.current === refreshKey) return;
    lastRefreshKey.current = refreshKey;
    load();
  }, [load, refreshKey]);
  useEffect(() => {
    const channel = sb.channel(`customer-feed-live-${me.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_posts' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, load)
      .subscribe();
    return () => sb.removeChannel(channel);
  }, [load, me.id]);
  const vote = async (post, option) => {
    const {
      error
    } = await sb.from('poll_votes').insert({
      post_id: post,
      user_id: me.id,
      option_id: option
    });
    error ? say(error.message) : load();
  };
  const react = async (post, emoji) => {
    const mine = d.mr.some(x => x.post_id === post && x.emoji === emoji);
    const {
      error
    } = await (mine ? sb.from('reactions').delete().match({
      post_id: post,
      user_id: me.id,
      emoji
    }) : sb.from('reactions').insert({
      post_id: post,
      user_id: me.id,
      emoji
    }));
    if (error) return say(error.message);
    load();
  };
  const comment = async post => {
    const body = (txt[post] || '').trim();
    if (!body) return;
    const {
      error
    } = await sb.from('comments').insert({
      post_id: post,
      user_id: me.id,
      body
    });
    if (error) return say(error.message);
    setTxt({
      ...txt,
      [post]: ''
    });
    setCommentOpen(current => ({
      ...current,
      [post]: true
    }));
    load();
  };
  if (loading) return <section className="feed-page"><h1 className="games-eyebrow">FEED</h1><div className="feed-empty">Preparing your feed…</div></section>;
  if (!d.p.length) return <section className="feed-page"><h1 className="games-eyebrow">FEED</h1>{loadError ? <div className="feed-empty" role="alert">{loadError}<button type="button" onClick={load}>Try again</button></div> : <div className="feed-empty">No updates yet. Pull down to refresh.</div>}</section>;
  return <section className="feed-page">
    <h1 className="games-eyebrow">FEED</h1>
    {loadError && <p className="feed-load-error" role="alert">Showing saved posts. Refresh failed: {loadError}</p>}
    <div className="feed-timeline">{d.p.map(p => {
        const voted = d.mv.find(x => x.post_id === p.id);
        const votes = o => d.pr.find(x => x.option_id === o)?.votes || 0;
        const options = p.poll_options || [];
        const total = options.reduce((a, o) => a + votes(o.id), 0);
        const comments = d.cm.filter(comment => comment.post_id === p.id);
        const liked = d.mr.some(item => item.post_id === p.id && item.emoji === '❤️');
        return <article key={p.id} className="feed-post">
        <div className="feed-rail"><div className="feed-brand-avatar"><span>EAT<b>60</b></span></div><i /></div>
        <div className="feed-post-body">
          <header className="feed-author"><b>@eat60.in</b><span className="verified-badge" aria-label="Verified account">✓</span><small>{new Date(p.created_at).toLocaleDateString()}</small></header>
          <p className="feed-post-copy">{p.body}</p>
          {p.image_url && <img className="feed-post-image" src={p.image_url} alt="Feed post" loading="lazy" />}
          {p.kind === 'poll' && <div className="feed-poll">{options.map(option => {
                const percent = total ? Math.round(votes(option.id) * 100 / total) : 0;
                return voted ? <div className={`feed-poll-result${voted.option_id === option.id ? ' chosen' : ''}`} key={option.id}><i style={{
                    width: `${percent}%`
                  }} /><span>{option.label}</span><b>{percent}%</b></div> : <button className="feed-poll-option" key={option.id} onClick={() => vote(p.id, option.id)}>{option.label}<span>→</span></button>;
              })}</div>}
          <div className="feed-engagement">
            <button className={liked ? 'liked' : ''} onClick={() => react(p.id, '❤️')} aria-label={liked ? 'Unlike post' : 'Like post'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg><span>{d.rc.find(item => item.post_id === p.id && item.emoji === '❤️')?.total || 0}</span></button>
            <button onClick={() => setCommentOpen(current => ({
                ...current,
                [p.id]: !current[p.id]
              }))} aria-label="Show comments"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v13H9l-5 4V4Z" /></svg><span>{comments.length}</span></button>
            <div aria-label="Views"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg><span>{d.vc.find(item => item.post_id === p.id)?.total || 0}</span></div>
          </div>
          {commentOpen[p.id] ? <div className="feed-comments">
            {comments.slice(-3).map(item => <p className={item.parent_comment_id ? 'feed-admin-reply' : ''} key={item.id}><b>{item.parent_comment_id ? '↳ ' : ''}{item.author}{item.is_admin ? ' · EAT60' : ''}</b><span>{item.body}</span></p>)}
            <div className="feed-comment-form"><input maxLength={300} placeholder="Write a comment…" value={txt[p.id] || ''} onChange={event => setTxt({
                  ...txt,
                  [p.id]: event.target.value
                })} onKeyDown={event => {
                  if (event.key === 'Enter') comment(p.id);
                }} /><button onClick={() => comment(p.id)} aria-label="Post comment">Post</button></div>
          </div> : <button className="feed-add-comment" onClick={() => setCommentOpen(current => ({
              ...current,
              [p.id]: true
            }))}><span>＋</span> ADD A COMMENT</button>}
        </div>
      </article>;
      })}</div>
  </section>;
}
const MATH_RANKS = [{
  name: 'Bronze',
  start: 0,
  next: 10,
  color: '#d99a5b'
}, {
  name: 'Silver',
  start: 10,
  next: 25,
  color: '#c8cbd1'
}, {
  name: 'Gold',
  start: 25,
  next: 45,
  color: '#ffd34d'
}, {
  name: 'Diamond',
  start: 45,
  next: null,
  color: '#68d9ff'
}];
function rankForScore(score) {
  return MATH_RANKS.reduce((current, rank) => score >= rank.start ? rank : current, MATH_RANKS[0]);
}
function makeRankedQuestion(score) {
  const rank = rankForScore(score);
  const tier = MATH_RANKS.indexOf(rank);
  const limit = [15, 40, 120, 300][tier];
  const whole = max => 2 + Math.floor(Math.random() * Math.max(1, max - 1));
  const gcd = (x, y) => y === 0 ? x : gcd(y, x % y);
  const type = ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Square root', 'Square', 'HCF', 'LCM', 'Modulo'][Math.floor(Math.random() * 9)];
  let a, b, answer, text;
  if (type === 'Addition') {
    a = whole(limit);
    b = whole(limit);
    answer = a + b;
    text = `${a} + ${b}`;
  } else if (type === 'Subtraction') {
    a = whole(limit);
    b = whole(Math.min(limit, a));
    answer = a - b;
    text = `${a} − ${b}`;
  } else if (type === 'Multiplication') {
    const factorLimit = [10, 18, 40, 100][tier];
    a = whole(factorLimit);
    b = whole(factorLimit);
    answer = a * b;
    text = `${a} × ${b}`;
  } else if (type === 'Division') {
    b = whole([6, 12, 25, 40][tier]);
    const quotient = whole([12, 30, 80, 200][tier]);
    a = b * quotient;
    answer = quotient;
    text = `${a} ÷ ${b}`;
  } else if (type === 'Square root') {
    const root = whole(limit);
    answer = root;
    text = `√${root * root}`;
  } else if (type === 'Square') {
    a = whole(limit);
    answer = a * a;
    text = `${a}²`;
  } else if (type === 'HCF') {
    a = whole(limit);
    b = whole(limit);
    answer = gcd(a, b);
    text = `HCF(${a}, ${b})`;
  } else if (type === 'LCM') {
    a = whole(limit);
    b = whole(limit);
    answer = a / gcd(a, b) * b;
    text = `LCM(${a}, ${b})`;
  } else {
    b = whole([8, 15, 30, 60][tier]);
    a = whole(limit * 2);
    answer = a % b;
    text = `${a} mod ${b}`;
  }
  return {
    text,
    answer,
    type
  };
}
function Maths({
  onEnd,
  onQuit
}) {
  const [left, setLeft] = useState(120);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState('');
  const [answerFeedback, setAnswerFeedback] = useState('');
  const [q, setQ] = useState(() => makeRankedQuestion(0));
  const scoreRef = useRef(0);
  const endedRef = useRef(false);
  const start = useRef(Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (left === 0 && !endedRef.current) {
      endedRef.current = true;
      onEnd(scoreRef.current, Math.min(120000, Math.max(1000, Date.now() - start.current)));
    }
  }, [left, onEnd]);
  const submitAnswer = () => {
    if (!answer.trim()) return;
    if (Number(answer) === q.answer) {
      scoreRef.current++;
      setScore(scoreRef.current);
      setAnswer('');
      setAnswerFeedback('');
      setQ(makeRankedQuestion(scoreRef.current));
      return;
    }
    setAnswerFeedback('Not quite — try again. The question stays the same.');
  };
  const typeDigit = key => {
    if (key === 'back') return setAnswer(current => current.slice(0, -1));
    if (key === 'clear') return setAnswer('');
    setAnswer(current => current.length < 7 ? current + key : current);
  };
  const tier = rankForScore(score);
  const tierIndex = MATH_RANKS.indexOf(tier);
  const progress = tier.next ? Math.min(100, (score - tier.start) / (tier.next - tier.start) * 100) : 100;
  const timeLabel = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return <div className="maths-round" style={{
    '--tier-color': tier.color
  }}>
      <div className="maths-topbar">
        <div className="maths-player"><button className="game-exit" onClick={onQuit} aria-label="Exit game">←</button><span>🧠</span><div><b>QUICK MATHS</b><small>{tier.name} · {score} correct</small></div></div>
        <div className="maths-timer" aria-live="polite">{timeLabel}</div>
      </div>
      <div className="maths-tier"><div className="maths-tier-label"><b>{tier.name.toUpperCase()}</b><span>{tierIndex + 1} / 4 RANKS</span></div><div className="maths-tier-track"><i style={{
          width: `${progress}%`
        }} /></div><small>{tier.next ? `${tier.next - score} correct answers to ${MATH_RANKS[tierIndex + 1].name}` : 'Top rank reached — keep scoring!'}</small></div>
      <div className="maths-question-area">
        <small>{q.type.toUpperCase()} · ANSWER THE QUESTION</small>
        <h1 className="math-question">{q.text}</h1>
        <form onSubmit={event => {
        event.preventDefault();
        submitAnswer();
      }}>
          <input className="math-answer" type="text" inputMode="none" autoComplete="off" aria-label="Your answer" placeholder="Type your answer" value={answer} onChange={event => {
          setAnswer(event.target.value.replace(/\D/g, '').slice(0, 7));
          setAnswerFeedback('');
        }} />
        </form>
        {answerFeedback && <p className="math-answer-feedback" role="status">{answerFeedback}</p>}
      </div>
      <div className="math-keypad" aria-label="Number keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map(key => <button key={key} className={key === 'back' ? 'math-backspace' : ''} onClick={() => typeDigit(key)} aria-label={key === 'back' ? 'Backspace' : key === '.' ? 'Decimal point' : key}>
            {key === 'back' ? '⌫' : key === 'clear' ? 'C' : key}
          </button>)}
      </div>
      <button className="math-submit" onClick={submitAnswer} disabled={!answer.trim()}>SUBMIT ANSWER <span>↗</span></button>
    </div>;
}
// Games, score history, leaderboard, and wallet components.
function Games({
  reload,
  say,
  me,
  initialView,
  onFocus = () => {},
  onViewChange = () => {},
  onRequestQuit,
  quitRef,
  onAnnounce
}) {
  const leaderboardKey = `leaderboard:${me.id}`;
  const [playing, setPlaying] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [lb, setLb] = useState(() => readOfflineCache(leaderboardKey) || []);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [rank, setRank] = useState(() => readOfflineCache(leaderboardKey)?.find(row => row.is_me)?.rank ?? null);
  const sessionId = useRef(null);
  const [view, setView] = useState(initialView || 'games');
  const games = [{
    id: 'snake',
    title: 'Hungry Snakes',
    subtitle: 'Improve rank, earn rewards & coins',
    icon: '🐍',
    color: 'snake'
  }, {
    id: 'burger',
    title: 'Flying Burger',
    subtitle: 'Improve rank, earn rewards & coins',
    icon: '🍔',
    color: 'burger'
  }, {
    id: 'qmaths',
    title: 'Quick Maths',
    subtitle: 'Improve rank, earn rewards & coins',
    icon: '🧮',
    color: 'maths'
  }, {
    id: 'rider',
    title: 'Rider Rush',
    subtitle: 'Deliver orders, dodge traffic & climb the league',
    icon: '🛵',
    color: 'rider'
  }];
  useEffect(() => setView(initialView || 'games'), [initialView]);
  useEffect(() => {
    if (countdown === null) return;
    const timer = setInterval(() => setCountdown(n => {
      if (n <= 1) {
        clearInterval(timer);
        return null;
      }
      return n - 1;
    }), 1000);
    return () => clearInterval(timer);
  }, [countdown]);
  const loadLb = async () => {
    const {
      data,
      error
    } = await sb.rpc('get_leaderboard');
    if (error) return say(error.message);
    setLb(data || []);
    writeOfflineCache(leaderboardKey, data || []);
    setRank(data?.find(row => row.is_me)?.rank ?? null);
  };
  useEffect(() => {
    loadLb();
  }, []);
  const finish = async (game, score) => {
    const currentSessionId = sessionId.current;
    sessionId.current = null;
    if (!currentSessionId) {
      const error = new Error('Game session missing. Please start a new game.');
      say(error.message);
      return {
        error
      };
    }
    setBusy(true);
    try {
      const {
        data,
        error
      } = await sb.rpc('submit_game_score', {
        p_session_id: currentSessionId,
        p_score: score
      });
      if (error) {
        say(error.message);
        return {
          error
        };
      }
      setRes({
        game,
        score,
        ...data
      });
      reload();
      loadLb();
      onAnnounce?.({
        type: 'game-score',
        title: 'That score is in!',
        message: `You earned ${Number(data?.xp) || 0} XP and ${(Number(data?.coins) || 0).toLocaleString('en-IN')} coins.`
      });
      return {
        data
      };
    } catch (error) {
      const submissionError = error instanceof Error ? error : new Error('Could not save your game score.');
      say(submissionError.message);
      return {
        error: submissionError
      };
    } finally {
      setBusy(false);
    }
  };
  const startGame = async id => {
    if (!navigator.onLine) return say('Connect to the internet before starting a game so your score and rewards can be saved.');
    setRes(null);
    setStarting(true);
    const {
      data,
      error
    } = await sb.rpc('start_game_session', {
      p_game: id
    });
    setStarting(false);
    if (error) return say(error.message);
    sessionId.current = data;
    setPlaying(id);
    setCountdown(null);
    onFocus(true);
  };
  const quitGame = () => {
    sessionId.current = null;
    setPlaying(null);
    setCountdown(null);
    onFocus(false);
  };
  const requestQuitGame = () => onRequestQuit();
  quitRef.current = quitGame;
  const changeView = nextView => {
    setView(nextView);
    onViewChange(nextView);
  };
  if (countdown !== null) return <div className="game-countdown-screen"><button onClick={requestQuitGame} aria-label="Leave game">×</button><small>GET READY</small><h1>{countdown}</h1><p>{games.find(game => game.id === playing)?.title}</p></div>;
  if (playing) {
    const currentGame = playing;
    const finishIntegratedGame = async result => {
      await finish(currentGame, result.score);
      setPlaying(null);
      onFocus(false);
    };
    const shared = {
      config: { XP_MAX_PER_PLAY: 0, COINS_PER_PLAY: 0 },
      onGameEnd: finishIntegratedGame
    };
    const gameSurface = playing === 'snake' ? <HungrySnakes {...shared} />
      : playing === 'burger' ? <FlyingBurger {...shared} />
      : playing === 'qmaths' ? <QuickMathGame {...shared} />
      : playing === 'rider' ? <RiderRush {...shared} />
      : null;
    if (gameSurface) return <div className={`integrated-game-surface ${playing}`}>
      <button className="integrated-game-exit" type="button" onClick={requestQuitGame} aria-label="Leave game">← <span>Exit</span></button>
      {gameSurface}
    </div>;
  }
  const daysLeft = 7 - new Date().getDay();
  if (view === 'rankings') return <WeeklyLeague rows={lb} daysLeft={daysLeft || 7} onBack={() => changeView('games')} />;
  if (view === 'scores') return <MyGameScores me={me} onBack={() => changeView('games')} />;
  return <section className="games-page">
      <header className="games-hero">
        <div><p className="games-eyebrow">GAMES</p><h2>GETTING BORED?<br /><span>TIRED OF DOOM SCROLLING?</span></h2></div>
        <button className="rank-display" onClick={() => changeView('rankings')} aria-label="Open weekly league standings"><b>#{rank ?? '—'}</b><span>RANK <small>VIEW LEAGUE ↗</small></span></button>
        <div className="week-pill">◷ &nbsp; {daysLeft || 7} DAYS LEFT THIS WEEK</div>
      </header>
      <div className="game-hub-links">
        <button onClick={() => changeView('rankings')}><span className="hub-link-icon rank">♜</span><span><b>WEEKLY RANKINGS</b><small>See your league position</small></span><strong>#{rank ?? '—'} →</strong></button>
        <button onClick={() => changeView('scores')}><span className="hub-link-icon score">✦</span><span><b>MY SCORES & BADGES</b><small>Personal bests and achievements</small></span><strong>{me?.xp ?? 0} XP →</strong></button>
      </div>
      <h3 className="games-list-title">PLAY THESE GAMES</h3>
      {res && <div className="game-result"><b>{games.find(game => game.id === res.game)?.title}: {res.score}</b><span>+{res.xp} XP · +{res.coins} coins</span></div>}
      {busy && <p className="game-saving">Saving your score…</p>}
      {starting && <p className="game-saving">Starting a secure game session…</p>}
      <div className="games-list">
        {games.map((game, index) => <button key={game.id} className={`game-card ${game.color}`} disabled={busy || starting} onClick={() => startGame(game.id)}>
            <span className="game-card-number">GAME {String(index + 1).padStart(2, '0')}</span>
            <span className="game-card-copy"><b>{game.title}</b><small>{game.subtitle}</small><span className="game-card-play">PLAY NOW <i>→</i></span></span>
            <span className="game-card-art">{game.icon}</span>
          </button>)}
      </div>
    </section>;
}
function MyGameScores({
  me,
  onBack
}) {
  const cacheKey = `game-scores:${me.id}`;
  const [cachedScores] = useState(() => readOfflineCache(cacheKey));
  const [scores, setScores] = useState(cachedScores?.scores || []);
  const [roundCount, setRoundCount] = useState(cachedScores?.roundCount || 0);
  const [loading, setLoading] = useState(!cachedScores);
  const [error, setError] = useState('');
  useEffect(() => {
    sb.from('game_scores').select('game,score,xp,played_at', {
      count: 'exact'
    }).order('played_at', {
      ascending: false
    }).limit(250).then(({
      data,
      count,
      error: queryError
    }) => {
      if (queryError) {
        setError(queryError.message);
      } else {
        const nextScores = data || [];
        const nextCount = count || 0;
        setScores(nextScores);
        setRoundCount(nextCount);
        writeOfflineCache(cacheKey, {
          scores: nextScores,
          roundCount: nextCount
        });
        setError('');
      }
      setLoading(false);
    });
  }, [cacheKey]);
  const best = game => Math.max(0, ...scores.filter(score => score.game === game).map(score => score.score));
  const playedGames = new Set(scores.map(score => score.game));
  const mathAnswers = scores.filter(score => score.game === 'qmaths').reduce((sum, score) => sum + score.score, 0);
  const badges = [{
    icon: '🚀',
    title: 'First round',
    detail: 'Play your first game',
    unlocked: roundCount > 0
  }, {
    icon: '🐍',
    title: 'Snake charmer',
    detail: 'Score 50 in Hungry Snakes',
    unlocked: best('snake') >= 50
  }, {
    icon: '🍔',
    title: 'Burger catcher',
    detail: 'Score 50 in Flying Burger',
    unlocked: best('burger') >= 50
  }, {
    icon: '🧠',
    title: 'Quick thinker',
    detail: 'Answer 25 Quick Maths questions',
    unlocked: mathAnswers >= 25
  }, {
    icon: '🛵',
    title: 'Rush hour rider',
    detail: 'Deliver 50 orders in Rider Rush',
    unlocked: best('rider') >= 50
  }, {
    icon: '🎮',
    title: 'All-rounder',
    detail: 'Try all four games',
    unlocked: playedGames.size >= 4
  }, {
    icon: '🏆',
    title: 'XP collector',
    detail: 'Earn 500 game XP',
    unlocked: (me?.xp || 0) >= 500
  }];
  const gameNames = {
    snake: 'Hungry Snakes',
    burger: 'Flying Burger',
    qmaths: 'Quick Maths',
    rider: 'Rider Rush'
  };
  return <section className="scores-page">
      <FloatingBack onClick={onBack} label="Back to games" />
      <header className="scores-header"><div><p>PLAYER PROFILE</p><h1>MY SCORES</h1></div><span className="scores-header-icon">✦</span></header>
      <div className="scores-summary">
        <article><small>TOTAL GAME XP</small><b>{me?.xp ?? 0}</b></article>
        <article><small>ROUNDS PLAYED</small><b>{roundCount}</b></article>
        <article><small>BADGES EARNED</small><b>{badges.filter(badge => badge.unlocked).length}<i> / {badges.length}</i></b></article>
      </div>
      <div className="achievement-heading"><div><p>COLLECT THEM ALL</p><h2>Achievement badges</h2></div><span>🏅</span></div>
      <div className="achievement-grid">{badges.map(badge => <article key={badge.title} className={`achievement-badge${badge.unlocked ? ' earned' : ''}`}><span>{badge.icon}</span><b>{badge.title}</b><small>{badge.detail}</small><i>{badge.unlocked ? 'UNLOCKED' : 'LOCKED'}</i></article>)}</div>
      <div className="score-history-heading"><div><p>YOUR RECENT PLAY</p><h2>Score history</h2></div><small>Last {Math.min(scores.length, 250)} rounds</small></div>
      {loading && <p className="score-empty">Loading your scores…</p>}
      {error && <p className="score-error">{error}</p>}
      {!loading && !error && scores.length === 0 && <p className="score-empty">Your scores will appear here after your first game.</p>}
      <div className="score-history">{scores.slice(0, 15).map((score, index) => <article className="score-history-row" key={`${score.played_at}-${index}`}><span className={`score-history-icon ${score.game}`}>{score.game === 'snake' ? '🐍' : score.game === 'burger' ? '🍔' : score.game === 'rider' ? '🛵' : '🧮'}</span><div><b>{gameNames[score.game] || score.game}</b><small>{new Date(score.played_at).toLocaleString()}</small></div><strong>{score.score} <small>PTS</small></strong><span className="score-xp">+{score.xp} XP</span></article>)}</div>
    </section>;
}
function WeeklyLeague({
  rows,
  daysLeft,
  onBack
}) {
  const [showRankUpdate, setShowRankUpdate] = useState(false);
  const me = rows.find(row => row.is_me);
  useEffect(() => {
    if (!me || me.previous_rank == null || Number(me.previous_rank) === Number(me.rank)) return;
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
    const key = `eat60:rank-update:${weekStart.toLocaleDateString('en-CA')}:${me.previous_rank}:${me.rank}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, 'shown');
    setShowRankUpdate(true);
  }, [me?.rank, me?.previous_rank]);
  const boundary = Math.max(1, Math.ceil(rows.length / 2));
  const demotionStart = Math.max(boundary, rows.length - Math.max(1, Math.ceil(rows.length / 3)));
  const movement = row => {
    if (row.previous_rank == null) return {
      text: 'NEW',
      type: 'new'
    };
    const change = Number(row.previous_rank) - Number(row.rank);
    if (change > 0) return {
      text: `↑ ${change}`,
      type: 'up'
    };
    if (change < 0) return {
      text: `↓ ${Math.abs(change)}`,
      type: 'down'
    };
    return {
      text: '—',
      type: 'same'
    };
  };
  return <>
    <section className="league-page">
      <header className="league-header">
        <FloatingBack onClick={onBack} label="Back to games" />
        <div className="league-countdown">◷ <b>{daysLeft} days left</b></div>
      </header>
      <div className="league-emblem"><span>#{me?.rank ?? '—'}</span></div>
      <h1 className="league-title">WEEKLY LEAGUE</h1>
      {me && <p className="league-your-rank">YOU ARE RANKED <b>#{me.rank}</b> · <strong className={`movement ${movement(me).type}`}>{movement(me).text} THIS WEEK</strong></p>}
      <p className="league-prize-rules">Weekly prizes: 1st 500 · 2nd 300 · 3rd 200 · ranks 4–10 100 coins. Only your best 3 plays per day count.</p>
      <div className="league-rule" />
      <div className="league-standings">
        {rows.map((row, index) => <Fragment key={`${row.rank}-${row.name}`}>
          {index === boundary && <div className="league-zone promotion">⌃ &nbsp; PROMOTION ZONE &nbsp; ⌃</div>}
          {index === demotionStart && index > boundary && <div className="league-zone relegation">⌄ &nbsp; DEMOTION ZONE &nbsp; ⌄</div>}
          <div className={`league-row${row.is_me ? ' is-me' : ''}`}>
            <span className={`league-position pos-${row.rank}`}>{row.rank}</span>
            <span className="league-avatar">{String(row.name || '?').slice(0, 1).toUpperCase()}</span>
            <b className="league-name">{row.name}{row.is_me ? ' · YOU' : ''}</b>
            <strong className="league-xp">{row.xp} XP</strong>
            <span className={`movement ${movement(row).type}`}>{row.rank <= 3 ? `${[500, 300, 200][row.rank - 1]} 🪙` : row.rank <= 10 ? '100 🪙' : movement(row).text}</span>
          </div>
        </Fragment>)}
        {rows.length === 0 && <div className="league-empty">No weekly scores yet. Play a game to enter the league.</div>}
      </div>
    </section>
    {showRankUpdate && me && <div className="rank-update-screen" role="dialog" aria-modal="true" aria-labelledby="rank-update-title">
      <div className="reward-screen-rays" aria-hidden="true" />
      <div className={`rank-update-emblem${Number(me.previous_rank) > Number(me.rank) ? ' improved' : ' declined'}`}><span>{Number(me.previous_rank) > Number(me.rank) ? '↑' : '↓'}</span></div>
      <p className="rank-update-kicker">WEEKLY LEAGUE UPDATE</p>
      <h2 id="rank-update-title">Your rank changed</h2>
      <p className="rank-update-movement"><s>#{me.previous_rank}</s><span>→</span><b>#{me.rank}</b></p>
      <p className="rank-update-caption">{Number(me.previous_rank) > Number(me.rank) ? `You climbed ${Number(me.previous_rank) - Number(me.rank)} ${Number(me.previous_rank) - Number(me.rank) === 1 ? 'place' : 'places'}! Keep it up.` : `You moved down ${Number(me.rank) - Number(me.previous_rank)} ${Number(me.rank) - Number(me.previous_rank) === 1 ? 'place' : 'places'}. Play a game to climb back.`}</p>
      <button className="reward-claim-primary rank-update-button" onClick={() => setShowRankUpdate(false)}>LET’S GO</button>
    </div>}
    </>;
}
function FlameAnimation() {
  const id = useId();
  const outer = `flame-outer-${id}`;
  const inner = `flame-inner-${id}`;
  return <svg className="animated-flame" viewBox="0 0 64 80" aria-hidden="true">
    <defs>
      <linearGradient id={outer} x1=".2" y1="1" x2=".8" y2="0"><stop stopColor="#ff3d16" /><stop offset=".58" stopColor="#ff8a22" /><stop offset="1" stopColor="#ffd64d" /></linearGradient>
      <linearGradient id={inner} x1=".4" y1="1" x2=".6" y2="0"><stop stopColor="#ffbd35" /><stop offset="1" stopColor="#fff3a1" /></linearGradient>
    </defs>
    <g className="flame-flicker"><path fill={`url(#${outer})`} d="M34 2c3 16-9 19-4 31C21 27 24 18 18 12 17 27 3 37 5 54c1 15 12 24 27 24s27-11 27-27C59 34 43 22 34 2Z" /><path fill={`url(#${inner})`} d="M35 35c1 9-6 12-4 19-5-3-6-8-9-10-5 13 1 25 11 25 9 0 15-7 14-16-1-7-6-11-12-18Z" /><path fill="#fff5bf" d="M34 53c-5 6-4 12 1 15 5-3 7-8 3-14l-2-4Z" opacity=".95" /></g>
  </svg>;
}
function Wallet({
  me,
  onBack
}) {
  return <section className="wallet-page">
    <FloatingBack onClick={onBack} label="Back to home" />
    <header className="wallet-header"><span>MY WALLET</span><i><CoinIcon /></i></header>
    <div className="wallet-balance"><small>AVAILABLE BALANCE</small><b><CoinIcon /> {me.coins} <span>COINS</span></b><p>Your EAT60 rewards balance</p></div>
    <div className="wallet-coming"><span className="wallet-orbit"><CoinIcon /></span><p>COMING SOON</p><h1>Your wallet is getting ready</h1><small>We’re preparing new ways to use your coins. Your balance is safe and will be ready here soon.</small></div>
    <div className="wallet-footer"><span>COINS EARNED THROUGH EAT60</span><span>100 coins = ₹1 reward value</span></div>
  </section>;
}
// Account tools, referrals, support, and public information pages.
function MoreIcon({
  name
}) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  const icon = {
    rewards: <><path d="M6 4h12v17l-6-3-6 3V4Z" /><path d="m9 10 2 2 4-4" /></>,
    ranks: <><circle cx="12" cy="8" r="5" /><path d="m8.5 12-1 9 4.5-2.5 4.5 2.5-1-9" /><path d="m10 8 1.4 1.4L14 7" /></>,
    coupons: <><path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z" /><path d="M13 7v2m0 3v2m0 3v1" /></>,
    scorecard: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 16v-3m4 3V8m4 8v-5" /></>,
    refer: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2" /></>,
    socials: <><path d="M20 11.5a7.5 7.5 0 0 1-11.4 6.4L4 19l1.1-4.1A7.5 7.5 0 1 1 20 11.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
    about: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="12" width="4" height="7" rx="2" /><rect x="17" y="12" width="4" height="7" rx="2" /><path d="M17 19a5 5 0 0 1-5 3h-1" /></>,
    bugs: <><path d="M9 9h6a3 3 0 0 1 3 3v5a6 6 0 0 1-12 0v-5a3 3 0 0 1 3-3Z" /><path d="m9 9 1-3h4l1 3M3 12h3m12 0h3M4 18h3m10 0h3m-12-9L6 6m12 3 2-3m-8 3V4" /></>,
    rate: <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9L12 3Z" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v3h14v-3" /></>,
    edit: <><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" /><path d="m11 13 8-8 3 3-8 8-4 1 1-4Z" /></>
  };
  return <svg {...props}>{icon[name] || icon.about}</svg>;
}
function More({
  me,
  email,
  reload,
  go,
  goGames,
  say,
  initialPage,
  onNavigatePath,
  onSelectVoucher,
  installAvailable,
  installMessage,
  socialLinks,
  supportPhone,
  onAnnounce
}) {
  const [rewards, setRewards] = useState([]);
  const [claimedRewards, setClaimedRewards] = useState([]);
  const [claimedRewardVouchers, setClaimedRewardVouchers] = useState({});
  const [pendingCoinClaims, setPendingCoinClaims] = useState([]);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponLoadError, setCouponLoadError] = useState('');
  const [claiming, setClaiming] = useState(null);
  const [rewardMessage, setRewardMessage] = useState('');
  const [celebration, setCelebration] = useState(null);
  const [claimPrompt, setClaimPrompt] = useState(null);
  const [editing, setEditing] = useState(initialPage === 'profile');
  const [subPage, setSubPage] = useState(initialPage && initialPage !== 'profile' ? initialPage : null);
  useEffect(() => {
    setEditing(initialPage === 'profile');
    setSubPage(initialPage && initialPage !== 'profile' ? initialPage : null);
  }, [initialPage]);
  const openProfile = () => {
    setEditing(true);
    setSubPage(null);
    onNavigatePath('profile');
  };
  const openMorePage = page => {
    setEditing(false);
    setSubPage(page);
    onNavigatePath(page);
  };
  const backToMore = () => openMorePage(null);
  useEffect(() => {
    let active = true;
    const loadRewards = async () => {
      const [catalogResult, ownedResult, couponsResult] = await Promise.all([sb.rpc('customer_streak_rewards'), sb.from('user_rewards').select('milestone,claimed,coin_reward,coupon_code').order('milestone'), sb.rpc('customer_available_coupons')]);
      let catalog = catalogResult;
      if (catalog.error?.code === 'PGRST202' || catalog.error?.code === '42883') {
        catalog = await sb.from('streak_rewards').select('milestone,gift,coin_reward,is_active').eq('is_active', true).order('milestone');
        catalog = {
          ...catalog,
          data: (catalog.data || []).map(reward => ({
            ...reward,
            has_voucher: false
          }))
        };
      }
      let owned = ownedResult;
      if (owned.error?.code === '42703' || owned.error?.code === 'PGRST204') {
        owned = await sb.from('user_rewards').select('milestone,claimed,coin_reward').order('milestone');
      }
      if (!active) return;
      setRewards(catalog.data || []);
      setClaimedRewards((owned.data || []).filter(reward => reward.claimed).map(reward => reward.milestone));
      setClaimedRewardVouchers(Object.fromEntries((owned.data || []).filter(reward => reward.claimed && reward.coupon_code).map(reward => [reward.milestone, reward.coupon_code])));
      const configuredCoinRewards = new Map((catalog.data || []).map(reward => [reward.milestone, Number(reward.coin_reward) || 0]));
      setPendingCoinClaims((owned.data || []).filter(reward => reward.claimed && Number(reward.coin_reward) === 0 && (configuredCoinRewards.get(reward.milestone) || 0) > 0).map(reward => reward.milestone));
      const setupRequired = catalog.error || owned.error;
      if (setupRequired) setRewardMessage(`${setupRequired.message} Apply admin_ads_rewards.sql in Supabase, then refresh the API schema cache.`);
      if (couponsResult.error) setCouponLoadError(couponsResult.error.message);else setAvailableCoupons(couponsResult.data || []);
    };
    loadRewards();
    return () => {
      active = false;
    };
  }, []);
  const claimReward = async milestone => {
    setClaiming(milestone);
    setRewardMessage('');
    const {
      data,
      error
    } = await sb.rpc('claim_streak_reward', {
      p_milestone: milestone
    });
    setClaiming(null);
    if (error) return setRewardMessage(error.message);
    setClaimedRewards(current => [...new Set([...current, milestone])]);
    if (data?.coupon_code) {
      setClaimedRewardVouchers(current => ({
        ...current,
        [milestone]: data.coupon_code
      }));
      const voucherResult = await sb.rpc('customer_available_coupons');
      if (voucherResult.error) setCouponLoadError(voucherResult.error.message);else setAvailableCoupons(voucherResult.data || []);
    }
    setPendingCoinClaims(current => current.filter(value => value !== milestone));
    const gift = rewards.find(reward => reward.milestone === milestone)?.gift || 'Streak reward';
    setClaimPrompt(null);
    setCelebration({
      milestone,
      gift,
      coins: Number(data?.coins_awarded) || 0,
      couponCode: data?.coupon_code || null
    });
    await reload();
  };
  if (editing) return <ProfileEditor me={me} email={email} reload={reload} onBack={backToMore} />;
  const tiles = {
    Funzone: [['rewards', 'Rewards'], ['ranks', 'Ranks'], ['coupons', 'Coupons'], ['scorecard', 'Scorecard']],
    Community: [['refer', 'Refer'], ['socials', 'Socials'], ['about', 'About']],
    'Setting & Supports': [['support', 'Supports'], ['bugs', 'Report bugs'], ['rate', 'Rate us'], ['download', installAvailable ? 'Install app' : 'Download app']]
  };
  const action = async id => {
    if (id === 'rewards') return openMorePage('rewards');
    if (id === 'ranks') return goGames('rankings');
    if (id === 'scorecard') return goGames('scores');
    if (id === 'coupons') return openMorePage('coupons');
    if (id === 'refer') return openMorePage('refer');
    if (id === 'rate') {
      say('Thanks for supporting EAT60!');
      return;
    }
    openMorePage(id);
  };
  const journey = <section className="streak-journey">
    <div className="streak-journey-head"><div><p>YOUR REWARDS PATH</p><h3>Streak achievements</h3><small>{me.streak} day current streak · {me.longest_streak || me.streak} day best</small></div><span className="streak-flame"><FlameAnimation /></span></div>
    <p className="streak-journey-note">Keep an order streak going. A day counts when an order is delivered.</p>
    <div className="streak-track">
      {rewards.map(reward => {
        const claimed = claimedRewards.includes(reward.milestone);
        const pendingCoins = pendingCoinClaims.includes(reward.milestone);
        const reached = (me.longest_streak || me.streak) >= reward.milestone;
        return <article key={reward.milestone} className={`streak-reward${claimed && !pendingCoins ? ' is-claimed' : reached ? ' is-ready' : ''}`}>
          <span className="streak-marker">{claimed ? '✓' : reached ? '!' : <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>}</span>
          <div className="streak-reward-card">
            <div className="streak-reward-art" aria-hidden="true">{claimed ? '🎁' : reward.milestone <= 30 ? '✨' : '🎁'}</div>
            <div className="streak-reward-copy"><span className="streak-day">DAY {reward.milestone}</span><b>{reward.gift}</b>{Number(reward.coin_reward) > 0 && <small>🪙 {Number(reward.coin_reward)} coins</small>}{reward.has_voucher && <small>🎟 Voucher reward</small>}<small>{claimed ? 'Reward claimed' : reached ? 'Goal reached — claim your reward' : `${Math.max(0, reward.milestone - me.streak)} more streak days to unlock`}</small></div>
            {claimed && !pendingCoins ? <div className="streak-status-actions"><span className="streak-status">CLAIMED</span>{claimedRewardVouchers[reward.milestone] && <button className="streak-claim" onClick={() => onSelectVoucher(claimedRewardVouchers[reward.milestone])}>USE VOUCHER</button>}</div> : reached ? <button className="streak-claim" onClick={() => setClaimPrompt(reward)}>{claiming === reward.milestone ? 'CLAIMING…' : pendingCoins ? 'CLAIM COINS' : 'CLAIM REWARD'}</button> : <span className="streak-locked">LOCKED</span>}
          </div>
        </article>;
      })}
    </div>
    {rewardMessage && <p className="streak-message" role="status">{rewardMessage}</p>}
  </section>;
  const celebrationPopup = celebration && <div className="claim-celebration" role="presentation" onClick={() => setCelebration(null)}>
    <div className="claim-confetti" aria-hidden="true">{Array.from({
        length: 30
      }, (_, index) => <i key={index} style={{
        '--confetti-x': `${index * 37 % 100}%`,
        '--confetti-delay': `${index % 9 * -0.17}s`,
        '--confetti-spin': `${index * 71 % 300}deg`
      }} />)}</div>
    <section className="claim-celebration-card" role="dialog" aria-modal="true" aria-labelledby="claim-celebration-title" onClick={event => event.stopPropagation()}>
      <button className="claim-celebration-close" onClick={() => setCelebration(null)} aria-label="Close celebration">×</button>
      <div className="claim-celebration-flame"><FlameAnimation /></div>
      <p className="claim-celebration-kicker">STREAK MILESTONE · DAY {celebration.milestone}</p>
      <h2 id="claim-celebration-title">You earned it!</h2>
      <p className="claim-celebration-gift">{celebration.gift}</p>
      <p className="claim-celebration-note">{celebration.coins > 0 ? `${celebration.coins} coins have been added to your wallet.` : 'Your reward is claimed. Show this screen to the team when you redeem it.'}</p>
      {celebration.couponCode && <button className="claim-celebration-done claim-use-voucher" onClick={() => {
        setCelebration(null);
        onSelectVoucher(celebration.couponCode);
      }}>USE {celebration.couponCode} AT CHECKOUT <span>→</span></button>}
      <button className="claim-celebration-done" onClick={() => setCelebration(null)}>LET’S GO <span>✦</span></button>
    </section>
  </div>;
  const claimPromptPopup = claimPrompt && <div className="reward-claim-screen" role="presentation">
    <div className="reward-screen-rays" aria-hidden="true" />
    <div className="reward-claim-badge" aria-hidden="true"><span>{claimPrompt.milestone}</span><FlameAnimation /></div>
    <p className="reward-claim-caption">DAYS CONSISTENT</p>
    <div className="reward-claim-copy"><small>{pendingCoinClaims.includes(claimPrompt.milestone) ? 'WALLET COINS AVAILABLE' : 'STREAK REWARD UNLOCKED'}</small><h1>Day {claimPrompt.milestone}</h1><b>{claimPrompt.gift}</b>{Number(claimPrompt.coin_reward) > 0 && <p>🪙 {Number(claimPrompt.coin_reward)} coins will be added to your wallet</p>}</div>
    <div className="reward-claim-actions">
      <button className="reward-claim-primary" disabled={claiming === claimPrompt.milestone} onClick={() => claimReward(claimPrompt.milestone)}>{claiming === claimPrompt.milestone ? 'CLAIMING…' : pendingCoinClaims.includes(claimPrompt.milestone) ? 'CLAIM COINS' : 'CLAIM REWARD'}</button>
      <button className="reward-claim-later" onClick={() => setClaimPrompt(null)}>LATER</button>
      {rewardMessage && <p role="alert">{rewardMessage}</p>}
    </div>
  </div>;
  const voucherSection = <section className="customer-vouchers">
    <div className="admin-section-heading"><div><p>OFFERS FOR YOU</p><h3>Available vouchers</h3></div></div>
    {couponLoadError ? <p className="admin-inline-error" role="alert">{couponLoadError}</p> : availableCoupons.length === 0 ? <p className="mu">There are no available vouchers right now.</p> : <div className="customer-voucher-list">{availableCoupons.map(voucher => <article className="customer-voucher" key={voucher.code}>
        <div><b>{voucher.code}</b><p>{voucher.description || `${voucher.discount_value}${voucher.discount_type === 'percent' ? '%' : '₹'} off`} · minimum order ₹{voucher.minimum_order}{voucher.maximum_discount ? ` · up to ₹${voucher.maximum_discount}` : ''}</p>{voucher.expires_at && <small>Expires {new Date(voucher.expires_at).toLocaleDateString('en-IN')}</small>}</div>
        <button className="pill" onClick={() => onSelectVoucher(voucher.code)}>Use voucher</button>
      </article>)}</div>}
  </section>;
  if (subPage === 'rewards') return <><FloatingBack onClick={backToMore} label="Back to More" /><section className="more-subpage"><header className="more-subpage-header"><h1>REWARDS</h1><span /></header>{voucherSection}{journey}</section>{celebrationPopup}{claimPromptPopup}</>;
  if (subPage === 'coupons') return <><FloatingBack onClick={backToMore} label="Back to More" /><section className="more-subpage"><header className="more-subpage-header"><h1>VOUCHERS</h1><span /></header>{voucherSection}</section></>;
  if (subPage === 'about') return <AboutPage onBack={backToMore} />;
  if (subPage === 'refer') return <ReferralPage me={me} reload={reload} onBack={backToMore} say={say} onAnnounce={onAnnounce} />;
  if (subPage === 'socials') return <SocialsPage socialLinks={socialLinks} onBack={backToMore} />;
  if (subPage === 'support' || subPage === 'bugs') return <SupportPage socialLinks={socialLinks} supportPhone={supportPhone} onBack={backToMore} onHistory={() => go('hist')} onCareers={() => openMorePage('careers')} onComplaint={() => openMorePage('bugs')} complaint={subPage === 'bugs'} />;
  if (subPage === 'careers') return <CareersPage onBack={backToMore} />;
  if (subPage && subPage !== 'rewards') {
    return <><FloatingBack onClick={backToMore} label="Back to More" /><section className="more-subpage"><header className="more-subpage-header"><h1>{subPage.toUpperCase()}</h1><span /></header></section></>;
  }
  return <>
      <section className="more-dashboard">
        <h1 className="more-title">MORE</h1>
        <section className="more-profile-hero">
          <div className="more-profile-row"><span>UPDATE</span><button className="more-profile-avatar" onClick={openProfile} aria-label="Update profile"><ProfileAvatar avatarId={me.avatar_id} /></button><span>PROFILE</span></div>
          <div className="more-profile-name"><b>{me.username || me.name || 'User Name'}</b><button onClick={openProfile} aria-label="Edit profile"><MoreIcon name="edit" /></button></div>
        </section>
        {Object.entries(tiles).map(([group, items]) => <section className="more-tile-section" key={group}><h2>{group.toUpperCase()}</h2><div className={`more-tiles more-tiles-${items.length}`}>{items.map(([id, label]) => id === 'download' ? <a className="more-tile" href="/download" key={id}><span className={`more-tile-icon icon-${id}`}><MoreIcon name={id} /></span><b>{label.toUpperCase()}</b></a> : <button className="more-tile" key={id} onClick={() => action(id)}><span className={`more-tile-icon icon-${id}`}><MoreIcon name={id} /></span><b>{label.toUpperCase()}</b></button>)}</div>{group === 'Setting & Supports' && installMessage && <p className="more-install-message" role="status">{installMessage}</p>}</section>)}
        <section className="more-account-actions"><div><b>{me.xp} XP</b><span>{me.coins} coins · {email}</span></div><div><button className="pill g" onClick={() => sb.auth.signOut()}>LOG OUT</button></div></section>
      </section>
      {celebrationPopup}
      {claimPromptPopup}
    </>;
}
function ReferralPage({
  me,
  reload,
  onBack,
  say,
  onAnnounce
}) {
  const cacheKey = `referral:${me.id}`;
  const codeCacheKey = `referral-code-draft:${me.id}`;
  const [dashboard, setDashboard] = useState(() => readOfflineCache(cacheKey));
  const [loading, setLoading] = useState(!readOfflineCache(cacheKey));
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('ref') || readOfflineCache(codeCacheKey) || '');
  const [error, setError] = useState('');
  const inviteUrl = dashboard?.code ? `${window.location.origin}/?mode=signup&ref=${encodeURIComponent(dashboard.code)}` : '';
  useEffect(() => {
    writeOfflineCache(codeCacheKey, code);
  }, [code, codeCacheKey]);
  const loadDashboard = useCallback(async () => {
    const {
      data,
      error: requestError
    } = await sb.rpc('customer_referral_dashboard');
    if (requestError) {
      const missingReferralSetup = requestError.code === 'PGRST202' || requestError.message.includes('customer_referral_dashboard');
      setError(missingReferralSetup ? 'Referral rewards are not installed yet. Ask the administrator to run referral_rewards.sql in the Supabase SQL Editor.' : requestError.message);
      if (!readOfflineCache(cacheKey) || !isNetworkError(requestError)) setDashboard(null);
    } else {
      setDashboard(data);
      setError('');
      writeOfflineCache(cacheKey, data);
    }
    setLoading(false);
  }, [cacheKey]);
  useEffect(() => {
    loadDashboard();
    window.addEventListener('online', loadDashboard);
    return () => window.removeEventListener('online', loadDashboard);
  }, [loadDashboard]);
  const shareInvite = async () => {
    if (!inviteUrl) return;
    const message = `Join me on EAT60. Sign up with my referral link and claim 2,500 coins: ${inviteUrl}`;
    try {
      if (navigator.share) await navigator.share({
        title: 'Join me on EAT60',
        text: message,
        url: inviteUrl
      });else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        say('Your referral link and invite message were copied.');
      } else {
        setError('Sharing is not available in this browser. Copy the referral link below.');
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') setError(shareError.message || 'Could not share the referral link.');
    }
  };
  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable. Press and hold the referral link to copy it.');
      await navigator.clipboard.writeText(inviteUrl);
      say('Referral link copied.');
    } catch (copyError) {
      setError(copyError.message || 'Could not copy the referral link.');
    }
  };
  const claimNewUserReward = async () => {
    if (!navigator.onLine) return setError('Connect to the internet to redeem a referral code.');
    setBusy(true);
    setError('');
    const {
      data,
      error: claimError
    } = await sb.rpc('claim_referral_reward', {
      p_code: code.trim() || null
    });
    setBusy(false);
    if (claimError) return setError(claimError.message);
    await Promise.all([reload(), loadDashboard()]);
    onAnnounce({
      type: 'reward',
      title: 'Welcome to EAT60!',
      message: `${Number(data?.coins_awarded) || 2500} referral coins have been added to your wallet.`
    });
  };
  const claimReferrerReward = async () => {
    if (!navigator.onLine) return setError('Connect to the internet to claim referral coins.');
    setBusy(true);
    setError('');
    const {
      data,
      error: claimError
    } = await sb.rpc('claim_referral_bonus');
    setBusy(false);
    if (claimError) return setError(claimError.message);
    const coins = Number(data?.coins_awarded) || 0;
    if (!coins) {
      await loadDashboard();
      return say('No referral coins are ready to claim yet.');
    }
    await Promise.all([reload(), loadDashboard()]);
    onAnnounce({
      type: 'reward',
      title: 'Your invites paid off!',
      message: `${coins.toLocaleString('en-IN')} referral coins have been added to your wallet.`
    });
  };
  const invites = Array.isArray(dashboard?.invites) ? dashboard.invites : [];
  return <>
    <FloatingBack onClick={onBack} label="Back to More" />
    <section className="more-subpage referral-page">
      <header className="more-subpage-header"><h1>REFER &amp; EARN</h1><span /></header>
      <article className="feature-card referral-hero">
        <p className="feature-eyebrow">GOOD FOOD IS BETTER SHARED</p>
        <h2>Invite a friend.<br />Both of you get rewarded.</h2>
        <div className="referral-reward-pair"><span><b>2,500</b><small>coins for your friend</small></span><i aria-hidden="true">+</i><span><b>3,000</b><small>coins for you</small></span></div>
      </article>
      <section className="feature-card referral-code-card">
        <div className="feature-card-heading"><div><small>YOUR PERSONAL CODE</small><h2>{dashboard?.code || (loading ? 'Loading code…' : 'Code unavailable')}</h2></div><span aria-hidden="true">↗</span></div>
        <p>Friends who sign up with your link can claim 2,500 coins. You can claim 3,000 coins after they redeem.</p>
        <div className="referral-link-field"><input readOnly aria-label="Your referral link" value={inviteUrl} placeholder="Your share link will appear here" /><button className="pill g" onClick={copyInvite} disabled={!inviteUrl}>COPY</button><button className="pill" onClick={shareInvite} disabled={!inviteUrl || !navigator.onLine}>SEND</button></div>
      </section>
      {(dashboard?.can_claim_new_user || dashboard?.can_redeem_code) && <section className="feature-card referral-redeem-card">
        <p className="feature-eyebrow">NEW CUSTOMER REWARD</p>
        <h2>{dashboard.can_claim_new_user ? 'Your 2,500 coins are ready' : 'Have a friend’s code?'}</h2>
        {dashboard.can_redeem_code && <label>Referral code<input autoCapitalize="characters" maxLength={16} value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="EAT-XXXXXXXXXXXX" /></label>}
        <button className="pill wide" disabled={busy || !navigator.onLine || dashboard.can_redeem_code && !dashboard.can_claim_new_user && !code.trim()} onClick={claimNewUserReward}>
          {busy ? 'CLAIMING…' : 'CLAIM 2,500 COINS'}
        </button>
        <small>Referral redemption is available before your first order. Each account can redeem only once.</small>
      </section>}
      {Number(dashboard?.pending_referrer_coins) > 0 && <section className="feature-card referral-pending-card">
        <div><small>READY TO CLAIM</small><b>{Number(dashboard.pending_referrer_coins).toLocaleString('en-IN')} coins</b><span>From friends who redeemed your code</span></div>
        <button className="pill" disabled={busy || !navigator.onLine} onClick={claimReferrerReward}>{busy ? 'CLAIMING…' : 'CLAIM COINS'}</button>
      </section>}
      <section className="feature-card referral-invites">
        <div className="feature-card-heading"><div><small>YOUR INVITES</small><h2>Friends who joined</h2></div><span>{invites.length}</span></div>
        {loading && !dashboard ? <LoadingIndicator label="Loading your invites…" compact /> : invites.length === 0 ? <p className="mu">No one has joined with your code yet. Share it to get started.</p> : <div className="referral-invite-list">{invites.map((invite, index) => <article key={`${invite.username}-${index}`}>
              <span className="referral-avatar">{(invite.username || 'E').slice(0, 1).toUpperCase()}</span>
              <div><b>{invite.username || 'EAT60 friend'}</b><small>Joined {new Date(invite.joined_at).toLocaleDateString('en-IN')}</small></div>
              <span className={`referral-invite-status${invite.claimed ? ' claimed' : ''}`}>{invite.claimed ? invite.referrer_reward_claimed ? 'REWARDED' : 'CLAIMED' : 'SIGNED UP'}</span>
            </article>)}</div>}
      </section>
      {error && <p className="feature-error" role="alert">{error}</p>}
      {!navigator.onLine && <p className="feature-offline" role="status">Offline mode: referral details are read-only until you reconnect.</p>}
    </section>
  </>;
}
function SocialsPage({
  socialLinks,
  onBack
}) {
  const channelDetails = {
    instagram: ['Instagram', '📸', 'Behind the scenes, new dishes and kitchen moments.'],
    facebook: ['Facebook', 'f', 'Updates, announcements and community news.'],
    youtube: ['YouTube', '▶', 'Food, fun and a little EAT60 magic.'],
    website: ['Website', '↗', 'Visit the EAT60 home on the web.'],
    whatsapp: ['WhatsApp', '◉', 'Message us and stay in touch.']
  };
  const channels = Object.entries(socialLinks || {}).filter(([key, url]) => key !== 'support_phone' && /^https?:\/\//i.test(url || '')).map(([key, url]) => {
    const [label, icon, detail] = channelDetails[key] || [key.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()), '↗', `Connect with EAT60 on ${key}.`];
    return [key, label, icon, detail, url];
  });
  return <>
    <FloatingBack onClick={onBack} label="Back to More" />
    <section className="more-subpage social-page">
      <header className="more-subpage-header"><h1>CONNECT WITH EAT60</h1><span /></header>
      <p className="social-page-quote">“Good food brings people together. We’re glad you’re here.”</p>
      {channels.length ? <div className="social-link-grid">{channels.map(([key, label, icon, detail, url]) => <a key={key} className={`social-link-card social-${key}`} href={url} target="_blank" rel="noopener noreferrer">
        <span aria-hidden="true">{icon}</span><div><b>{label}</b><small>{detail}</small></div><strong aria-hidden="true">↗</strong>
      </a>)}</div> : <article className="feature-card"><h2>We’re getting social</h2><p>Our official social links will appear here as soon as they are configured.</p></article>}
      <p className="social-page-footer">Follow along, share your food moments, and tag EAT60. We love seeing what you enjoy.</p>
    </section>
  </>;
}
function SupportPage({
  socialLinks,
  supportPhone,
  onBack,
  onHistory,
  onCareers,
  onComplaint,
  complaint
}) {
  const faq = [['Order status & delivery', 'Open Order History to follow the latest status. If your order is taking longer than expected, contact us with the order number.'], ['Payment & refunds', 'Payment questions and refund updates are handled against the order record. Open Order History and include your order number when contacting support.'], ['Cancelled or rejected order', 'A cancelled order will show its final status in Order History. Any coins used on an eligible cancelled order are returned to your wallet automatically.'], ['Wallet & coins', 'Your wallet balance is shown in the app. Coins are earned from eligible games and rewards; 100 coins can be used for ₹1 off where checkout rules allow.'], ['Games, score & rankings', 'Scores and rewards are saved when you finish a game while online. Weekly rankings update from eligible scores; check Games → Weekly Rankings.'], ['Account & profile', 'Open More → Edit Profile to update your name, username, phone, address and avatar. Never share your password or sign-in code with anyone.'], ['Rewards & referrals', 'Open More → Rewards for order streak gifts, or More → Refer for your code, invite status, and claimable referral coins.']];
  const phone = String(supportPhone || '').trim();
  const telHref = phone.replace(/[^\d+]/g, '');
  let whatsappHref = /^https?:\/\//i.test(socialLinks?.whatsapp || '') ? socialLinks.whatsapp : '';
  if (complaint && whatsappHref) {
    try {
      const contactUrl = new URL(whatsappHref);
      contactUrl.searchParams.set('text', 'Hello EAT60 Support, I would like to report an issue. Please help me.');
      whatsappHref = contactUrl.toString();
    } catch {
      whatsappHref = '';
    }
  }
  return <>
    <FloatingBack onClick={onBack} label="Back to More" />
    <section className="more-subpage support-page">
      <header className="more-subpage-header"><h1>{complaint ? 'REPORT A PROBLEM' : 'HELP & SUPPORT'}</h1><span /></header>
      <article className="feature-card support-intro">
        <p className="feature-eyebrow">WE’RE HERE TO HELP</p>
        <h2>{complaint ? 'Tell us what went wrong.' : 'A little help goes a long way.'}</h2>
        <p>Choose a topic below, check your order history, or contact the EAT60 team directly.</p>
        <div className="support-actions">
          <button className="pill" onClick={onHistory}>GET HELP WITH AN ORDER</button>
          {!complaint && <button className="pill g" onClick={onComplaint}>RAISE A COMPLAINT</button>}
          {telHref && <a className="pill g" href={`tel:${telHref}`}>CALL SUPPORT</a>}
          {whatsappHref && <a className="pill g" href={whatsappHref} target="_blank" rel="noopener noreferrer">{complaint ? 'RAISE A COMPLAINT ON WHATSAPP' : 'CHAT ON WHATSAPP'}</a>}
        </div>
        {!telHref && !whatsappHref && <small>Direct support contact is not configured yet. Please use Order History for order-specific help.</small>}
      </article>
      <section className="support-faq"><div className="feature-card-heading"><div><small>QUICK ANSWERS</small><h2>Frequently asked questions</h2></div></div>
        {faq.map(([question, answer]) => <details className="support-faq-item" key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p>{question.startsWith('Order') && <button className="pill g" onClick={onHistory}>OPEN ORDER HISTORY</button>}</details>)}
      </section>
      <button className="careers-callout" onClick={onCareers}><span aria-hidden="true">✦</span><span><b>Build something good with us</b><small>Explore future EAT60 career opportunities</small></span><strong>CAREERS →</strong></button>
    </section>
  </>;
}
export function CareersPage({
  onBack
}) {
  return <>
    {onBack && <FloatingBack onClick={onBack} label="Back to EAT60" />}
    <section className="more-subpage careers-page">
      <header className="more-subpage-header"><h1>CAREERS AT EAT60</h1><span /></header>
      <article className="feature-card careers-hero"><span className="careers-spark" aria-hidden="true">✦</span><p className="feature-eyebrow">GOOD THINGS ARE COOKING</p><h2>Help bring good food closer.</h2><p>We’re building EAT60 for our local community. Career opportunities will be announced here when we’re ready to grow the team.</p><span className="careers-coming-soon">CAREERS OPENING IN THE FUTURE</span></article>
    </section>
  </>;
}
export function AboutPage({
  onBack
}) {
  const [aboutData, setAboutData] = useState(() => readOfflineCache('about'));
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([sb.from('settings').select('about_founder_name,about_founder_photo_url,about_founder_instagram_url,about_founder_portfolio_url,social_links').eq('id', 1).maybeSingle(), sb.from('brands').select('id,name,emoji,is_open,about_category,about_tagline,zomato_url,swiggy_url').order('name')]).then(([{
      data: settings,
      error: settingsError
    }, {
      data: brands,
      error: brandsError
    }]) => {
      if (!active) return;
      const queryError = settingsError || brandsError;
      if (queryError) {
        setError(queryError.message.includes('does not exist') ? 'About page settings are not set up yet. Run admin_operations.sql in Supabase, then update founder and outlet details in Admin.' : queryError.message);
        if (aboutData && isNetworkError(queryError)) setError('');
        return;
      }
      const nextData = {
        settings: settings || {},
        brands: (brands || []).filter(brand => brand.is_open)
      };
      setAboutData(nextData);
      writeOfflineCache('about', nextData);
    });
    return () => {
      active = false;
    };
  }, []);
  const linkButton = (label, url, className = '') => /^https?:\/\//i.test(url || '') ? <a className={`about-link-button ${className}`} href={url} target="_blank" rel="noopener noreferrer">{label}<span aria-hidden="true">↗</span></a> : <button className={`about-link-button ${className}`} type="button" disabled title="This link will be added soon">{label}<span aria-hidden="true">↗</span></button>;
  return <div className="about-page">
    <button className="about-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> BACK</button>
    {error && <p className="about-load-error" role="alert">About page settings could not be loaded: {error}</p>}
    {!aboutData && !error && <LoadingIndicator label="Loading About EAT60…" compact />}
    <header className="about-hero">
      <div className="about-founder-photo">
        {aboutData?.settings?.about_founder_photo_url ? <img src={aboutData.settings.about_founder_photo_url} alt={`${aboutData.settings.about_founder_name || 'Founder'} of EAT60`} /> : <div className="about-founder-placeholder" aria-label="Founder photo coming soon"><span>👨‍💻</span><small>FOOD · CODE · COMMUNITY</small></div>}
      </div>
      <div className="about-founder-copy">
        <p className="about-eyebrow">THE PERSON BEHIND EAT60</p>
        <h1>{aboutData?.settings?.about_founder_name || 'Your Name'}</h1>
        <p className="about-founder-role">CEO &amp; Founder, Foodverse Kitchen Pvt Ltd</p>
        <p className="about-founder-job">Software Engineer</p>
        <div className="about-founder-links">
          {linkButton('Instagram', aboutData?.settings?.about_founder_instagram_url, 'instagram')}
          {linkButton('Portfolio', aboutData?.settings?.about_founder_portfolio_url, 'portfolio')}
        </div>
      </div>
    </header>

    <section className="about-intro">
      <p className="about-eyebrow">OUR STORY</p>
      <h2>Built by an engineer who got tired of paying fees.</h2>
    </section>

    <section className="about-story">
      <h2>Once upon a time...</h2>
      <p>...there was a mechanical engineer. He studied engines, gears and machines. He was sure his career would run smoothly.</p>
      <p>It didn’t. The engine stalled, and nobody could fix it, not even him.</p>
      <p>So he did what every sensible person does: he learned to code. Mechanical engineer to software engineer. Different tools, same habit of staring at things that don’t work until they work.</p>
      <h3>Then he got into food.</h3>
      <p>Soon he was cooking, delivering and, most of all, paying. Commission here, fee there, ads to be seen. He helped Zomato and Swiggy grow so much that, at one point, they were doing better from his kitchen than he was.</p>
      <p>His accounts were in loss. His kitchen was full of orders. Something was wrong with this picture.</p>
      <p>So he combined the two things he knew: <strong>food and technology</strong>. He built an app where the kitchen and the customer meet directly, with no one standing in the middle holding out a hand.</p>
      <p>That app is <strong>EAT60.</strong></p>
    </section>

    <section className="about-no-fees">
      <p className="about-eyebrow">A BETTER KIND OF CHECKOUT</p>
      <h2>What you pay is the food price.<br /><span>Nothing else.</span></h2>
      <ul><li>No extra service fee</li><li>No platform fee</li><li>No ads fee</li></ul>
      <p className="about-no-fees-note">No surprise at checkout. Even our bill believes in a happy ending.</p>
    </section>

    <section className="about-company">
      <p className="about-eyebrow">WHO WE ARE</p>
      <h2>Three ways to bring good food closer.</h2>
      <div className="about-company-grid">
        <article><span>🏠</span><h3>Foodverse Kitchen Pvt Ltd</h3><small>PARENT COMPANY</small><p>A multibrand cloud kitchen under one roof, where each taste has its own story. Started in September 2025.</p></article>
        <article><span>📱</span><h3>EAT60</h3><small>OUR APP</small><p>Order from all our brands in one place. Play games, earn coins, climb the leaderboard, and use your coins for a discount on food.</p></article>
        <article><span>🍱</span><h3>The Mealo</h3><small>OUR TIFFIN SERVICE</small><p>Ghar ka khana, delivered to you. Because sometimes you just want food that tastes like home.</p></article>
      </div>
    </section>
    {Object.entries({
      instagram: 'Instagram',
      facebook: 'Facebook',
      whatsapp: 'WhatsApp',
      youtube: 'YouTube',
      website: 'Website'
    }).filter(([key]) => /^https?:\/\//i.test(aboutData?.settings?.social_links?.[key] || '')).length > 0 && <section className="about-business-links">
        {Object.entries({
        instagram: 'Instagram',
        facebook: 'Facebook',
        whatsapp: 'WhatsApp',
        youtube: 'YouTube',
        website: 'Website'
      }).filter(([key]) => /^https?:\/\//i.test(aboutData?.settings?.social_links?.[key] || '')).map(([key, label]) => linkButton(label, aboutData.settings.social_links[key], `business-${key}`))}
      </section>}

    <section className="about-outlets">
      <p className="about-eyebrow">OUR OUTLETS</p>
      <h2>Every brand has its own story, and its own menu.</h2>
      <div className="about-outlet-list">
        {(aboutData?.brands || []).map(outlet => {
          return <article className="about-outlet" key={outlet.id}>
            <div className="about-outlet-copy"><span>{outlet.about_category || outlet.emoji || 'EAT60 OUTLET'}</span><h3>{outlet.name}</h3><p>{outlet.about_tagline || 'A taste worth coming back for.'}</p></div>
            <div className="about-outlet-links">{linkButton('Zomato', outlet.zomato_url, 'zomato')}{linkButton('Swiggy', outlet.swiggy_url, 'swiggy')}</div>
          </article>;
        })}
        {aboutData && aboutData.brands.length === 0 && <p className="about-no-outlets">Our outlets will appear here when they are available.</p>}
      </div>
    </section>
  </div>;
}
function ProfileEditor({
  me,
  email,
  reload,
  onBack
}) {
  const [form, setForm] = useState(() => ({
    username: me.username || '',
    name: me.name || '',
    address: me.address || '',
    area: me.area || '',
    city: me.city || '',
    phone: me.phone || '',
    gender: me.gender || 'other',
    avatar_id: me.avatar_id || 1,
    ...readOfflineCache(`profile-draft:${me.id}`)
  }));
  const [newEmail, setNewEmail] = useState(email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const updateField = field => event => setForm(current => ({
    ...current,
    [field]: event.target.value
  }));
  useEffect(() => {
    writeOfflineCache(`profile-draft:${me.id}`, form);
  }, [form, me.id]);
  const saveProfile = async event => {
    event.preventDefault();
    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setProfileMessage('Username must be 3–24 characters: lowercase letters, numbers, or underscores.');
      return;
    }
    if (!form.name.trim()) {
      setProfileMessage('Enter your full name.');
      return;
    }
    setBusy(true);
    setProfileMessage('');
    try {
      const {
        error
      } = await sb.from('profiles').update({
        username,
        name: form.name.trim(),
        address: form.address.trim(),
        area: form.area.trim(),
        city: form.city.trim(),
        phone: form.phone.trim(),
        gender: form.gender,
        avatar_id: Number(form.avatar_id)
      }).eq('id', me.id);
      if (error?.code === '23505') return setProfileMessage('That username is already in use. Try another one.');
      if (error?.code === 'PGRST204' || error?.code === 'PGRST205') return setProfileMessage('Profile fields are not installed in the database yet. Run profile_fields.sql in the Supabase SQL Editor, then try again.');
      if (error) return setProfileMessage(error.message);
      writeOfflineCache(`profile-draft:${me.id}`, null);
      setProfileMessage('Profile saved.');
      await reload();
    } catch (error) {
      setProfileMessage(error.message || 'Could not save your profile. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  const changeEmail = async event => {
    event.preventDefault();
    const nextEmail = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return setEmailMessage('Enter a valid email address.');
    if (nextEmail.toLowerCase() === email.toLowerCase()) return setEmailMessage('This is already your current email.');
    setBusy(true);
    setEmailMessage('');
    try {
      const {
        error
      } = await sb.auth.updateUser({
        email: nextEmail
      });
      if (error) return setEmailMessage(error.message);
      setEmailMessage('Check your email inboxes to confirm the address change. Your login email updates after confirmation.');
    } catch (error) {
      setEmailMessage(error.message || 'Could not update your email. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  const changePassword = async event => {
    event.preventDefault();
    if (password.length < 6) return setPasswordMessage('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setPasswordMessage('The passwords do not match.');
    setBusy(true);
    setPasswordMessage('');
    try {
      const {
        error
      } = await sb.auth.updateUser({
        password
      });
      if (error) return setPasswordMessage(error.message);
      setPassword('');
      setConfirmPassword('');
      setPasswordMessage('Password changed successfully.');
    } catch (error) {
      setPasswordMessage(error.message || 'Could not update your password. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return <section className="profile-editor">
      <FloatingBack onClick={onBack} label="Back to More" />
      <div className="profile-editor-heading"><div><p className="profile-kicker">YOUR ACCOUNT</p><h2>PROFILE</h2></div></div>
      <form className="profile-form card" onSubmit={saveProfile}>
        <div className="profile-form-identity"><div className="profile-avatar"><ProfileAvatar avatarId={form.avatar_id} /></div><div><p>GOOD TO SEE YOU</p><h3>{form.name || 'Your name'}</h3><small>Pick an avatar that feels like you</small></div></div>
        <fieldset className="profile-gender profile-field-wide">
          <legend>Gender</legend>
          <div className="profile-gender-options">
            {GENDER_OPTIONS.map(option => <button
              type="button"
              key={option.value}
              className={form.gender === option.value ? 'selected' : ''}
              aria-pressed={form.gender === option.value}
              onClick={() => setForm(current => ({ ...current, gender: option.value }))}
            >
              <GenderIcon gender={option.value} />
              {option.label}
            </button>)}
          </div>
        </fieldset>
        <fieldset className="profile-avatar-picker profile-field-wide"><legend>Choose your avatar <small>{PROFILE_AVATAR_COUNT} styles · any gender</small></legend><div className="profile-avatar-options">{Array.from({ length: PROFILE_AVATAR_COUNT }, (_, index) => {
            return <button type="button" key={index} className={Number(form.avatar_id) === index + 1 ? 'selected' : ''} onClick={() => setForm(current => ({
              ...current,
              avatar_id: index + 1
            }))} aria-label={`Choose avatar ${index + 1}`} aria-pressed={Number(form.avatar_id) === index + 1}><ProfileAvatar avatarId={index + 1} /></button>;
          })}</div></fieldset>
        <div className="profile-fields">
          <label>Username<input autoComplete="username" maxLength={24} value={form.username} onChange={updateField('username')} placeholder="your_unique_name" /></label>
          <label>Full name<input autoComplete="name" maxLength={80} value={form.name} onChange={updateField('name')} placeholder="Your full name" /></label>
          <label className="profile-field-wide">Address<input autoComplete="street-address" maxLength={160} value={form.address} onChange={updateField('address')} placeholder="House, street, landmark" /></label>
          <label>Area<input autoComplete="address-level3" maxLength={80} value={form.area} onChange={updateField('area')} placeholder="Area" /></label>
          <label>City<input autoComplete="address-level2" maxLength={80} value={form.city} onChange={updateField('city')} placeholder="City" /></label>
          <label className="profile-field-wide">Phone number<input autoComplete="tel" inputMode="tel" maxLength={20} value={form.phone} onChange={updateField('phone')} placeholder="Phone number" /></label>
        </div>
        <div className="profile-form-footer"><button className="pill" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>{profileMessage && <p className="profile-feedback" role="status">{profileMessage}</p>}</div>
      </form>

      <form className="card account-change-form" onSubmit={changeEmail}>
        <h3>Change email</h3><p className="mu">Current email: {email}</p>
        <label>New email<input type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} required /></label>
        <button className="pill" disabled={busy}>{busy ? 'Updating…' : 'Update email'}</button>
        {emailMessage && <p className="profile-feedback" role="status">{emailMessage}</p>}
      </form>

      <form className="card account-change-form" onSubmit={changePassword}>
        <h3>Change password</h3>
        <label>New password<input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></label>
        <button className="pill" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        {passwordMessage && <p className="profile-feedback" role="status">{passwordMessage}</p>}
      </form>
    </section>;
}
