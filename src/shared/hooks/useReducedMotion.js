import { useEffect, useState } from 'react'

export default function useReducedMotion() {
    const read = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'
    const [reduced, setReduced] = useState(read)
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)')
        const update = () => setReduced(read())
        media.addEventListener('change', update)
        window.addEventListener('apex-motion-change', update)
        return () => { media.removeEventListener('change', update); window.removeEventListener('apex-motion-change', update) }
    }, [])
    return reduced
}
