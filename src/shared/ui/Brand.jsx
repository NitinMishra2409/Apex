export default function Brand({ compact = false }) {
    return <span className="brand">
        <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <path d="M4 34 19 8l6 10-9 16H4Z" fill="#F3BC64" />
            <path d="m21 3 16 31h-8l-7-14 4-7-5-10Z" fill="#FFD894" />
            <path d="m19 25-4 9h12l-5-9h-3Z" fill="#D7E0EF" />
            <path d="m19 8 3 6-6 20H4L19 8Z" fill="#E4A84C" fillOpacity=".3" />
        </svg>
        {!compact && <span>Apex Log</span>}
    </span>
}
