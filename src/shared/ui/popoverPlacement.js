// Keep the list attached to its trigger while making room for short viewports.
export function placePopover(rect, viewport, desiredHeight, desiredWidth) {
  const margin = 8
  const gap = 4
  const viewportLeft = viewport.left || 0
  const viewportTop = viewport.top || 0
  const width = Math.max(0, Math.min(Math.max(rect.width, desiredWidth), viewport.width - margin * 2))
  const left = Math.max(viewportLeft + margin, Math.min(rect.left, viewportLeft + viewport.width - width - margin))
  const below = viewportTop + viewport.height - rect.bottom - gap - margin
  const above = rect.top - viewportTop - gap - margin
  const up = above > below && below < Math.min(desiredHeight, 240)
  const maxHeight = Math.max(0, Math.min(desiredHeight, viewport.height - margin * 2, up ? above : below))
  const preferredTop = up ? rect.top - gap - maxHeight : rect.bottom + gap
  const top = Math.max(viewportTop + margin, Math.min(preferredTop, viewportTop + viewport.height - margin - maxHeight))
  return { left, top, width, maxHeight }
}
