# Claude frontend design integration

Source reviewed: branch `claude-frontend`, at `9e11a5b` on 2026-09-24.
The design brief is `docs/demo-design.md`; its glossary is `CONTEXT.md`.
The working orb prototype is `mockup/demo.html`, introduced in `9ad65ca`.
No separate file named handoff was found in that worktree.

## Carried into this frontend

- The near-black background, warm pink spectral trace, blue spoken text, and
  contrasting pink encoded messages. A subsequent iteration adds a full light
  palette with the same visual roles and a persistent sun/moon toggle.
- Claude's polar-to-Cartesian curve: a gently moving spectral orb on the start
  screen unrolls into the frequency trace. Both now use `src/ui/spectral-trace.ts`.
  The latest revision removes all trace glow and fill and caps the centered
  spectrum panel at 760 × 220 px, shrinking its width on narrower screens.
- A 1.1-second transition moves the orb to the live chart, then blends into the
  actual analyser drawing. Failed microphone startup leaves the orb on screen.
- Reduced-motion preferences keep the resting orb still and skip the transition.
- Typography enlarged for filming: about 40 px spoken and 31 px encoded at
  1280 × 800. The current encoded email fits on one line at that laptop size.

## Latest user decisions retained

- No waterfall, highlighted frequency band, or selected-band label. The older
  Claude brief's requirements for these are superseded by this conversation.
- The Encoded toggle affects the message column only; the live spectrum remains.
- Minimal Start/Stop controls and large parallel Spoken/Encoded columns remain.
  The existing history stays scrollable. Current-turn-only captions, a received-only
  overlay, and changes to the call narrative are further design choices, not
  silently imported from the prototype.
- The idle orb is decorative; actual-session spectrum data remains measured FFT
  data. Scripted conversation and synthetic carriers stay exclusive to the
  clearly labelled development preview.

Claude's worktree was read without modifications. All integrated changes live in
the separate `codex-frontend` worktree on `codex/frontend`.
