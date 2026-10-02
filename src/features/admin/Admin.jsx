import { useCallback, useEffect, useRef, useState } from 'react'
import { sb } from '../../lib/supabase'
import PoweredFooter from '../../components/PoweredFooter'

const LABEL = { pending: 'Pending', accepted: 'Accepted', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery', payment_received: 'Payment received', delivered: 'Delivered', rejected: 'Rejected', cancelled: 'Cancelled' }
const TABS = [['overview', 'Overview'], ['settings', 'Settings'], ['orders', 'Orders'], ['menu', 'Menu'], ['outlets', 'Outlets'], ['promos', 'Promos'], ['rewards', 'Rewards'], ['feed', 'Feed']]

function ConfirmDialog({ title, message, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busy, onCancel])

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await onConfirm()
      if (result) setError(result)
      else onCancel()
    } catch (confirmError) {
      setError(confirmError.message || 'The action could not be completed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="admin-confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
    <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-message">
      <div className="admin-confirm-icon" aria-hidden="true">!</div>
      <p className="admin-confirm-kicker">PLEASE CONFIRM</p>
      <h2 id="admin-confirm-title">{title}</h2>
      <p id="admin-confirm-message">{message}</p>
      {error && <p className="admin-confirm-error" role="alert">{error}</p>}
      <div className="admin-confirm-actions">
        <button ref={cancelRef} className="admin-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className="admin-confirm-delete" disabled={busy} onClick={confirm}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
    </section>
  </div>
}

export default function Admin({ onBack }) {
  const [tab, setTab] = useState('overview')
  const [orders, setOrders] = useState([])
  const [ordersError, setOrdersError] = useState('')
  const [connection, setConnection] = useState('connecting')
  const [alert, setAlert] = useState('')
  const [permission, setPermission] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))
  const [alertEnabled, setAlertEnabled] = useState(false)
  const [storeOnline, setStoreOnline] = useState(true)
  const [storeMessage, setStoreMessage] = useState('')
  const [soundEnabled,setSoundEnabled]=useState(false)
  const soundRef=useRef(null)
  const alertEnabledRef = useRef(false)
  const seenOrderIds = useRef(new Set())
  const alertTimer = useRef(null)

  const loadOrders = useCallback(async () => {
    const { data, error } = await sb.from('orders')
      .select('*, order_items(*), profiles(name, phone), order_stage_events(*)')
      .order('created_at', { ascending: false }).limit(1000)
    if (error) { setOrdersError(error.message); return }
    setOrdersError('')
    setOrders(data || [])
    setConnection('connected')
    data?.forEach((order) => seenOrderIds.current.add(String(order.id)))
  }, [])

  const loadStore = useCallback(async () => {
    const { data } = await sb.from('settings').select('store_online,offline_message').eq('id', 1).maybeSingle()
    if (data) { setStoreOnline(data.store_online !== false); setStoreMessage(data.offline_message || '') }
  }, [])

  useEffect(() => {
    let mounted = true
    loadOrders()
    loadStore()
    const channel = sb.channel('admin-live-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (!mounted) return
        if (payload.eventType === 'INSERT') {
          const order = payload.new
          const id = String(order.id)
          if (!seenOrderIds.current.has(id)) {
            seenOrderIds.current.add(id)
            const title = `New order #${order.id}`
            const body = `₹${Number(order.total || 0).toLocaleString('en-IN')} · ${order.status || 'placed'}`
            setAlert(`${title} received · ${body}`)
            window.clearTimeout(alertTimer.current)
            alertTimer.current = window.setTimeout(() => setAlert(''), 6500)
            if (alertEnabledRef.current && 'Notification' in window && Notification.permission === 'granted') {
              try {
                const notification = new Notification(title, { body, tag: `eat60-order-${id}`, renotify: false })
                notification.onclick = () => { window.focus(); setTab('orders'); notification.close() }
              } catch { /* Keep the in-app alert available if the browser blocks system notifications. */ }
            }
            if(soundEnabled&&soundRef.current)playOrderTone(soundRef.current)
          }
        }
        loadOrders()
      })
      .subscribe((status) => {
        if (!mounted) return
        if (status === 'SUBSCRIBED') setConnection('connected')
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setConnection('disconnected')
      })
    return () => {
      mounted = false
      window.clearTimeout(alertTimer.current)
      sb.removeChannel(channel)
    }
  }, [loadOrders, loadStore, soundEnabled])
  useEffect(()=>()=>{if(soundRef.current){soundRef.current.close();soundRef.current=null}},[])

  const enableAlerts = async () => {
    if (!('Notification' in window)) return setPermission('unsupported')
    let result = Notification.permission
    if (result === 'default') result = await Notification.requestPermission()
    setPermission(result)
    alertEnabledRef.current = result === 'granted'
    setAlertEnabled(result === 'granted')
    setAlert(result === 'granted' ? 'Live browser order alerts are enabled.' : 'Allow notifications in your browser settings to receive order alerts.')
    window.clearTimeout(alertTimer.current)
    alertTimer.current = window.setTimeout(() => setAlert(''), 5000)
  }

  const toggleSound=async()=>{
    if(!soundEnabled){try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return setAlert('This browser does not support sound alerts.');const ctx=soundRef.current||new AudioCtx();soundRef.current=ctx;await ctx.resume();setSoundEnabled(true);setAlert('New order sound is on.')}catch{setAlert('Sound could not be enabled in this browser.')}}
    else{setSoundEnabled(false);setAlert('New order sound is off.')}
    window.clearTimeout(alertTimer.current);alertTimer.current=window.setTimeout(()=>setAlert(''),3500)
  }

  return (
    <main className="app admin-app">
      <header className="admin-header">
        <div className="admin-brand"><span className="admin-mark">EAT<b>60</b></span><div><p>FOODVERSE KITCHEN</p><h1>Admin dashboard</h1></div></div>
        <div className="admin-header-actions">
          <span className={`admin-live-state ${connection}`}><i />{connection === 'connected' ? 'LIVE' : connection === 'connecting' ? 'CONNECTING' : 'RECONNECTING'}</span>
          <button className={`admin-notify ${alertEnabled ? 'enabled' : ''}`} onClick={enableAlerts} disabled={permission === 'unsupported'}>
            <span aria-hidden="true">{alertEnabled ? '✓' : '♧'}</span>{alertEnabled ? 'Alerts on' : permission === 'denied' ? 'Allow in browser' : 'Enable alerts'}
          </button>
          <button className={`admin-notify ${soundEnabled?'enabled':''}`} onClick={toggleSound}><span aria-hidden="true">{soundEnabled?'🔊':'🔈'}</span>{soundEnabled?'Sound on':'Sound off'}</button>
          <button className="admin-exit" onClick={onBack}>Back to shop</button>
          <button className="admin-exit" onClick={() => sb.auth.signOut()}>Log out</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Admin sections">
        {TABS.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'orders' && orders.filter((order) => (order.order_stage || 'pending') === 'pending').length > 0 && <b>{orders.filter((order) => (order.order_stage || 'pending') === 'pending').length}</b>}</button>)}
      </nav>

      {ordersError && <div className="admin-error" role="alert"><b>Orders could not be loaded</b><span>{ordersError}</span><button onClick={loadOrders}>Retry</button></div>}
      {alert && <div className="admin-alert" role="status"><span>🔔</span><p>{alert}</p><button aria-label="Dismiss notification" onClick={() => setAlert('')}>×</button></div>}
      {tab === 'overview' && <><Overview orders={orders} onViewOrders={() => setTab('orders')} online={storeOnline} setOnline={async (value) => { const { error } = await sb.from('settings').update({ store_online: value }).eq('id', 1); if (!error) setStoreOnline(value); else setAlert(error.message) }} /><DeliverySettings /></>}
      {tab === 'settings' && <AboutPageSettings />}
      {tab === 'orders' && <Orders rows={orders} refresh={loadOrders} />}
      {tab === 'menu' && <Menu />}
      {tab === 'outlets' && <Outlets />}
      {tab === 'feed' && <AdminFeed />}
      {tab === 'promos' && <Promos />}
      {tab === 'rewards' && <Rewards />}
      <PoweredFooter className="admin-footer" />
    </main>
  )
}

function AboutPageSettings() {
  const [form, setForm] = useState({
    about_founder_name: '',
    about_founder_photo_url: '',
    about_founder_instagram_url: '',
    about_founder_portfolio_url: ''
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    sb.from('settings')
      .select('about_founder_name,about_founder_photo_url,about_founder_instagram_url,about_founder_portfolio_url')
      .eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setMessage(error.message)
        else if (data) setForm((current) => ({ ...current, ...data }))
      })
    return () => { active = false }
  }, [])

  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const uploadFounderPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setMessage('Choose an image file for the founder photo.')
    if (file.size > 5 * 1024 * 1024) return setMessage('Founder photos must be 5 MB or smaller.')
    setBusy(true)
    setMessage('')
    try {
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const { data, error } = await sb.storage.from('menu-images')
        .upload(`about/founder-${crypto.randomUUID()}.${extension}`, file, { cacheControl: '3600', contentType: file.type })
      if (error) return setMessage(error.message)
      const { data: publicData } = sb.storage.from('menu-images').getPublicUrl(data.path)
      setForm((current) => ({ ...current, about_founder_photo_url: publicData.publicUrl }))
      setMessage('Photo uploaded. Save the About page settings to publish it.')
    } catch (uploadError) {
      setMessage(uploadError.message || 'The founder photo could not be uploaded.')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const values = {
      ...form,
      about_founder_name: form.about_founder_name.trim(),
      about_founder_photo_url: form.about_founder_photo_url.trim(),
      about_founder_instagram_url: form.about_founder_instagram_url.trim(),
      about_founder_portfolio_url: form.about_founder_portfolio_url.trim()
    }
    const urls = [
      values.about_founder_photo_url,
      values.about_founder_instagram_url,
      values.about_founder_portfolio_url
    ].filter(Boolean)
    if (urls.some((url) => !/^https?:\/\/\S+$/i.test(url))) return setMessage('Enter full links beginning with https:// or http://.')
    setBusy(true)
    setMessage('')
    const { error } = await sb.from('settings').update(values).eq('id', 1)
    setBusy(false)
    if (error) setMessage(error.message)
    else { setForm(values); setMessage('About page settings saved.') }
  }

  return <section className="admin-content admin-about-settings">
    <div className="admin-page-heading"><div><p>PUBLIC ABOUT PAGE</p><h2>About page settings</h2><span>Update the founder profile, social links, and ordering links shown on /about.</span></div></div>
    <div className="admin-feed-editor">
      <h3>Founder profile</h3>
      <div className="admin-form-grid">
        <label>Founder name<input maxLength={100} value={form.about_founder_name} onChange={change('about_founder_name')} placeholder="Your name" /></label>
        <label>Founder photo URL<input type="url" value={form.about_founder_photo_url} onChange={change('about_founder_photo_url')} placeholder="https://…" /></label>
        <label className="admin-about-photo-upload">Upload founder photo<input type="file" accept="image/*" onChange={uploadFounderPhoto} /></label>
        <label>Instagram URL<input type="url" value={form.about_founder_instagram_url} onChange={change('about_founder_instagram_url')} placeholder="https://instagram.com/…" /></label>
        <label>Portfolio URL<input type="url" value={form.about_founder_portfolio_url} onChange={change('about_founder_portfolio_url')} placeholder="https://…" /></label>
      </div>
      <button className="admin-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save About page'} <span>→</span></button>
      {message && <p className="admin-feedback" role="status">{message}</p>}
    </div>
  </section>
}

function DeliverySettings() {
  const defaults = { delivery_fee: 20, min_order: 99, min_delivery_km: 2, delivery_per_km: 5, free_delivery_minimum: 0, delivery_free: false, max_delivery_km: 5 }
  const [form, setForm] = useState(defaults)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let active = true
    sb.from('settings')
      .select('delivery_fee,min_order,min_delivery_km,delivery_per_km,free_delivery_minimum,delivery_free,max_delivery_km')
      .eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) setMessage(error.message)
        else if (data) setForm({ ...defaults, ...data })
      })
    return () => { active = false }
  }, [])

  const change = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const save = async () => {
    const values = {
      delivery_fee: Number(form.delivery_fee),
      min_order: Number(form.min_order),
      min_delivery_km: Number(form.min_delivery_km),
      delivery_per_km: Number(form.delivery_per_km),
      free_delivery_minimum: Number(form.free_delivery_minimum),
      delivery_free: Boolean(form.delivery_free),
      max_delivery_km: Number(form.max_delivery_km)
    }
    if (Object.entries(values).some(([key, value]) => key !== 'delivery_free' && (!Number.isFinite(value) || value < 0))) return setMessage('Enter valid non-negative values for all delivery settings.')
    if ([values.delivery_fee, values.min_order, values.delivery_per_km, values.free_delivery_minimum].some((value) => !Number.isInteger(value))) return setMessage('Fee and order amount fields must use whole rupee amounts.')
    if (values.max_delivery_km <= 0 || values.min_delivery_km > values.max_delivery_km) return setMessage('Maximum delivery distance must be greater than zero and at least the minimum distance.')
    setBusy(true)
    setMessage('')
    const { error } = await sb.from('settings').update(values).eq('id', 1)
    setBusy(false)
    if (error) setMessage(error.message)
    else { setForm(values); setMessage('Delivery settings saved.') }
  }

  return <section className="admin-content admin-delivery-settings">
    <div className="admin-page-heading"><div><p>CHECKOUT & DELIVERY</p><h2>Delivery settings</h2><span>Base fee covers the minimum distance. Extra distance is charged per km; orders above the free-delivery minimum pay ₹0.</span></div></div>
    <div className="admin-feed-editor">
      <div className="admin-form-grid">
        <label>Base delivery fee ₹<input type="number" min="0" step="1" value={form.delivery_fee} onChange={change('delivery_fee')} /></label>
        <label>Minimum order amount ₹<input type="number" min="0" step="1" value={form.min_order} onChange={change('min_order')} /></label>
        <label>Base fee covers distance (km)<input type="number" min="0" step="0.1" value={form.min_delivery_km} onChange={change('min_delivery_km')} /></label>
        <label>Extra charge per km ₹<input type="number" min="0" step="1" value={form.delivery_per_km} onChange={change('delivery_per_km')} /></label>
        <label>Free delivery from order amount ₹<input type="number" min="0" step="1" value={form.free_delivery_minimum} onChange={change('free_delivery_minimum')} placeholder="0 to disable" /></label>
        <label>Maximum delivery distance (km)<input type="number" min="0.1" step="0.1" value={form.max_delivery_km} onChange={change('max_delivery_km')} /></label>
        <label className="admin-delivery-free-toggle">Make all delivery free<input type="checkbox" checked={form.delivery_free} onChange={(event) => setForm((current) => ({ ...current, delivery_free: event.target.checked }))} /></label>
      </div>
      <button className="admin-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save delivery settings'} <span>→</span></button>
      {message && <p className="admin-feedback" role="status">{message}</p>}
    </div>
  </section>
}

function Overview({ orders, onViewOrders, online, setOnline }) {
  const placed = orders.filter((order) => (order.order_stage || 'pending') === 'pending')
  const active = orders.filter((order) => ['accepted','preparing','ready','out_for_delivery','payment_received'].includes(order.order_stage || order.status))
  const funnelStages=['pending','accepted','preparing','ready','out_for_delivery','payment_received','delivered']
  const funnel=funnelStages.map(stage=>({stage,count:orders.filter(o=>(o.order_stage|| (o.status==='placed'?'pending':o.status))===stage).length}))
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const today = orders.filter((order) => new Date(order.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayKey)
  const revenue = today.filter((order) => !['cancelled','rejected'].includes(order.order_stage || order.status)).reduce((sum, order) => sum + Number(order.total || 0), 0)
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p>YOUR STORE AT A GLANCE</p><h2>Good to see you.</h2><span>Monitor orders and keep your kitchen moving.</span></div><button className="admin-primary" onClick={onViewOrders}>View orders <span>→</span></button></div>
    <div className="admin-store-switch"><div><b>{online ? 'Store is accepting orders' : 'Store is offline'}</b><small>{online ? 'Customers can place orders now.' : 'New checkout is paused.'}</small></div><button className={`admin-toggle ${online ? 'on' : ''}`} onClick={() => setOnline(!online)}><i />{online ? 'Online' : 'Offline'}</button></div>
    <div className="admin-metrics">
      <Metric label="NEW ORDERS" value={placed.length} detail="Waiting for confirmation" icon="✳" tone="lime" />
      <Metric label="IN PROGRESS" value={active.length} detail="Being prepared or delivered" icon="◷" tone="blue" />
      <Metric label="TODAY’S ORDERS" value={today.length} detail="Orders placed today" icon="▤" tone="purple" />
      <Metric label="TODAY’S SALES" value={`₹${revenue.toLocaleString('en-IN')}`} detail="Excludes cancelled orders" icon="₹" tone="orange" />
    </div>
    <div className="admin-funnel"><div className="admin-section-heading"><div><p>ORDER FLOW</p><h3>Live order funnel</h3></div><span>Across latest {orders.length} orders</span></div><div className="admin-funnel-steps">{funnel.map((item,index)=><div key={item.stage} className={`admin-funnel-step funnel-${item.stage}`}><span>{index+1}</span><b>{LABEL[item.stage]}</b><strong>{item.count}</strong></div>)}</div></div>
    <div className="admin-section-heading"><div><p>THE LATEST</p><h3>Recent orders</h3></div><button onClick={onViewOrders}>All orders <span>→</span></button></div>
    {orders.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>AMOUNT</th><th>STATUS</th><th>TIME</th></tr></thead><tbody>{orders.slice(0, 6).map((order) => <OrderRow key={order.id} order={order} compact />)}</tbody></table></div> : <div className="admin-empty"><span>⌑</span><b>No orders yet</b><small>New customer orders will show up here in real time.</small></div>}
  </section>
}

function Metric({ label, value, detail, icon, tone }) {
  return <article className={`admin-metric ${tone}`}><div className="admin-metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{detail}</small></article>
}

function playOrderTone(context){
  const now=context.currentTime
  ;[0,.19,.38].forEach((offset,index)=>{const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.value=[740,880,1046][index];gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(.13,now+offset+.025);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.16);osc.connect(gain);gain.connect(context.destination);osc.start(now+offset);osc.stop(now+offset+.17)})
}

function OrderTimer({createdAt}){
 const [now,setNow]=useState(Date.now())
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[])
 const seconds=Math.max(0,Math.floor((now-new Date(createdAt).getTime())/1000))
 return <span className="order-live-timer">⏱ {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} elapsed</span>
}

function PendingDecisionClock({createdAt}){
 const [now,setNow]=useState(Date.now())
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[])
 const seconds=Math.max(0,300-Math.floor((now-new Date(createdAt).getTime())/1000))
 return <div className={`admin-pending-clock${seconds===0?' expired':''}`}>Auto-reject in {Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')} unless accepted or rejected</div>
}

function OrderJourney({order}){
 const events=[...(order.order_stage_events||[])].sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at))
 return <div className="order-journey"><div className="order-journey-head"><b>Order journey</b><OrderTimer createdAt={order.created_at}/></div><div className="order-journey-steps">{events.map((event,index)=>{const next=events[index+1];const mins=next?Math.max(0,Math.round((new Date(next.occurred_at)-new Date(event.occurred_at))/60000)):null;return <div key={event.id} className="order-journey-step"><i/><div><b>{LABEL[event.stage]||event.stage.replaceAll('_',' ')}</b><small>{new Date(event.occurred_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}{mins!==null?` · ${mins} min in this stage`:''}</small>{event.note&&event.stage==='rejected'&&<small>{event.note}</small>}</div></div>})}</div></div>
}

function Orders({ rows, refresh }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('today')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reasonId, setReasonId] = useState(null)
  const [reason, setReason] = useState('')
  const [paymentId, setPaymentId] = useState(null)
  const [payment, setPayment] = useState('cash')
  const stageOf = (o) => o.order_stage || (o.status === 'placed' ? 'pending' : o.status)
  const now = new Date()
  const dateKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const start = period === 'today' ? dateKey(now) : period === 'week' ? dateKey(new Date(now.getTime() - 6*86400000)) : period === 'month' ? dateKey(new Date(now.getFullYear(), now.getMonth(), 1)) : from
  const end = period === 'custom' ? to : dateKey(now)
  const filtered = rows.filter((order) => (filter === 'all' || stageOf(order) === filter) &&
    (!start || dateKey(order.created_at) >= start) && (!end || dateKey(order.created_at) <= end) &&
    (`${order.id} ${order.customer_name || order.profiles?.name || ''} ${order.phone || ''}`.toLowerCase().includes(query.toLowerCase())))

  const move = async (id, stage, why = null, payType = null) => {
    setBusyId(id); setError('')
    const { error: updateError } = await sb.rpc('admin_update_order', { p_id: id, p_stage: stage, p_reason: why, p_payment_type: payType })
    if (updateError) setError(updateError.message)
    else await refresh()
    setBusyId(null)
  }

  return <section className="admin-content">
    <div className="admin-page-heading"><div><p>FULFILMENT</p><h2>Order management</h2><span>Review incoming orders and update their progress.</span></div><button className="admin-secondary" onClick={refresh}>↻ <span>Refresh</span></button></div>
    <div className="admin-order-tools"><div className="admin-filter-tabs">{['all','pending','accepted','preparing','ready','out_for_delivery','payment_received','delivered','rejected','cancelled'].map((status) => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status === 'all' ? 'All orders' : LABEL[status]}</button>)}</div><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order or customer" /></label></div>
    <div className="admin-report-tools"><select value={period} onChange={(e)=>setPeriod(e.target.value)}><option value="today">Today</option><option value="week">Last 7 days</option><option value="month">This month</option><option value="custom">Choose dates</option></select>{period==='custom'&&<><input type="date" value={from} onChange={e=>setFrom(e.target.value)}/><span>to</span><input type="date" value={to} onChange={e=>setTo(e.target.value)}/></>}<b>{filtered.length} orders · ₹{filtered.filter(o=>!['rejected','cancelled'].includes(stageOf(o))).reduce((a,o)=>a+Number(o.total||0),0).toLocaleString('en-IN')} sales</b></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {filtered.length ? <div className="admin-order-list">{filtered.map((order) => <article className="admin-order-card" key={order.id}>
      <div className="admin-order-card-top"><div><span className="admin-order-number">ORDER #{order.id}</span><strong>₹{Number(order.total).toLocaleString('en-IN')}</strong></div><span className={`admin-status status-${stageOf(order)}`}>{LABEL[stageOf(order)] || stageOf(order)}</span></div>
      <div className="admin-order-customer"><div className="admin-customer-avatar">{(order.customer_name || order.profiles?.name || 'G').slice(0, 1).toUpperCase()}</div><div><b>{order.customer_name || order.profiles?.name || 'Customer'}</b><small>{order.phone || order.profiles?.phone || 'No phone provided'}</small></div><time>{new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
      <div className="admin-order-items">{(order.order_items || []).map((item) => <div key={item.id}><span>{item.qty}×</span>{item.item_name}<b>₹{Number(item.unit_price * item.qty).toLocaleString('en-IN')}</b></div>)}</div>
      <div className="admin-order-address"><span>DELIVER TO</span><p>{order.address || 'No delivery address provided'}</p>{order.delivery_distance_km != null && <small>{Number(order.delivery_distance_km).toFixed(1)} km · Delivery ₹{order.delivery_fee}{order.delivery_fee_before_discount > order.delivery_fee ? ` (₹${order.delivery_fee_before_discount} waived)` : ''}</small>}</div>
      {order.order_stage_events?.length>0&&<OrderJourney order={order}/>}
      {stageOf(order)==='pending'&&<PendingDecisionClock createdAt={order.created_at}/>}
      {order.rejection_reason&&<p className="admin-rejection-reason">Reason: {order.rejection_reason}</p>}
      {stageOf(order)==='payment_received'&&<p className="admin-pending-clock">Payment received · {order.payment_type||'type not recorded'}</p>}
      {reasonId===order.id&&<div className="admin-decision-form"><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Reason for rejecting"/><button className="admin-cancel-order" disabled={!reason.trim()||busyId===order.id} onClick={async()=>{await move(order.id,'rejected',reason);setReasonId(null);setReason('')}}>Confirm reject</button><button className="admin-secondary" onClick={()=>setReasonId(null)}>Cancel</button></div>}
      {paymentId===order.id&&<div className="admin-decision-form"><select value={payment} onChange={e=>setPayment(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="online">Online</option><option value="other">Other</option></select><button className="admin-primary" onClick={async()=>{await move(order.id,'payment_received',null,payment);setPaymentId(null)}}>Confirm payment</button></div>}
      <div className="admin-order-actions">{stageOf(order)==='pending'&&<><button className="admin-primary" disabled={busyId===order.id} onClick={()=>move(order.id,'accepted')}>Accept order <span>→</span></button><button className="admin-cancel-order" disabled={busyId===order.id} onClick={()=>{setReasonId(order.id);setReason('')}}>Reject</button></>}{({accepted:'preparing',preparing:'ready',ready:'out_for_delivery',out_for_delivery:'payment_received',payment_received:'delivered'})[stageOf(order)]&&<button className="admin-primary" disabled={busyId===order.id} onClick={()=>stageOf(order)==='out_for_delivery'?setPaymentId(order.id):move(order.id,({accepted:'preparing',preparing:'ready',ready:'out_for_delivery',payment_received:'delivered'})[stageOf(order)])}>{stageOf(order)==='out_for_delivery'?'Record payment':`Mark ${LABEL[({accepted:'preparing',preparing:'ready',ready:'out_for_delivery',payment_received:'delivered'})[stageOf(order)]]}`} <span>→</span></button>}</div>
    </article>)}</div> : <div className="admin-empty"><span>⌕</span><b>No matching orders</b><small>Try another status or search term.</small></div>}
  </section>
}

function OrderRow({ order }) {
  const products = (order.order_items || []).map((item) => `${item.qty}× ${item.item_name}`).join(', ')
  const stage=order.order_stage||(order.status==='placed'?'pending':order.status)
  return <tr><td><b>#{order.id}</b></td><td>{order.customer_name || order.profiles?.name || 'Customer'}</td><td className="admin-item-cell">{products || '—'}</td><td>₹{Number(order.total).toLocaleString('en-IN')}</td><td><span className={`admin-status status-${stage}`}>{LABEL[stage] || stage}</span></td><td>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td></tr>
}

function Menu() {
  const [items, setItems] = useState([])
  const [brands, setBrands] = useState([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const load = useCallback(async () => {
    const [{ data, error: itemError }, { data: brandData, error: brandError }] = await Promise.all([
      sb.from('menu_items').select('*, item_variants(*), item_extras(*)').order('name'),
      sb.from('brands').select('id,name').order('name')
    ])
    setError(itemError?.message || brandError?.message || '')
    setItems(data || []); setBrands(brandData || [])
  }, [])
  useEffect(() => { load() }, [load])
  const toggle = async (item) => {
    setSaving(item.id); setError('')
    const { error: updateError } = await sb.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    if (updateError) setError(updateError.message); else setItems((current) => current.map((row) => row.id === item.id ? { ...row, is_available: !item.is_available } : row))
    setSaving(null)
  }
  const visible = items.filter((item) => (filter === 'all' || item.brand_id === filter) && `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
  const remove = async () => {
    if (!deleteTarget) return 'The menu item could not be found.'
    setError('')
    const variantIds = (deleteTarget.item_variants || []).map((variant) => variant.id)
    if (variantIds.length) {
      const { error: settingsError } = await sb.from('settings')
        .update({ offer_variant_id: null, offer_price: null, offer_date: null })
        .in('offer_variant_id', variantIds)
      if (settingsError) return settingsError.message
    }
    const { error: deleteError } = await sb.from('menu_items').delete().eq('id', deleteTarget.id)
    if (deleteError) return deleteError.message
    setItems((rows) => rows.filter((row) => row.id !== deleteTarget.id))
    return null
  }
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p>CATALOG</p><h2>Menu & availability</h2><span>Manage descriptions, food photos, sizes, prices and extras.</span></div><button className="admin-primary" onClick={()=>setEditing({})}>Add menu item <span>＋</span></button></div>
    <div className="admin-catalog-tools"><label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a dish" /></label><select aria-label="Filter by outlet" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All outlets</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    <div className="admin-menu-grid">{visible.map((item) => <article className="admin-menu-card" key={item.id}>{item.image_url?<img className="admin-menu-art admin-menu-photo" src={item.image_url} alt=""/>:<div className="admin-menu-art">{brands.find((brand) => brand.id === item.brand_id)?.emoji || '🍽️'}</div>}<div className="admin-menu-info"><span>{item.category} · {brands.find((brand) => brand.id === item.brand_id)?.name || item.brand_id}</span><h3>{item.name}</h3><p>{item.description || 'No description added.'}</p><div className="admin-variant-prices">{item.item_variants?.map((variant) => <span key={variant.id}>{variant.label} <b>₹{variant.price}</b></span>)}{(item.item_extras||[]).map(x=><span key={x.id}>+ {x.name} <b>₹{x.price}</b></span>)}</div><div className="admin-card-actions"><button onClick={()=>setEditing(item)}>Edit</button><button onClick={()=>setDeleteTarget(item)}>Delete</button></div></div><button className={`admin-toggle ${item.is_available ? 'on' : ''}`} disabled={saving === item.id} onClick={() => toggle(item)}><i />{saving === item.id ? 'Saving' : item.is_available ? 'Available' : 'Hidden'}</button></article>)}</div>
    {editing&&<MenuEditor item={editing} brands={brands} close={()=>setEditing(null)} saved={load} />}
    {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.name}?`} message="This will permanently delete this menu item, including its sizes and extras." onCancel={() => setDeleteTarget(null)} onConfirm={remove} />}
  </section>
}

function MenuEditor({item,brands,close,saved}){
  const [form,setForm]=useState({brand_id:item.brand_id||brands[0]?.id||'',category:item.category||'Pizza',name:item.name||'',description:item.description||'',image_url:item.image_url||'',is_available:item.is_available!==false})
  const [variants,setVariants]=useState(item.item_variants?.length?item.item_variants.map(v=>({id:v.id,label:v.label,price:v.price})): [{label:'Regular',price:''}])
  const [extras,setExtras]=useState((item.item_extras||[]).map(x=>({name:x.name,price:x.price,is_available:x.is_available!==false})))
  const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  const update=(key,value)=>setForm(f=>({...f,[key]:value}))
  const upload=async(file)=>{if(!file)return;setBusy(true);const path=`${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,'-')}`;const {error:e}=await sb.storage.from('menu-images').upload(path,file,{upsert:true,contentType:file.type});if(e){setError(e.message);setBusy(false);return}const {data}=sb.storage.from('menu-images').getPublicUrl(path);update('image_url',data.publicUrl);setBusy(false)}
  const save=async()=>{
    const list=variants.filter(v=>v.label&&Number(v.price)>0)
    if(!form.name.trim()||!form.brand_id||!list.length)return setError('Add a name, outlet and at least one priced size.')
    setBusy(true);setError('');let id=item.id;let error
    if(id){({error}=await sb.from('menu_items').update(form).eq('id',id))}
    else{const result=await sb.from('menu_items').insert(form).select('id').single();id=result.data?.id;error=result.error}
    if(!error){
      const retained=new Set(list.filter(v=>v.id).map(v=>v.id));const removed=(item.item_variants||[]).filter(v=>!retained.has(v.id)).map(v=>v.id)
      if(removed.length){await sb.from('settings').update({offer_variant_id:null,offer_price:null,offer_date:null}).in('offer_variant_id',removed);const result=await sb.from('item_variants').delete().in('id',removed);error=result.error}
      if(!error){for(const v of list.filter(v=>v.id)){const result=await sb.from('item_variants').update({label:v.label.trim(),price:Number(v.price)}).eq('id',v.id).eq('item_id',id);if(result.error){error=result.error;break}}}
      const added=list.filter(v=>!v.id)
      if(!error&&added.length){const result=await sb.from('item_variants').insert(added.map(v=>({item_id:id,label:v.label.trim(),price:Number(v.price)})));error=result.error}
    }
    if(!error){await sb.from('item_extras').delete().eq('item_id',id);const extrasToSave=extras.filter(x=>x.name.trim()&&Number(x.price)>=0);if(extrasToSave.length){const result=await sb.from('item_extras').insert(extrasToSave.map(x=>({item_id:id,name:x.name.trim(),price:Number(x.price),is_available:x.is_available!==false})));error=result.error}}
    if(error)setError(error.message);else{await saved();close()}setBusy(false)
  }
  return <div className="admin-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="admin-modal"><div className="admin-section-heading"><div><p>MENU ITEM</p><h3>{item.id?'Edit item':'New item'}</h3></div><button onClick={close}>×</button></div><div className="admin-form-grid"><label>Item name<input value={form.name} onChange={e=>update('name',e.target.value)}/></label><label>Outlet<select value={form.brand_id} onChange={e=>update('brand_id',e.target.value)}>{brands.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label>Category<input value={form.category} onChange={e=>update('category',e.target.value)}/></label><label>Image URL<input value={form.image_url} onChange={e=>update('image_url',e.target.value)} placeholder="https://…"/></label><label className="admin-upload-label">Upload image<input type="file" accept="image/*" onChange={e=>upload(e.target.files?.[0])}/></label><label className="admin-wide-label">Description<textarea value={form.description} onChange={e=>update('description',e.target.value)}/></label></div><div className="admin-editor-list"><b>Sizes and prices</b>{variants.map((v,i)=><div key={i}><input placeholder="Size" value={v.label} onChange={e=>setVariants(a=>a.map((x,n)=>n===i?{...x,label:e.target.value}:x))}/><input type="number" min="1" placeholder="Price ₹" value={v.price} onChange={e=>setVariants(a=>a.map((x,n)=>n===i?{...x,price:e.target.value}:x))}/><button onClick={()=>setVariants(a=>a.filter((_,n)=>n!==i))}>×</button></div>)}<button onClick={()=>setVariants(a=>[...a,{label:'',price:''}])}>＋ Add size</button></div><div className="admin-editor-list"><b>Extras</b>{extras.map((x,i)=><div key={i}><input placeholder="Extra name" value={x.name} onChange={e=>setExtras(a=>a.map((q,n)=>n===i?{...q,name:e.target.value}:q))}/><input type="number" min="0" placeholder="Price ₹" value={x.price} onChange={e=>setExtras(a=>a.map((q,n)=>n===i?{...q,price:e.target.value}:q))}/><button onClick={()=>setExtras(a=>a.filter((_,n)=>n!==i))}>×</button></div>)}<button onClick={()=>setExtras(a=>[...a,{name:'',price:''}])}>＋ Add extra</button></div>{error&&<p className="admin-inline-error">{error}</p>}<div className="admin-modal-actions"><button className="admin-secondary" onClick={close}>Cancel</button><button className="admin-primary" disabled={busy} onClick={save}>{busy?'Saving…':'Save item'}</button></div></section></div>
}

function Outlets() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form,setForm]=useState({id:'',name:'',emoji:'🍽️'});const [busy,setBusy]=useState(false)
  const load = useCallback(async () => {
    const { data, error: queryError } = await sb.from('brands').select('*').order('name')
    setError(queryError?.message || ''); setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])
  const toggle = async (brand) => {
    setError('')
    const { error: updateError } = await sb.from('brands').update({ is_open: !brand.is_open }).eq('id', brand.id)
    if (updateError) setError(updateError.message)
    else setRows((current) => current.map((row) => row.id === brand.id ? { ...row, is_open: !brand.is_open } : row))
  }
  const add=async()=>{if(!form.id.trim()||!form.name.trim())return setError('Add an outlet ID and name.');setBusy(true);const {error:e}=await sb.from('brands').insert({id:form.id.trim().toLowerCase().replace(/\s+/g,'-'),name:form.name.trim(),emoji:form.emoji,is_open:true});if(e)setError(e.message);else{setForm({id:'',name:'',emoji:'🍽️'});await load()}setBusy(false)}
  const updateDetails = async (brand) => {
    const urls = [brand.zomato_url || '', brand.swiggy_url || ''].filter(Boolean)
    if (urls.some((url) => !/^https?:\/\/\S+$/i.test(url))) return setError('Outlet listing links must begin with https:// or http://.')
    setError('')
    const { error: updateError } = await sb.from('brands').update({
      about_category: brand.about_category || '',
      about_tagline: brand.about_tagline || '',
      zomato_url: brand.zomato_url || '',
      swiggy_url: brand.swiggy_url || ''
    }).eq('id', brand.id)
    if (updateError) setError(updateError.message)
    else setRows((current) => current.map((row) => row.id === brand.id ? { ...row, ...brand } : row))
  }
  const remove=async()=>{if(!deleteTarget)return 'The outlet could not be found.';setError('');const {error:deleteError}=await sb.rpc('admin_delete_outlet',{p_id:deleteTarget.id});if(deleteError)return deleteError.message;setRows(rows=>rows.filter(row=>row.id!==deleteTarget.id));return null}
  return <section className="admin-content">
    <div className="admin-page-heading"><div><p>STORE LOCATIONS</p><h2>Outlet controls</h2><span>Pause or resume ordering by kitchen.</span></div><span className="admin-total-chip">{rows.filter((row) => row.is_open).length} open</span></div>
    <div className="admin-create-row"><input placeholder="Outlet ID (e.g. eat60-cafe)" value={form.id} onChange={e=>setForm({...form,id:e.target.value})}/><input placeholder="Outlet name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/><input aria-label="Outlet emoji" value={form.emoji} onChange={e=>setForm({...form,emoji:e.target.value})}/><button className="admin-primary" disabled={busy} onClick={add}>Add outlet ＋</button></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    <div className="admin-outlet-grid">{rows.map((brand) => <article className={`admin-outlet-card ${brand.is_open ? 'is-open' : ''}`} key={brand.id}>
      <div className="admin-outlet-icon">{brand.emoji || '🍽️'}</div>
      <div className="admin-outlet-main"><span>OUTLET · {brand.id}</span><h3>{brand.name}</h3><small>{brand.is_open ? 'Visible on About · accepting orders' : 'Hidden from About · orders paused'}</small>
        <div className="admin-outlet-about-fields">
          <label>About category<input value={brand.about_category || ''} onChange={(event) => setRows((current) => current.map((row) => row.id === brand.id ? { ...row, about_category: event.target.value } : row))} placeholder="Cuisine or menu type" /></label>
          <label>About tagline<input value={brand.about_tagline || ''} onChange={(event) => setRows((current) => current.map((row) => row.id === brand.id ? { ...row, about_tagline: event.target.value } : row))} placeholder="A short outlet description" /></label>
          <label>Zomato URL<input type="url" value={brand.zomato_url || ''} onChange={(event) => setRows((current) => current.map((row) => row.id === brand.id ? { ...row, zomato_url: event.target.value } : row))} placeholder="https://…" /></label>
          <label>Swiggy URL<input type="url" value={brand.swiggy_url || ''} onChange={(event) => setRows((current) => current.map((row) => row.id === brand.id ? { ...row, swiggy_url: event.target.value } : row))} placeholder="https://…" /></label>
        </div>
        <button className="admin-secondary admin-outlet-save" onClick={() => updateDetails(brand)}>Save About details</button>
      </div>
      <button className={`admin-toggle ${brand.is_open ? 'on' : ''}`} onClick={() => toggle(brand)}><i />{brand.is_open ? 'Open' : 'Closed'}</button>
      <button className="admin-cancel-order" onClick={()=>setDeleteTarget(brand)}>Delete</button>
    </article>)}</div>
    {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.name}?`} message="This will permanently delete the outlet, its menu items, and their sizes." onCancel={() => setDeleteTarget(null)} onConfirm={remove} />}
  </section>
}

function AdminFeed() {
  const [body, setBody] = useState('')
  const [opts, setOpts] = useState('')
  const [imageUrl,setImageUrl]=useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [posts,setPosts]=useState([])
  const [deleteTarget,setDeleteTarget]=useState(null)
  const [comments,setComments]=useState([]);const [likes,setLikes]=useState([]);const [userId,setUserId]=useState('');const [reply,setReply]=useState({})
  const load=useCallback(async()=>{const [p,c,l,u]=await Promise.all([sb.from('feed_posts').select('id,kind,body,image_url,created_at').order('created_at',{ascending:false}),sb.from('feed_comments').select('*').order('created_at'),sb.from('reaction_counts').select('*').eq('emoji','❤️'),sb.auth.getUser()]);if(p.error)setMsg(p.error.message);else setPosts(p.data||[]);if(!c.error)setComments(c.data||[]);if(!l.error)setLikes(l.data||[]);setUserId(u.data?.user?.id||'')},[])
  useEffect(()=>{load()},[load])
  useEffect(()=>{const ch=sb.channel('admin-feed-engagement').on('postgres_changes',{event:'*',schema:'public',table:'comments'},load).on('postgres_changes',{event:'*',schema:'public',table:'reactions'},load).subscribe();return()=>sb.removeChannel(ch)},[load])
  const publish = async () => {
    const list = opts.split(',').map((s) => s.trim()).filter(Boolean)
    if (!body.trim()) return setMsg('Write something first.')
    if (list.length === 1) return setMsg('Add at least two poll options, or leave the field empty for a post.')
    setBusy(true); setMsg('')
    const { data, error } = await sb.from('feed_posts').insert({ kind: list.length > 1 ? 'poll' : 'news', body: body.trim(), image_url:imageUrl.trim()||null }).select().single()
    if (error) { setMsg(error.message); setBusy(false); return }
    if (list.length > 1) {
      const { error: optionsError } = await sb.from('poll_options').insert(list.map((label) => ({ post_id: data.id, label })))
      if (optionsError) { setMsg(`Post was created, but poll options failed: ${optionsError.message}`); setBusy(false); return }
    }
    setBody(''); setOpts('');setImageUrl(''); setMsg('Published successfully.'); await load(); setBusy(false)
  }
  const sendReply=async(commentId)=>{const text=(reply[commentId]||'').trim();if(!text||!userId)return;const {error}=await sb.from('comments').insert({post_id:comments.find(c=>c.id===commentId)?.post_id,user_id:userId,parent_comment_id:commentId,body:text});if(error)setMsg(error.message);else{setReply(r=>({...r,[commentId]:''}));await load()}}
  const removePost=async()=>{if(!deleteTarget)return 'The feed post could not be found.';const {error:deleteError}=await sb.from('feed_posts').delete().eq('id',deleteTarget.id);if(deleteError)return deleteError.message;setPosts(current=>current.filter(post=>post.id!==deleteTarget.id));setComments(current=>current.filter(comment=>comment.post_id!==deleteTarget.id));return null}
  return <><section className="admin-content"><div className="admin-page-heading"><div><p>CUSTOMER COMMUNITY</p><h2>Feed studio</h2><span>Publish announcements for live in-app alerts, share posts, and reply to customers.</span></div><span className="admin-total-chip">{posts.length} posts</span></div><div className="admin-feed-editor"><div className="admin-feed-editor-heading"><div className="admin-feed-icon">✳</div><div><b>Write an announcement or post</b><small>News announcements appear as a live full-screen alert for customers</small></div></div><label>YOUR POST<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} placeholder="Share an announcement, offer, or question…" /></label><div className="admin-feed-count">{body.length} / 1000</div><label>IMAGE URL <span>(optional)</span><input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://…"/></label><label>POLL OPTIONS <span>(optional, comma-separated)</span><input value={opts} onChange={(event) => setOpts(event.target.value)} placeholder="For a poll: Pizza, Burger, Wraps" /></label><button className="admin-primary" disabled={busy || !body.trim()} onClick={publish}>{busy ? 'Publishing…' : 'Publish to feed'} <span>→</span></button>{msg && <p className="admin-feedback" role="status">{msg}</p>}</div><h3 className="admin-list-title">Live feed and conversations</h3><div className="admin-feed-list">{posts.map(p=>{const postComments=comments.filter(c=>c.post_id===p.id);const topComments=postComments.filter(c=>!c.parent_comment_id);return <article className="admin-feed-post-card" key={p.id}><div><span>{p.kind==='poll'?'POLL':'POST'} · {new Date(p.created_at).toLocaleDateString()}</span><p>{p.body}</p>{p.image_url&&<img className="admin-feed-preview" src={p.image_url} alt=""/>}<div className="admin-feed-stats"><b>♥ {likes.find(x=>x.post_id===p.id)?.total||0} likes</b><b>▢ {postComments.length} comments</b></div>{topComments.map(c=><div className="admin-comment-thread" key={c.id}><p><b>{c.author}</b><span>{c.body}</span></p>{postComments.filter(r=>r.parent_comment_id===c.id).map(r=><p className="admin-comment-reply" key={r.id}><b>{r.author} · EAT60</b><span>{r.body}</span></p>)}<div className="admin-reply-form"><input maxLength={300} value={reply[c.id]||''} onChange={e=>setReply(r=>({...r,[c.id]:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&sendReply(c.id)} placeholder={`Reply to ${c.author}…`}/><button onClick={()=>sendReply(c.id)}>Reply</button></div></div>)}</div><button className="admin-cancel-order" onClick={()=>setDeleteTarget(p)}>Delete post</button></article>})}</div></section>{deleteTarget && <ConfirmDialog title="Delete this feed post?" message="This will permanently delete the post and its comments." onCancel={() => setDeleteTarget(null)} onConfirm={removePost} />}</>
}

function Promos(){
 const empty={code:'',description:'',discount_type:'percent',discount_value:'10',minimum_order:'0',maximum_discount:'',usage_limit:'',per_user_limit:'1',starts_at:'',expires_at:'',is_active:true}
 const [rows,setRows]=useState([]),[form,setForm]=useState(empty),[edit,setEdit]=useState(null),[msg,setMsg]=useState('')
 const [deleteTarget,setDeleteTarget]=useState(null)
 const load=useCallback(async()=>{const {data,error}=await sb.from('coupons').select('*').order('created_at',{ascending:false});if(error)setMsg(error.message);else setRows(data||[])},[]);useEffect(()=>{load()},[load])
 const save=async()=>{const val={code:form.code.trim().toUpperCase(),description:form.description||'',discount_type:form.discount_type,discount_value:Number(form.discount_value),minimum_order:Number(form.minimum_order||0),maximum_discount:form.maximum_discount===''?null:Number(form.maximum_discount),usage_limit:form.usage_limit===''?null:Number(form.usage_limit),per_user_limit:Number(form.per_user_limit||1),starts_at:form.starts_at?new Date(form.starts_at).toISOString():null,expires_at:form.expires_at?new Date(form.expires_at).toISOString():null,is_active:form.is_active!==false};const {error}=edit?await sb.from('coupons').update(val).eq('id',edit):await sb.from('coupons').insert(val);if(error)setMsg(error.message);else{setForm(empty);setEdit(null);setMsg('Promo saved.');load()}}
 const change=(k,v)=>setForm(f=>({...f,[k]:v}))
 const remove=async()=>{if(!deleteTarget)return 'The coupon could not be found.';const {error}=await sb.from('coupons').delete().eq('id',deleteTarget.id);if(error)return error.message;setRows(rows=>rows.filter(row=>row.id!==deleteTarget.id));return null}
 return <><section className="admin-content"><div className="admin-page-heading"><div><p>OFFERS & CAMPAIGNS</p><h2>Coupons and promos</h2><span>Set discount, minimum cart, campaign dates and redemption caps.</span></div></div><div className="admin-feed-editor"><div className="admin-form-grid"><label>Coupon code<input value={form.code} onChange={e=>change('code',e.target.value.toUpperCase())} placeholder="EAT60WELCOME"/></label><label>Description<input value={form.description} onChange={e=>change('description',e.target.value)}/></label><label>Discount type<select value={form.discount_type} onChange={e=>change('discount_type',e.target.value)}><option value="percent">Percent</option><option value="fixed">Fixed amount ₹</option></select></label><label>Discount value<input type="number" min="1" value={form.discount_value} onChange={e=>change('discount_value',e.target.value)}/></label><label>Minimum order ₹<input type="number" min="0" value={form.minimum_order} onChange={e=>change('minimum_order',e.target.value)}/></label><label>Maximum discount ₹<input type="number" min="1" value={form.maximum_discount} onChange={e=>change('maximum_discount',e.target.value)} placeholder="No cap"/></label><label>Total redemptions<input type="number" min="1" value={form.usage_limit} onChange={e=>change('usage_limit',e.target.value)} placeholder="Unlimited"/></label><label>Uses per user<input type="number" min="1" value={form.per_user_limit} onChange={e=>change('per_user_limit',e.target.value)}/></label><label>Starts<input type="datetime-local" value={form.starts_at} onChange={e=>change('starts_at',e.target.value)}/></label><label>Expires<input type="datetime-local" value={form.expires_at} onChange={e=>change('expires_at',e.target.value)}/></label></div><button className="admin-primary" onClick={save}>{edit?'Update promo':'Create promo'}</button>{msg&&<p className="admin-feedback">{msg}</p>}</div><div className="admin-promo-list">{rows.map(c=><article key={c.id}><div><b>{c.code}</b><p>{c.description||`${c.discount_value}${c.discount_type==='percent'?'%':'₹'} off`} · min ₹{c.minimum_order} · {c.used_count}/{c.usage_limit||'∞'} uses · {c.per_user_limit} per user</p><small>{c.starts_at?new Date(c.starts_at).toLocaleString():'Anytime'} — {c.expires_at?new Date(c.expires_at).toLocaleString():'No expiry'}</small></div><button className={`admin-toggle ${c.is_active?'on':''}`} onClick={async()=>{const {error}=await sb.from('coupons').update({is_active:!c.is_active}).eq('id',c.id);if(error)setMsg(error.message);else setRows(r=>r.map(x=>x.id===c.id?{...x,is_active:!x.is_active}:x))}}><i/>{c.is_active?'Active':'Paused'}</button><button className="admin-secondary" onClick={()=>{setEdit(c.id);setForm({...empty,...c,starts_at:c.starts_at?new Date(c.starts_at).toISOString().slice(0,16):'',expires_at:c.expires_at?new Date(c.expires_at).toISOString().slice(0,16):'',maximum_discount:c.maximum_discount??'',usage_limit:c.usage_limit??''})}}>Edit</button><button className="admin-cancel-order" onClick={()=>setDeleteTarget(c)}>Delete</button></article>)}</div></section>{deleteTarget&&<ConfirmDialog title={`Delete coupon ${deleteTarget.code}?`} message="This coupon will no longer be available to customers." onCancel={()=>setDeleteTarget(null)} onConfirm={remove}/>}</>
}

function Rewards(){
 const [rows,setRows]=useState([]),[form,setForm]=useState({milestone:'',gift:''}),[msg,setMsg]=useState('')
 const [deleteTarget,setDeleteTarget]=useState(null)
 const load=useCallback(async()=>{const {data,error}=await sb.from('streak_rewards').select('*').order('milestone');if(error)setMsg(error.message);else setRows(data||[])},[]);useEffect(()=>{load()},[load])
 const save=async()=>{const {error}=await sb.from('streak_rewards').upsert({milestone:Number(form.milestone),gift:form.gift.trim(),is_active:true});if(error)setMsg(error.message);else{setForm({milestone:'',gift:''});setMsg('Reward saved.');load()}}
 const remove=async()=>{if(!deleteTarget)return 'The streak reward could not be found.';const {error}=await sb.from('streak_rewards').delete().eq('milestone',deleteTarget.milestone);if(error)return error.message;setRows(rows=>rows.filter(row=>row.milestone!==deleteTarget.milestone));return null}
 return <><section className="admin-content"><div className="admin-page-heading"><div><p>LOYALTY PROGRAM</p><h2>Streak rewards</h2><span>Choose the order streak milestones and customer rewards.</span></div></div><div className="admin-create-row"><input type="number" min="1" placeholder="Order streak milestone" value={form.milestone} onChange={e=>setForm({...form,milestone:e.target.value})}/><input placeholder="Reward description" value={form.gift} onChange={e=>setForm({...form,gift:e.target.value})}/><button className="admin-primary" onClick={save}>Save reward ＋</button></div>{msg&&<p className="admin-feedback">{msg}</p>}<div className="admin-promo-list">{rows.map(r=><article key={r.milestone}><div><b>{r.milestone} order streak</b><p>{r.gift}</p></div><button className={`admin-toggle ${r.is_active?'on':''}`} onClick={async()=>{const {error}=await sb.from('streak_rewards').update({is_active:!r.is_active}).eq('milestone',r.milestone);if(error)setMsg(error.message);else setRows(a=>a.map(x=>x.milestone===r.milestone?{...x,is_active:!x.is_active}:x))}}><i/>{r.is_active?'Active':'Paused'}</button><button className="admin-cancel-order" onClick={()=>setDeleteTarget(r)}>Delete</button></article>)}</div></section>{deleteTarget&&<ConfirmDialog title={`Delete ${deleteTarget.milestone}-day reward?`} message="Customers will no longer be able to earn this streak reward." onCancel={()=>setDeleteTarget(null)} onConfirm={remove}/>}</>
}
