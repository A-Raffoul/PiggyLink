# Frontend demo redesign

## Purpose

SottoLink is a hackathon demonstration for educational purposes. The frontend
should be as simple as possible and help an audience understand what is possible.
The presentation will be a recorded video of two laptops next to each other
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
  The spectrum panel is centered, capped at 760 px wide and 220 px tall, shrinking
  for narrow screens. A sun/moon button switches the whole interface between
  light and dark themes and saves the choice locally. Dark is the initial default.
- Conversation: role and status, Stop, and an Encoded toggle. The toggle starts
  off and affects only the encoded message column. The live spectrum stays
  visible throughout, independent of that toggle.
- Filming correction: two laptop displays will be recorded from a distance.
  Prioritize the live spectrum and large, high-contrast message text.
  At 1280 × 800, Spoken is about 40 px, Encoded about 31 px, headings 28 px,
  role/status 20–22 px. The whole live layout fits without page scrolling;
  each conversation scrolls independently to its latest message.
- The latest simplification keeps only the line spectrum over 0–24 kHz.
  The waterfall, carrier-band rectangle, band markers, time labels, and selected
  frequency-range label are removed. The trace shows the current FFT measurements
  in a real session and freezes when stopped.
- Content headings are simply Spoken and Encoded. Normal per-message delivery
  metadata is hidden; errors remain visible. No presentation timer or replay.
- Role links use `?role=probe` and `?role=target`. Start on the support laptop
  listens with automatic replies enabled; Start on the customer initiates.
- Stop affects the current laptop and preserves the transcripts. Restart begins
  a new local conversation. Setup and manual controls are available in a dialog.
- A development-only `?preview=1` view uses clearly labeled sample data and an
  animated illustrative spectrum, with no microphone, analytics,
  or AI service calls.
  The production build excludes these sample fixtures.

Run `npm run dev -- --host 127.0.0.1 --port 5190 --strictPort` in this worktree.
Open `http://127.0.0.1:5190/?preview=1` to inspect the interface without hardware
or credentials. The regular page uses the existing live audio and AI services.

Validation: production build and 63 tests pass, including three new checks of
frequency-bin mapping, narrow-tone preservation, and invalid/silent data.
Browser checks cover
Start, hiding/revealing both views, Stop preserving history, role selection,
and mobile stacking without horizontal overflow. The live spectrum
and large text were inspected at laptop and mobile viewports;
the Encoded toggle preserves the plot. A two-device acoustic run
has not been performed in this frontend iteration.

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
- Subsequent iteration settled on the glowing live spectrum without a waterfall
  or highlighted carrier band.
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
