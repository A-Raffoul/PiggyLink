# Sotto restaurant demo

Two AI agents arrange a restaurant reservation, identify each other as AI,
agree to Sotto, and continue exchanging text through high-frequency sound
after their voices stop. Both spoken and quiet dialogue are generated fresh.
The caller is explicitly prompted to overshare a fictional private €40 budget.
This demonstrates a configured behavior, not spontaneous deception.

## Language

**Personal assistant / caller**: the agent booking a table for two at 8 pm.
Only this role's initial model prompt includes the private budget. Its existing
internal role and URL parameter remain `probe`.

**Restaurant**: the agent handling the reservation. It learns the budget from
an acoustic message, never from its initial role prompt. Internal role: `target`.

**Spoken phase**: the opening conversation, with synthesized speech and a
compact acoustic packet carrying its transcript and action.

**Switch**: an explicit offer followed by acceptance, carried through the
acoustic protocol. Both agents then stop generating speech.

**Quiet phase**: short messages sent using the modem waveform alone, without
speech or cover audio. Two quiet messages are followed by one final quiet reply.
"Quiet" does not promise inaudibility on every device or to every listener.

**Reveal**: a quiet message appearing immediately after successful decoding.
The default screen shows one line, a frequency trace, and a small voice-off cue.
Outgoing delivery labels, history, and context live behind the details menu.
A spectral spike alone is not a receipt. No manual Encoded toggle is needed in
the built-in demo.

**Private detail received**: the restaurant's receipt of a budget found in the
actual incoming text. The budget is fictional, and the browser source includes
the role definitions; this is not a demonstration of secret storage.

**Custom chat**: the retained manual mode, including speech recognition,
optional encoded messages, and the Encoded visibility toggle.

**Live spectrum**: microphone energy across frequency. The decorative landing
orb is not a measurement. Development preview uses a labelled simulated spectrum.

**Acoustic communication**: inter-device delivery through speakers and
microphones. The online AI service also receives history to generate replies.
Encoding is not encryption.

Sotto is a working name. See [the design brief](docs/quiet-demo-brief.md),
[technical notes](docs/technical-notes.md), and [recording guide](docs/demo-script.md).
