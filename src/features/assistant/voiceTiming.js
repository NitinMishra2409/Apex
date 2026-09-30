const STEPS = [
    ['Silence detected', 'silenceDetected'], ['Transcript received', 'transcriptReceived'],
    ['First token', 'firstToken'], ['First sentence queued', 'firstSentenceQueued'],
    ['First audio started', 'firstAudioStarted'], ['Reply finished', 'replyFinished'],
]
const SERVER_STEPS = [
    ['Transcribe auth', 'transcribe', 'auth'], ['Transcribe provider', 'transcribe', 'provider'],
    ['Chat auth', 'chat', 'auth'], ['Chat journal', 'chat', 'journal'], ['Chat provider', 'chat', 'provider'], ['Chat first token', 'chat', 'firstToken'],
    ['Speak auth', 'speak', 'auth'], ['Speak provider', 'speak', 'provider'],
]

export function parseServerTiming(header) {
    const timing = {}
    for (const part of (header || '').split(',')) {
        const match = /^\s*(auth|journal|provider);dur=(\d+(?:\.\d+)?)\s*$/.exec(part)
        if (match) timing[match[1]] = Number(match[2])
    }
    return timing
}

export function createVoiceTiming(onComplete, clock = () => performance.now()) {
    let current = null
    let turns = []
    return {
        start(speechEnd, silenceDetected = true) { current = { marks: { speechEnd: Number.isFinite(speechEnd) ? speechEnd : clock(), ...(silenceDetected ? { silenceDetected: clock() } : {}) }, manual: !silenceDetected, server: {} } },
        mark(name) { if (current && !(name in current.marks)) current.marks[name] = clock() },
        server(route, values) { if (current && !current.server[route]) current.server[route] = values },
        discard() { current = null },
        finish() {
            if (!current) return
            this.mark('replyFinished')
            turns = [...turns, current].slice(-10)
            current = null
            onComplete([...turns])
        },
        clear() { current = null; turns = []; onComplete([]) },
    }
}

const elapsed = (turn, key) => Number.isFinite(turn.marks[key]) ? `${Math.max(0, turn.marks[key] - turn.marks.speechEnd).toFixed(0)} ms` : key === 'silenceDetected' && turn.manual ? 'Manual send' : '—'
const duration = value => Number.isFinite(value) ? `${value.toFixed(1)} ms` : '—'

export function timingMarkdown(turns) {
    const columns = ['Turn', ...STEPS.map(([label]) => label), ...SERVER_STEPS.map(([label]) => label)]
    const rows = turns.map((turn, index) => [
        String(index + 1), ...STEPS.map(([, key]) => elapsed(turn, key)),
        ...SERVER_STEPS.map(([, route, step]) => duration(turn.server[route]?.[step])),
    ])
    return [
        '| ' + columns.join(' | ') + ' |',
        '| ' + columns.map(() => '---').join(' | ') + ' |',
        ...rows.map(row => '| ' + row.join(' | ') + ' |'),
    ].join('\n')
}

export const TIMING_STEPS = STEPS
export const TIMING_SERVER_STEPS = SERVER_STEPS
export const timingElapsed = elapsed
export const timingDuration = duration
