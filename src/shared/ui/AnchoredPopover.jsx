import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { placePopover } from './popoverPlacement'

function visibleViewport() {
  const viewport = window.visualViewport
  return viewport ? { width: viewport.width, height: viewport.height, left: viewport.offsetLeft, top: viewport.offsetTop } : { width: innerWidth, height: innerHeight, left: 0, top: 0 }
}

// Render inside an owning modal's top layer, or outside ordinary clipping panels.
export default function AnchoredPopover({ anchorRef, onClose, children, className = '', width = 240, height = 320, focusOnOpen = false, ...props }) {
  const popup = useRef(null)
  const close = useRef(onClose)
  const [position, setPosition] = useState(null)
  const positioned = position !== null
  useLayoutEffect(() => { close.current = onClose })
  useLayoutEffect(() => {
    if (focusOnOpen && positioned) popup.current?.querySelector('a, button')?.focus()
  }, [focusOnOpen, positioned])
  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current
      const rect = anchor?.getBoundingClientRect()
      if (!rect) return
      const viewport = visibleViewport()
      if (!anchor.getClientRects().length || rect.bottom < viewport.top || rect.top > viewport.top + viewport.height || rect.right < viewport.left || rect.left > viewport.left + viewport.width) {
        close.current()
        return
      }
      setPosition(placePopover(rect, viewport, height, width))
    }
    const outside = event => {
      if (!anchorRef.current?.contains(event.target) && !popup.current?.contains(event.target)) close.current()
    }
    const escape = event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close.current()
        if (anchorRef.current?.getClientRects().length) anchorRef.current.focus()
      }
    }
    update()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [anchorRef, height, width])
  const host = anchorRef.current?.closest('dialog') || document.body
  return createPortal(<div {...props} ref={popup} className={`apex-popover ${className}`} style={position || { visibility: 'hidden', top: 0, left: 0, width, maxHeight: height }}>{children}</div>, host)
}
