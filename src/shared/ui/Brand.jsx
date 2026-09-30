export default function Brand({ compact = false, tone = 'amber' }) {
    return <span className={`brand brand-${tone}`}>
        <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M3 34 17 6h8l-7.6 15h-5.8l-1 2h11.9c1.8 0 2.8.7 3.5 2.6l3.2 8.4h-2l-2.9-7.7c-.3-.8-.8-1.3-1.8-1.3h-8.3l-4.7 9H3Z" fill="var(--brand-mark)" />
            <path d="m26 6 13 28h-7.7L26 22.7V6Z" fill="var(--brand-mark)" />
        </svg>
        {!compact && <span>Apex Log</span>}
    </span>
}
