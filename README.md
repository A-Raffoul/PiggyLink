# CrossTalk

CrossTalk runs a live, unscripted conversation between two ElevenLabs agents in separate browsers. Each window:

1. hears the other voice through its microphone;
2. decodes that audio with ElevenLabs Scribe v2;
3. sends the decoded text to its own ElevenLabs Agent;
4. receives a newly generated reply;
5. speaks the reply with its assigned ElevenLabs voice.

Rachel and Drew remain the default text-to-speech voices:

- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Drew: `29vD33N1CtxCmqQRPOHJ`

The setup screen now accepts a conversation brief and a total turn limit instead of a fixed script.

## Configure ElevenLabs Agents

Create two agents in the ElevenLabs dashboard, one for each personality. Configure both agents as text-only and leave their automatic first message empty; CrossTalk generates the opening turn itself. Keep replies concise in each agent's system prompt because the TTS endpoint accepts at most 500 characters per turn.

Example personality prompts:

- **Agent A / Rachel:** “You are Rachel, a curious optimist. Make clear, lively arguments and ask focused questions. Keep each response to one or two short sentences.”
- **Agent B / Drew:** “You are Drew, a thoughtful skeptic. Challenge assumptions constructively and use concrete examples. Keep each response to one or two short sentences.”

## Configure Vercel

Add these server-side environment variables in Vercel Project Settings:

```sh
ELEVENLABS_API_KEY=your_key
ELEVENLABS_AGENT_A_ID=your_rachel_agent_id
ELEVENLABS_AGENT_B_ID=your_drew_agent_id
```

You can instead set `ELEVENLABS_AGENT_ID` to use one agent configuration for both browser roles. Separate IDs produce more distinct personalities.

Do not prefix the key with `VITE_`; Vite variables are exposed to the browser. The API key is read only by the Vercel functions. The browser receives a short-lived signed WebSocket URL, never the key.

The two built-in voice IDs are allowed automatically. To use other voices, add their IDs as `ELEVENLABS_VOICE_A_ID` and `ELEVENLABS_VOICE_B_ID` in Vercel, then enter those same IDs on the setup screen.

## Run

```sh
npm install
npx vercel dev
```

The regular Vite server renders the interface but does not emulate the Vercel functions, so use `vercel dev` for live ElevenLabs calls.

## Conversation flow

1. Enter a shared conversation brief, names, voice IDs, and a turn limit.
2. Open the two role links in separate browsers or devices within earshot.
3. Prepare Speaker B first and allow microphone access. It begins listening.
4. Prepare Speaker A, then press **Start conversation**.
5. Agent A generates and speaks an opening line.
6. Speaker B records and decodes it, sends the text to Agent B, and speaks Agent B's generated reply.
7. The acoustic handoff repeats until the selected turn limit is reached.

Use speakers rather than headphones. A quiet room and moderate playback volume give the sound detector the clearest handoffs. The microphone meter should visibly move while the other browser is speaking.

## API behavior and privacy

The Vercel functions use:

- ElevenLabs Agents signed WebSocket sessions for dynamic text generation;
- `scribe_v2` for speech-to-text;
- `eleven_flash_v2_5` for text-to-speech.

They keep `ELEVENLABS_API_KEY` on the server, allow only configured voice IDs, cap TTS lines at 500 characters, and accept microphone segments up to 8 MB.

Peer recordings and generated conversation text are sent to ElevenLabs. Review the retention settings that apply to your account before using sensitive dialogue. For a public production deployment, add account-level usage limits or rate limiting to protect Agent, TTS, and transcription credits.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The earlier acoustic-modem modules remain under `src/audio`, `src/core`, `src/modem`, and `src/vendor`, but they are not imported by CrossTalk.
