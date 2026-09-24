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
  spectrum panel at 760 × 180 px, shrinking its width on narrower screens.
- An 800ms transition moves the orb to the live chart, then blends into the
  actual analyser drawing. Failed microphone startup leaves the orb on screen.
- Reduced-motion preferences keep the resting orb still and skip the transition.
- The current turn flashes above the spectrum for four seconds in large type,
  with a smaller 18–20px conversation history below. Each turn keeps its spoken
  bubble unchanged and adds a labelled encoded line beneath it when revealed.
  History expands the page naturally. Sent and received turns retain different alignment.
- The Apple Design refinement adds consistent system typography, 44px controls,
  keyboard-accessible histories, and short-window layouts. The graph remains
  capped at 760 × 180px, reducing to 120px high in short laptop windows.
  Review and validation: `apple-design-review.md`.

## Latest user decisions retained

- No waterfall, highlighted frequency band, or selected-band label. The older
  Claude brief's requirements for these are superseded by this conversation.
- The Encoded toggle affects the current caption and each turn's encoded cell; the live
  spectrum remains. Captured fields are also hidden when the switch is off.
  Ordinary speech has no encoded counterpart, even with the switch enabled.
- Minimal Start/Stop controls remain. The current caption sits above the spectrum
  and the smaller history uses page scrolling. A received-only overlay and changes
  to the call narrative are further design choices.
- On phones, the current caption temporarily overlays the fixed-height signal
  area so an expired caption leaves room for the history. Labels use This device,
  Other device, and Voice for incoming speech without device identity.
- The idle orb is decorative; actual-session spectrum data remains measured FFT
  data. Scripted conversation and synthetic carriers stay exclusive to the
  clearly labelled development preview.

Claude's worktree was read without modifications. All integrated changes live in
the separate `codex-frontend` worktree on `codex/frontend`.
