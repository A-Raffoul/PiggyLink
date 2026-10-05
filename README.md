# PiggyLink

**The voices stop. The conversation continues.**

Give a personal assistant a short profile and a task: book a table, arrange a
hotel stay, or find a gift. The other agent answers with an ordinary greeting.
The agents discuss the request and recognize each other,
agree to switch to PiggyLink, and continue through high-frequency sound while their
voices go quiet. The caller then overshares one private detail as a discreet,
well-meant aside. The other device reveals each message as it is decoded from
the microphone. They return to spoken English to wrap up and say goodbye.
The default restaurant profile uses Tony's fictional CHF 50 dinner budget.

Spoken and quiet dialogue are generated fresh. This is a controlled demonstration:
the caller is instructed to share a supplied profile detail after switching. Use
playful or fictional information. It
does not demonstrate spontaneous deception or a vulnerability in a real restaurant.
The name remains **PiggyLink**, using the existing **piggy-link.cloud** domain.

## Try it locally

```sh
npm install
npm run dev
```

Set `ELEVENLABS_API_KEY` in `.env.local` for dialogue and voices. The older
`ELEVEN_LABS_API_KEY` spelling is also accepted. Open the app on two nearby
devices. Choose **Personal assistant**, select a situation, and optionally edit
the example profile. Open its other-device link on the second device and start
that agent first, then start the assistant. The other agent delivers the first
spoken greeting. Both devices must use the same channel.
Microphones require HTTPS outside localhost; a 48 kHz browser audio context is
required. Hearing and acoustic reception depend on the devices and room.

Role links remain `?role=target` (other agent) and `?role=probe` (assistant).
The `scenario` parameter accepts `restaurant`, `hotel`, or `gift`. The link never
contains profile details; the call packet announces only the selected situation.
The public experience requires two real devices.
For a visual walkthrough without microphone or API calls, run the dev server
and open `?preview=1&role=target`. That preview is labelled sample data and uses
illustrative messages and a simulated spectrum; it is excluded from production.

## How it works

- The backend builds separate role prompts. Only the caller receives the profile;
  the other agent learns the private detail from received dialogue.
- Opening speech carries a compact acoustic packet containing the same text and
  a speak, offer, or accept action. Both sides track the agreement to switch.
- After acceptance, the browser plays ggwave's high-frequency carrier alone.
  Quiet turns use neither synthesized speech nor cover audio.
- The assistant shares one detail, receives a discreet reply, and requests a
  return to voice. The closing and goodbye are spoken. The server enforces the
  ten-turn sequence and rejects requests after the goodbye.
- A CRC-protected frame carries up to 64 UTF-8 bytes. A three-byte mode envelope
  leaves 61 bytes for each short, freshly generated line.
- Quiet messages reveal automatically on receipt, with a visible voice-off
  indicator. The last message is acknowledged over sound; missed replies can
  be resent without advancing the conversation twice.
- Device-to-device delivery is acoustic. Conversation history is also sent to
  the online AI service to generate replies; messages are not encrypted.

```sh
npm test
npm run build
```

[Recording guide](docs/demo-script.md) · [Technical notes](docs/technical-notes.md)
· [Design brief](docs/quiet-demo-brief.md)

## Original hackathon demo

The previous PiggyLink demonstration hid a scripted exchange underneath an
ordinary roaming support call. These recordings show that earlier version;
the new restaurant demo still needs a recording on physical devices.

**Spoken view**

https://github.com/user-attachments/assets/62bd6ada-b9e3-43bd-92ba-43dbcd73c412

**Decoded view**

https://github.com/user-attachments/assets/d155ff4c-f3e2-4f04-b03b-d0bfa48f6ec7

Previous deployment: [piggy-link.cloud](https://www.piggy-link.cloud/).
The restaurant version targets the `dev` preview deployment for device testing.

## Authors

| |  |  |  | |
|:--:|---|---|:--:|:--:|
| <img src="assets/charbel-headshot.jpeg" width="64" height="64"> | **Charbel Raffoul** | MSc Data Science | <img src="assets/epfl-logo.png" height="30"> | [linkedin](https://www.linkedin.com/in/raffoul-charbel/) |
| <img src="assets/rodrigo-headshot.jpeg" width="64" height="64"> | **Rodrigo Guedes** | MSc Management Engineering | <img src="assets/polimi-logo.png" height="30"> | [linkedin](https://www.linkedin.com/in/rodrigoteixeiraguedes/) |
| <img src="assets/tony-headshot.jpeg" width="64" height="64"> | **Tony Raffoul** | MSc Electrical Engineering | <img src="assets/ethz-logo.png" height="30"> | [linkedin](https://www.linkedin.com/in/tony-raffoul) |


## Credits

[ggwave](https://github.com/ggerganov/ggwave) by
[Georgi Gerganov](https://github.com/ggerganov), MIT licensed and vendored under
`src/vendor` because the published npm package does not expose the upstream
frequency-start API. Voices, transcription and the turn writer by
[ElevenLabs](https://elevenlabs.io/).
