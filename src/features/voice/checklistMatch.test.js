import { describe, it, expect } from 'vitest'
import { matchChecklist } from './checklistMatch'
import { parseTradeSpeech } from './voiceParse'
import { CHECKLIST_DEFAULTS } from '../../domain/checklists/vocabulary'

const ITEMS = CHECKLIST_DEFAULTS.trade
const [SETUP, STOP, SIZE, REWARD, REVENGE] = ITEMS

const ticked = (transcript, items = ITEMS) => matchChecklist(transcript, items).ticked

describe('matchChecklist - numbered references', () => {
    it('reads digits and spelled-out numbers', () => {
        expect(ticked('checklist 1, 3')).toEqual([SETUP, SIZE])
        expect(ticked('check list one and three')).toEqual([SETUP, SIZE])
        expect(ticked('items two and four')).toEqual([STOP, REWARD])
        expect(ticked('tick 2')).toEqual([STOP])
    })

    it('reads a list with commas and a final "and"', () => {
        expect(ticked('checklist one, two and four.')).toEqual([SETUP, STOP, REWARD])
        expect(ticked('Checklist one, two, and five')).toEqual([SETUP, STOP, REVENGE])
    })

    it('does not fold adjacent numbers into one value', () => {
        // "one three" must not become 4 the way a price would.
        expect(ticked('checklist one three')).toEqual([SETUP, SIZE])
    })

    it('reads ranges', () => {
        expect(ticked('checks one to three')).toEqual([SETUP, STOP, SIZE])
        expect(ticked('checklist 2 through 4')).toEqual([STOP, SIZE, REWARD])
        expect(ticked('checklist 1-3')).toEqual([SETUP, STOP, SIZE])
    })

    it('reads "all" forms', () => {
        expect(ticked('all checks done')).toEqual(ITEMS)
        expect(ticked('checklist all done')).toEqual(ITEMS)
        expect(ticked('tick all items')).toEqual(ITEMS)
    })

    it('reads "all except" forms', () => {
        expect(ticked('everything except four')).toEqual([SETUP, STOP, SIZE, REVENGE])
        expect(ticked('checklist all except two and five')).toEqual([SETUP, SIZE, REWARD])
        expect(ticked('all but four')).toEqual([SETUP, STOP, SIZE, REVENGE])
    })

    it('ignores numbers outside the list instead of guessing', () => {
        expect(ticked('checklist one, seven and nine')).toEqual([SETUP])
        expect(ticked('checklist zero')).toEqual([])
        expect(ticked('checklist seven')).toEqual([])
    })

    it('does not read a quantity after a trigger word as an item', () => {
        expect(ticked('long nifty check 2 lots of 75 at 22400')).toEqual([])
    })

    it('combines separate references in one dictation', () => {
        expect(ticked('checklist one and two, and tick 5')).toEqual([SETUP, STOP, REVENGE])
    })
})

describe('matchChecklist - ordinary words near a reference', () => {
    it('does not read "but", "without" or "other than" as an exclusion on their own', () => {
        expect(ticked('checklist one and two but I chased the entry')).toEqual([SETUP, STOP])
        expect(ticked('checks one, two, without a stop')).toEqual([SETUP, STOP])
        expect(ticked('checklist one, other than that fine')).toEqual([SETUP])
    })

    it('does not treat a bare "all but" in speech as ticking everything', () => {
        expect(ticked("I'm all but done here")).toEqual([])
    })

    it('does not read a distant "all" or "every" as ticking everything', () => {
        expect(ticked('every trade I take, checklist one and two')).toEqual([SETUP, STOP])
        expect(ticked('all good, check one')).toEqual([SETUP])
        expect(ticked('checklist one, all good')).toEqual([SETUP])
    })
})

describe('matchChecklist - keyword overlap', () => {
    it("ticks an item when its own words are spoken", () => {
        expect(ticked('long nifty, stop loss placed')).toEqual([STOP])
        expect(ticked('Not revenge trading and position size within my risk limit')).toEqual([SIZE, REVENGE])
    })

    it('tolerates word endings', () => {
        expect(ticked('the stop loss was placed')).toEqual([STOP])
        expect(ticked("I'm not revenge trade")).toEqual([REVENGE])
    })

    it('puts near-matches in unsure, not ticked', () => {
        const result = matchChecklist('I put a stop loss in', ITEMS)
        expect(result.ticked).toEqual([])
        expect(result.unsure).toEqual([STOP])
    })

    it('does not treat a negated item as confirmed by its bare words', () => {
        const result = matchChecklist('I was revenge trading', ITEMS)
        expect(result.ticked).toEqual([])
        expect(result.unsure).toEqual([REVENGE])
    })

    it('does not flag an item for a single common word', () => {
        const result = matchChecklist('long nifty, took the trade', ['Log every trade', 'Tag my mistakes'])
        expect(result).toEqual({ ticked: [], unsure: [] })
    })

    it('does not list an item as unsure when it is already ticked by number', () => {
        const result = matchChecklist('checklist two, stop loss', ITEMS)
        expect(result.ticked).toEqual([STOP])
        expect(result.unsure).toEqual([])
    })

    it('honours an explicit exclusion over a keyword match', () => {
        const result = matchChecklist('everything except two, stop loss placed', ITEMS)
        expect(result.ticked).not.toContain(STOP)
        expect(result.unsure).not.toContain(STOP)
    })
})

describe('matchChecklist - stability', () => {
    it('gives the same result every time', () => {
        const t = 'Long NIFTY, checklist one, two and four, stop loss in'
        expect(matchChecklist(t, ITEMS)).toEqual(matchChecklist(t, ITEMS))
    })

    it('returns nothing for a dictation with no checklist words', () => {
        const t = 'Long bitcoin at 68,400 with a stop at 67,200 and target 71,500, size 5000, breakout setup'
        expect(matchChecklist(t, ITEMS)).toEqual({ ticked: [], unsure: [] })
    })

    it('copes with empty input and an empty list', () => {
        expect(matchChecklist('', ITEMS)).toEqual({ ticked: [], unsure: [] })
        expect(matchChecklist(null, ITEMS)).toEqual({ ticked: [], unsure: [] })
        expect(matchChecklist('checklist one', [])).toEqual({ ticked: [], unsure: [] })
    })

    it('returns labels in checklist order', () => {
        expect(ticked('checklist four, one')).toEqual([SETUP, REWARD])
    })
})

describe('trade fields are unaffected by spoken checklist numbers', () => {
    const FIELDS = 'long nifty 2 lots of 75 at 22400, stop 22370, target 22500'

    it('keeps entry, stop, target and units the same', () => {
        const plain = parseTradeSpeech(FIELDS).fields
        const spoken = parseTradeSpeech(`${FIELDS}, checklist one, two and four`).fields
        expect(spoken).toEqual(plain)
        expect(spoken).toMatchObject({ entry: 22400, sl: 22370, tp: 22500, units: 150 })
    })

    it('does not read a checklist number as the value of a dangling field', () => {
        const fields = parseTradeSpeech('long nifty at 22400 with a stop loss, checklist one, three').fields
        expect(fields.sl).toBeUndefined()
        expect(fields.entry).toBe(22400)
    })

    it('still parses fields spoken after the checklist', () => {
        const fields = parseTradeSpeech('checklist one and three, long nifty at 22400, stop 22370').fields
        expect(fields).toMatchObject({ entry: 22400, sl: 22370 })
    })
})

describe('matchChecklist - merging AI suggestions', () => {
    const merged = (transcript, ai) => matchChecklist(transcript, ITEMS, ai)

    it('is unchanged when there is no AI answer', () => {
        expect(merged('checklist one and two', undefined)).toEqual(matchChecklist('checklist one and two', ITEMS))
        expect(merged('checklist one and two', { ticked: [], unsure: [] })).toEqual(matchChecklist('checklist one and two', ITEMS))
    })

    it('adds the items the AI ticked, in checklist order', () => {
        expect(merged('my stop is in and I sized it small', { ticked: [SIZE, STOP], unsure: [] }).ticked).toEqual([STOP, SIZE])
    })

    it('keeps every number the trader said, whatever the AI answers', () => {
        expect(merged('checklist one and two', { ticked: [], unsure: [] }).ticked).toEqual([SETUP, STOP])
        expect(merged('checklist one and two', { ticked: [REWARD], unsure: [SIZE] })).toEqual({ ticked: [SETUP, STOP, REWARD], unsure: [SIZE] })
    })

    it('never ticks an item the trader excluded by number', () => {
        const result = merged('checklist all except four', { ticked: [REWARD], unsure: [] })
        expect(result.ticked).toEqual([SETUP, STOP, SIZE, REVENGE])
        expect(merged('checklist all except four', { ticked: [], unsure: [REWARD] }).unsure).toEqual([])
    })

    it('lets a confident AI tick settle an item the code was unsure about', () => {
        const codeOnly = matchChecklist('stop loss', ITEMS)
        expect(codeOnly.unsure).toContain(STOP)
        expect(merged('stop loss', { ticked: [STOP], unsure: [] })).toEqual({ ticked: [STOP], unsure: [] })
    })

    it('adds the AI unsure items, but never demotes a tick', () => {
        const result = merged('checklist two', { ticked: [], unsure: [STOP, SIZE] })
        expect(result).toEqual({ ticked: [STOP], unsure: [SIZE] })
    })

    it('ignores labels that are not on the checklist', () => {
        expect(merged('checklist two', { ticked: ['Bought the dip'], unsure: ['Chased it'] })).toEqual({ ticked: [STOP], unsure: [] })
    })
})
