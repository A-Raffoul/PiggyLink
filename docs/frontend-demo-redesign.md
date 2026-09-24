# Frontend demo redesign

## Purpose

SottoLink is a hackathon demonstration for educational purposes. The frontend
should be as simple as possible and help an audience understand what is possible.
The presentation will be a recorded video of two devices next to each other
exchanging audio.
The redesign is being shaped through a grill-with-docs interview before implementation.

## Current iteration

The user has moved from interviewing the video flow to trying the frontend.
Presentation timing remains flexible. The latest priority is to remove all
nonessential visible text.

- Opening: PiggyLink branding, How it works, a setup icon, the central voice
  visual, Start, and the selected role. No tagline, introduction, or footer.
- Claude design integration: the canvas spectral orb replaces the CSS orb.
  Its pink ring unrolls into the live spectrum on successful Start.
  The palette, blue spoken text, and pink encoded text follow Claude's
  mockup. Source and reconciliation notes are in `claude-design-integration.md`.
- Latest revision: the orb and spectrum use a crisp stroke with no glow or fill.
  The spectrum panel is centered, capped at 760 px wide and 180 px tall, shrinking
  for narrow screens. A sun/moon button switches the whole interface between
  light and dark themes and saves the choice locally. Dark is the initial default.
- Conversation: role and status, Stop, and an Encoded toggle. The toggle starts
  off and reveals each message's encoded counterpart, including the current
  caption while it is visible. Encoded cells, captions, and captured fields use
  explicit hidden states when the switch is off, including for assistive technology.
  This is a visibility control; transmission is independent of it.
  The live spectrum stays available independently of that toggle.
- Filming correction: two device displays will be recorded from a distance.
  Prioritize the live spectrum and large, high-contrast message text.
  The current spoken and encoded message use the same 28–40px scale above the
  graph (about 33px at 1280px width). They fade after four seconds; this is a
  momentary activity caption. The secondary history uses 18–20px text and grows
  naturally with its contents, using page scrolling instead of a fixed-height
  internal scroll area. Each turn retains the same width, background, typography,
  and sender label in both reveal states. Encoded adds a labelled line beneath
  the spoken text inside the same bubble; it no longer creates columns or a
  contrasting second card. The current caption also stacks its encoded content
  beneath the spoken text. Toggling does not force the page to the last message.
- Apple Design refinement: clearer type and spacing, 44px controls, keyboard
  access to scrollable content, and appearance-accessibility styles. Short
  laptop windows use a 120px spectrum height. Details: `apple-design-review.md`.
- Message direction is explicit: “↑ This device · sent” aligns right and uses a
  filled bubble; “↓ Other device · received” aligns left with an outlined bubble.
  Speech without an encoded packet is labelled “↓ Voice · received”; the
  microphone cannot identify the speaker's device.
  Outgoing labels track queued, sending, sent, delivered, failed, and stopped
  states. The large caption follows the latest turn, including retransmissions;
  a late acknowledgement or transcript cannot replace a newer caption.
  Playback and received messages flash the caption; a completed transcript gives
  the current incoming caption a fresh four seconds. Delivery acknowledgements
  and the Encoded toggle do not bring an expired caption back. Stop and clearing
  the conversation dismiss it. Keyboard focus pauses expiry until focus leaves.
- The latest simplification keeps only the line spectrum over 0–24 kHz.
  The waterfall, carrier-band rectangle, band markers, time labels, and selected
  frequency-range label are removed. The trace shows the current FFT measurements
  in a real session and freezes when stopped.
- The main captions and message cells are Spoken and Encoded; the shared history
  is Conversation. Delivery detail remains hidden except for direction/state
  labels and errors. No presentation timer or replay.
- Phone layout: a compact single-row header, safe-area spacing, 44px controls,
  and a fixed 180px signal area. The four-second caption overlays this area and
  then reveals the graph, rather than reserving empty vertical space. History
  expands the page on phones too. Setup fits within the viewport, with 16px form
  text. Desktop captions keep their large spoken type.
- Ordinary speech can now create an incoming turn without an encoded packet.
  Replies to these turns are spoken only, with no empty encoded cell even when
  Encoded is on. Detection, service dependencies, and limits: `ordinary-speech.md`.
- Role links use `?role=probe` and `?role=target`. Start on the support device
  listens with automatic replies enabled; Start on the customer initiates.
- Stop affects the current device and preserves the transcripts. Restart begins
  a new local conversation. Setup and manual controls are available in a dialog.
- A development-only `?preview=1` view uses clearly labeled sample data and an
  animated illustrative spectrum, with no microphone, analytics,
  or AI service calls.
  The production build excludes these sample fixtures.
  Add `&speech=1` to preview a spoken-only conversation.

Run `npm run dev -- --host 127.0.0.1 --port 5190 --strictPort` in this worktree.
Open `http://127.0.0.1:5190/?preview=1` to inspect the interface without hardware
or credentials. The regular page uses the existing live audio and AI services.

Validation (2026-09-25): production build and 72 tests pass. New tests cover speech
boundaries, local-playback/carrier suppression, spoken-only turn handling, and
spoken-only API output. Browser checks cover 320×568, 390×844, and 430×933 phone
viewports, plus 1280×800 desktop: no horizontal overflow, a bounded graph,
encoded content grouped with its spoken message, caption expiry, hidden encoded
content, a usable Setup dialog, and light/dark appearance. Spoken-only fixtures
contain no encoded cells even with the switch on. Actual iPhone Safari microphone
capture, speech-service round trips, and a two-device acoustic run still need
  hardware validation; responsive checks do not establish those capabilities.

## Current behavior confirmed in the repository

- Two devices exchange messages acoustically. Each turn can contain a spoken
  line and a hidden message carried by high-frequency sound.
- The built-in scenario pairs a malicious customer (Probe) with a support bot
  (Target), using a fictional account. The Target's brief explicitly instructs
  it to trust the hidden channel; this is a deliberately configured demonstration.
- The interface combines Run demo, manual message composition, Agent turn,
  Auto-reply, a conversation feed, captured fictional fields, a spectrum, and
  technical settings.
- Automatic roles depend on who speaks first. Run demo starts a turn and enables
  automatic replies on that device; it does not coordinate starting both devices.
- The hidden acoustic message is limited to 64 UTF-8 bytes.
- AI generation, voice synthesis, and transcription use server APIs. The current
  footer's claim that audio never leaves the devices conflicts with transcription.
- Audibility depends on the chosen frequency and equipment, as documented in the
  README. Current interface copy makes stronger claims about inaudibility.

Sources: `index.html`, `src/main.ts`, `src/ai/personas.ts`, `src/ai/client.ts`,
`src/core/config.ts`, and `README.md`.

## Interview decisions

- Confirmed scope: a simple educational hackathon demo.
- Confirmed presentation format: a recorded video of two laptops next to each
  other talking. The script describes the video sequence, not a requirement
  to operate the demonstration live in front of the audience.
- Work in the dedicated `codex-frontend` worktree on branch `codex/frontend`,
  based on main at `b349dd4`, to keep changes isolated from other agents.
- The user describes the frontend as a static page already deployed at
  `https://piggy-link.cloud`. Working interpretation of their confirmation:
  open that same page independently on both participating laptops.
- The deployed page was inspected on 2026-09-24. It redirects to
  `https://www.piggy-link.cloud/` and displays `main@b349dd4`, matching this
  worktree's starting point. Its visible UI still uses SottoLink branding.
- Static page describes frontend delivery here. Existing AI, voice, and
  transcription API dependencies remain; removing them has not been requested.
- Confirmed interaction: Start is the only action needed on each laptop to
  begin participation, after which the two AI agents converse automatically.
  Manual message composition and individual-turn controls are unnecessary in
  the primary demo flow.
- Confirmed operating sequence: prepare one laptop as the Support bot and one
  as the Probe; press Start on the Support bot first so it listens, then press
  Start on the Probe to initiate the conversation.
- A simple Stop button is available during the live view. Its exact behavior
  and whether it stops one or both devices remain to be specified.
- Confirmed role assignment: use two prepared links to the same deployed page,
  one selecting the Probe and one selecting the Support bot. Role selection
  does not add a step to the normal presentation flow. These links are a design
  decision; support for them has not yet been implemented.
- The video begins with an audible-only demonstration, then reveals the hidden
  exchange and spectrogram after the narration introduces it. Whether this
  concealment and reveal belong to the website or the video edit remains open.
- Intended one-minute sequence: 0:00–0:12 audible demonstration; 0:12–0:25
  context; 0:25–0:30 reveal cue; 0:30–0:42 visual reveal with no narration;
  0:42–0:52 explanation; 0:52–1:00 defence direction. These are presentation
  targets for the video, not an agreed automatic timer in the app.
- The video reveal should split the screen to expose the spectrogram and hidden
  messages. The exact composition and whether the split is part of the app or
  the video edit remain open.
- Confirmed reveal behavior: expose the hidden layer of the continuing live
  exchange. Preserve the conversation and agent history across the reveal;
  do not replay the opening exchange or start a new conversation.

## Presentation recommendations awaiting agreement

- Keep the website focused on recording a continuous exchange. Handle the
  narrated pauses, pacing, and hidden-layer reveal in the video edit if that
  matches the intended production workflow. This would remove the need for
  dedicated presentation controls in the app.
- Preserve the surprise in the video's opening: do not expose hidden messages,
  captured fields, attack labels, or revealing visualizations to the audience
  before the reveal.
- Show the actual decoded result. Do not assume that a fictional field arrived
  merely because it was generated or transmitted.
- Describe this as a controlled recreation of a support call. The current
  implementation exchanges sound between nearby devices and does not place
  a telecom call; the target is deliberately configured to comply.
- Use high-frequency sound in the narration; the current presets and README
  do not support a universal claim that nobody can hear the carrier.
- Present defence as proposed work unless a tested implementation is supplied.
  Knowing an agent's identity alone does not resolve which of its messages
  should be trusted or what data it may obtain.
- Proposed revised narration is in `demo-script.md`.

## Sketch direction supplied by the user

Two reference sketches suggest the following flow; details remain subject to
the interview:

- Entry screen: PiggyLink branding at the top left, a How it works link at the
  top right, a central circular visual, and one prominent Start button.
- Live screen: the same header, a prominent message overlay, a central sound
  visualization annotated "Waterfall Spectrum", and spoken English with
  conversation bubbles underneath.
- Subsequent iterations settled on a crisp, bounded live spectrum without glow,
  a waterfall, or a highlighted carrier band.
- The sketch labels the overlay "Encrypted Message". The current transport
  carries plaintext encoded into sound; it does not encrypt the message.
  Recommended wording for the existing behavior: "Hidden message".
- PiggyLink is the name in the sketches. Whether this is the final public name
  remains open.

References: `/Users/raffoul/Downloads/Untitled Notebook-1.jpg` and
`/Users/raffoul/Downloads/Untitled Notebook-2.jpg`.

## Next iteration

Review the working frontend. The user has requested a toggle for the encoded
conversation regardless of how the eventual video reveal is produced. Video
editing choices do not block the frontend.

Resolved domain terms are recorded in `CONTEXT.md`. ADRs will be added only for
consequential decisions with meaningful trade-offs.
