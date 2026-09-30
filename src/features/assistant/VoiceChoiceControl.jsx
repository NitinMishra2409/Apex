import { useId } from 'react'

const OPTIONS = [['device', 'Device voice (instant)'], ['studio', 'Studio voice']]

export default function VoiceChoiceControl({ value, onChange, className = '' }) {
    const name = useId()
    return <fieldset className={`voice-choice ${className}`}>
        <legend>Spoken replies</legend>
        <div className="voice-choice-options">{OPTIONS.map(([id, label]) => <label key={id} className={value === id ? 'is-selected' : ''}><input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />{label}</label>)}</div>
        <small>{value === 'device' ? 'Starts instantly and has no daily limit. Quality depends on your device.' : 'More natural, but limited each day. It switches to your device voice if the limit is reached.'}</small>
    </fieldset>
}
