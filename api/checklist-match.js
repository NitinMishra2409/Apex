// POST /api/checklist-match — signed-in AI matching of a dictated transcript to the per-trade checklist.
// Body: { transcript, items }. Answers { ticked, unsure }, or an error the client treats as
// "match without AI" (429 rate limited, 503 unavailable).
import { authenticate, readJson, json, fail, requestLifetime } from '../server/assistant/runtime.js'
import { checklistRequest, matchChecklistWithModel } from '../server/speech/checklistMatch.js'

export const config = { api: { bodyParser: false }, maxDuration: 10 }

export async function checklistMatchHandler(req, res, env = process.env) {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return json(res, 405, { error: 'Method not allowed.' }) }
    // The browser gives up after about 2.5 s; a little longer here lets a late answer still be dropped cleanly.
    const lifetime = requestLifetime(req, res, 3500)
    try {
        await authenticate(req, env, lifetime.signal)
        const { transcript, items } = checklistRequest(await readJson(req, 20000))
        const matched = await matchChecklistWithModel(transcript, items, env, lifetime.signal)
        if (!res.destroyed) json(res, 200, matched)
    } catch (err) { if (!res.destroyed) fail(res, err) }
    finally { lifetime.dispose() }
}
export default checklistMatchHandler
