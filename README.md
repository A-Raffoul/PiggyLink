# SottoLink

SottoLink is an experimental, browser-only two-way acoustic chat. Each device
mixes short private messages into speech audio using ggwave's ultrasonic FSK
protocol and plays it aloud; the other device listens through its microphone
and shows only messages that pass SottoLink's integrity check.

Messages between devices never go over the network: the data path is acoustic
only. Small server functions in `api/` are used only to call AI services
(voice, transcription, and the agent that writes each turn).

## Agent conversations

Each turn has a spoken line and a hidden message (up to 64 bytes).

1. The turn writer uses the device's agent brief and conversation so far: an
   ElevenLabs agent in text-only mode (default) or Apertus via any
   OpenAI-compatible provider. For the built-in demo, the Probe's encoded
   requests follow the scripted sequence; Support writes its own replies.
2. ElevenLabs text-to-speech voices the spoken line (48 kHz PCM); the hidden
   message is mixed in as near-ultrasound, ending with the speech.
3. The receiver decodes the hidden message, then sends the last few seconds of
   microphone audio to ElevenLabs speech-to-text (Scribe) for the spoken line.
   The frame carries how long the speech ran, so the receiver knows how far
   back to cut.
4. With Auto-reply on at both ends, the agents keep talking up to the
   Auto-reply limit. The built-in demo pauses the Probe after Sam's final `done`.

The [built-in demo](docs/demo-script.md) uses `?role=target` for Support and
`?role=probe` for the customer agent. Start Support first, then the customer.
Editing an agent brief switches that device to Custom and bypasses the built-in
scenario.

### Server settings

Set these in Vercel → Project Settings → Environment Variables (and in
`.env.local` for `npm run dev`, which serves `api/` locally). The `api/` routes
are open to anyone with the site's URL and spend these accounts' credits, so
share the link only with people you trust.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ELEVENLABS_API_KEY` | yes | Voices, transcription and the default turn writer |
| `APERTUS_API_KEY`, `APERTUS_BASE_URL`, `APERTUS_MODEL` | for Apertus | OpenAI-compatible endpoint (base URL ending in `/v1`) |
| `ELEVENLABS_AGENT_LLM` | no | Model for a newly created agent (default `gemini-2.5-flash`) |
| `ELEVENLABS_AGENT_ID` | no | Use a specific agent instead of the auto-created "SottoLink turn writer" |
| `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` | no | Defaults `eleven_multilingual_v2`, `scribe_v2` |

## How a conversation works

- Both devices join the same channel (frequency preset); the microphone stays on.
- Devices take turns: after sending, the composer locks until the other side
  replies. The reply doubles as the delivery acknowledgement.
- Before transmitting, a device waits until the channel is quiet, plus a random
  backoff, so simultaneous sends are unlikely to collide.
- Each frame carries a random device id and a sequence number, so a device
  ignores its own transmissions and drops duplicates. If the waiting side
  presses Resend for a message that was already answered, the other side
  re-sends its reply automatically.

## MVP scope

- Two computers about one metre apart in a quiet room, Chrome as the target
- Included example speech or custom WAV cover audio (looped when a message needs longer), with messages up to 64 UTF-8 bytes
- ggwave Ultrasound Normal with manually matched 15, 16, 17, or 18 kHz presets
- Adjustable carrier level from -30 to -12 dB relative to the speech in the overlay window
- Raw microphone constraints and a live high-frequency spectrum display
- Plaintext, session-only data

The 18 kHz preset spans approximately 18–22.45 kHz and assumes a 48 kHz audio
pipeline. Device speakers, microphones, browser processing, room acoustics, and
listener hearing all affect reliability and audibility. The app does not claim
that its signal is universally inaudible or secure.

## Develop

```sh
npm install
npm run dev
```

Microphone capture requires HTTPS outside `localhost`. Deploy the static Vite
build to Vercel to test across devices.

```sh
npm test
npm run build
```

## Test procedure

1. Deploy to Vercel. Open the same URL with `?role=target` on Support and
   `?role=probe` on the customer device in Chrome.
2. In Setup, choose the same channel on both devices and different voices.
   Keep the built-in briefs for the [scripted demo](docs/demo-script.md).
3. Press Start on Support, then Start on the customer device, allowing
   microphone access. Start enables Auto-reply on both.
4. After Sam's goodbye, switch Encoded on and verify that the customer device
   received the four fictional details.
5. For a custom conversation, select Custom and write each brief. Use Agent
   turn or type a spoken line (optional) plus a hidden message by hand.
6. If nothing arrives, raise signal strength in Settings toward -12 dB, then
   repeat at higher frequency presets to compare audibility and reliability.

The target first milestone is at least 9 successful decodes out of 10 trials on
the reference devices while the carrier is not consciously noticeable.

## Third-party code

The current ggwave Emscripten build is vendored under `src/vendor` because the
published npm package does not expose the upstream frequency-start API. ggwave
is MIT licensed; its license is included beside the vendored build.
