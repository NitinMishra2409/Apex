# Call an expert

The selected seasoned-coach direction is implemented as an AI voice call on the existing Coach page. Open it from the dashboard's Review your session card, the Coach header, or the coach portrait card. `/coach?call=expert` opens the call preview; `period` carries the selected journal range. Opening the preview does not request microphone access. Start call begins listening.

The feature uses the same `useAssistant` instance as text chat: Groq Llama 3.3 70B, NVIDIA Whisper transcription, Groq Orpheus Autumn speech with Easy Speech fallback on TTS rate limits, authenticated/demo journal context, and encrypted conversation history are unchanged. The call screen uses the same providers as journal chat and voice; no separate account system or calling service is introduced. This is explicitly labeled as an AI coach, not a connection to a human expert.

The native modal provides focus containment and Escape dismissal. Start/resume and interrupt use the existing voice entry point. Send now ends the current recording. Pause stops capture, pending generation, and audio playback; it does not clear completed history. End and close stop the voice conversation and return to chat. Route unmount uses the existing assistant cleanup. The timer measures elapsed time since Start call, including pauses. Errors remain visible with a retry action. Captions display the latest conversation message. The portrait is static; a state-driven waveform indicates speaking and a microphone-level waveform indicates listening. Lip synchronization is not implemented. Reduced-motion preferences disable the speaking animation.

## Files

- `src/features/assistant/ExpertCall.jsx`: card, call dialog and controls.
- `src/features/assistant/expert.css`: responsive call presentation.
- `src/features/assistant/Coach.jsx`: entry points and shared assistant connection.
- `src/features/overview/Dashboard.jsx`: call link with the current period.
- `public/images/apex-expert.png`: portrait asset used by the call view.
