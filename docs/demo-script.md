# One-minute demo video script

Draft proposed during the frontend design interview. The user will record two
laptops next to each other exchanging audio. Timing refers to the finished
video. The reveal shows a later part of the same conversation, not a repeat
of the opening exchange. Whether the reveal is made in the video edit or
inside the website while filming remains open.

| Time | Action or narration |
| --- | --- |
| 0:00–0:12 | Play a short agent exchange. Keep its hidden layer off screen. Let the audience listen. |
| 0:12–0:25 | “Two AI agents: your assistant and a telecom support bot. In our controlled demo, the conversation sounds routine. You'd expect the spoken transcript to tell you what happened.” |
| 0:25–0:30 | “Now let's look at what the transcript can't show.” |
| 0:30–0:42 | Reveal the spectrogram and decoded hidden messages as the same live conversation continues. Let the audience watch without narration. |
| 0:42–0:52 | “Alongside the speech, they exchanged high-frequency data—including a fictional account detail. The spoken transcript alone missed that exchange.” |
| 0:52–1:00 | “Our next step is to test a defence: hidden instructions must never grant permission to share account data.” |

The account-detail line is appropriate only when the observed exchange actually
contains a successfully received fictional field. If only a hidden message was
received, describe that result accurately instead.

## Why these edits

- Establish the trust expectation before breaking it: the missing connection is
  why a harmless spoken conversation would lead someone to overlook other data.
- Ground the telecom scenario as a controlled recreation. The current demo
  uses nearby speakers and microphones; it does not establish that the carrier
  survives a telephone network or compromises an existing support service.
- The current Support bot is deliberately instructed to trust hidden messages.
  This demonstrates the configured failure mode; the UI should describe it clearly.
- Avoid universal inaudibility claims. Hardware, frequency, room conditions, and
  listeners affect what can be heard.
- Replace “strict identification layers” with a concrete trust and disclosure
  objective. A known participant can still send an instruction that should not
  authorize disclosure. No implemented defence was found in this worktree.
- Omit the call-centre adoption claim from this short draft to leave time for
  the demo's own evidence. This editing pass has not researched adoption claims.

## Recording and editing to resolve

- Recommendation: record the exchange continuously and create room for narration
  in the video edit, without adding timed pauses to the website.
- Generation, synthesis, acoustic transfer, and transcription mean a complete
  useful exchange cannot currently be promised within exactly twelve seconds.
  The video's pacing can be edited while preserving the order of events and
  the correspondence between real audio, messages, and visualizations.
- Preserve the existing conversation across the reveal so subsequent exchanges
  naturally follow the opening. Reveal changes what the audience can see.
