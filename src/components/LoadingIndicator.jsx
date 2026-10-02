export default function LoadingIndicator({
  label = 'Loading EAT60…',
  compact = false
}) {
  return <div className={`eat60-loading${compact ? ' compact' : ''}`} role="status" aria-live="polite">
    <span className="eat60-loader-spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>;
}
