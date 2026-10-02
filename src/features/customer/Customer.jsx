import { Fragment, useEffect, useState, useCallback, useRef, useId } from 'react'
import { sb } from '../../lib/supabase'
import PoweredFooter from '../../components/PoweredFooter'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const CATS = ['Pizza', 'Burger', 'Sandwich', 'Maggie', 'Chinese', 'Wraps']
const LABEL = { placed: 'Placed', pending:'Awaiting kitchen', accepted:'Accepted', preparing: 'Preparing', ready:'Ready', out_for_delivery: 'Out for delivery', payment_received:'Payment received', delivered: 'Delivered', rejected:'Rejected', cancelled: 'Cancelled' }
const STEPS = ['pending','accepted','preparing','ready','out_for_delivery','payment_received','delivered']
const CATEGORY_ICONS = { Pizza: '🍕', Burger: '🍔', Sandwich: '🥪', Wraps: '🌯', Maggie: '🍜', Chinese: '🥡' }
const PROFILE_AVATARS = [
  { skin: '#f3c39f', hairColor: '#38241f', shirt: '#55bca1', bg: '#c4ecdd', gender: 'male', style: 'waves' },
  { skin: '#9c6348', hairColor: '#171a22', shirt: '#91aaff', bg: '#dcd4ff', gender: 'male', style: 'short' },
  { skin: '#ffcfaa', hairColor: '#74452d', shirt: '#77c987', bg: '#c9eaff', gender: 'male', style: 'part' },
  { skin: '#d69a70', hairColor: '#30211d', shirt: '#f0a53e', bg: '#ffdfb3', gender: 'male', style: 'curls' },
  { skin: '#f4c6a6', hairColor: '#62352c', shirt: '#e9779c', bg: '#ffd8e5', gender: 'female', style: 'long' },
  { skin: '#8c503e', hairColor: '#17151c', shirt: '#9c82dc', bg: '#e6d9ff', gender: 'female', style: 'curls' },
  { skin: '#f2d0b6', hairColor: '#a85c32', shirt: '#55aeda', bg: '#c9efff', gender: 'female', style: 'bob' },
  { skin: '#c88760', hairColor: '#231c1d', shirt: '#efaa43', bg: '#ffe8b8', gender: 'female', style: 'long' },
  { skin: '#e7bd9f', hairColor: '#7654a3', shirt: '#77c8b5', bg: '#d7f4e9', gender: 'other', style: 'pixie' },
  { skin: '#b6775c', hairColor: '#263d4b', shirt: '#f08068', bg: '#ffe0d4', gender: 'other', style: 'waves' }
]
const DELIVERY_POINT = { latitude: 25.764105, longitude: 84.151860 }
const DEFAULT_DELIVERY_RADIUS_KM = 5

function distanceInKm(from, to) {
  const radians = (degrees) => degrees * Math.PI / 180
  const earthRadiusKm = 6371
  const dLat = radians(to.latitude - from.latitude)
  const dLon = radians(to.longitude - from.longitude)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function ProfileAvatar({ avatarId = 1 }) {
  const avatar = PROFILE_AVATARS[Math.max(0, Math.min(PROFILE_AVATARS.length - 1, Number(avatarId) - 1))] || PROFILE_AVATARS[0]
  const hairPaths = {
    waves: 'M23 45C13 21 30 7 49 8c22 0 37 16 28 39l-8-8-4-15c-7 10-21 15-42 14Z',
    short: 'M22 43C15 20 27 8 48 8c22 0 35 14 29 37l-9-9-4-13c-8 8-22 12-42 12Z',
    part: 'M21 43C16 19 30 7 49 8c20 0 34 13 29 36l-8-7-1-14c-8 7-20 10-34 8l-4 11Z',
    curls: 'M21 44C11 29 17 12 31 12c3-9 18-8 22-1 12-6 24 4 25 16 3 7 1 12-2 18l-9-8-5-16c-10 10-25 15-41 13Z',
    long: 'M20 48C11 22 23 7 47 7c24 0 39 18 31 47l-6 20H27l-4-21Z',
    bob: 'M20 48C12 21 26 7 48 7c24 0 37 17 31 43l-8 19-6-16-1-18c-10 9-25 12-40 10l-1 22-7 2Z',
    pixie: 'M22 42C16 19 29 8 48 9c20 0 31 12 29 31l-8-4-3-16c-8 9-24 14-42 13Z'
  }
  const longHair = ['long', 'bob'].includes(avatar.style)
  return <svg className="profile-portrait" viewBox="0 0 100 100" role="img" aria-label="Selected profile avatar">
    <circle cx="50" cy="50" r="50" fill={avatar.bg}/>
    {longHair && <path d={hairPaths[avatar.style]} fill={avatar.hairColor}/>}
    <path d="M10 100c2-22 16-32 40-32s38 10 40 32Z" fill={avatar.shirt}/>
    <path d="M42 60h16v17H42z" fill={avatar.skin}/>
    <ellipse cx="24" cy="47" rx="5" ry="8" fill={avatar.skin}/><ellipse cx="76" cy="47" rx="5" ry="8" fill={avatar.skin}/>
    <ellipse cx="50" cy="43" rx="25" ry="30" fill={avatar.skin}/>
    {!longHair && <path d={hairPaths[avatar.style]} fill={avatar.hairColor}/>}
    <path d="M36 43q4-4 8 0M56 43q4-4 8 0" fill="none" stroke="#54342c" strokeWidth="2" strokeLinecap="round"/>
    <ellipse cx="40" cy="49" rx="2.4" ry="3.1" fill="#302a2b"/><ellipse cx="60" cy="49" rx="2.4" ry="3.1" fill="#302a2b"/>
    <circle cx="31" cy="55" r="3" fill="#ed8e91" opacity=".42"/><circle cx="69" cy="55" r="3" fill="#ed8e91" opacity=".42"/>
    <path d="M45 61q5 5 10 0" fill="none" stroke="#a34852" strokeWidth="2" strokeLinecap="round"/>
    {avatar.style === 'curls' && <><circle cx="29" cy="22" r="5" fill={avatar.hairColor}/><circle cx="42" cy="13" r="5" fill={avatar.hairColor}/><circle cx="57" cy="13" r="5" fill={avatar.hairColor}/><circle cx="71" cy="23" r="5" fill={avatar.hairColor}/></>}
    {avatar.style === 'pixie' && <path d="M75 14q11 4 9 14l-8-4" fill={avatar.hairColor}/>}
  </svg>
}

function NavigationIcon({ name }) {
  const common = { width: 23, height: 23, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5.5 9v11h13V9M9 20v-6h6v6"/></>,
    hist: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
    cart: <><path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 1.9-1.4L22 9H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></>,
    feed: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    more: <><path d="M4 6h16M4 12h16M4 18h16"/></>
  }
  return <svg {...common}>{paths[name]}</svg>
}

function FloatingBack({ onClick, label = 'Go back' }) {
  return <button className="floating-back" type="button" onClick={onClick} aria-label={label}><span aria-hidden="true">←</span></button>
}

function CoinIcon() {
  return <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="#ffbf43" stroke="#ffe08b" strokeWidth="2"/><circle cx="16" cy="16" r="9" fill="none" stroke="#d88917" strokeWidth="1.6"/><path d="M18.8 11.6c-.7-.7-1.6-1-2.8-1-1.6 0-2.6.8-2.6 2.1 0 3.2 5.4 1.4 5.4 4.8 0 1.4-1.1 2.4-2.9 2.4-1.2 0-2.2-.4-3-1.2M16 9v14" fill="none" stroke="#9a5b0c" strokeWidth="1.5" strokeLinecap="round"/></svg>
}

function ActionIcon({ name }) {
  const props = { viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  if (name === 'game') return <svg {...props}><path d="M14 15h20a9 9 0 0 1 8 12l-3 8a4 4 0 0 1-6 1l-7-5h-7l-7 5a4 4 0 0 1-6-1l-3-8a9 9 0 0 1 8-12Z"/><path d="M13 21v10m-5-5h10"/><circle cx="32" cy="23" r="1.5" fill="currentColor"/><circle cx="36" cy="28" r="1.5" fill="currentColor"/></svg>
  if (name === 'tiffin') return <svg {...props}><path d="M15 10V6h18v4M12 12h24l-2 25H14l-2-25Z"/><path d="M14 20h20m-19 8h18M24 12v25"/><path d="M18 5h12"/></svg>
  return <svg {...props}><path d="M7 10h34v7a4 4 0 0 0 0 8v7H7v-7a4 4 0 0 0 0-8v-7Z"/><path d="M25 12v3m0 6v3m0 6v3"/></svg>
}

export default function Customer({ me, email, reload, onOpenDownload, installAvailable, installMessage }) {
  const [tab, setTab] = useState('home')
  const [gameView, setGameView] = useState('games')
  const [gameFocus,setGameFocus]=useState(false)
  const [moreInitialPage, setMoreInitialPage] = useState(null)
  const [cart, setCart] = useState([])
  const [selectedVoucher, setSelectedVoucher] = useState('')
  const [rank, setRank] = useState(null)
  const [fullscreenNotice, setFullscreenNotice] = useState(null)
  const [data, setData] = useState({ brands: [], items: [], cfg: {}, ratings: {}, ratingError: '' })
  const [toast, setToast] = useState('')
  const [locationStatus, setLocationStatus] = useState('idle')
  const [locationLabel, setLocationLabel] = useState('Harpur, Ballia')

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 2400) }
  const handleDelivered = useCallback((orderId) => {
    const key = `eat60:delivered:${orderId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, 'shown')
    setFullscreenNotice({ type: 'order-delivered', id: orderId })
  }, [])

  const reloadRatings = useCallback(async () => {
    const { data: ratings, error } = await sb
      .from('menu_item_ratings')
      .select('menu_item_id,average_rating,review_count')
    setData((current) => ({
      ...current,
      ratings: Object.fromEntries((ratings || []).map((rating) => [rating.menu_item_id, rating])),
      ratingError: error?.message || ''
    }))
  }, [])

  useEffect(() => {
    (async () => {
      const [b, i, s, ratings] = await Promise.all([
        sb.from('brands').select('*').order('name'),
        sb.from('menu_items').select('*, item_variants(*), item_extras(*)').order('id'),
        sb.from('settings').select('*').single(),
        sb.from('menu_item_ratings').select('menu_item_id,average_rating,review_count')
      ])
      setData({
        brands: b.data || [],
        items: i.data || [],
        cfg: s.data || {},
        ratings: Object.fromEntries((ratings.data || []).map((rating) => [rating.menu_item_id, rating])),
        ratingError: ratings.error?.message || ''
      })
    })()
  }, [])

  useEffect(() => { reload() }, [tab]) // refresh coins and streak when switching tabs

  useEffect(() => {
    sb.rpc('get_leaderboard').then(({ data }) => {
      const currentPlayer = data?.find((row) => row.is_me)
      setRank(currentPlayer?.rank ?? null)
    })
  }, [])

  useEffect(() => {
    const channel = sb.channel(`customer-announcements-${me.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_posts' }, ({ new: post }) => {
        if (post.kind !== 'news') return
        const key = `eat60:announcement:${post.id}`
        if (sessionStorage.getItem(key)) return
        sessionStorage.setItem(key, 'shown')
        setFullscreenNotice({ type: 'announcement', id: post.id, message: post.body })
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [me.id])

  useEffect(() => {
    const channel = sb.channel(`customer-order-milestones-${me.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${me.id}` }, ({ new: order }) => {
        if (order.order_stage === 'delivered') handleDelivered(order.id)
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [handleDelivered, me.id])

  const price = (v) =>
    v.id === data.cfg.offer_variant_id && data.cfg.offer_date === today() ? data.cfg.offer_price : v.price

  const add = (item, v, extras = []) => {
    const b = data.brands.find((x) => x.id === item.brand_id)
    if (!item.is_available || !b?.is_open) return say('This outlet is closed right now')
    setCart((c) => {
      const extraIds=extras.map(x=>x.id).sort();const l = c.find((x) => x.vid === v.id && JSON.stringify((x.extras||[]).map(z=>z.id).sort())===JSON.stringify(extraIds))
      return l
        ? c.map((x) => (x === l ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { vid: v.id, name: `${item.name} (${v.label})`, price: price(v)+extras.reduce((sum,x)=>sum+Number(x.price),0), extras, qty: 1 }]
    })
    say('Added to cart')
  }

  const n = cart.reduce((a, x) => a + x.qty, 0)
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const floatingDeliveryFee = data.cfg.delivery_free === true || (Number(data.cfg.free_delivery_minimum) > 0 && cartSubtotal >= Number(data.cfg.free_delivery_minimum))
    ? 0
    : Number(data.cfg.delivery_fee || 0)
  const floatingCartTotal = cartSubtotal + floatingDeliveryFee
  const go = (t) => { if(t!=='games')setGameFocus(false);setTab(t); window.scrollTo(0, 0) }
  const goGames = (view = 'games') => { setGameView(view); go('games') }
  const goMore = (page = null) => { setMoreInitialPage(page); go('more') }
  const checkDeliveryArea = () => {
    if (!navigator.geolocation) {
      setLocationStatus('error')
      return say('Location is not supported by this browser.')
    }

    setLocationStatus('checking')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const distance = distanceInKm(
          { latitude: coords.latitude, longitude: coords.longitude },
          DELIVERY_POINT
        )
        const roundedDistance = distance.toFixed(1)
        const deliveryRadius = Number(data.cfg.max_delivery_km) || DEFAULT_DELIVERY_RADIUS_KM
        const available = distance <= deliveryRadius
        setLocationStatus(available ? 'available' : 'unavailable')
        setLocationLabel(available ? 'Delivery available' : 'Delivery unavailable')
        say(available
          ? `You’re ${roundedDistance} km away. Delivery is available.`
          : `Delivery is not available at your location (${roundedDistance} km away; ${deliveryRadius} km limit).`)
      },
      (error) => {
        setLocationStatus('error')
        if (error.code === error.PERMISSION_DENIED) return say('Allow location access to check delivery in your area.')
        if (error.code === error.TIMEOUT) return say('Location check timed out. Please try again.')
        return say('Could not detect your location. Please try again.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  return (
    <div className={`app customer-app${gameFocus?' game-focus-app':''}`}>
      <header className="customer-header">
        <button className="wordmark-button" onClick={() => go('home')} aria-label="EAT60 home">
          <span className="logo">EAT<b>60</b></span>
          <small>Ballia’s first food delivery app</small>
        </button>
        <button className={`location-button location-${locationStatus}`} onClick={checkDeliveryArea} aria-label="Check delivery availability using your location" disabled={locationStatus === 'checking'}>
          <span>{locationStatus === 'checking' ? 'Checking location…' : locationLabel}</span><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" fill="currentColor"/><circle cx="12" cy="10" r="2.5" fill="#171717"/></svg></i>
        </button>
      </header>
      <div className="stat-pills">
        <button className="stat-wallet" onClick={() => go('wallet')}><i><CoinIcon /></i><span><small>YOUR WALLET</small><b>{me.coins} COINS</b></span></button>
        <button className="stat-streak" onClick={() => goMore('rewards')}><i><FlameAnimation /></i><span><small>ORDER STREAK</small><b>{me.streak} DAYS</b></span></button>
        <button className="stat-rank" onClick={() => goGames('rankings')}><i><MoreIcon name="ranks" /></i><span><small>WEEKLY LEAGUE</small><b>{rank ? `#${rank} RANK` : 'PLAY TO RANK'}</b></span></button>
        <button className="stat-track" onClick={() => go('hist')}><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12 18-9-7 18-3-7-8-2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="m11 14 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></i><span><small>YOUR DELIVERY</small><b>TRACK ORDER</b></span></button>
      </div>

      {tab === 'home' && <Home data={data} add={add} price={price} go={go} goMore={goMore} goGames={goGames} say={say} me={me} reloadRatings={reloadRatings} />}
      {tab === 'cart' && (
        <Cart cart={cart} setCart={setCart} cfg={data.cfg} me={me} say={say} voucherCode={selectedVoucher}
          done={(orderId) => { setSelectedVoucher(''); reload(); setFullscreenNotice({ type: 'order-placed', id: orderId }) }} />
      )}
      {tab === 'hist' && <History me={me} />}
      {tab === 'feed' && <Feed me={me} say={say} />}
      {tab === 'games' && <div className={`game-focus-surface${gameFocus?' focused':''}`}><Games reload={reload} say={say} me={me} initialView={gameView} onFocus={setGameFocus} /></div>}
      {tab === 'wallet' && <Wallet me={me} onBack={() => go('home')} />}
      {tab === 'more' && <More me={me} email={email} reload={reload} go={go} goGames={goGames} say={say} initialPage={moreInitialPage}
        onSelectVoucher={(code) => { setSelectedVoucher(code); go('cart') }} installAvailable={installAvailable} installMessage={installMessage} />}

      <PoweredFooter />

      <nav className="customer-nav" aria-label="Main navigation">
        {[
          ['home', 'Home'], ['hist', 'History'], ['cart', 'Cart'], ['feed', 'Feed'], ['more', 'More']
        ].map(([k, l]) => (
          <button key={k} className={tab === k || (tab === 'wallet' && k === 'home') ? 'on' : ''} onClick={() => { if (k === 'more') setMoreInitialPage(null); go(k) }} aria-current={tab === k ? 'page' : undefined}>
            <i><NavigationIcon name={k} /></i><span>{l}</span>{k === 'cart' && n > 0 && <b>{n}</b>}
          </button>
        ))}
      </nav>
      {n > 0 && tab !== 'cart' && <button className="floating-cart" onClick={() => go('cart')} aria-label={`Open cart, ${n} items, estimated total ₹${floatingCartTotal}`}>
        <span className="floating-cart-icon"><NavigationIcon name="cart" /><b>{n}</b></span><span className="floating-cart-copy"><small>{n} {n === 1 ? 'ITEM' : 'ITEMS'}</small><strong>₹{floatingCartTotal.toLocaleString('en-IN')}</strong></span><span className="floating-cart-arrow">→</span>
      </button>}
      {toast && <div className="toast">{toast}</div>}
      {fullscreenNotice && <FullscreenNotice notice={fullscreenNotice}
        onClose={() => { const goHome = fullscreenNotice.type === 'order-placed'; setFullscreenNotice(null); if (goHome) go('home') }}
        onTrackOrder={() => { setFullscreenNotice(null); go('hist') }}
        onViewFeed={() => { setFullscreenNotice(null); go('feed') }} />}
    </div>
  )
}

function FullscreenNotice({ notice, onClose, onTrackOrder, onViewFeed }) {
  const announcement = notice.type === 'announcement'
  const delivered = notice.type === 'order-delivered'
  const title = announcement ? 'A note from EAT60' : delivered ? 'Order delivered!' : 'Order placed!'
  const detail = announcement
    ? notice.message
    : delivered
      ? `Order #${notice.id} has arrived. Enjoy your meal!`
      : `Order #${notice.id} is with the kitchen. We’ll keep you updated as it moves along.`
  return <div className={`fullscreen-notice${announcement ? ' is-announcement' : ''}`} role="dialog" aria-modal="true" aria-labelledby="fullscreen-notice-title">
    <div className="reward-screen-rays" aria-hidden="true" />
    <div className={`notice-animation-icon ${announcement ? 'notice-megaphone' : delivered ? 'notice-delivered' : 'notice-placed'}`} aria-hidden="true">
      <span>{announcement ? '✳' : delivered ? '✓' : '✓'}</span>
      {!announcement && <i />}
    </div>
    <p className="notice-kicker">{announcement ? 'ANNOUNCEMENT' : delivered ? 'GOOD FOOD, RIGHT ON TIME' : 'THANK YOU FOR YOUR ORDER'}</p>
    <h1 id="fullscreen-notice-title">{title}</h1>
    <p className="notice-detail">{detail}</p>
    <div className="notice-progress" aria-hidden="true"><i /></div>
    <div className="notice-actions">
      {announcement
        ? <button className="reward-claim-primary" onClick={onViewFeed}>VIEW FEED</button>
        : <button className="reward-claim-primary" onClick={onTrackOrder}>{delivered ? 'VIEW ORDER' : 'TRACK YOUR ORDER'}</button>}
      <button className="reward-claim-later" onClick={onClose}>{announcement ? 'CLOSE' : 'CONTINUE'}</button>
    </div>
  </div>
}

function Home({ data, add, price, go, goMore, goGames, say, me, reloadRatings }) {
  const [b, setB] = useState('')
  const [c, setC] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [selectedExtras,setSelectedExtras]=useState([])
  const offerRef = useRef(null)
  const brand = (id) => data.brands.find((x) => x.id === id)
  const items = data.items.filter((i) =>
    (!b || i.brand_id === b) && (!c || i.category === c) &&
    (i.name + (i.description || '')).toLowerCase().includes(q.toLowerCase()))
  const offerItem = data.cfg.offer_date === today() &&
    data.items.find((i) => i.item_variants.some((v) => v.id === data.cfg.offer_variant_id))
  const sorted = (i) => [...i.item_variants].sort((x, y) => x.price - y.price)
  const activeVariant = (item) => item?.item_variants?.find((v) => v.id === data.cfg.offer_variant_id)
  const scrollToOffer = () => {
    if (!offerItem) return say('No active offer right now. Check back soon!')
    offerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const addFromCard = (item) => {
    if (!item.is_available || !brand(item.brand_id)?.is_open) return say('This outlet is closed right now')
    const variants = sorted(item)
    if (!variants.length) return say('This item has no sizes available yet')
    if (variants.length === 1 && !(item.item_extras||[]).some(e=>e.is_available)) add(item, variants[0])
    else {setOpen(item);setSelectedExtras([])}
  }

  return (
    <>
      <div className="quick-actions">
        <button onClick={() => goMore()}><i className="quick-icon profile-icon"><ProfileAvatar avatarId={me.avatar_id} /></i><span>{me.username || me.name || 'My Profile'}</span></button>
        <button onClick={() => goGames()}><i className="quick-icon game-icon"><ActionIcon name="game" /></i><span>Play Game</span></button>
        <button onClick={scrollToOffer}><i className="quick-icon offer-icon">50<small>%<br />OFF</small></i><span>Offers & Coupon</span></button>
        <button onClick={() => data.cfg.tiffin_url ? window.open(data.cfg.tiffin_url, '_blank', 'noopener,noreferrer') : say('Tiffin service details are coming soon')}><i className="quick-icon tiffin-icon"><ActionIcon name="tiffin" /></i><span>Tiffin Service</span></button>
      </div>

      {offerItem && (
        <div className="offer-card" id="daily-offer" ref={offerRef}>
          <div>
            <h2>OFFER OF THE DAY</h2>
            <small>GRAB THIS OFFER BEFORE IT ENDS</small>
            <p>{`GET ${offerItem.name.toUpperCase()} @ ₹${data.cfg.offer_price}/-`}</p>
            <button className="offer-add" onClick={() => add(offerItem, activeVariant(offerItem))}>Add to cart <span>→</span></button>
          </div>
          <div className="offer-art" aria-hidden="true">🍕</div>
        </div>
      )}

      <section className="category-section">
        <div className="section-heading"><h2>CATEGORIES</h2>{(c || b) && <button onClick={() => { setC(''); setB('') }}>Clear filters</button>}</div>
        <div className="category-scroller">
          {CATS.map((x) => (
            <button key={x} className={`category-button${c === x ? ' selected' : ''}`} onClick={() => setC(c === x ? '' : x)}>
              <i>{CATEGORY_ICONS[x]}</i><span>{x}</span>
            </button>
          ))}
        </div>
        <div className="brand-scroller" aria-label="Filter by restaurant">
          {data.brands.map((x) => (
            <button key={x.id} className={`brand-chip${b === x.id ? ' selected' : ''}`} onClick={() => setB(b === x.id ? '' : x.id)}>{x.emoji} {x.name}</button>
          ))}
        </div>
      </section>

      <label className="menu-search">
        <span aria-hidden="true">⌕</span>
        <input aria-label="Search menu" placeholder="PANEER MAKHANI PIZZA" value={q} onChange={(e) => setQ(e.target.value)} />
        {q && <button onClick={() => setQ('')} aria-label="Clear search">×</button>}
      </label>

      <section className="menu-section">
        <div className="section-heading"><h2>{c || b ? 'MENU' : 'POPULAR RIGHT NOW'}</h2></div>
        {data.ratingError&&<div className="menu-rating-error" role="alert">
          <b>Customer ratings could not be loaded.</b>
          <p>{data.ratingError}</p>
          <small>In the Supabase project connected to this app, run order_reviews.sql, then rerun admin_operations.sql. If both have already completed, run <code>NOTIFY pgrst, 'reload schema';</code>, wait briefly, and retry.</small>
          <button type="button" onClick={reloadRatings}>Retry ratings</button>
        </div>}
        {items.length === 0 && <div className="empty">No items match. Clear a filter or try another search.</div>}
        <div className="menu-grid">
          {items.map((i) => {
            const ok = i.is_available && brand(i.brand_id)?.is_open
            const variants = sorted(i)
            return (
              <article key={i.id} className={`menu-card${ok ? '' : ' unavailable'}`}>
                <button className="menu-card-main" onClick={() => ok && setOpen(i)} disabled={!ok} aria-label={`View ${i.name}`}>
                  {i.image_url ? <img className="menu-image" src={i.image_url} alt={i.name} loading="lazy" /> : <span className="menu-image menu-image-fallback">{CATEGORY_ICONS[i.category] || brand(i.brand_id)?.emoji || '🍽️'}</span>}
                  <span className="menu-card-copy">
                    <small>{brand(i.brand_id)?.name || 'EAT60 KITCHEN'}</small>
                    <b>{i.name}</b>
                    <span className="menu-item-rating" aria-label={data.ratings[i.id] ? `${data.ratings[i.id].average_rating} out of 5 based on ${data.ratings[i.id].review_count} order ratings` : 'No customer ratings yet'}>
                      <span aria-hidden="true">{data.ratings[i.id] ? '★' : '☆'}</span>
                      {data.ratings[i.id] ? `${Number(data.ratings[i.id].average_rating).toFixed(1)} · ${data.ratings[i.id].review_count} ${data.ratings[i.id].review_count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}
                    </span>
                    <span>{i.description || i.category}</span>
                    <strong>{!ok ? 'CLOSED RIGHT NOW' : variants[0] ? `FROM ₹${price(variants[0])}` : 'TEMPORARILY UNAVAILABLE'}</strong>
                  </span>
                </button>
                <button className="menu-add" disabled={!ok || !variants.length} onClick={() => addFromCard(i)} aria-label={`Add ${i.name} to cart`}>
                  ADD <span>+</span>
                </button>
              </article>
            )
          })}
        </div>
      </section>

      {open && (
        <>
          <div className="bk" onClick={() => setOpen(null)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`${open.name} options`}>
            <button type="button" className="grab" onClick={() => setOpen(null)} aria-label="Close item options" />
            <div className="sheet-item-heading">
              {open.image_url && <img className="sheet-item-image" src={open.image_url} alt={open.name} />}
              <div className="sheet-item-copy">
                <h2>{open.name}</h2>
                {open.description && <small>{open.description}</small>}
              </div>
            </div>
            {(open.item_extras||[]).some(e=>e.is_available)&&<div className="extra-picker"><b>Add extras</b>{open.item_extras.filter(e=>e.is_available).map(x=><label key={x.id}><input type="checkbox" checked={selectedExtras.some(e=>e.id===x.id)} onChange={e=>setSelectedExtras(a=>e.target.checked?[...a,x]:a.filter(y=>y.id!==x.id))}/><span>{x.name}</span><strong>+₹{x.price}</strong></label>)}</div>}
            {sorted(open).map((v) => (
              <div key={v.id} className="vr">
                <span>₹{price(v)} &nbsp; {v.label}</span>
                <button className="pill" onClick={() => { add(open, v, selectedExtras); setOpen(null) }}>Add +</button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function Cart({ cart, setCart, cfg, me, say, done, voucherCode }) {
  const [useCoins, setUseCoins] = useState(false)
  const [customerName, setCustomerName] = useState(me.name || '')
  const [addr, setAddr] = useState([me.address, me.area, me.city].filter(Boolean).join(', '))
  const [ph, setPh] = useState(me.phone || '')
  const [busy, setBusy] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [couponResult, setCouponResult] = useState(null)
  const [deliveryDistance, setDeliveryDistance] = useState(null)
  const [locationMessage, setLocationMessage] = useState('')

  // These numbers are only a preview. The server recalculates the real total.
  const sub = cart.reduce((a, x) => a + x.price * x.qty, 0)
  const couponDisc = Number(couponResult?.discount_amount || 0)
  const minDistance = Number(cfg.min_delivery_km || 0)
  const extraDistance = Math.max(0, (deliveryDistance ?? minDistance) - minDistance)
  const distanceFee = Math.ceil(extraDistance * Number(cfg.delivery_per_km || 0))
  const deliveryFeeBeforeDiscount = Number(cfg.delivery_fee || 0) + distanceFee
  const freeDeliveryMinimum = Number(cfg.free_delivery_minimum || 0)
  const freeDelivery = cfg.delivery_free === true || (freeDeliveryMinimum > 0 && sub >= freeDeliveryMinimum)
  const deliveryFee = freeDelivery ? 0 : deliveryFeeBeforeDiscount
  const deliveryRadius = Number(cfg.max_delivery_km) || DEFAULT_DELIVERY_RADIUS_KM
  const beyondDeliveryRadius = deliveryDistance !== null && deliveryDistance > deliveryRadius
  const minimumOrder = Number(cfg.min_order || 0)
  const minimumOrderMet = sub >= minimumOrder
  const disc = useCoins ? Math.min(Math.floor(me.coins / 100), Math.floor((Math.max(0, sub - couponDisc) * (cfg.max_coin_pct || 20)) / 100)) : 0
  const gstIncluded = Math.round(sub * 5 / 105)
  const total = Math.max(0, sub + deliveryFee - disc - couponDisc)
  const qty = (k, d) => { setCouponResult(null); setCart((c) => c.map((x, i) => (i === k ? { ...x, qty: x.qty + d } : x)).filter((x) => x.qty > 0)) }

  const place = async () => {
    if (!customerName.trim() || !ph.trim() || !addr.trim()) return say('Enter your name, phone number, and delivery address.')
    if (!minimumOrderMet) return say(`Minimum order is ₹${minimumOrder}.`)
    if (beyondDeliveryRadius) return say(`Delivery is available only within ${deliveryRadius} km.`)
    setBusy(true)
    try {
      const { data: orderId, error } = await sb.rpc('place_order_with_coupon', {
        p_items: cart.map((x) => ({ variant_id: x.vid, qty: x.qty, extras:(x.extras||[]).map(e=>({id:e.id})) })),
        p_use_coins: useCoins,
        p_address: addr,
        p_phone: ph,
        p_coupon_code: couponResult?.code || null,
        p_customer_name: customerName,
        p_distance_km: deliveryDistance === null ? null : Number(deliveryDistance.toFixed(2))
      })
      if (error) return say(error.message)
      setCart([])
      done(orderId)
    } catch (error) {
      say(error.message || 'Could not place the order. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  const validateCoupon = useCallback(async (code = coupon) => {
    try {
      const { data, error } = await sb.rpc('validate_coupon', { p_code: code, p_subtotal: sub })
      if (error) { setCouponResult(null); return say(error.message) }
      if (!data?.valid) { setCouponResult(null); return say(data?.message || 'Coupon unavailable') }
      setCouponResult(data)
      setCoupon(data.code)
      say(`Voucher applied · save ₹${data.discount_amount}`)
    } catch (error) {
      setCouponResult(null)
      say(error.message || 'Could not validate the voucher. Please try again.')
    }
  }, [coupon, sub, say])
  useEffect(() => {
    if (voucherCode) {
      setCoupon(voucherCode)
      validateCoupon(voucherCode)
    }
  }, [voucherCode])
  useEffect(() => {
    setCustomerName(me.name || '')
    setAddr([me.address, me.area, me.city].filter(Boolean).join(', '))
    setPh(me.phone || '')
  }, [me.id, me.name, me.address, me.area, me.city, me.phone])
  const checkDeliveryDistance = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported. Enter your delivery address to continue with the base fee.')
      return
    }
    setLocationMessage('Finding your location…')
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const distance = distanceInKm({ latitude: coords.latitude, longitude: coords.longitude }, DELIVERY_POINT)
      const roundedDistance = Number(distance.toFixed(2))
      setDeliveryDistance(roundedDistance)
      if (roundedDistance > deliveryRadius) setLocationMessage(`You are ${roundedDistance.toFixed(1)} km away; delivery is available within ${deliveryRadius} km.`)
      else setLocationMessage(`Estimated distance: ${roundedDistance.toFixed(1)} km.`)
    }, (error) => {
      setDeliveryDistance(null)
      setLocationMessage(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied. Enter your address to continue with the base fee.'
        : 'Could not detect your location. Enter your address to continue with the base fee.')
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
  }

  if (!cart.length) return <div className="empty">Your cart is empty. Add something from Home.</div>

  return (
    <>
      {cart.map((x, k) => (
        <div key={`${x.vid}-${(x.extras||[]).map(e=>e.id).sort().join('-')}`} className="card row between">
          <div className="fx"><b>{x.name}</b>{(x.extras||[]).length>0&&<small>{x.extras.map(e=>e.name).join(', ')}</small>}</div>
          <div className="row">
            <button className="pill g" onClick={() => qty(k, -1)}>-</button><b>{x.qty}</b>
            <button className="pill g" onClick={() => qty(k, 1)}>+</button>
          </div>
          <b style={{ width: 60, textAlign: 'right' }}>₹{x.price * x.qty}</b>
        </div>
      ))}
      <div className="card">
        <div className="cart-customer-fields">
          <label>Full name<input autoComplete="name" maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Full name" required /></label>
          <label>Delivery address<input autoComplete="street-address" maxLength={240} value={addr} onChange={(event) => setAddr(event.target.value)} placeholder="House, street, landmark" required /></label>
          <label>Phone number<input autoComplete="tel" inputMode="tel" maxLength={20} value={ph} onChange={(event) => setPh(event.target.value)} placeholder="Phone number" required /></label>
        </div>
        <button type="button" className="delivery-location-button" onClick={checkDeliveryDistance}>⌖ Use current location for distance</button>
        {locationMessage && <small className={`delivery-location-message${beyondDeliveryRadius ? ' unavailable' : ''}`} role="status">{locationMessage}</small>}
        <label className="row">
          <input type="checkbox" style={{ width: 20 }} checked={useCoins} onChange={(e) => setUseCoins(e.target.checked)} />
          <span>Use coins (100 coins = ₹1). You have {me.coins}.</span>
        </label>
        <div className="coupon-entry"><input aria-label="Voucher code" placeholder="Coupon / voucher code" value={coupon} onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponResult(null) }} /><button type="button" className="pill" onClick={() => validateCoupon()}>Apply</button></div>
        {couponResult && <small className="coupon-applied">{couponResult.code} applied · save ₹{couponDisc}</small>}
        <div className="cart-price-breakdown">
          {!minimumOrderMet && <p className="cart-minimum-note">Add ₹{minimumOrder - sub} more to meet the ₹{minimumOrder} minimum order.</p>}
          <div className="row between"><span>Items (GST included)</span><span>₹{sub}</span></div>
          <div className="row between cart-gst-row"><span>GST included (5%)</span><span>₹{gstIncluded}</span></div>
          {couponDisc > 0 && <div className="row between ac"><span>Voucher discount</span><span>-₹{couponDisc}</span></div>}
          <div className="row between"><span>Delivery{deliveryDistance !== null ? ` · ${deliveryDistance.toFixed(1)} km` : ''}</span>
            {freeDelivery
              ? <span className="delivery-waived"><s>₹{deliveryFeeBeforeDiscount}</s> <b>FREE · ₹0</b></span>
              : <span>₹{deliveryFee}</span>}
          </div>
          {disc > 0 && <div className="row between ac"><span>Coin discount</span><span>-₹{disc}</span></div>}
          <div className="row between"><h3>Total</h3><h3>₹{total}</h3></div>
        </div>
        {!cfg.store_online&&<p className="offline-banner">{cfg.offline_message||'Ordering is offline right now. Please try later.'}</p>}
        <button className="pill wide" disabled={busy || !customerName.trim() || !ph.trim() || !addr.trim() || !minimumOrderMet || beyondDeliveryRadius || cfg.store_online===false} onClick={place}>{busy ? 'Placing order…' : cfg.store_online===false ? 'Ordering unavailable' : beyondDeliveryRadius ? 'Outside delivery area' : !minimumOrderMet ? `Minimum order ₹${minimumOrder}` : 'Place order, pay on delivery'}</button>
      </div>
    </>
  )
}

function CustomerOrderJourney({order}){
 const events=[...(order.order_stage_events||[])].sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at))
 if(!events.length)return null
 return <div className="customer-order-journey"><b>ORDER JOURNEY</b>{events.map((event,index)=><div className="customer-order-event" key={event.id}><i/><span><strong>{LABEL[event.stage]||event.stage.replaceAll('_',' ')}</strong><small>{new Date(event.occurred_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}{index<events.length-1?` · ${Math.max(0,Math.round((new Date(events[index+1].occurred_at)-new Date(event.occurred_at))/60000))} min`:''}</small>{event.stage==='rejected'&&event.note&&<small>{event.note}</small>}</span></div>)}</div>
}

function History({ me }) {
  const [rows, setRows] = useState([])
  const [reviews, setReviews] = useState({})
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState(null)
  const [feedbackError, setFeedbackError] = useState('')
  const [reviewLoadError, setReviewLoadError] = useState('')
  const [orderLoadError, setOrderLoadError] = useState('')
  const load = useCallback(async () => {
    let result=await sb.from('orders').select('*, order_items(*), order_stage_events(*)').order('created_at', { ascending: false })
    if(result.error)result=await sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })
    if(result.error) {
      setOrderLoadError(result.error.message)
      return
    }
    setOrderLoadError('')
    setRows(result.data || [])
    if(me?.id){
      const reviewResult=await sb.from('order_reviews').select('order_id,rating,feedback').eq('user_id',me.id)
      if(reviewResult.error) setReviewLoadError(reviewResult.error.message)
      else {
        setReviewLoadError('')
        setReviews(Object.fromEntries((reviewResult.data||[]).map(review=>[review.order_id,review])))
      }
    }
  }, [me?.id])

  const submitReview=async(order)=>{
    const draft=drafts[order.id]||{}
    if(!draft.rating)return setFeedbackError('Choose a star rating before submitting.')
    setSaving(order.id);setFeedbackError('')
    try {
      const {data,error}=await sb.from('order_reviews').insert({order_id:order.id,user_id:me.id,rating:draft.rating,feedback:(draft.feedback||'').trim()||null}).select('order_id,rating,feedback').single()
      if(error) setFeedbackError(error.message)
      else setReviews(current=>({...current,[order.id]:data}))
    } catch (error) {
      setFeedbackError(error.message || 'Could not send your feedback. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  useEffect(() => {
    load()
    const ch = sb.channel('my-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${me.id}` }, load)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [load, me.id])

  if (orderLoadError) return <div className="card" role="alert"><b>Order history could not be loaded.</b><p>{orderLoadError}</p><button className="pill" onClick={load}>Try again</button></div>
  if (!rows.length) return <div className="empty">No orders yet. Your first delivered order starts your streak.</div>
  return <>
    {reviewLoadError&&<div className="card" role="alert"><b>Ratings and reviews are unavailable.</b><p>{reviewLoadError}</p><small>Ask the administrator to run order_reviews.sql in the Supabase SQL Editor.</small><button className="pill" onClick={load}>Try again</button></div>}
    {rows.map((o) => (
    <div key={o.id} className="card">
      <div className="row between"><b>Order #{o.id}</b><span className="ac">{LABEL[o.order_stage]||LABEL[o.status]||o.status}</span></div>
      <small>{new Date(o.created_at).toLocaleString()}</small>
      {o.order_stage&&!['rejected','cancelled'].includes(o.order_stage)&&<div className="stp">{STEPS.map((s, i) => <i key={s} className={i <= STEPS.indexOf(o.order_stage) ? 'on' : ''} />)}</div>}
      <CustomerOrderJourney order={o}/>
      {!['delivered','rejected','cancelled'].includes(o.order_stage||'pending')&&<small className="customer-eta">Estimated arrival around {new Date(new Date(o.created_at).getTime()+45*60000).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})} · typical delivery takes 35–50 minutes</small>}
      {o.rejection_reason&&<p className="order-rejection">{o.rejection_reason}</p>}
      {o.payment_type&&<small>Paid by {o.payment_type}</small>}
      {o.order_items.map((x) => <div key={x.id}>{x.item_name} x{x.qty}</div>)}
      <b>₹{o.total}</b>
      {(o.order_stage||o.status)==='delivered'&&<div className="order-feedback">
        {reviews[o.id]?<><strong>Thanks for your feedback</strong><div className="order-feedback-stars" aria-label={`${reviews[o.id].rating} out of 5 stars`}>{Array.from({length:5},(_,index)=><span key={index} className={index<reviews[o.id].rating?'selected':''}>★</span>)}</div>{reviews[o.id].feedback&&<small>{reviews[o.id].feedback}</small>}</>:<>
          <strong>How was this order?</strong>
          <div className="order-feedback-stars" role="group" aria-label="Rate your order">{[1,2,3,4,5].map(rating=><button type="button" key={rating} className={(drafts[o.id]?.rating||0)>=rating?'selected':''} aria-label={`${rating} star${rating===1?'':'s'}`} aria-pressed={(drafts[o.id]?.rating||0)===rating} onClick={()=>setDrafts(current=>({...current,[o.id]:{...current[o.id],rating}}))}>★</button>)}</div>
          <textarea maxLength={500} value={drafts[o.id]?.feedback||''} onChange={event=>setDrafts(current=>({...current,[o.id]:{...current[o.id],feedback:event.target.value}}))} placeholder="Share a comment about your food or delivery (optional)" />
          <button className="admin-primary" disabled={saving===o.id} onClick={()=>submitReview(o)}>{saving===o.id?'Sending…':'Send feedback'} <span>→</span></button>
          {feedbackError&&<small role="alert">{feedbackError}</small>}
        </>}
      </div>}
    </div>
  ))}
  </>
}

function Feed({ me, say }) {
  const [d, setD] = useState({ p: [], pr: [], rc: [], cm: [], mv: [], mr: [], vc: [] })
  const [txt, setTxt] = useState({})
  const [commentOpen, setCommentOpen] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const r = await Promise.all([
      sb.from('feed_posts').select('*, poll_options(*)').order('created_at', { ascending: false }),
      sb.from('poll_results').select('*'),
      sb.from('reaction_counts').select('*'),
      sb.from('feed_comments').select('*').order('created_at'),
      sb.from('poll_votes').select('post_id,option_id'),
      sb.from('reactions').select('post_id,emoji'),
      sb.from('feed_view_counts').select('*')
    ])
    const posts = r[0].data || []
    let viewCounts = r[6].data || []
    if (posts.length) {
      const { error } = await sb.from('feed_views').upsert(posts.map((post) => ({ post_id: post.id, user_id: me.id })), { onConflict: 'post_id,user_id', ignoreDuplicates: true })
      if (!error) {
        const views = await sb.from('feed_view_counts').select('*')
        viewCounts = views.data || viewCounts
      }
    }
    setD({ p: posts, pr: r[1].data || [], rc: r[2].data || [], cm: r[3].data || [], mv: r[4].data || [], mr: r[5].data || [], vc: viewCounts })
    setLoading(false)
  }, [me.id])
  useEffect(() => { load() }, [load])

  const vote = async (post, option) => {
    const { error } = await sb.from('poll_votes').insert({ post_id: post, user_id: me.id, option_id: option })
    error ? say(error.message) : load()
  }
  const react = async (post, emoji) => {
    const mine = d.mr.some((x) => x.post_id === post && x.emoji === emoji)
    const { error } = await (mine
      ? sb.from('reactions').delete().match({ post_id: post, user_id: me.id, emoji })
      : sb.from('reactions').insert({ post_id: post, user_id: me.id, emoji }))
    if (error) return say(error.message)
    load()
  }
  const comment = async (post) => {
    const body = (txt[post] || '').trim()
    if (!body) return
    const { error } = await sb.from('comments').insert({ post_id: post, user_id: me.id, body })
    if (error) return say(error.message)
    setTxt({ ...txt, [post]: '' })
    setCommentOpen((current) => ({ ...current, [post]: true }))
    load()
  }

  if (loading) return <section className="feed-page"><h1 className="games-eyebrow">FEED</h1><div className="feed-empty">Loading posts…</div></section>
  if (!d.p.length) return <section className="feed-page"><h1 className="games-eyebrow">FEED</h1><div className="feed-empty">No updates yet. Check back soon.</div></section>
  return <section className="feed-page">
    <h1 className="games-eyebrow">FEED</h1>
    <div className="feed-timeline">{d.p.map((p) => {
    const voted = d.mv.find((x) => x.post_id === p.id)
    const votes = (o) => d.pr.find((x) => x.option_id === o)?.votes || 0
    const options = p.poll_options || []
    const total = options.reduce((a, o) => a + votes(o.id), 0)
    const comments = d.cm.filter((comment) => comment.post_id === p.id)
    const liked = d.mr.some((item) => item.post_id === p.id && item.emoji === '❤️')
    return (
      <article key={p.id} className="feed-post">
        <div className="feed-rail"><div className="feed-brand-avatar"><span>EAT<b>60</b></span></div><i /></div>
        <div className="feed-post-body">
          <header className="feed-author"><b>@eat60.in</b><span className="verified-badge" aria-label="Verified account">✓</span><small>{new Date(p.created_at).toLocaleDateString()}</small></header>
          <p className="feed-post-copy">{p.body}</p>
          {p.image_url && <img className="feed-post-image" src={p.image_url} alt="Feed post" loading="lazy" />}
          {p.kind === 'poll' && <div className="feed-poll">{options.map((option) => {
            const percent = total ? Math.round((votes(option.id) * 100) / total) : 0
            return voted ? <div className={`feed-poll-result${voted.option_id === option.id ? ' chosen' : ''}`} key={option.id}><i style={{ width: `${percent}%` }} /><span>{option.label}</span><b>{percent}%</b></div> : <button className="feed-poll-option" key={option.id} onClick={() => vote(p.id, option.id)}>{option.label}<span>→</span></button>
          })}</div>}
          <div className="feed-engagement">
            <button className={liked ? 'liked' : ''} onClick={() => react(p.id, '❤️')} aria-label={liked ? 'Unlike post' : 'Like post'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/></svg><span>{d.rc.find((item) => item.post_id === p.id && item.emoji === '❤️')?.total || 0}</span></button>
            <button onClick={() => setCommentOpen((current) => ({ ...current, [p.id]: !current[p.id] }))} aria-label="Show comments"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v13H9l-5 4V4Z"/></svg><span>{comments.length}</span></button>
            <div aria-label="Views"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg><span>{d.vc.find((item) => item.post_id === p.id)?.total || 0}</span></div>
          </div>
          {commentOpen[p.id] ? <div className="feed-comments">
            {comments.slice(-3).map((item) => <p className={item.parent_comment_id?'feed-admin-reply':''} key={item.id}><b>{item.parent_comment_id?'↳ ':''}{item.author}{item.is_admin?' · EAT60':''}</b><span>{item.body}</span></p>)}
            <div className="feed-comment-form"><input maxLength={300} placeholder="Write a comment…" value={txt[p.id] || ''} onChange={(event) => setTxt({ ...txt, [p.id]: event.target.value })} onKeyDown={(event) => { if (event.key === 'Enter') comment(p.id) }} /><button onClick={() => comment(p.id)} aria-label="Post comment">Post</button></div>
          </div> : <button className="feed-add-comment" onClick={() => setCommentOpen((current) => ({ ...current, [p.id]: true }))}><span>＋</span> ADD A COMMENT</button>}
        </div>
      </article>
    )
  })}</div>
  </section>
}

const MATH_RANKS = [
  { name: 'Bronze', start: 0, next: 10, color: '#d99a5b' },
  { name: 'Silver', start: 10, next: 25, color: '#c8cbd1' },
  { name: 'Gold', start: 25, next: 45, color: '#ffd34d' },
  { name: 'Diamond', start: 45, next: null, color: '#68d9ff' }
]

function rankForScore(score) {
  return MATH_RANKS.reduce((current, rank) => score >= rank.start ? rank : current, MATH_RANKS[0])
}

function makeRankedQuestion(score) {
  const rank = rankForScore(score)
  const tier = MATH_RANKS.indexOf(rank)
  const limit = [15, 40, 120, 300][tier]
  const whole = (max) => 2 + Math.floor(Math.random() * Math.max(1, max - 1))
  const gcd = (x, y) => y === 0 ? x : gcd(y, x % y)
  const type = ['Addition', 'Subtraction', 'Multiplication', 'Division', 'Square root', 'Square', 'HCF', 'LCM', 'Modulo'][Math.floor(Math.random() * 9)]
  let a, b, answer, text

  if (type === 'Addition') {
    a = whole(limit); b = whole(limit); answer = a + b; text = `${a} + ${b}`
  } else if (type === 'Subtraction') {
    a = whole(limit); b = whole(Math.min(limit, a)); answer = a - b; text = `${a} − ${b}`
  } else if (type === 'Multiplication') {
    const factorLimit = [10, 18, 40, 100][tier]
    a = whole(factorLimit); b = whole(factorLimit); answer = a * b; text = `${a} × ${b}`
  } else if (type === 'Division') {
    b = whole([6, 12, 25, 40][tier]); const quotient = whole([12, 30, 80, 200][tier])
    a = b * quotient; answer = quotient; text = `${a} ÷ ${b}`
  } else if (type === 'Square root') {
    const root = whole(limit); answer = root; text = `√${root * root}`
  } else if (type === 'Square') {
    a = whole(limit); answer = a * a; text = `${a}²`
  } else if (type === 'HCF') {
    a = whole(limit); b = whole(limit); answer = gcd(a, b); text = `HCF(${a}, ${b})`
  } else if (type === 'LCM') {
    a = whole(limit); b = whole(limit); answer = (a / gcd(a, b)) * b; text = `LCM(${a}, ${b})`
  } else {
    b = whole([8, 15, 30, 60][tier]); a = whole(limit * 2); answer = a % b; text = `${a} mod ${b}`
  }
  return { text, answer, type }
}

function Maths({ onEnd, onQuit }) {
  const [left, setLeft] = useState(120)
  const [score, setScore] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answerFeedback, setAnswerFeedback] = useState('')
  const [q, setQ] = useState(() => makeRankedQuestion(0))
  const scoreRef = useRef(0)
  const endedRef = useRef(false)
  const start = useRef(Date.now())

  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (left === 0 && !endedRef.current) {
      endedRef.current = true
      onEnd(scoreRef.current, Math.min(120000, Math.max(1000, Date.now() - start.current)))
    }
  }, [left, onEnd])

  const submitAnswer = () => {
    if (!answer.trim()) return
    if (Number(answer) === q.answer) {
      scoreRef.current++
      setScore(scoreRef.current)
      setAnswer('')
      setAnswerFeedback('')
      setQ(makeRankedQuestion(scoreRef.current))
      return
    }
    setAnswerFeedback('Not quite — try again. The question stays the same.')
  }
  const typeDigit = (key) => {
    if (key === 'back') return setAnswer((current) => current.slice(0, -1))
    if (key === 'clear') return setAnswer('')
    setAnswer((current) => current.length < 7 ? current + key : current)
  }
  const tier = rankForScore(score)
  const tierIndex = MATH_RANKS.indexOf(tier)
  const progress = tier.next ? Math.min(100, ((score - tier.start) / (tier.next - tier.start)) * 100) : 100
  const timeLabel = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`

  return (
    <div className="maths-round" style={{ '--tier-color': tier.color }}>
      <div className="maths-topbar">
        <div className="maths-player"><button className="game-exit" onClick={onQuit} aria-label="Exit game">←</button><span>🧠</span><div><b>QUICK MATHS</b><small>{tier.name} · {score} correct</small></div></div>
        <div className="maths-timer" aria-live="polite">{timeLabel}</div>
      </div>
      <div className="maths-tier"><div className="maths-tier-label"><b>{tier.name.toUpperCase()}</b><span>{tierIndex + 1} / 4 RANKS</span></div><div className="maths-tier-track"><i style={{ width: `${progress}%` }} /></div><small>{tier.next ? `${tier.next - score} correct answers to ${MATH_RANKS[tierIndex + 1].name}` : 'Top rank reached — keep scoring!'}</small></div>
      <div className="maths-question-area">
        <small>{q.type.toUpperCase()} · ANSWER THE QUESTION</small>
        <h1 className="math-question">{q.text}</h1>
        <form onSubmit={(event) => { event.preventDefault(); submitAnswer() }}>
          <input className="math-answer" type="text" inputMode="none" autoComplete="off" aria-label="Your answer" placeholder="Type your answer" value={answer} onChange={(event) => { setAnswer(event.target.value.replace(/\D/g, '').slice(0,7)); setAnswerFeedback('') }} />
        </form>
        {answerFeedback && <p className="math-answer-feedback" role="status">{answerFeedback}</p>}
      </div>
      <div className="math-keypad" aria-label="Number keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => (
          <button key={key} className={key === 'back' ? 'math-backspace' : ''} onClick={() => typeDigit(key)} aria-label={key === 'back' ? 'Backspace' : key === '.' ? 'Decimal point' : key}>
            {key === 'back' ? '⌫' : key === 'clear' ? 'C' : key}
          </button>
        ))}
      </div>
      <button className="math-submit" onClick={submitAnswer} disabled={!answer.trim()}>SUBMIT ANSWER <span>↗</span></button>
    </div>
  )
}

const GRID_SIZE = 16
const startSnake = () => ({
  snake: [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }],
  food: { x: 11, y: 8 }, direction: { x: 1, y: 0 }, score: 0, fruit:0,lives:3,left:60,over: false
})

function SnakeGame({ onEnd, onQuit }) {
  const gameRef = useRef(startSnake())
  const directionRef = useRef({ x: 1, y: 0 })
  const startedAt=useRef(Date.now());const onEndRef=useRef(onEnd);onEndRef.current=onEnd
  const [game, setGame] = useState(gameRef.current)
  const setGameState = (next) => { gameRef.current = next; setGame(next) }

  const turn = (next) => {
    const current = directionRef.current
    if (next.x === -current.x && next.y === -current.y) return
    directionRef.current = next
    setGameState({ ...gameRef.current, direction: next })
  }

  useEffect(() => {
    const onKey = (event) => {
      const dirs = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }
      }
      if (!dirs[event.key]) return
      event.preventDefault()
      turn(dirs[event.key])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let timer;let stopped=false
    const step=()=>{
      if(stopped)return
      const current = gameRef.current
      if (current.over)return
      const direction = directionRef.current
      const head = { x: current.snake[0].x + direction.x, y: current.snake[0].y + direction.y }
      const ate = head.x === current.food.x && head.y === current.food.y
      const body = ate ? current.snake : current.snake.slice(0, -1)
      const hit = head.x < 0 || head.y < 0 || head.x >= GRID_SIZE || head.y >= GRID_SIZE ||
        body.some((part) => part.x === head.x && part.y === head.y)
      if (hit) {
        const lives=current.lives-1
        if(lives<=0){setGameState({...current,lives:0,over:true});onEndRef.current(current.score,Math.max(1000,Date.now()-startedAt.current));return}
        directionRef.current={x:1,y:0}
        setGameState({...startSnake(),score:current.score,fruit:current.fruit,lives,left:current.left})
      }else{
        const snake = [head, ...current.snake]
        if (!ate) snake.pop()
        let food = current.food;let score=current.score;let fruit=current.fruit;let left=current.left
        if (ate) {
          fruit++;score+=10;left=Math.min(90,left+5)
          do { food = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) } }
          while (snake.some((part) => part.x === food.x && part.y === food.y))
        }
        setGameState({ ...current, snake, food, score,fruit,left })
      }
      const latest=gameRef.current
      if(!latest.over)timer=setTimeout(step,Math.max(75,220-latest.fruit*7))
    }
    timer=setTimeout(step,220)
    return()=>{stopped=true;clearTimeout(timer)}
  }, [])

  useEffect(()=>{const timer=setInterval(()=>{const current=gameRef.current;if(current.over)return;const left=current.left-1;if(left<=0){const ended={...current,left:0,over:true};setGameState(ended);onEndRef.current(current.score,Math.max(1000,Date.now()-startedAt.current))}else setGameState({...current,left})},1000);return()=>clearInterval(timer)},[])

  const snakeCells = new Set(game.snake.map((part) => part.y * GRID_SIZE + part.x))
  const headCell = game.snake[0].y * GRID_SIZE + game.snake[0].x
  const foodCell = game.food.y * GRID_SIZE + game.food.x
  return (
    <div className="game-stage">
      <div className="game-stage-head"><button className="game-exit" onClick={onQuit} aria-label="Exit game">←</button><b>HUNGRY SNAKES</b><span>🍎 {game.fruit}</span><span>♥ {game.lives}</span><span>{game.left}s</span><strong>{game.score} pts</strong></div>
      <div className="snake-board" role="img" aria-label={`Snake game board. Score ${game.score}`}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, cell) => {
          const partIndex=game.snake.findIndex(part=>part.y*GRID_SIZE+part.x===cell)
          return <i key={cell} className={`${partIndex>=0 ? 'snake-cell' : ''}${cell === headCell ? ' snake-head' : ''}${cell === foodCell ? ' snake-food' : ''}`} style={partIndex>=0?{'--segment-index':partIndex}:undefined}/>
        })}
      </div>
      <div className="snake-controls" aria-label="Snake controls">
        <span />
        <button onClick={() => turn({ x: 0, y: -1 })} aria-label="Move up">↑</button>
        <span />
        <button onClick={() => turn({ x: -1, y: 0 })} aria-label="Move left">←</button>
        <button onClick={() => turn({ x: 0, y: 1 })} aria-label="Move down">↓</button>
        <button onClick={() => turn({ x: 1, y: 0 })} aria-label="Move right">→</button>
      </div>
      <p className="game-hint">Use arrows, WASD or touch controls. Fruit adds points and 5 seconds. Avoid walls and yourself.</p>
      {game.over&&<div className="game-over-overlay"><small>RUN COMPLETE</small><b>{game.score} POINTS</b><span>{game.fruit} fruit · {game.lives} lives left</span><button className="math-submit" onClick={onQuit}>BACK TO GAMES</button></div>}
    </div>
  )
}

function FlyingBurger({ onEnd, onQuit }) {
  const [state,setState]=useState({bird:48,score:0,lives:2,left:20,pipes:[{id:1,x:108,gap:49,passed:false}],over:false})
  const stateRef=useRef(state);const velocity=useRef(0);const startRef=useRef(Date.now());const endRef=useRef(false);const immuneUntil=useRef(0);const onEndRef=useRef(onEnd);onEndRef.current=onEnd
  const update=(next)=>{stateRef.current=next;setState(next)}
  const flap=()=>{if(!stateRef.current.over)velocity.current=-1.15}
  useEffect(()=>{const key=e=>{if(e.code==='Space'||e.key==='ArrowUp'){e.preventDefault();flap()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[])
  useEffect(()=>{
    const timer=setInterval(()=>{const current=stateRef.current;if(current.over)return;const elapsed=Math.max(1000,Date.now()-startRef.current);const bird=Math.max(4,Math.min(96,current.bird+(velocity.current+=.075)));let pipes=current.pipes.map(pipe=>({...pipe,x:pipe.x-1.05}));if(pipes[pipes.length-1].x<68)pipes=[...pipes,{id:Date.now(),x:108,gap:23+Math.random()*54,passed:false}];let score=current.score;let crash=false
      pipes=pipes.map(pipe=>{if(!pipe.passed&&pipe.x<22){score+=10;return{...pipe,passed:true}}if(Date.now()>immuneUntil.current&&pipe.x<28&&pipe.x>12&&(bird<pipe.gap-14||bird>pipe.gap+14))crash=true;return pipe})
      if(bird<=5||bird>=95)crash=true
      let lives=current.lives
      if(crash){lives--;velocity.current=0;if(lives<=0){const ended={...current,score,lives:0,over:true};update(ended);if(!endRef.current){endRef.current=true;onEndRef.current(score,Math.min(24000,elapsed))}return}immuneUntil.current=Date.now()+1100;update({...current,score,lives,bird:48,pipes:pipes.filter(p=>p.x>33)})}else update({...current,score,bird,pipes:pipes.filter(p=>p.x>-15)})
    },40)
    const clock=setInterval(()=>{const current=stateRef.current;if(current.over)return;const left=current.left-1;if(left<=0){update({...current,left:0,over:true});if(!endRef.current){endRef.current=true;onEndRef.current(current.score,Math.min(24000,Math.max(1000,Date.now()-startRef.current)))}}else update({...current,left})},1000)
    return()=>{clearInterval(timer);clearInterval(clock)}
  },[])
  return <div className="game-stage burger-game-stage"><div className="game-stage-head"><button className="game-exit" onClick={onQuit} aria-label="Exit game">←</button><b>FLYING BURGER</b><span>♥ {state.lives}</span><span>{state.left}s</span><strong>{state.score} pts</strong></div><div className="burger-arena" onPointerDown={flap} role="button" tabIndex={0} aria-label="Tap anywhere to fly upward"><div className="burger-ground"/><div className="burger-bird" style={{top:`${state.bird}%`}}>🍔</div>{state.pipes.map(pipe=><Fragment key={pipe.id}><i className="burger-pipe top" style={{left:`${pipe.x}%`,height:`${pipe.gap-15}%`}}/><i className="burger-pipe bottom" style={{left:`${pipe.x}%`,top:`${pipe.gap+15}%`,height:`${85-pipe.gap}%`}}/></Fragment>)}<span className="burger-tap-hint">TAP TO FLY</span></div><p className="game-hint">Tap or press ↑ / Space to flap. Fly between the pipes. Two lives.</p>{state.over&&<div className="game-over-overlay"><small>GAME OVER</small><b>{state.score} POINTS</b><button className="math-submit" onClick={onQuit}>BACK TO GAMES</button></div>}</div>
}

function Games({ reload, say, me, initialView, onFocus = () => {} }) {
  const [playing, setPlaying] = useState(null)
  const [countdown,setCountdown]=useState(null)
  const [lb, setLb] = useState([])
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [rank, setRank] = useState(null)
  const [view, setView] = useState(initialView || 'games')
  useEffect(() => setView(initialView || 'games'), [initialView])
  useEffect(()=>{if(countdown===null)return;const timer=setInterval(()=>setCountdown(n=>{if(n<=1){clearInterval(timer);return null}return n-1}),1000);return()=>clearInterval(timer)},[countdown])
  const loadLb = () => sb.rpc('get_leaderboard').then(({ data }) => {
    setLb(data || [])
    setRank(data?.find((row) => row.is_me)?.rank ?? null)
  })
  useEffect(() => { loadLb() }, [])

  const finish = async (game, score, ms) => {
    setPlaying(null)
    setCountdown(null)
    onFocus(false)
    setBusy(true)
    const { data, error } = await sb.rpc('submit_game_score', { p_game: game, p_score: score, p_duration_ms: ms })
    setBusy(false)
    if (error) return say(error.message)
    setRes({ game, score, ...data })
    reload()
    loadLb()
  }
  const startGame=(id)=>{setRes(null);setPlaying(id);setCountdown(5);onFocus(true)}
  const quitGame=()=>{setPlaying(null);setCountdown(null);onFocus(false)}

  if(countdown!==null)return <div className="game-countdown-screen"><button onClick={quitGame} aria-label="Leave game">×</button><small>GET READY</small><h1>{countdown}</h1><p>{playing==='snake'?'Hungry Snakes':playing==='burger'?'Flying Burger':'Quick Maths'}</p></div>
  if (playing === 'snake') return <SnakeGame onEnd={(score, ms) => finish('snake', score, ms)} onQuit={quitGame} />
  if (playing === 'burger') return <FlyingBurger onEnd={(score, ms) => finish('burger', score, ms)} onQuit={quitGame} />
  if (playing === 'qmaths') return <Maths onEnd={(score, ms) => finish('qmaths', score, ms)} onQuit={quitGame} />
  const daysLeft = 7 - new Date().getDay()
  if (view === 'rankings') return <WeeklyLeague rows={lb} daysLeft={daysLeft || 7} onBack={() => setView('games')} />
  if (view === 'scores') return <MyGameScores me={me} onBack={() => setView('games')} />
  const games = [
    { id: 'snake', title: 'Hungry Snakes', subtitle: 'Improve rank, earn rewards & coins', icon: '🐍', color: 'snake' },
    { id: 'burger', title: 'Flying Burger', subtitle: 'Improve rank, earn rewards & coins', icon: '🍔', color: 'burger' },
    { id: 'qmaths', title: 'Quick Maths', subtitle: 'Improve rank, earn rewards & coins', icon: '🧮', color: 'maths' }
  ]
  return (
    <section className="games-page">
      <header className="games-hero">
        <div><p className="games-eyebrow">GAMES</p><h2>GETTING BORED?<br /><span>TIRED OF DOOM SCROLLING?</span></h2></div>
        <button className="rank-display" onClick={() => setView('rankings')} aria-label="Open weekly league standings"><b>#{rank ?? '—'}</b><span>RANK <small>VIEW LEAGUE ↗</small></span></button>
        <div className="week-pill">◷ &nbsp; {daysLeft || 7} DAYS LEFT THIS WEEK</div>
      </header>
      <div className="game-hub-links">
        <button onClick={() => setView('rankings')}><span className="hub-link-icon rank">♜</span><span><b>WEEKLY RANKINGS</b><small>See your league position</small></span><strong>#{rank ?? '—'} →</strong></button>
        <button onClick={() => setView('scores')}><span className="hub-link-icon score">✦</span><span><b>MY SCORES & BADGES</b><small>Personal bests and achievements</small></span><strong>{me?.xp ?? 0} XP →</strong></button>
      </div>
      <h3 className="games-list-title">PLAY THESE GAMES</h3>
      {res && <div className="game-result"><b>{games.find((game) => game.id === res.game)?.title}: {res.score}</b><span>+{res.xp} XP · +{res.coins} coins</span></div>}
      {busy && <p className="game-saving">Saving your score…</p>}
      <div className="games-list">
        {games.map((game, index) => (
          <button key={game.id} className={`game-card ${game.color}`} disabled={busy} onClick={() => startGame(game.id)}>
            <span className="game-card-number">GAME {String(index + 1).padStart(2, '0')}</span>
            <span className="game-card-copy"><b>{game.title}</b><small>{game.subtitle}</small><span className="game-card-play">PLAY NOW <i>→</i></span></span>
            <span className="game-card-art">{game.icon}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function MyGameScores({ me, onBack }) {
  const [scores, setScores] = useState([])
  const [roundCount, setRoundCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    sb.from('game_scores').select('game,score,xp,played_at', { count: 'exact' }).order('played_at', { ascending: false }).limit(250)
      .then(({ data, count, error: queryError }) => {
        setScores(data || [])
        setRoundCount(count || 0)
        setError(queryError?.message || '')
        setLoading(false)
      })
  }, [])
  const best = (game) => Math.max(0, ...scores.filter((score) => score.game === game).map((score) => score.score))
  const playedGames = new Set(scores.map((score) => score.game))
  const mathAnswers = scores.filter((score) => score.game === 'qmaths').reduce((sum, score) => sum + score.score, 0)
  const badges = [
    { icon: '🚀', title: 'First round', detail: 'Play your first game', unlocked: roundCount > 0 },
    { icon: '🐍', title: 'Snake charmer', detail: 'Score 50 in Hungry Snakes', unlocked: best('snake') >= 50 },
    { icon: '🍔', title: 'Burger catcher', detail: 'Score 50 in Flying Burger', unlocked: best('burger') >= 50 },
    { icon: '🧠', title: 'Quick thinker', detail: 'Answer 25 Quick Maths questions', unlocked: mathAnswers >= 25 },
    { icon: '🎮', title: 'All-rounder', detail: 'Try all three games', unlocked: playedGames.size >= 3 },
    { icon: '🏆', title: 'XP collector', detail: 'Earn 500 game XP', unlocked: (me?.xp || 0) >= 500 }
  ]
  const gameNames = { snake: 'Hungry Snakes', burger: 'Flying Burger', qmaths: 'Quick Maths' }
  return (
    <section className="scores-page">
      <FloatingBack onClick={onBack} label="Back to games" />
      <header className="scores-header"><div><p>PLAYER PROFILE</p><h1>MY SCORES</h1></div><span className="scores-header-icon">✦</span></header>
      <div className="scores-summary">
        <article><small>TOTAL GAME XP</small><b>{me?.xp ?? 0}</b></article>
        <article><small>ROUNDS PLAYED</small><b>{roundCount}</b></article>
        <article><small>BADGES EARNED</small><b>{badges.filter((badge) => badge.unlocked).length}<i> / {badges.length}</i></b></article>
      </div>
      <div className="achievement-heading"><div><p>COLLECT THEM ALL</p><h2>Achievement badges</h2></div><span>🏅</span></div>
      <div className="achievement-grid">{badges.map((badge) => <article key={badge.title} className={`achievement-badge${badge.unlocked ? ' earned' : ''}`}><span>{badge.icon}</span><b>{badge.title}</b><small>{badge.detail}</small><i>{badge.unlocked ? 'UNLOCKED' : 'LOCKED'}</i></article>)}</div>
      <div className="score-history-heading"><div><p>YOUR RECENT PLAY</p><h2>Score history</h2></div><small>Last {Math.min(scores.length, 250)} rounds</small></div>
      {loading && <p className="score-empty">Loading your scores…</p>}
      {error && <p className="score-error">{error}</p>}
      {!loading && !error && scores.length === 0 && <p className="score-empty">Your scores will appear here after your first game.</p>}
      <div className="score-history">{scores.slice(0, 15).map((score, index) => <article className="score-history-row" key={`${score.played_at}-${index}`}><span className={`score-history-icon ${score.game}`}>{score.game === 'snake' ? '🐍' : score.game === 'burger' ? '🍔' : '🧮'}</span><div><b>{gameNames[score.game] || score.game}</b><small>{new Date(score.played_at).toLocaleString()}</small></div><strong>{score.score} <small>PTS</small></strong><span className="score-xp">+{score.xp} XP</span></article>)}</div>
    </section>
  )
}

function WeeklyLeague({ rows, daysLeft, onBack }) {
  const [showRankUpdate, setShowRankUpdate] = useState(false)
  const me = rows.find((row) => row.is_me)
  useEffect(() => {
    if (!me || me.previous_rank == null || Number(me.previous_rank) === Number(me.rank)) return
    const weekStart = new Date()
    weekStart.setHours(0, 0, 0, 0)
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    const key = `eat60:rank-update:${weekStart.toLocaleDateString('en-CA')}:${me.previous_rank}:${me.rank}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, 'shown')
    setShowRankUpdate(true)
  }, [me?.rank, me?.previous_rank])
  const boundary = Math.max(1, Math.ceil(rows.length / 2))
  const demotionStart = Math.max(boundary, rows.length - Math.max(1, Math.ceil(rows.length / 3)))
  const movement = (row) => {
    if (row.previous_rank == null) return { text: 'NEW', type: 'new' }
    const change = Number(row.previous_rank) - Number(row.rank)
    if (change > 0) return { text: `↑ ${change}`, type: 'up' }
    if (change < 0) return { text: `↓ ${Math.abs(change)}`, type: 'down' }
    return { text: '—', type: 'same' }
  }
  return (
    <>
    <section className="league-page">
      <header className="league-header">
        <FloatingBack onClick={onBack} label="Back to games" />
        <div className="league-countdown">◷ <b>{daysLeft} days left</b></div>
      </header>
      <div className="league-emblem"><span>#{me?.rank ?? '—'}</span></div>
      <h1 className="league-title">WEEKLY LEAGUE</h1>
      {me && <p className="league-your-rank">YOU ARE RANKED <b>#{me.rank}</b> · <strong className={`movement ${movement(me).type}`}>{movement(me).text} THIS WEEK</strong></p>}
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
            <span className={`movement ${movement(row).type}`}>{movement(row).text}</span>
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
    </>
  )
}

function FlameAnimation() {
  const id = useId()
  const outer = `flame-outer-${id}`
  const inner = `flame-inner-${id}`
  return <svg className="animated-flame" viewBox="0 0 64 80" aria-hidden="true">
    <defs>
      <linearGradient id={outer} x1=".2" y1="1" x2=".8" y2="0"><stop stopColor="#ff3d16"/><stop offset=".58" stopColor="#ff8a22"/><stop offset="1" stopColor="#ffd64d"/></linearGradient>
      <linearGradient id={inner} x1=".4" y1="1" x2=".6" y2="0"><stop stopColor="#ffbd35"/><stop offset="1" stopColor="#fff3a1"/></linearGradient>
    </defs>
    <g className="flame-flicker"><path fill={`url(#${outer})`} d="M34 2c3 16-9 19-4 31C21 27 24 18 18 12 17 27 3 37 5 54c1 15 12 24 27 24s27-11 27-27C59 34 43 22 34 2Z"/><path fill={`url(#${inner})`} d="M35 35c1 9-6 12-4 19-5-3-6-8-9-10-5 13 1 25 11 25 9 0 15-7 14-16-1-7-6-11-12-18Z"/><path fill="#fff5bf" d="M34 53c-5 6-4 12 1 15 5-3 7-8 3-14l-2-4Z" opacity=".95"/></g>
  </svg>
}

function Wallet({ me, onBack }) {
  return <section className="wallet-page">
    <FloatingBack onClick={onBack} label="Back to home" />
    <header className="wallet-header"><span>MY WALLET</span><i><CoinIcon /></i></header>
    <div className="wallet-balance"><small>AVAILABLE BALANCE</small><b><CoinIcon /> {me.coins} <span>COINS</span></b><p>Your EAT60 rewards balance</p></div>
    <div className="wallet-coming"><span className="wallet-orbit"><CoinIcon /></span><p>COMING SOON</p><h1>Your wallet is getting ready</h1><small>We’re preparing new ways to use your coins. Your balance is safe and will be ready here soon.</small></div>
    <div className="wallet-footer"><span>COINS EARNED THROUGH EAT60</span><span>100 coins = ₹1 reward value</span></div>
  </section>
}

function MoreIcon({ name }) {
  const props = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const icon = {
    rewards: <><path d="M6 4h12v17l-6-3-6 3V4Z"/><path d="m9 10 2 2 4-4"/></>,
    ranks: <><circle cx="12" cy="8" r="5"/><path d="m8.5 12-1 9 4.5-2.5 4.5 2.5-1-9"/><path d="m10 8 1.4 1.4L14 7"/></>,
    coupons: <><path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6Z"/><path d="M13 7v2m0 3v2m0 3v1"/></>,
    scorecard: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 16v-3m4 3V8m4 8v-5"/></>,
    refer: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4m-6.6 7 6.6 4.2"/></>,
    socials: <><path d="M20 11.5a7.5 7.5 0 0 1-11.4 6.4L4 19l1.1-4.1A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></>,
    about: <><circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/></>,
    support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="12" width="4" height="7" rx="2"/><rect x="17" y="12" width="4" height="7" rx="2"/><path d="M17 19a5 5 0 0 1-5 3h-1"/></>,
    bugs: <><path d="M9 9h6a3 3 0 0 1 3 3v5a6 6 0 0 1-12 0v-5a3 3 0 0 1 3-3Z"/><path d="m9 9 1-3h4l1 3M3 12h3m12 0h3M4 18h3m10 0h3m-12-9L6 6m12 3 2-3m-8 3V4"/></>,
    rate: <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9L12 3Z"/>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v3h14v-3"/></>,
    edit: <><path d="M12 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="m11 13 8-8 3 3-8 8-4 1 1-4Z"/></>
  }
  return <svg {...props}>{icon[name] || icon.about}</svg>
}

function More({ me, email, reload, go, goGames, say, initialPage, onSelectVoucher, installAvailable, installMessage }) {
  const [rewards, setRewards] = useState([])
  const [claimedRewards, setClaimedRewards] = useState([])
  const [availableCoupons, setAvailableCoupons] = useState([])
  const [couponLoadError, setCouponLoadError] = useState('')
  const [claiming, setClaiming] = useState(null)
  const [rewardMessage, setRewardMessage] = useState('')
  const [celebration, setCelebration] = useState(null)
  const [claimPrompt, setClaimPrompt] = useState(null)
  const [editing, setEditing] = useState(false)
  const [subPage, setSubPage] = useState(initialPage || null)
  useEffect(() => { setSubPage(initialPage || null) }, [initialPage])
  useEffect(() => {
    Promise.all([
      sb.from('streak_rewards').select('milestone,gift').eq('is_active',true).order('milestone'),
      sb.from('user_rewards').select('milestone,claimed').order('milestone'),
      sb.rpc('customer_available_coupons')
    ]).then(([catalog, owned, coupons]) => {
      setRewards(catalog.data || [])
      setClaimedRewards((owned.data || []).filter((reward) => reward.claimed).map((reward) => reward.milestone))
      if (coupons.error) setCouponLoadError(coupons.error.message)
      else setAvailableCoupons(coupons.data || [])
    })
  }, [])
  const claimReward = async (milestone) => {
    setClaiming(milestone)
    setRewardMessage('')
    const { error } = await sb.rpc('claim_streak_reward', { p_milestone: milestone })
    setClaiming(null)
    if (error) return setRewardMessage(error.message)
    setClaimedRewards((current) => [...new Set([...current, milestone])])
    const gift = rewards.find((reward) => reward.milestone === milestone)?.gift || 'Streak reward'
    setClaimPrompt(null)
    setCelebration({ milestone, gift })
    reload()
  }
  if (editing) return <ProfileEditor me={me} email={email} reload={reload} onBack={() => setEditing(false)} />
  const tiles = {
    Funzone: [['rewards', 'Rewards'], ['ranks', 'Ranks'], ['coupons', 'Coupons'], ['scorecard', 'Scorecard']],
    Community: [['refer', 'Refer'], ['socials', 'Socials'], ['about', 'About']],
    'Setting & Supports': [['support', 'Supports'], ['bugs', 'Report bugs'], ['rate', 'Rate us'], ['download', installAvailable ? 'Install app' : 'Download app']]
  }
  const action = async (id) => {
    if (id === 'download') return onOpenDownload()
    if (id === 'rewards') return setSubPage('rewards')
    if (id === 'ranks') return goGames('rankings')
    if (id === 'scorecard') return goGames('scores')
    if (id === 'coupons') return setSubPage('coupons')
    if (id === 'refer') {
      const message = `Join me on EAT60! Use my username ${me.username} when you sign up. ${window.location.origin}`
      try {
        if (navigator.share) await navigator.share({ title: 'Join me on EAT60', text: message })
        else { await navigator.clipboard.writeText(message); say('Invite message copied to clipboard') }
      } catch (error) { if (error.name !== 'AbortError') say('Could not share the invite on this device') }
      return
    }
    if (id === 'rate') { say('Thanks for supporting EAT60!'); return }
    setSubPage(id)
  }
  const journey = <section className="streak-journey">
    <div className="streak-journey-head"><div><p>YOUR REWARDS PATH</p><h3>Streak achievements</h3><small>{me.streak} day current streak · {me.longest_streak || me.streak} day best</small></div><span className="streak-flame"><FlameAnimation /></span></div>
    <p className="streak-journey-note">Keep an order streak going. A day counts when an order is delivered.</p>
    <div className="streak-track">
      {rewards.map((reward) => {
        const claimed = claimedRewards.includes(reward.milestone)
        const reached = (me.longest_streak || me.streak) >= reward.milestone
        return <article key={reward.milestone} className={`streak-reward${claimed ? ' is-claimed' : reached ? ' is-ready' : ''}`}>
          <span className="streak-marker">{claimed ? '✓' : reached ? '!' : '🔒'}</span>
          <div className="streak-reward-card">
            <div className="streak-reward-art" aria-hidden="true">{claimed ? '🎁' : reward.milestone <= 30 ? '✨' : '🎁'}</div>
            <div className="streak-reward-copy"><span className="streak-day">DAY {reward.milestone}</span><b>{reward.gift}</b><small>{claimed ? 'Reward claimed' : reached ? 'Goal reached — claim your reward' : `${Math.max(0, reward.milestone - me.streak)} more streak days to unlock`}</small></div>
            {claimed ? <span className="streak-status">CLAIMED</span> : reached ? <button className="streak-claim" onClick={() => setClaimPrompt(reward)}>{claiming === reward.milestone ? 'CLAIMING…' : 'CLAIM REWARD'}</button> : <span className="streak-locked">LOCKED</span>}
          </div>
        </article>
      })}
    </div>
    {rewardMessage && <p className="streak-message" role="status">{rewardMessage}</p>}
  </section>
  const celebrationPopup = celebration && <div className="claim-celebration" role="presentation" onClick={() => setCelebration(null)}>
    <div className="claim-confetti" aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <i key={index} style={{ '--confetti-x': `${(index * 37) % 100}%`, '--confetti-delay': `${(index % 9) * -0.17}s`, '--confetti-spin': `${(index * 71) % 300}deg` }} />)}</div>
    <section className="claim-celebration-card" role="dialog" aria-modal="true" aria-labelledby="claim-celebration-title" onClick={(event) => event.stopPropagation()}>
      <button className="claim-celebration-close" onClick={() => setCelebration(null)} aria-label="Close celebration">×</button>
      <div className="claim-celebration-flame"><FlameAnimation /></div>
      <p className="claim-celebration-kicker">STREAK MILESTONE · DAY {celebration.milestone}</p>
      <h2 id="claim-celebration-title">You earned it!</h2>
      <p className="claim-celebration-gift">{celebration.gift}</p>
      <p className="claim-celebration-note">Your reward is claimed. Show this screen to the team when you redeem it.</p>
      <button className="claim-celebration-done" onClick={() => setCelebration(null)}>LET’S GO <span>✦</span></button>
    </section>
  </div>
  const claimPromptPopup = claimPrompt && <div className="reward-claim-screen" role="presentation">
    <div className="reward-screen-rays" aria-hidden="true" />
    <div className="reward-claim-badge" aria-hidden="true"><span>{claimPrompt.milestone}</span><FlameAnimation /></div>
    <p className="reward-claim-caption">DAYS CONSISTENT</p>
    <div className="reward-claim-copy"><small>STREAK REWARD UNLOCKED</small><h1>Day {claimPrompt.milestone}</h1><b>{claimPrompt.gift}</b></div>
    <div className="reward-claim-actions">
      <button className="reward-claim-primary" disabled={claiming === claimPrompt.milestone} onClick={() => claimReward(claimPrompt.milestone)}>{claiming === claimPrompt.milestone ? 'CLAIMING…' : 'CLAIM REWARD'}</button>
      <button className="reward-claim-later" onClick={() => setClaimPrompt(null)}>LATER</button>
      {rewardMessage && <p role="alert">{rewardMessage}</p>}
    </div>
  </div>
  const voucherSection = <section className="customer-vouchers">
    <div className="admin-section-heading"><div><p>OFFERS FOR YOU</p><h3>Available vouchers</h3></div></div>
    {couponLoadError ? <p className="admin-inline-error" role="alert">{couponLoadError}</p> : availableCoupons.length === 0
      ? <p className="mu">There are no available vouchers right now.</p>
      : <div className="customer-voucher-list">{availableCoupons.map((voucher) => <article className="customer-voucher" key={voucher.code}>
        <div><b>{voucher.code}</b><p>{voucher.description || `${voucher.discount_value}${voucher.discount_type === 'percent' ? '%' : '₹'} off`} · minimum order ₹{voucher.minimum_order}{voucher.maximum_discount ? ` · up to ₹${voucher.maximum_discount}` : ''}</p>{voucher.expires_at && <small>Expires {new Date(voucher.expires_at).toLocaleDateString('en-IN')}</small>}</div>
        <button className="pill" onClick={() => onSelectVoucher(voucher.code)}>Use voucher</button>
      </article>)}</div>}
  </section>
  if (subPage === 'rewards') return <><FloatingBack onClick={() => setSubPage(null)} label="Back to More" /><section className="more-subpage"><header className="more-subpage-header"><h1>REWARDS</h1><span /></header>{voucherSection}{journey}</section>{celebrationPopup}{claimPromptPopup}</>
  if (subPage === 'coupons') return <><FloatingBack onClick={() => setSubPage(null)} label="Back to More" /><section className="more-subpage"><header className="more-subpage-header"><h1>VOUCHERS</h1><span /></header>{voucherSection}</section></>
  if (subPage && subPage !== 'rewards') {
    const pages = {
      socials: ['Socials', 'Our social channels will be added here soon.'],
      about: ['About EAT60', 'Ballia’s first food delivery app. Browse local food, place an order, and build your daily streak.'],
      support: ['Support', 'For order updates, open History. For help with food or delivery, contact the restaurant handling your order.'],
      bugs: ['Report a bug', 'Bug reporting is being prepared. If a problem affected an order, open History and contact the restaurant handling it.']
    }
    const [title, detail] = pages[subPage] || ['More', '']
    return <><FloatingBack onClick={() => setSubPage(null)} label="Back to More" /><section className="more-subpage"><header className="more-subpage-header"><h1>{title.toUpperCase()}</h1><span /></header><article className="more-info-card"><div className="more-info-icon"><MoreIcon name={subPage === 'support' ? 'support' : subPage === 'bugs' ? 'bugs' : subPage} /></div><h2>{title}</h2><p>{detail}</p>{subPage === 'support' && <button className="pill g" onClick={() => go('hist')}>VIEW ORDER HISTORY</button>}</article></section></>
  }
  return (
    <>
      <section className="more-dashboard">
        <h1 className="more-title">MORE</h1>
        <section className="more-profile-hero">
          <div className="more-profile-row"><span>UPDATE</span><button className="more-profile-avatar" onClick={() => setEditing(true)} aria-label="Update profile"><ProfileAvatar avatarId={me.avatar_id} /></button><span>PROFILE</span></div>
          <div className="more-profile-name"><b>{me.username || me.name || 'User Name'}</b><button onClick={() => setEditing(true)} aria-label="Edit profile"><MoreIcon name="edit" /></button></div>
        </section>
        {Object.entries(tiles).map(([group, items]) => <section className="more-tile-section" key={group}><h2>{group.toUpperCase()}</h2><div className={`more-tiles more-tiles-${items.length}`}>{items.map(([id, label]) => <button className="more-tile" key={id} onClick={() => action(id)}><span className={`more-tile-icon icon-${id}`}><MoreIcon name={id} /></span><b>{label.toUpperCase()}</b></button>)}</div>{group === 'Setting & Supports' && installMessage && <p className="more-install-message" role="status">{installMessage}</p>}</section>)}
        <section className="more-account-actions"><div><b>{me.xp} XP</b><span>{me.coins} coins · {email}</span></div><div><button className="pill g" onClick={() => sb.auth.signOut()}>LOG OUT</button></div></section>
      </section>
      {celebrationPopup}
      {claimPromptPopup}
    </>
  )
}

function ProfileEditor({ me, email, reload, onBack }) {
  const [form, setForm] = useState({
    username: me.username || '', name: me.name || '', address: me.address || '',
    area: me.area || '', city: me.city || '', phone: me.phone || '',
    gender: me.gender || 'other', avatar_id: me.avatar_id || 1
  })
  const [newEmail, setNewEmail] = useState(email)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const saveProfile = async (event) => {
    event.preventDefault()
    const username = form.username.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      setProfileMessage('Username must be 3–24 characters: lowercase letters, numbers, or underscores.')
      return
    }
    if (!form.name.trim()) {
      setProfileMessage('Enter your full name.')
      return
    }
    setBusy(true)
    setProfileMessage('')
    try {
      const { error } = await sb.from('profiles').update({
        username, name: form.name.trim(), address: form.address.trim(),
        area: form.area.trim(), city: form.city.trim(), phone: form.phone.trim(),
        gender: form.gender, avatar_id: Number(form.avatar_id)
      }).eq('id', me.id)
      if (error?.code === '23505') return setProfileMessage('That username is already in use. Try another one.')
      if (error?.code === 'PGRST204' || error?.code === 'PGRST205') return setProfileMessage('Profile fields are not installed in the database yet. Run profile_fields.sql in the Supabase SQL Editor, then try again.')
      if (error) return setProfileMessage(error.message)
      setProfileMessage('Profile saved.')
      await reload()
    } catch (error) {
      setProfileMessage(error.message || 'Could not save your profile. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const changeEmail = async (event) => {
    event.preventDefault()
    const nextEmail = newEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) return setEmailMessage('Enter a valid email address.')
    if (nextEmail.toLowerCase() === email.toLowerCase()) return setEmailMessage('This is already your current email.')
    setBusy(true)
    setEmailMessage('')
    try {
      const { error } = await sb.auth.updateUser({ email: nextEmail })
      if (error) return setEmailMessage(error.message)
      setEmailMessage('Check your email inboxes to confirm the address change. Your login email updates after confirmation.')
    } catch (error) {
      setEmailMessage(error.message || 'Could not update your email. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    if (password.length < 6) return setPasswordMessage('Password must be at least 6 characters.')
    if (password !== confirmPassword) return setPasswordMessage('The passwords do not match.')
    setBusy(true)
    setPasswordMessage('')
    try {
      const { error } = await sb.auth.updateUser({ password })
      if (error) return setPasswordMessage(error.message)
      setPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password changed successfully.')
    } catch (error) {
      setPasswordMessage(error.message || 'Could not update your password. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="profile-editor">
      <FloatingBack onClick={onBack} label="Back to More" />
      <div className="profile-editor-heading"><div><p className="profile-kicker">YOUR ACCOUNT</p><h2>PROFILE</h2></div></div>
      <form className="profile-form card" onSubmit={saveProfile}>
        <div className="profile-form-identity"><div className="profile-avatar"><ProfileAvatar avatarId={form.avatar_id} /></div><div><p>GOOD TO SEE YOU</p><h3>{form.name || 'Your name'}</h3><small>Pick an avatar that feels like you</small></div></div>
        <fieldset className="profile-gender profile-field-wide"><legend>Gender</legend><div>{[['male', 'Male'], ['female', 'Female'], ['other', 'Other']].map(([value, label]) => <button type="button" key={value} className={form.gender === value ? 'selected' : ''} onClick={() => setForm((current) => {
          const nextAvatar = PROFILE_AVATARS[Number(current.avatar_id) - 1]
          const available = PROFILE_AVATARS.findIndex((avatar) => avatar.gender === value || avatar.gender === 'other') + 1
          return { ...current, gender: value, avatar_id: value === 'other' || nextAvatar.gender === value || nextAvatar.gender === 'other' ? current.avatar_id : available }
        })}>{label}</button>)}</div></fieldset>
        <fieldset className="profile-avatar-picker profile-field-wide"><legend>Choose your avatar <small>{PROFILE_AVATARS.filter((avatar) => form.gender === 'other' || avatar.gender === form.gender || avatar.gender === 'other').length} styles</small></legend><div className="profile-avatar-options">{PROFILE_AVATARS.map((avatar, index) => {
          const visible = form.gender === 'other' || avatar.gender === form.gender || avatar.gender === 'other'
          return visible && <button type="button" key={index} className={Number(form.avatar_id) === index + 1 ? 'selected' : ''} onClick={() => setForm((current) => ({ ...current, avatar_id: index + 1 }))} aria-label={`Choose avatar ${index + 1}`} aria-pressed={Number(form.avatar_id) === index + 1}><ProfileAvatar avatarId={index + 1} /></button>
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
        <label>New email<input type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} required /></label>
        <button className="pill" disabled={busy}>{busy ? 'Updating…' : 'Update email'}</button>
        {emailMessage && <p className="profile-feedback" role="status">{emailMessage}</p>}
      </form>

      <form className="card account-change-form" onSubmit={changePassword}>
        <h3>Change password</h3>
        <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <button className="pill" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        {passwordMessage && <p className="profile-feedback" role="status">{passwordMessage}</p>}
      </form>
    </section>
  )
}
