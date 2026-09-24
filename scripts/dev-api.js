import { chatHandler } from '../api/chat.js'
import { speakHandler } from '../api/speak.js'
import { listenHandler } from '../api/listen.js'
import { transcribeHandler } from '../api/transcribe.js'
import { allowLocalDemo } from '../server/assistant/runtime.js'

/** Mount the production handlers with development-only environment and demo authorization. */
export function devApi(env) {
    return {
        name: 'apexlog-dev-api',
        configureServer(server) {
            const routes = { chat: chatHandler, speak: speakHandler, listen: listenHandler, transcribe: transcribeHandler }
            for (const [route, handler] of Object.entries(routes)) {
                server.middlewares.use(`/api/${route}`, (req, res) => {
                    allowLocalDemo(req, env)
                    return handler(req, res, env)
                })
            }
        },
    }
}
