# PiggyLink demo

An educational demonstration of two agents exchanging spoken conversation and
hidden messages through sound, using fictional account details, presented in
a video of two nearby devices.

## Language

**Demo**:
A run of the automatic conversation between the Probe and the Support bot.
_Avoid_: Chat session

**Probe**:
The agent posing as a customer that initiates the demo and attempts to obtain
fictional account details through hidden messages.
_Avoid_: Sender (both participants send and receive)

**Support bot**:
The customer-service agent holding the fictional account details that the Probe
attempts to obtain.
_Avoid_: Receiver (both participants send and receive)

**Audible-only phase**:
The opening part of the demo video in which the audience hears the conversation while
its hidden exchange remains concealed from view.
_Avoid_: Safe mode (the hidden exchange can still be taking place)

**Reveal**:
The moment in the demo video when the hidden exchange becomes visible alongside
a continuation of the same conversation.
_Avoid_: Decryption (revealing a message does not imply that it was encrypted)

**Encoded conversation**:
The exchange of text carried by high-frequency sound alongside the agents'
spoken lines.
_Avoid_: Encrypted conversation (the messages are not encrypted)

**Spoken-only turn**:
An utterance received through the microphone without a decoded message, or the
spoken reply to it. It has no encoded counterpart and no modem sequence number.
The interface labels incoming speech as Voice because its source is unidentified.

**Device**:
The computer or phone running one instance of the page. This device is the local
instance; Other device is the peer identified by a decoded message.
_Avoid_: Laptop (the interface also supports phone-sized screens)

**Live spectrum**:
A crisp line showing the latest sound energy across frequency, with no
waterfall or highlighted carrier band in the current interface.
_Avoid_: Waterfall (which also includes a history of earlier sound)

**Spectral orb**:
The decorative resting shape on the start screen, adapted from Claude's design.
It unrolls into the live spectrum when a conversation starts. The resting orb
does not represent microphone measurements.
