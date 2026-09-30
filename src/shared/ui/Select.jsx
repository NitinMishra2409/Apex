import { Children, useId, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import AnchoredPopover from './AnchoredPopover'

const optionText = children => Children.toArray(children).map(child => typeof child === 'object' ? optionText(child.props.children) : String(child)).join('')

// Controlled, single-choice presentation. Values and updates remain with the caller.
export default function Select({ id, name, value, onValueChange, disabled = false, children, className = '', style, autoComplete, ...rest }) {
  const options = Children.toArray(children).filter(child => child?.type === 'option').map(child => ({
    value: String(child.props.value ?? ''), label: child.props.children,
    text: optionText(child.props.children), disabled: Boolean(child.props.disabled),
  }))
  const selected = options.findIndex(option => option.value === String(value))
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(Math.max(0, selected))
  const trigger = useRef(null)
  const activeOption = useRef(null)
  const search = useRef({ text: '', at: 0 })
  const generatedId = useId()
  const triggerId = id || `${generatedId}-trigger`
  const listId = `${generatedId}-list`
  const expanded = open && !disabled

  const choose = option => {
    if (!option || option.disabled) return
    if (option.value !== String(value)) onValueChange?.(option.value)
    setOpen(false)
    trigger.current?.focus()
  }
  const show = start => {
    if (disabled || !options.some(option => !option.disabled)) return
    search.current = { text: '', at: 0 }
    setActive(options[start]?.disabled ? options.findIndex(option => !option.disabled) : start)
    setOpen(true)
  }
  const move = delta => {
    let next = active
    for (let i = 0; i < options.length; i++) {
      next = (next + delta + options.length) % options.length
      if (!options[next].disabled) { setActive(next); break }
    }
  }
  const onKeyDown = event => {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!expanded) show(Math.max(0, selected))
      else move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const index = event.key === 'Home' ? options.findIndex(o => !o.disabled) : options.map(o => !o.disabled).lastIndexOf(true)
      if (!expanded) show(index)
      else setActive(index)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (expanded) choose(options[active])
      else show(Math.max(0, selected))
    } else if (event.key === 'Tab') setOpen(false)
    else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      const now = Date.now()
      const text = (now - search.current.at < 700 ? search.current.text : '') + event.key.toLowerCase()
      const repeated = [...text].every(char => char === text[0])
      const query = repeated ? text[0] : text
      const start = repeated ? active + 1 : active
      const index = options.findIndex((_, offset) => {
        const option = options[(start + offset) % options.length]
        return !option.disabled && option.text.toLowerCase().startsWith(query)
      })
      if (index >= 0) {
        const found = (start + index) % options.length
        if (!expanded) show(found)
        else setActive(found)
      }
      search.current = { text, at: now }
    }
  }
  useLayoutEffect(() => {
    if (expanded) activeOption.current?.scrollIntoView({ block: 'nearest' })
  }, [expanded, active])

  return <span className={`apex-select ${className}`} style={style}>
    {name && <input type="hidden" name={name} value={value ?? ''} disabled={disabled} autoComplete={autoComplete} />}
    <button {...rest} id={triggerId} ref={trigger} type="button" role="combobox" aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded ? `${listId}-${active}` : undefined} disabled={disabled} className="apex-select-trigger" onClick={() => expanded ? setOpen(false) : show(Math.max(0, selected))} onKeyDown={onKeyDown} onBlur={() => setOpen(false)}>
      <span className="apex-select-value">{options[selected]?.label ?? options[0]?.label}</span><ChevronDown size={16} aria-hidden="true" />
    </button>
    {expanded && <AnchoredPopover anchorRef={trigger} onClose={() => setOpen(false)} id={listId} role="listbox" aria-labelledby={triggerId} className="apex-select-popup" width={200} height={Math.min(320, options.length * 44 + 8)}>
      {options.map((option, index) => <button key={`${option.value}-${index}`} ref={index === active ? activeOption : undefined} id={`${listId}-${index}`} data-index={index} type="button" role="option" tabIndex={-1} aria-selected={index === selected} disabled={option.disabled} className={`apex-select-option ${index === active ? 'is-active' : ''}`} onPointerMove={() => { if (!option.disabled) setActive(index) }} onPointerDown={event => event.preventDefault()} onClick={() => choose(option)}><span>{option.label}</span>{index === selected && <Check size={15} aria-hidden="true" />}</button>)}
    </AnchoredPopover>}
  </span>
}
