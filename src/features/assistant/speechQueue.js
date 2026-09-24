export function splitSpeech(buffer, flush = false) {
    const chunks = []
    while (buffer.length) {
        const sentence = buffer.match(/^[\s\S]{20,198}?[.!?](?:\s|$)/)
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
export function playAudio(blob, signal, onState) {
    return new Promise((resolve, reject) => {
        if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'))
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        const cleanup = () => { audio.pause(); audio.removeAttribute('src'); URL.revokeObjectURL(url); signal.removeEventListener('abort', abort) }
        const finish = error => { cleanup(); error ? reject(error) : resolve() }
        const abort = () => finish(new DOMException('Aborted', 'AbortError'))
        audio.onended = () => finish()
        audio.onerror = () => finish(new Error('Audio playback failed. Your answer is still available in the conversation.'))
        signal.addEventListener('abort', abort, { once: true })
        onState('speaking')
        audio.play().catch(() => finish(new Error('Your browser blocked audio playback. Use Read aloud to play the answer.')))
    })
}
// Begin speaking a complete phrase while the remaining text is still streaming.
// Serialize synthesis/playback to preserve order and bound provider concurrency.
export function createSpeechQueue({ signal, synthesize, play = playAudio, fallback, voiceSession = { device: false }, onProvider = () => {}, onState, onError }) {
    let buffer = '', chain = Promise.resolve(), failed = false
    const enqueue = chunks => {
        for (const chunk of chunks) chain = chain.then(async () => {
            if (signal.aborted || failed) return
            onState('generating')
            if (voiceSession.device && fallback) {
                onProvider('device')
                await fallback(chunk, signal, onState)
                return
            }
            let blob
            try { blob = await synthesize(chunk, signal) }
            catch (error) {
                if (signal.aborted || error.status !== 429 || !fallback) throw error
                // Retry this unspoken phrase once on-device, then keep the same
                // voice for the rest of this conversation instead of hammering Groq.
                voiceSession.device = true; onProvider('device')
                await fallback(chunk, signal, onState)
                return
            }
            if (!signal.aborted) await play(blob, signal, onState)
        }).catch(error => { failed = true; if (!signal.aborted) onError(error) })
    }
    return {
        append(text) { buffer += text; const split = splitSpeech(buffer); buffer = split.remainder; enqueue(split.chunks) },
        async finish() { enqueue(splitSpeech(buffer, true).chunks); buffer = ''; await chain; onState('idle'); return !failed },
    }
}
