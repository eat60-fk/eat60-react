export default function PoweredFooter({
  className = ''
}) {
  return <footer className={`powered-footer ${className}`.trim()} aria-label="Powered by Foodverse Kitchen">
    <span>POWERED BY</span>
    <strong>FOODVERSE KITCHEN</strong>
  </footer>;
}
