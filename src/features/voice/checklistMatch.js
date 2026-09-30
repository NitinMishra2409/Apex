// Turn a spoken transcript into ticks for the numbered per-trade checklist.
//
//   "... checklist one, two and four"    -> items 1, 2 and 4
//   "checks one to three" / "all except four"
//   "stop loss placed"                   -> the item worded "Stop loss placed"
//
// Kept apart from the trade-field parser: that one reads numbers as prices, this
// one reads them as item positions ("one, three" is items 1 and 3, never 4).
//
// Conservative like the field parser. A confident match ticks; a near match is
// reported as `unsure` so the form can ask the trader to check it.

const NUMBER_WORDS = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fourty: 40,
    fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
}
const TENS = new Set(['twenty', 'thirty', 'forty', 'fourty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'])

// Words that introduce a list of item numbers.
const TRIGGERS = new Set(['checklist', 'checklists', 'check', 'checks', 'checkmark', 'checkmarks', 'item', 'items', 'tick', 'ticks', 'ticked', 'number', 'numbers'])
// Words allowed inside a reference clause without ending it.
const FILLER = new Set(['list', 'the', 'of', 'are', 'is', 'were', 'was', 'for', 'on', 'off', 'please', 'and', 'plus', 'also', 'then'])
const COMPLETION = new Set(['done', 'complete', 'completed', 'finished', 'ticked', 'checked'])
const ALL = new Set(['all', 'everything', 'every'])
const EXCEPT = new Set(['except', 'but', 'besides', 'excluding', 'without', 'minus', 'apart', 'other', 'than', 'from'])
const DETERMINERS = new Set(['the', 'of', 'my', 'these', 'those'])
const RANGE = new Set(['to', 'through', 'thru', 'till', 'until'])
// A number followed by one of these is a quantity ("check 2 lots"), not an item.
const QUANTITY_NOUN = /^(?:shares?|units?|lots?|contracts?|coins?|tokens?|percent|pips?|points?|dollars?|bucks|rupees|usd|usdt|r)$/

const STOP_WORDS = new Set(['a', 'an', 'the', 'my', 'i', 'me', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at', 'it', 'its', 'and', 'or', 'for', 'with', 'this', 'that', 'every'])

function tokenize(text) {
    return String(text ?? '')
        .toLowerCase()
        .replace(/[‘’“”']/g, '')
        .replace(/(\d),(?=\d{3}\b)/g, '$1')
        .replace(/(\d)\s*[-–—]\s*(?=\d)/g, '$1 to ')
        .replace(/[^a-z0-9.\s]/g, ' ')
        .replace(/\.(?!\d)/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
}

/** Read the number at tokens[i]; returns { value, length } or null. */
function readNumber(tokens, i) {
    const word = tokens[i]
    if (/^\d+$/.test(word)) return { value: Number(word), length: 1 }
    if (!(word in NUMBER_WORDS)) return null
    const value = NUMBER_WORDS[word]
    const next = NUMBER_WORDS[tokens[i + 1]]
    if (TENS.has(word) && next >= 1 && next <= 9) return { value: value + next, length: 2 }
    return { value, length: 1 }
}

/**
 * Parse one reference clause starting at `from`.
 * @returns {{ end:number, picked:Set<number>, excluded:Set<number>, all:boolean }}
 */
function readClause(tokens, from) {
    const picked = new Set()
    const excluded = new Set()
    let all = false, excluding = false, completion = false
    let last = null      // last number read, for "one to three"
    let rangeFrom = null

    let i = from
    for (; i < tokens.length; i++) {
        const word = tokens[i]

        const num = readNumber(tokens, i)
        if (num) {
            const after = tokens[i + num.length]
            if (after && QUANTITY_NOUN.test(after)) break
            const target = excluding ? excluded : picked
            const start = rangeFrom ?? num.value
            for (let n = Math.min(start, num.value); n <= Math.max(start, num.value) && n <= 99; n++) target.add(n)
            last = num.value
            rangeFrom = null
            i += num.length - 1
            continue
        }
        if (RANGE.has(word) && last !== null && readNumber(tokens, i + 1)) { rangeFrom = last; continue }
        // "all"/"except" only mean something right after the trigger ("all except four").
        if (ALL.has(word)) {
            if (picked.size || excluded.size) break
            all = true
            continue
        }
        if (EXCEPT.has(word)) {
            if (!all) break
            excluding = true
            continue
        }
        if (COMPLETION.has(word)) { completion = true; continue }
        if (FILLER.has(word) || TRIGGERS.has(word)) continue
        break
    }

    // "checklist done" with no numbers means everything.
    if (completion && !picked.size && !excluded.size) all = true
    return { end: i, picked, excluded, all }
}

/** Positions (1-based) named by numbered references in the transcript. */
function numberedReferences(tokens, count) {
    const picked = new Set()
    const excluded = new Set()
    let all = false

    for (let i = 0; i < tokens.length;) {
        const word = tokens[i]
        const startsAllExcept = ALL.has(word) && EXCEPT.has(tokens[i + 1])
        if (!TRIGGERS.has(word) && !startsAllExcept) { i++; continue }

        const clause = readClause(tokens, startsAllExcept ? i : i + 1)
        // "I'm all but done" is not a checklist reference; "all except four" needs a number.
        if (startsAllExcept && !clause.excluded.size) { i++; continue }
        // "all checks done", "all the items": the ALL word must sit right before the trigger.
        const prev = tokens[i - 1], prev2 = tokens[i - 2]
        const allBefore = ALL.has(prev) || (DETERMINERS.has(prev) && ALL.has(prev2))
        if (allBefore && !clause.picked.size) clause.all = true

        clause.picked.forEach(n => picked.add(n))
        clause.excluded.forEach(n => excluded.add(n))
        if (clause.all) all = true
        i = Math.max(clause.end, i + 1)
    }

    const positions = new Set()
    if (all) for (let n = 1; n <= count; n++) positions.add(n)
    picked.forEach(n => positions.add(n))
    excluded.forEach(n => positions.delete(n))
    return { positions, excluded }
}

// ── Keyword overlap ─────────────────────────────────────────────────────────

/** Light stem so "placed"/"place" and "trading"/"trade" compare equal. */
function stem(word) {
    let w = word
    if (w.length > 4) w = w.replace(/(?:ing|ed|es|s)$/, '')
    if (w.length > 3) w = w.replace(/e$/, '')
    return w
}

function significantWords(label) {
    return [...new Set(tokenize(label).filter(w => !STOP_WORDS.has(w)).map(stem))]
}

/**
 * Score an item's own words against what was said.
 * Most words present -> ticked; about half -> unsure. Negations ("not") count as
 * words, so "I was revenge trading" cannot confirm "Not revenge trading".
 */
function keywordVerdict(label, spoken) {
    const words = significantWords(label)
    if (!words.length) return null
    const hits = words.filter(w => spoken.has(w)).length
    if (hits >= 2 && hits / words.length >= 0.75) return 'ticked'
    if (hits >= 2 && hits / words.length >= 0.5) return 'unsure'
    if (words.length === 1 && hits === 1) return 'unsure'
    return null
}

/**
 * Work out which checklist items a transcript ticks.
 *
 * `ai` is an optional model answer (see api/checklist-match.js). It can only add: it
 * ticks items the code missed, or flags them unsure. Numbers the trader said explicitly
 * always stand, and an item they excluded by number ("all except four") is never added.
 *
 * @param {string} transcript
 * @param {string[]} items  the ordered per-trade checklist labels
 * @param {{ ticked?: string[], unsure?: string[] }} [ai]
 * @returns {{ ticked: string[], unsure: string[] }} labels, in checklist order
 */
export function matchChecklist(transcript, items, ai) {
    const labels = Array.isArray(items) ? items : []
    if (!labels.length) return { ticked: [], unsure: [] }

    const tokens = tokenize(transcript)
    if (!tokens.length) return { ticked: [], unsure: [] }

    const { positions, excluded } = numberedReferences(tokens, labels.length)
    const spoken = new Set(tokens.map(stem))
    const aiTicked = new Set(ai?.ticked)
    const aiUnsure = new Set(ai?.unsure)

    const ticked = []
    const unsure = []
    labels.forEach((label, index) => {
        const position = index + 1
        if (excluded.has(position)) return
        if (positions.has(position)) { ticked.push(label); return }
        const verdict = keywordVerdict(label, spoken)
        if (verdict === 'ticked' || aiTicked.has(label)) ticked.push(label)
        else if (verdict === 'unsure' || aiUnsure.has(label)) unsure.push(label)
    })
    return { ticked, unsure }
}
