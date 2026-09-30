import Brand from '../shared/ui/Brand'

export default function RouteFallback() {
  return <div className="route-fallback" role="status" aria-live="polite">
    <Brand compact />
    <p>Loading your workspace…</p>
  </div>
}
