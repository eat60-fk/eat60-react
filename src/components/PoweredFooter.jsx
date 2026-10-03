export default function PoweredFooter({
  className = '',
  version = '1.0.0',
  online = typeof navigator === 'undefined' ? true : navigator.onLine
}) {
  return <footer className={`powered-footer ${className}`.trim()} aria-label="Powered by Foodverse Kitchen">
    <span>POWERED BY</span>
    <strong>FOODVERSE KITCHEN</strong>
    <small className="powered-footer-meta"><span>{online ? 'ONLINE' : 'OFFLINE'}</span><i aria-hidden="true">·</i><span>v.{String(version || '1.0.0').replace(/^v\.?/i, '')}</span></small>
  </footer>;
}
