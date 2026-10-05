# PiggyLink technical notes

## Dialogue and transport

The caller (`probe`) and other agent (`target`) start with separate server-built
model prompts. Scenarios are restaurant, hotel, and gift shop. Only the caller
prompt contains the visitor's profile; the target API rejects a supplied profile.
The fields are name (24 characters), request (120), and private context (180).
Both roles generate
fresh text through the selected AI writer; there are no fixed live payloads.
The current fictional budget is CHF 50. The default voices are Chris for the
caller and Sarah for the restaurant; an explicitly selected voice takes priority.

The caller sends a small `call` control packet containing the scenario ID, which is
not dialogue. The other device adopts that scenario. Setup links contain only
the scenario and target role, never profile data. The restaurant
answers only after receiving it, so both microphones are ready before its greeting.
The dialogue has four phases, implemented in `src/core/quiet-dialogue.ts`:

1. **Spoken:** restaurant greeting, caller's explicit introduction as an AI agent
   acting on Tony's behalf and polite booking request, then the restaurant's
   confirmation that it is AI too. The caller offers PiggyLink; the restaurant accepts.
2. **Quiet:** after acceptance, speech generation stops. Agents send short text
   through sound: the budget, a discreet waiter-note reply, and a `resume` request.
3. **Closing:** the restaurant resumes English to confirm the booking, then the
   caller says thank you and goodbye (`finish`). Neither repeats the private exchange.
4. **Complete:** the receiving device acknowledges the final message. A lost
   greeting, acceptance, return-to-voice reply, or final acknowledgement can be recovered with Resend.

Each existing L3 frame contains device ID, sequence number, speech duration,
CRC-16, and up to 126 UTF-8 bytes of payload: its 14-byte header keeps the whole
wire within ggwave's 140-byte variable-length limit. The payload begins with `S7`
and one action letter (`c`, `s`, `o`, `a`, `q`, `r`, `f`, or acknowledgement `k`).
The caller's first spoken request may use 123 UTF-8 bytes, so it can clearly
identify itself and make a complete request. Other generated turns retain the
61-byte limit, and manual messages retain their 64-byte limit. Overlong model
replies are rejected and retried, not truncated.
The prompt describes only the actions available on the current turn, with a
short closing instruction for the final reply. A rejected draft is retried once
with the exact validation error and a concise length target. Repairs preserve
the caller's AI identity, the person it represents, and the request's time, day,
and party size. They preserve grammar and may use the full byte limit
instead of the shorter soft target. Byte counts are
measured in UTF-8; a repeated invalid answer remains an error rather than being
silently replaced with canned dialogue.

Both devices must refresh to this version: `S6` only supported short speech,
so mixed versions intentionally reject each other's packets.
For profile-based calls, the backend validates alternating roles, history actions,
channel fields, and byte lengths. It rejects extra requests after the ten-turn call.

Spoken packets carry the same text as the synthesized line and its action. The
receiver therefore obtains a transcript through the microphone's acoustic
channel without waiting for speech recognition. Each spoken turn's packet is mixed
under its speech. Built-in demo roles do not use ordinary speech
recognition; Custom chat retains that separate path.

Quiet packets play the complete modem waveform by itself, with independent peak
level control (default −18 dBFS). There is no cover audio, speech synthesis, or
speech transcription in this phase. The spectrum displays microphone measurements.
Decoded messages appear on receipt. The default demo view shows one current line,
the frequency trace, and a small voice-state cue that returns to “Voice on” as
closing speech starts. The details menu exposes history,
controls, private context, and the received detail. There, outgoing text is labelled
as sending/sent; only incoming text can populate the receipt.
Errors automatically open the details view so they cannot be hidden while filming.

## Audio requirements

The browser audio context must run at **48,000 Hz**. The engine requests that
rate and reports an error if it cannot obtain it. Loopback verification found
that the current modem path failed at 44,100 Hz even on lower frequency presets;
this build does not claim support for that rate.

Available starting frequencies are 15, 16, 17, and 18 kHz, with a span of roughly
4.45 kHz. Both devices must select the same preset. Default: 18 kHz. Protocol:
ggwave Ultrasound Fastest, with upstream Fast/Normal fallbacks.

Devices take turns, ignore their own frames, and suppress duplicates. Each reply
acknowledges the preceding message. Channel sensing uses a short randomized
backoff and an existing ten-second maximum wait when it believes the channel is
busy. Keep messages short and test room noise and latency on recording hardware.

Waveform loopback tests verify encoding, normalization, Unicode payloads and
CRC decoding. They do not establish real speaker/microphone reliability or
whether a particular listener can hear the carrier. Physical testing is required.

## Server configuration

`ELEVENLABS_API_KEY` supplies voices and the default text-only agent writer.
The legacy `ELEVEN_LABS_API_KEY` name is accepted. Put the key in `.env.local`
for Vite or in deployment environment variables. The standard spelling wins
when both exist.

Optional: `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_LLM`, `ELEVENLABS_TTS_MODEL`,
`ELEVENLABS_STT_MODEL`. Apertus uses `APERTUS_API_KEY`, `APERTUS_BASE_URL`, and
`APERTUS_MODEL` as before.

Inter-device delivery is through speakers and microphones. The model service
receives conversation history for reply generation, including fictional private
messages. Acoustic encoding is not encryption. The browser build includes public
example profiles; role prompts live on the backend. The assistant's profile is
sent to the AI service, so this does not demonstrate secret storage.

The API routes spend the configured provider account's credits and currently have
no public usage quota. Add deployment access controls or usage limits before a
broad public launch. HTTPS is required for microphones outside localhost.

## Verification

```sh
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5190
```

`?preview=1&role=probe` and `?preview=1&role=target` run a timed visual preview
without microphone access, analytics, or AI calls. The messages and spectrum in
that mode are samples. These preview fixtures are excluded from production.

For the physical test and recording sequence, see [demo-script.md](demo-script.md).

### Local verification, 5 October 2026

- 116 tests passed across 17 files; TypeScript and the production build passed.
- The full 114-byte AI introduction passes route validation and acoustic loopback
  on all four frequency channels, as well as loopback mixed with example speech.
  The maximum 123-byte Unicode spoken message also decodes through the modem.
  Quiet-message limits and the ten-turn sequence remain covered.
- A live opening identified the caller as an AI agent acting on Tony's behalf,
  preserved the booking details, and progressed to PiggyLink. An oversized closing
  prompted a shorter closing instruction; replaying that exact history then
  completed the spoken close and goodbye. A live repair of an oversized opening
  also preserved the AI identity, Tony's name, party size, time, and tonight.
- Chris synthesized the full requested introduction in 6.32 seconds. Its acoustic
  transcript decoded intact from the actual mixed waveform at the default 18 kHz
  channel; the carrier lasted 4.65 seconds. This is digital loopback, not a new
  physical speaker/microphone test.
- Fresh personalized restaurant, hotel, and gift runs completed all ten turns.
  The updated aside prompt produced “Between us, Alex has a dinner budget of
  CHF 50.” and “Just between us, Alex brings a teddy bear on trips.” The peers
  learned those details from received history and replied discreetly; the
  private details were not spoken. PiggyLink was named in the spoken switch.
- Scenario setup packets for restaurant, hotel, and gift decode at 48 kHz.
  The longer “Not sure he'd want this on tape” budget example also passes
  modem loopback on all four frequency channels (including a Unicode apostrophe).
- The new profile screen has passed compilation and markup checks, but automated
  visual review was unavailable in this session and physical device QA remains.
- The CHF 50 payload decodes through the modem on all four frequency presets.
  The received-budget parser recognizes CHF before or after the amount and
  amounts written as Swiss francs, without inferring a budget from a bare number.
- Opening refinement: two live four-turn openings and two forced repairs of an
  oversized opening passed. The repair produced “Hello, could I book Tony a table
  for two at eight, please?” (58 UTF-8 bytes). These checks used only the public
  opening instructions, excluding the private scenario context. Wording remains
  generated fresh; the revised opening still needs a two-device listening check.
- Two live provider runs completed the new ten-turn call, from the restaurant
  greeting to the spoken confirmation and goodbye. The quiet exchange in the
  second run explicitly mentioned the date and waiter; no budget was spoken.
  A separate live opening check exercised correction of an oversized introduction.
- The short initial call-control packet decoded in the actual 48 kHz modem loopback.
- The final-turn validation failure reported during phone testing has regression
  coverage for oversized Unicode text, wrong actions, and unwanted speech. Five
  API replays of the reported conversation, a real model repair of an oversized
  draft, and a complete fresh conversation passed after the retry fix.
- Before adding the natural opening and spoken close, a provider run completed speak → offer → accept → quiet → quiet → finish.
  The caller generated “Budget is €40. Please be discreet with my date.”
- Live TTS returned non-silent 48 kHz audio for the acceptance line.
- In that earlier sequence, the generated quiet packets lasted 1.58, 2.73, and 2.92 seconds respectively.
  First-quiet model generation took 3.89 seconds in this run, so generation plus
  the first packet alone took about 5.47 seconds. This excludes channel wait,
  scheduling, and any physical reception delay. Provider latency varies.
- The user tested the previous version through the budget receipt on a phone.
  The new call connection and spoken closing still need a physical two-device test.
  Audibility and final responsive layout review remain unverified in this session.
