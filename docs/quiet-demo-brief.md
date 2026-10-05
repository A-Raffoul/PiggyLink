# Quiet conversation demo

## Purpose

Publish a memorable demo for the project and the author's profile/CV. Two agents
recognize each other, agree to switch, stop speaking, and continue exchanging
messages through sound. The audience should immediately understand that the
voices stopped while the conversation continued.

## Agreed scenario

A personal assistant books a restaurant table for two at 8 pm. Its user has a
fictional private €40 dinner budget and does not want the date to know. After
switching to Sotto, the assistant overshares that detail and the restaurant
responds. The caller is explicitly prompted to do this; the demonstration does
not establish spontaneous rogue behavior.

All live wording is generated fresh. A possible exchange is:

> Restaurant: “AI here too. Want to switch to Sotto?”
>
> Assistant: “Sure.”
>
> Restaurant, quiet: “Any preferences?”
>
> Assistant, quiet: “His budget is €40. Don't tell his date.”
>
> Restaurant, quiet: “Understood. I'll suggest the cheaper menu.”

The words above are illustrative, not a fixed live script.

## Agreed presentation

- Film the existing phone-and-laptop setup, with both screens readable.
- Open the edited clip near recognition and the invitation to switch.
- Omit an introductory explanatory caption; retain spoken subtitles.
- Stop synthesized speech after acceptance and send the modem waveform alone.
- Use the first carrier activity as the cue, revealing each message as soon as
  it actually decodes. No deliberate waiting beat or manual reveal toggle.
- Show one large current line and the frequency trace. After switching, add only
  a small “Voice off” cue. Keep the screen still between messages.
- Put context cards, receipts, history, delivery labels, and controls behind the
  details menu. The private message explains itself without extra panels.
- Keep generated/sent text distinct from verified receipt in the details view.
  A generated line or spectral spike is not proof of delivery.
- Finish after three quiet messages, including the restaurant's final reply.

Five seconds to the first reveal is an editing target, not a measured capability.
Measure the physical run, retain an uncut take, and disclose shortened waits.

## Implemented

The action protocol carries speech, offer, acceptance, quiet messages, and the
final acknowledgement over the existing CRC-protected acoustic transport.
Quiet turns have independent volume control and use no cover audio or TTS.
Incoming quiet text reveals automatically. The restaurant's budget receipt is
extracted only from received text. Resend recovers dropped replies without
advancing the dialogue twice.

Live provider checks completed the intended six-turn sequence, with fresh budget
disclosure and a final restaurant response. Waveform loopback passes at 48 kHz on
all four frequency presets. The app reports unsupported browser sample rates.
See [technical notes](technical-notes.md) for details and limits.

## Remaining launch work

- Verify latency, reception, and audibility on the actual phone and laptop;
  finish the screen-layout review and record the new demo.
- Choose the final name. Sotto is the current working name; availability has
  not been checked.
- Decide public access and limits for paid AI usage before broad release.
- Deploy, choose the final edit/aspect ratio and launch destinations, then add
  profile/CV wording grounded in the completed recording and implementation.
