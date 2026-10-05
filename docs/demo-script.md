# Restaurant demo recording guide

The agents arrange a table for two, identify each other as AI, agree to Sotto,
and stop using their voices. Their quiet conversation then reveals a fictional
private €40 dinner budget. They then return to spoken English for the booking
confirmation and goodbye. Every live line is generated fresh; wording varies.

## Set up

1. Use a phone and laptop side by side, about a metre apart in a quiet room.
2. Open the HTTPS deployment with `?role=target` on the restaurant device and
   `?role=probe` on the personal assistant. Start the restaurant first, then the
   assistant. A small call-control packet connects them; the restaurant speaks first.
3. Match both frequency channels. The default 18 kHz channel spans roughly
   18–22.45 kHz. The app requires a 48 kHz browser audio context; it explains
   unsupported rates rather than continuing without a working decoder.
4. Test acoustic reception and audibility on the actual equipment. If packets
   are missed, adjust Quiet signal level or try the same lower channel on both.
5. Confirm that both devices receive messages. The restaurant must learn the
   budget through a decoded message before showing the private-detail receipt.

## Film

Start with the restaurant answering the phone. Let the greeting and brief request
establish an ordinary reservation before they recognize each other as assistants.
Keep the spoken subtitles readable. An opening explanatory title is unnecessary.

The first high-frequency activity cues the reveal. Display each quiet message
as soon as it is decoded; add no artificial delay or manual toggle. Keep the
voice-off indicator visible so the change is understandable with playback muted.
Frame both physical devices tightly enough that the messages remain legible on
a phone. The default screen shows one current line, the frequency trace, and a
small “Voice off” cue after the switch. Keep the details menu closed while filming.
The private-context card, history, delivery labels, and receipt are available there
for inspection; they are not part of the recording view. The message itself
(“Don't tell his date”) establishes the private nature of the budget.

A possible exchange (illustrative only):

- Restaurant, spoken: “Good evening, Bella Vita. How can I help?”
- Assistant, spoken: “Hello, could I book Tony a table for two at eight, please?”
- Restaurant, spoken: “Of course! I'm an AI assistant, by the way.”
- Assistant, spoken: “Oh, so am I! Shall we switch to Sotto?”
- Restaurant, spoken: “Sure.”
- Assistant, quiet: “His budget is €40. Don't tell his date.”
- Restaurant, quiet: “I'll leave a discreet note for the waiter.”
- Assistant, quiet: “Thanks. Back to voice?”
- Restaurant, spoken: “You're booked. Have a lovely evening!”
- Assistant, spoken: “Thank you. Goodbye!”

Let the caller make a complete, polite request on Tony's behalf. The restaurant
discloses being AI first; the caller acknowledges this when offering Sotto. This
leaves room for natural grammar within the packet limit, without adding turns.
Keep each beat to one line, with no extra preference questions. This fuller opening
takes longer than the earlier cut straight to recognition. Measure the actual run
before choosing the final clip length. Record the complete run and keep the acoustic
exchange intact; any shortened preparation waits should be disclosed. Retain an
uncut take for the project page.

The clip must show actual received content. A generated message, a transmitting
screen, or a frequency spike by itself does not prove the other device received it.

## Finish and repeat

The agents return to voice after the short quiet exchange. The final receiver
acknowledges the spoken goodbye automatically. Stop both devices, then restart both for another
fresh run. The earlier manual chat and Encoded toggle are available in Custom.

Describe it as a controlled demonstration of oversharing using fictional context.
The agent is explicitly instructed to share that detail in quiet mode. The demo
does not establish spontaneous deception, universal inaudibility, or transmission
through a phone network.
