# SottoLink

SottoLink is an experimental, browser-only acoustic link. A sender mixes a short
private message into an uploaded WAV recording using ggwave's ultrasonic FSK
protocol. A nearby receiver listens through its microphone and displays only a
message that passes SottoLink's integrity check.

No message relay or application backend is used. After the static app loads,
the data path is acoustic only.

## MVP scope

- Mac sender to iPhone receiver, about one metre apart in a quiet room
- Safari as the initial browser target
- Included example speech or custom WAV cover audio, with private messages up to 32 UTF-8 bytes
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
build to Vercel for testing on an iPhone.

```sh
npm test
npm run build
```

## Test procedure

1. Deploy to Vercel and open the same URL in Safari on the Mac and iPhone.
2. On the iPhone, select Receiver, choose 15 kHz, and tap Start listening.
3. On the Mac, select Sender and choose the same frequency.
4. Use the included speech example—or upload your own WAV—enter a message, and begin at -30 dB.
5. Tap Mix & transmit with the devices stationary and about one metre apart.
6. Raise strength toward -12 dB only if decoding fails, then repeat at higher
   frequency presets to compare audibility and reliability.

The target first milestone is at least 9 successful decodes out of 10 trials on
the reference devices while the carrier is not consciously noticeable.

### Repeatable baseline batches

The Sender includes a **Baseline batch** control for repeatable physical trials.
Set the first number, trial count, and pause, then run the batch. It sends
zero-padded payloads such as `0001`, `0002`, and `0003`. Batch playback uses
only a compact window around the speech onset and modem carrier (with a short
lead-in and tail), then starts the pause and next trial. Manual transmissions
continue to play the full cover clip.

On the Receiver, set a condition label and expected ID range, then choose
**Start new trial log** before listening. The report includes every expected
trial as `received` or `missed`, plus duplicate and unexpected payloads with
their receipt time and frequency preset. Use **Export CSV** before changing
conditions or clearing the log. The CSV is a local download; no trial telemetry
leaves either device.

### Channel calibration capture

For one-way channel diagnosis, start the receiver, choose **Start raw diagnostic
capture**, send one message, then choose **Stop & download raw WAV**. On the
sender, download the matching **last transmitted reference WAV**. Both files are
lossless 48 kHz WAVs. Compare them locally with:

```sh
node tools/analyze-channel.mjs sender-reference.wav receiver-microphone.wav
```

The report estimates time alignment and relative energy across the 15–22 kHz
range. It characterizes the complete speaker-to-microphone path; it is not a
calibrated laboratory frequency-response measurement.

The Sender's **Channel sweep** produces a 15–22 kHz stepped probe at 250 Hz
spacing. Capture it on the receiver and use the same analyzer command to map
the complete directional response, adding `--sweep` before the file paths.

## Third-party code

The current ggwave Emscripten build is vendored under `src/vendor` because the
published npm package does not expose the upstream frequency-start API. ggwave
is MIT licensed; its license is included beside the vendored build.
