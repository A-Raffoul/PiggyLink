# CrossTalk

CrossTalk performs a known conversation with two ElevenLabs text-to-speech voices. It opens one browser window for Speaker A and one for Speaker B, generates only that speaker's lines in each window, and coordinates the turns with a same-origin browser channel.

Rachel and Drew are preconfigured as the default voices:

- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Drew: `29vD33N1CtxCmqQRPOHJ`

No agent IDs, microphones, speech recognition, or LLM-generated replies are involved.

## Configure Vercel

Add the following server-side environment variable in Vercel Project Settings:

```sh
ELEVENLABS_API_KEY=your_key
```

Do not prefix the key with `VITE_`; Vite variables are exposed to the browser. The key is read only by `/api/speech`.

The two built-in voice IDs are allowed automatically. To use other voices, add their IDs as `ELEVENLABS_VOICE_A_ID` and `ELEVENLABS_VOICE_B_ID` in Vercel, then enter those same IDs on the setup screen. This allowlist prevents the public endpoint from being used with arbitrary voice IDs.

## Run

```sh
npm install
npm run dev
```

The regular Vite server renders the interface, but it does not emulate the Vercel function. Use `vercel dev` when testing real speech generation locally:

```sh
npx vercel dev
```

## Performance flow

1. Enter or keep the two voice IDs and edit the known script.
2. Open both role links in two windows of the same browser.
3. Click **Prepare** in each window. Each window generates only its speaker's audio.
4. Once both are ready, the first speaker starts automatically.
5. Every completed audio clip signals the other window to play the next turn. Both windows display the same live transcript.

The two windows must share a browser storage partition for `BroadcastChannel` coordination. Two windows or tabs in the same browser work; unrelated browser applications or devices need a network-backed room service.

## API behavior

The Vercel function calls ElevenLabs' synchronous text-to-speech endpoint with `eleven_flash_v2_5`. It:

- keeps `ELEVENLABS_API_KEY` on the server;
- accepts only the built-in voices and optional environment-configured voices;
- limits each line to 500 characters;
- returns generated MP3 audio without browser or CDN caching.

For a public production deployment, add account-level usage limits or Vercel rate limiting to further protect ElevenLabs credits.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The earlier acoustic-modem modules remain under `src/audio`, `src/core`, `src/modem`, and `src/vendor`, but they are not imported by CrossTalk.
