import { useEffect, useRef } from 'react'
import { calcPnl } from '../../domain/trades/math'
import useReducedMotion from '../../shared/hooks/useReducedMotion'

const trade = { symbol: 'AAPL', direction: 'LONG', entry: 180, exit: 184, units: 10, fees: 2 }
const amount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pnl = calcPnl(trade.direction, trade.entry, trade.exit, trade.units, trade.fees)

export default function LandingScene() {
    const scene = useRef(null)
    const reduced = useReducedMotion()
    useEffect(() => {
        const node = scene.current
        const pointer = window.matchMedia('(min-width: 1180px) and (hover: hover) and (pointer: fine)')
        let frame = 0
        const reset = () => {
            cancelAnimationFrame(frame)
            node.style.removeProperty('--scene-x')
            node.style.removeProperty('--scene-y')
        }
        const move = event => {
            if (reduced || !pointer.matches || event.pointerType === 'touch') return
            const { left, top, width, height } = node.getBoundingClientRect()
            const x = Math.max(-1, Math.min(1, (event.clientX - left) / width * 2 - 1))
            const y = Math.max(-1, Math.min(1, (event.clientY - top) / height * 2 - 1))
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                node.style.setProperty('--scene-x', `${-y * 2}deg`)
                node.style.setProperty('--scene-y', `${x * 2}deg`)
            })
        }
        node.addEventListener('pointermove', move)
        node.addEventListener('pointerleave', reset)
        pointer.addEventListener('change', reset)
        return () => {
            reset()
            node.removeEventListener('pointermove', move)
            node.removeEventListener('pointerleave', reset)
            pointer.removeEventListener('change', reset)
        }
    }, [reduced])
    return <div className="al-scene" ref={scene} aria-hidden="true">
        <div className="al-scene-glow" />
        <picture>
            <source media="(max-width: 760px)" srcSet="/images/ui-redesign/hero-sculpture-small.webp" />
            <img className="al-sculpture" src="/images/ui-redesign/hero-sculpture.webp" width="1312" height="1199" alt="" decoding="async" />
        </picture>
    </div>
}

export function LandingTradeStrip() {
    return <figure className="al-proof" aria-label="Illustrative journal trade in a USD account">
        <figcaption>Illustrative journal <span aria-hidden="true">·</span> USD account</figcaption>
        <div className="al-proof-symbol"><strong>{trade.symbol}</strong><span>{trade.direction}</span></div>
        <dl>
            <div><dt>Entry</dt><dd>{amount.format(trade.entry)}</dd></div>
            <div><dt>Exit</dt><dd>{amount.format(trade.exit)}</dd></div>
            <div><dt>Units</dt><dd>{trade.units}</dd></div>
            <div><dt>Fees</dt><dd>{amount.format(trade.fees)}</dd></div>
            <div className="al-proof-pnl"><dt>Realised P&amp;L</dt><dd>+{amount.format(pnl)} USD</dd></div>
        </dl>
        <p>3 checks saved</p>
    </figure>
}
