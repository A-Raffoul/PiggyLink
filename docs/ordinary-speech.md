# Ordinary speech and phone support

Open the Support role, press Start, and speak after a short quiet pause. Start
enables automatic replies. The microphone now listens for ordinary speech in
addition to modem frames. Manual controls also allow a spoken line with an empty
encoded field.

## Flow

`SpeechDetector` tracks energy in the 150–4000 Hz band, waits for 900 ms of silence,
and passes the recent recording to the existing transcription API. It requires
250 ms of voiced activity, keeps 200 ms of pre-roll, and caps a segment at 20 s.
This is a simple energy detector for the prototype, not a trained voice detector.

Local playback, detected carrier activity, decoding, and a busy assistant suppress
ordinary speech detection. A 700 ms tail reduces playback echoes. If a new modem
frame arrives while speech recognition is pending, the plain result is discarded
so that the encoded receive path owns that turn.

An accepted transcript is a turn with an empty hidden field. It gives the assistant
the next speaking turn without acknowledging an encoded packet. The next AI request
uses spoken-only mode: only spoken history is included, and the server forces the
encoded output to be empty. The reply is synthesized and played without a carrier.
These turns use one full-width history cell and no encoded caption.

The Encoded switch only controls presentation. It does not change what the other
device sends or whether encoded messages are received.

## Phone handling

The page uses viewport-fit and safe-area spacing, compact controls, a bounded
signal area, and temporary captions over that area on narrow screens. Text fields
remain 16 px. The engine requests 48 kHz and falls back to the browser's native
sample rate if that rate is unsupported. Synthesized audio is resampled by
decodeAudioData before playback. Microphone startup reports a useful error if
getUserMedia is unavailable.

References: [WebKit safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/),
[AudioContext sample rate](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/AudioContext),
and [getUserMedia secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## Verification and limits

- Unit tests exercise speech/pause boundaries, brief noise, suppression, long
  utterances, packet-independent turns, and spoken-only API parsing.
- `?preview=1&role=target&speech=1` provides development-only spoken fixtures.
  It does not record audio or call AI services.
- Responsive browser checks cover 320, 390, and 430 px widths. These are layout
  checks, not tests on an actual iPhone or Safari audio stack.
- End-to-end microphone → transcription → assistant → speaker needs a hardware
  run with configured APIs. Background speech or changing noise may trigger the
  simple detector. Speech during assistant playback/processing is ignored, so
  barge-in is not supported. Carrier suppression and echo timing need verification
  on the actual recording devices.
- Phone speaker/microphone bandwidth can differ from desktop equipment; layout
  support does not guarantee successful high-frequency communication.
