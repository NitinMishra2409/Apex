export function splitSpeech(buffer, flush = false, minimum = 20) {
    const chunks = []
    while (buffer.length) {
        const sentence = buffer.match(new RegExp(`^[\\s\\S]{${minimum},198}?[.!?](?:\\s|$)`))
        let length = sentence?.[0].length || 0
        if (!length && buffer.length > 200) length = buffer.lastIndexOf(' ', 200) > 0 ? buffer.lastIndexOf(' ', 200) : 200
        if (!length && flush) length = Math.min(buffer.length, 200)
        if (!length) break
        // Do not cut a Unicode surrogate pair at the provider's phrase limit.
        if (length > 1 && length < buffer.length && /[\uD800-\uDBFF]/.test(buffer[length - 1])) length--
        const chunk = buffer.slice(0, length).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*#`_]/g, '').trim()
        if (chunk) chunks.push(chunk)
        buffer = buffer.slice(length).trimStart()
    }
    return { chunks, remainder: buffer }
}

// Speak a reply phrase by phrase while its text is still streaming.
// Phrase N+1 is requested while phrase N plays, so audio is ready when N ends;
// playback order is always the text order. On a speech rate limit (429) the
// unspoken phrase and the rest of the conversation move to the device voice.
export function createSpeechQueue({ signal: parentSignal, synthesize, play, drain = () => Promise.resolve(), stop = () => {}, fallback, voiceSession = { device: false }, onProvider = () => {}, onState, onError, onFirstSentence = () => {} }) {
    const controller = new AbortController(), signal = controller.signal
    const cancel = () => { controller.abort(); stop() }
    if (parentSignal.aborted) cancel()
    else parentSignal.addEventListener('abort', cancel, { once: true })
    let buffer = '', chain = Promise.resolve(), failed = false, playing = -1, first = true
    const items = []
    const fail = error => {
        if (failed || parentSignal.aborted) return
        failed = true
        cancel()
        parentSignal.removeEventListener('abort', cancel)
        onState('idle')
        onError(error)
    }
    const request = item => {
        if (item.pending || voiceSession.device || signal.aborted || failed) return
        try { item.pending = Promise.resolve(synthesize(item.text, signal)) }
        catch (error) { item.pending = Promise.reject(error) }
        item.pending.catch(() => { /* handled when this phrase's turn comes */ })
    }
    const speakOnDevice = async text => {
        await drain(signal)
        onProvider('device')
        await fallback(text, signal, onState)
    }
    const enqueue = chunks => {
        for (const text of chunks) {
            const index = items.push({ text }) - 1
            if (index === 0) onFirstSentence()
            // A short opening sentence may be spoken on its own; later phrases wait for full sentences.
            if (index <= playing + 1) request(items[index])
            chain = chain.then(async () => {
                if (signal.aborted || failed) return
                playing = index
                const item = items[index]
                if (first) { first = false; onState('generating') }
                if (voiceSession.device && fallback) return speakOnDevice(item.text)
                request(item)
                let audio
                try { audio = await item.pending }
                catch (error) {
                    if (signal.aborted || error.status !== 429 || !fallback) throw error
                    // Retry this unspoken phrase once on-device, then keep the same
                    // voice for the rest of this conversation instead of hammering Groq.
                    voiceSession.device = true; voiceSession.limited = true
                    return speakOnDevice(item.text)
                }
                if (items[index + 1]) request(items[index + 1])
                if (!signal.aborted) await play(audio, signal, onState)
            }).catch(fail)
        }
    }
    return {
        append(text) { buffer += text; const split = splitSpeech(buffer, false, first && !items.length ? 12 : 20); buffer = split.remainder; enqueue(split.chunks) },
        async finish() {
            enqueue(splitSpeech(buffer, true).chunks); buffer = ''
            await chain
            if (!failed && !signal.aborted) await drain(signal).catch(fail)
            parentSignal.removeEventListener('abort', cancel)
            onState('idle')
            return !failed && !parentSignal.aborted
        },
    }
}
