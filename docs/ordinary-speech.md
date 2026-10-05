# Ordinary English and optional human replies

The restaurant demo opens with ordinary English. The greeting, caller's full AI
introduction and reservation request, AI recognition, PiggyLink offer, and spoken
acceptance contain no ultrasound. The first encoded packet carries the private
aside only after both sides have agreed aloud.

The planned demo assumes no human interruptions and retains its ten-turn flow.
As an optional fallback, start Restaurant and speak after its greeting. It
transcribes the question and gives a short relevant English reply. The personal
assistant also reacts to an unexpected question. Questions and refusals keep the
conversation in English rather than forcing a switch. Custom chat retains its
manual spoken and encoded messages.

## Recognition and response

`SpeechDetector` tracks energy in the 150–4000 Hz band, waits for 900 ms of silence,
and passes the recent recording to the existing transcription API. It requires
250 ms of voiced activity, keeps 200 ms of pre-roll, and caps a segment at 20 s.
This is an energy detector, not a trained voice detector.
Its threshold follows the measured room level plus 12 dB. It has no fixed
microphone-volume cutoff: clear speech can have low absolute input gain.

Local playback, detected carrier activity, decoding, and reply preparation
suppress recognition. A 700 ms tail reduces playback echoes. The engine senses
speech independently for collision avoidance, even when transcription is disabled.
If a modem frame arrives during recognition, the plain result is discarded.

The opening receives an ordinary transcript with no action metadata. The next
model request interprets the latest utterance as `speak`, `offer`, or `accept` and
writes the reply at the same time. The API validates that an offer precedes any
acceptance and that only an accepted switch allows a private packet. The model is
instructed to recognize refusals and uncertainty as ordinary speech. A malformed
interpretation or invalid action gets one repair attempt. Private profile context
must never be spoken.

The restaurant retries its cached greeting after five seconds without a reply,
at most three times. The response window includes recognition and reply
preparation. Hearing an utterance cancels a queued replay while it is transcribed.
Repeated first greetings, ignoring case and punctuation, replay the cached caller
introduction instead of adding a dialogue turn. Manual Resend also works for a
missed spoken acceptance. Stop cancels pending work for the session.

## Verification and limits

- A real provider run completed the ten-turn call using Chris and Sarah. All five
  opening lines were synthesized and transcribed from pure speech, with no modem
  overlay. “Piggy Link” transcriptions correctly led to offer and acceptance.
- Live human-question, refusal, and protocol-question checks remained in English
  with no private disclosure. Unit tests cover legal transitions, invalid
  interpretations, repeated greetings, microphone utterance detection, and timers.
- Measured transcription took about 0.5–0.8 seconds per opening line, excluding
  the detector's silence window. Provider and network timing varies.
- A regression test exercises the browser audio engine's handoff to recognition
  with a quieter greeting above the room floor. The previous fixed −65 dB cutoff
  discarded it, leaving the personal assistant listening indefinitely. Low-gain
  speech, normal-gain speech, steady noise, clicks, and suppression are covered.
- Physical speaker-to-microphone timing and recognition still need a two-device
  test. The loopback check used provider-generated audio, not a room recording.
- Speech during playback or reply preparation is ignored; barge-in is not
  supported. During the quiet exchange, the automatic demo listens for packets.
- The browser requires a 48 kHz audio context and HTTPS outside localhost. Quiet
  reception depends on device bandwidth and the room. The public full demo still
  requires two devices; there is no simulated public one-screen exchange.
