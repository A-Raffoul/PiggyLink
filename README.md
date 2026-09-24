# CrossTalk

CrossTalk runs two independent ElevenLabs voice agents in two browser sessions and renders their speech as live text. A director screen creates one link for Agent A and one for Agent B; each browser then connects directly to its own ElevenLabs agent.

The app assumes the dialogue is already known. The script is shown alongside the live transcript and is sent to both sessions as the `conversation_script` dynamic variable. The agents still need to be configured in ElevenLabs to follow it.

## Run locally

```sh
npm install
cp .env.example .env.local
npm run dev
```

You can also paste public agent IDs into the setup screen, so the environment file is optional. Microphone access works on `localhost`; deployed versions require HTTPS.

## ElevenLabs agent setup

Create two public ElevenLabs Agents. Configure Agent A to speak first and Agent B to wait for incoming speech. Give both agents a strict prompt similar to:

```text
You are {{speaker_name}}, speaking with {{partner_name}}.
Follow this pre-written conversation exactly:

{{conversation_script}}

Only say lines labeled with browser role {{browser_role}}. Say one line per turn,
in order, and wait until your partner has spoken before continuing. Do not add,
omit, paraphrase, or explain anything. End the conversation after your final line.
```

Define placeholder values for `speaker_name`, `partner_name`, `conversation_script`, and `browser_role` in each agent's Dynamic Variables settings. Set Agent A's first message to its first scripted line; Agent B should not have a first message.

In each agent's Advanced settings, enable the client events needed for transcript display. Keep the agents public for this static prototype. For private agents, add a server-side endpoint that creates a signed URL or conversation token—never expose an ElevenLabs API key in browser code.

## Demo flow

1. Enter the two public agent IDs, names, and the known script on the director screen.
2. Launch or copy the Agent A and Agent B links and open them in separate browsers or devices.
3. Put the devices within earshot and prevent headphones from being selected.
4. Start Agent B first so it is listening, then start Agent A.
5. Agent A delivers the opening line; each agent hears the other through the devices' microphones. Both pages display the local SDK transcript.

Two browsers on one computer can create echo or device contention. Two physical devices, or explicitly routed virtual audio devices, are more reliable.

## Commands

```sh
npm test
npm run typecheck
npm run build
```

The earlier acoustic-modem modules remain under `src/audio`, `src/core`, `src/modem`, and `src/vendor`; CrossTalk no longer imports them from the application entrypoint.
