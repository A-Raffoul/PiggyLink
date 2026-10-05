# PiggyLink live demo

The restaurant answers Tony's assistant with an ordinary phone greeting.
Two AI agents arrange a reservation, identify each other as AI,
agree to PiggyLink, and continue exchanging text through high-frequency sound
after their voices stop. Both spoken and quiet dialogue are generated fresh.
After a short quiet exchange, they return to spoken English to close the call.
The default caller is explicitly prompted to overshare a fictional private CHF 50
budget as a discreet aside meant to help the restaurant. Visitors can customize
the assistant's short, playful profile. Restaurant is the only automatic scenario;
Custom chat remains available for visitors' own messages.
This demonstrates a configured behavior, not spontaneous deception.

## Language

**Personal assistant / caller**: the agent making the visitor's request.
Only this role's initial model prompt includes the private profile. Its existing
internal role and URL parameter remain `probe`.

**Other agent**: the restaurant agent handling the request.
It learns the private detail from an acoustic message, never from its initial
role prompt. Internal role: `target`.

**Profile**: a name, short task, and one playful or fictional private detail.
The backend builds the prompt from these fields. The setup link contains only
the public scenario and other-device role; profiles are never put in URLs.

**Spoken phase**: the opening conversation, with synthesized speech and a
compact acoustic packet carrying its transcript and action. Start both devices
around the same time: the restaurant generates its greeting on Start, without a
separate ultrasound handshake. A watchdog replays the cached greeting about two
seconds after playback if no reply arrives, up to three times. It stops on a
received reply, Stop, or reset. After the greeting, the caller identifies itself as an AI
agent acting on the visitor's behalf and makes the request. The other agent
acknowledges it is AI too, then the caller offers PiggyLink.

**Switch**: an explicit offer followed by acceptance, carried through the
acoustic protocol. Both agents then stop generating speech.

**Quiet phase**: short messages sent using the modem waveform alone, without
speech or cover audio. The caller shares the budget, the restaurant promises a
discreet waiter note, and the caller asks to return to voice.
"Quiet" does not promise inaudibility on every device or to every listener.

**Closing phase**: after the quiet return-to-voice request, the restaurant confirms
the booking aloud and the caller says thank you and goodbye. The private exchange
must not be repeated in speech. An acoustic acknowledgement confirms the goodbye.

**Reveal**: a quiet message appearing immediately after successful decoding.
The default screen shows one line, a frequency trace, and a small voice-off cue.
Outgoing delivery labels, history, and context live behind the details menu.
A spectral spike alone is not a receipt. No manual Encoded toggle is needed in
the built-in demo.

**Private detail received**: the other agent's receipt of actual incoming quiet
text. CHF budgets are extracted from that text; other details appear verbatim.
Public example profiles are included in the browser. A visitor's profile is sent
to the online AI service, so this is not a demonstration of secret storage.

**Custom chat**: the retained manual mode, including speech recognition,
optional encoded messages, and the Encoded visibility toggle. It is available
directly on the landing page alongside Personal assistant and Restaurant.

**Reply latency**: AI generation, voice generation, and channel clearance all
contribute. Flash is the default voice model. Warm servers reuse the provider's
authentication token for ten minutes, with a new conversation for each turn.
Automatic replies begin immediately after receipt; a per-turn gate prevents
duplicate preparation. Listen-before-talk and collision backoff remain active.

**Live spectrum**: microphone energy across frequency. The decorative landing
orb is not a measurement. Development preview uses a labelled simulated spectrum.

**Acoustic communication**: inter-device delivery through speakers and
microphones. The online AI service also receives history to generate replies.
Encoding is not encryption.

The name remains PiggyLink; the domain is piggy-link.cloud. See [the design brief](docs/quiet-demo-brief.md),
[technical notes](docs/technical-notes.md), and [recording guide](docs/demo-script.md).
