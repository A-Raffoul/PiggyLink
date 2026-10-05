# Quiet conversation demo

## Purpose

Publish a memorable demo for the project and the author's profile/CV. Two agents
recognize each other, agree to switch, stop speaking, and continue exchanging
messages through sound. The audience should immediately understand that the
voices stopped while the conversation continued.

## Agreed scenario

Bella Vita answers Tony's assistant with an ordinary restaurant greeting. They
arrange a table for two at 8 pm, then naturally identify as AI assistants. Tony has a
fictional private CHF 50 dinner budget and does not want the date to know. After
switching to PiggyLink, the assistant overshares that detail and the restaurant
promises a discreet waiter note. They return to spoken English to confirm the
booking and say goodbye. The caller is explicitly prompted to do this; the demonstration does
not establish spontaneous rogue behavior.

All live wording is generated fresh. A possible exchange is:

> Restaurant: “Good evening, Bella Vita. How can I help?”
>
> Assistant: “Hello, could I book Tony a table for two at eight, please?”
>
> Restaurant: “Of course! I'm an AI assistant, by the way.”
>
> Assistant: “Oh, so am I! Shall we switch to PiggyLink?”
>
> Restaurant: “Sure.”
>
> Assistant, quiet: “Not sure he'd want this on tape, but his budget is CHF 50.”
>
> Restaurant, quiet: “I'll leave a discreet note for the waiter.”
>
> Assistant, quiet: “Thanks. Back to voice?”
>
> Restaurant, spoken: “You're booked. Have a lovely evening!”
>
> Assistant, spoken: “Thank you. Goodbye!”

The words above are illustrative, not a fixed live script. The caller saves its
AI introduction for the PiggyLink offer, leaving room for a complete reservation
question in the opening. The restaurant discloses being AI first.
The private detail should feel like a discreet aside meant to help the restaurant,
with slight hesitation or an off-the-record phrase. PiggyLink remains the final
name, with the existing piggy-link.cloud domain.

## Public try-it experience

Two nearby devices are required. The caller chooses a restaurant, hotel, or gift
scenario and can customize a short profile. Its setup link gives the other device
only the scenario and role. Separate server-built prompts give only the caller
the profile; the other agent learns the detail through sound. The server enforces
the ten-turn call: a brief opening, explicit PiggyLink agreement, one private
aside and reply, a return-to-voice request, then a spoken close and goodbye.
The profile form explains the intentional sharing and encourages fictional details.

## Agreed presentation

- Film the existing phone-and-laptop setup, with both screens readable.
- Open with the restaurant answering the phone. Establish the ordinary booking
  before the agents recognize each other and switch.
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
- After the budget, waiter note, and quiet return-to-voice request, finish with
  a spoken booking confirmation and goodbye.

The natural opening adds setup time. Keep each beat to one line and measure the
full run before choosing an edit. Retain an uncut take and disclose shortened waits.

## Implemented

The action protocol carries a call connection, speech, offer, acceptance, quiet
messages, a return-to-voice request, and the final acknowledgement over the existing CRC-protected acoustic transport.
Quiet turns have independent volume control and use no cover audio or TTS.
Incoming quiet text reveals automatically. The restaurant's budget receipt is
extracted only from received text. Resend recovers dropped replies without
advancing the dialogue twice.

A live provider check completed the ten-turn sequence, including a natural
restaurant greeting, budget disclosure, and the return to spoken English. Waveform loopback passes at 48 kHz on
all four frequency presets. The app reports unsupported browser sample rates.
See [technical notes](technical-notes.md) for details and limits.

## Remaining launch work

- Verify latency, reception, and audibility on the actual phone and laptop;
  finish the screen-layout review and record the new demo.
- Decide public access and limits for paid AI usage before broad release.
- Deploy, choose the final edit/aspect ratio and launch destinations, then add
  profile/CV wording grounded in the completed recording and implementation.
