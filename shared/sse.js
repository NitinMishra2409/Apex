/** Decode SSE across arbitrary UTF-8 network chunks, including CRLF boundaries. */
export async function* readSSE(stream) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const parse = frame => frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    try {
        while (true) {
            const { value, done } = await reader.read()
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
            let match
            while ((match = /\r?\n\r?\n/.exec(buffer))) {
                const data = parse(buffer.slice(0, match.index))
                buffer = buffer.slice(match.index + match[0].length)
                if (data) yield data
            }
            if (done) { const tail = parse(buffer); if (tail) yield tail; break }
        }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}
