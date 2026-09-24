# SottoLink

SottoLink is an experimental, browser-only two-way acoustic chat. Each device
mixes short private messages into speech audio using ggwave's ultrasonic FSK
protocol and plays it aloud; the other device listens through its microphone
and shows only messages that pass SottoLink's integrity check.

No message relay or application backend is used. After the static app loads,
the data path is acoustic only.

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

1. Deploy to Vercel and open the same URL in Chrome on both computers.
2. On both, choose 15 kHz and click Join channel, allowing microphone access.
3. Send a message from one computer with the devices about one metre apart.
4. Reply from the other computer; the first sender's message turns "Delivered".
5. If nothing arrives, raise signal strength in Settings toward -12 dB, then
   repeat at higher frequency presets to compare audibility and reliability.

The target first milestone is at least 9 successful decodes out of 10 trials on
the reference devices while the carrier is not consciously noticeable.

## Third-party code

The current ggwave Emscripten build is vendored under `src/vendor` because the
published npm package does not expose the upstream frequency-start API. ggwave
is MIT licensed; its license is included beside the vendored build.
