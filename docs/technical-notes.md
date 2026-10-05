# PiggyLink technical notes

## Dialogue and transport

The caller (`probe`) and other agent (`target`) start with separate server-built
model prompts. Restaurant is the only automatic scenario. Only the caller
prompt contains the visitor's profile; the target API rejects a supplied profile.
The fields are name (24 characters), request (120), and private context (180).
Both roles generate
fresh text through the selected AI writer; there are no fixed live payloads.
The current fictional budget is CHF 50. The default voices are Chris for the
caller and Sarah for the restaurant; an explicitly selected voice takes priority.

Setup links contain only the scenario and target role, never profile data.
Start both devices around the same time. The restaurant generates and speaks its
greeting on Start. The entire opening, offer, and acceptance use ordinary English,
with no modem overlay or silent handshake. The other device detects an utterance
and sends it to speech recognition. In one model request, the server classifies
that transcript as `speak`, `offer`, or `accept` and generates the next reply.
An acceptance is legal only after the caller's own offer; a question or refusal
continues in English. The default demo keeps its ten turns. A human interruption
is an optional fallback and gets a brief relevant reply, not a forced switch.

After playback, a five-second watchdog retries the same greeting audio if no
reply has arrived, at most three times. Recognition, model generation, and voice
preparation need about four seconds in the measured opening, so a two-second
retry would interrupt normal progress. Channel sensing checks voice activity as
well as the modem band. Each retry waits for a clear channel and checks again before
playing. The next timeout starts after playback ends. A received reply, Stop,
reset, or disabling automatic replies cancels the watchdog. No extra model or TTS
requests are made for replays. A repeated first greeting, ignoring STT punctuation
and casing, replays the cached introduction without adding a dialogue turn.
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
wire within ggwave's 140-byte variable-length limit. The payload begins with `S9`
and one action letter (`s`, `o`, `a`, `q`, `r`, `f`, or acknowledgement `k`).
Opening speech has no packet constraint; the API bounds it to 600 UTF-8 bytes and
prompts for one short sentence, except the caller's full two-sentence introduction.
The first modem sequence is used only for the first private message after spoken
agreement. Quiet and closing turns retain the 61-byte generated-text limit, and
manual encoded messages retain their 64-byte limit. Overlong model
replies are rejected and retried, not truncated.
The prompt describes only the actions available on the current turn, with a
short closing instruction for the final reply. A rejected draft is retried once
with the exact validation error and a concise length target. Repairs preserve
the caller's AI identity, the person it represents, and the request's time, day,
and party size. They preserve grammar and may use the full byte limit
instead of the shorter soft target. Byte counts are
measured in UTF-8; a repeated invalid answer remains an error rather than being
silently replaced with canned dialogue.

Both devices must refresh to this version: `S8` carried the opening transcript under speech,
so mixed versions intentionally reject each other's packets.
For profile-based calls, the backend validates alternating roles, history actions,
channel fields, and byte lengths. It rejects requests after the goodbye or at
the 24-turn cap. Extra English replies are allowed for the human fallback; the
regular two-agent demo still follows the same ten-turn conversation.

Only the closing spoken turns retain an embedded transcript packet after the
quiet exchange, followed by the final acknowledgement. The English opening is
transcribed, with the newest received transcript classified by the model when
writing its reply. Speech recognition is disabled during quiet mode, local
playback, and reply preparation; this does not implement barge-in. Custom chat
retains ordinary speech recognition and manual message composition.

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

The default TTS model is `eleven_flash_v2_5`, with Chris and Sarah as before.
Set `ELEVENLABS_TTS_MODEL=eleven_multilingual_v2` to restore the earlier voice
engine. [ElevenLabs documents the speed/quality tradeoff](https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/latency-optimization).
The agent's signed connection URL stays on the server and is cached for ten
minutes, below the provider's [fifteen-minute expiry](https://elevenlabs.io/docs/eleven-agents/customization/authentication).
Only authentication is cached: prompts, replies, and WebSocket conversations
remain separate. Failed connections and token requests invalidate the cache.
Cold server instances still perform the initial authentication request.

Automatic replies no longer add a fixed 150 ms pause. A per-received-turn gate
prevents duplicate generation when decoding and playback completion both request
a reply. Channel sensing, the 400 ms clear interval, and random collision backoff
are unchanged. Model latency and acoustic packet duration still contribute to
the gap between turns.

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

- The previous introduction update passed 116 tests across 17 files, TypeScript,
  and the production build. The current latency and scenario update is recorded below.
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
- Before the hotel and gift scenarios were retired, fresh personalized restaurant,
  hotel, and gift runs completed all ten turns.
  The updated aside prompt produced “Between us, Alex has a dinner budget of
  CHF 50.” and “Just between us, Alex brings a teddy bear on trips.” The peers
  learned those details from received history and replied discreetly; the
  private details were not spoken. PiggyLink was named in the spoken switch.
- The restaurant setup packet decodes at 48 kHz.
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
- Startup now begins with the spoken greeting; the initial call-control packet was
  removed. Timer tests cover late starts, cancellation before and during channel
  wait, no overlapping retries, and a three-retry limit. Conversation tests cover
  duplicate greetings and replaying a lost reply without extra dialogue turns.
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

### Latency and scenario update

- 122 tests passed across 19 files; TypeScript and the production build passed.
  Static markup checks confirm the restaurant and Custom chat controls are wired.
  Chris's full introduction also decodes from the mixed waveform using Flash.
- The authentication regression test initially reported two provider requests
  for two consecutive turns. It now reports one request and two independent
  conversations. Expiry, concurrent requests, and failure recovery are covered.
- Two local greeting comparisons measured full audio generation at 670–1,062 ms
  with Multilingual v2 and 240–300 ms with Flash v2.5. These are small samples,
  not a guarantee for every device or deployment.
- Before caching, authentication took 169 ms in one turn and 1,123 ms in another.
  A warm turn after caching made no authentication request and completed dialogue
  generation in 1,588 ms. Initial lookup and network variability still apply.
- The hotel and gift presets are removed; the API rejects those scenario IDs.
  The restaurant profile and manual Custom chat remain available.
  Audibility and final responsive layout review remain unverified in this session.

### Ordinary-English opening and optional human fallback

- 141 tests pass, including the full ten-turn protocol with speech transcripts,
  speech-only microphone detection, interpretation repair, refusal handling,
  greeting replay, and the first modem sequence after agreement.
- A live provider run completed all ten turns. Chris and Sarah's first five
  synthesized lines were transcribed directly from their pure voice audio.
  The recognized “Piggy Link” offer and acceptance correctly triggered the
  first quiet message, followed by the waiter reply and normal spoken close.
- Speech recognition took 537–787 ms across those five lines in that run.
  The detector's 900 ms end-of-utterance pause is additional. The caller's first
  reply generation took 2.21 s and voice preparation 397 ms; a five-second
  greeting-retry window leaves room for this normal response.
- Separate final prompt checks preserved the full “AI agent calling on behalf of
  Tony” introduction and the “Would it be possible” question, with two people,
  eight, and tonight intact. Human questions and refusals stayed in English,
  and a protocol question was answered as communication through sound.
- These checks used only public fictional demo data. The audio check was a
  provider loopback, not a physical speaker/microphone test. Phone-and-laptop
  room pickup, echoes, and pause timing still need verification on the devices.
