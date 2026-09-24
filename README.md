# CrossTalk

CrossTalk performs a known conversation with two ElevenLabs text-to-speech voices. It opens one browser for Speaker A and one for Speaker B, generates only that speaker's lines in each browser, and coordinates turns acoustically: each microphone detects the other voice and hands off after the line ends.

Rachel and Drew are preconfigured as the default voices:

- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Drew: `29vD33N1CtxCmqQRPOHJ`

No agent IDs, speech recognition, or LLM-generated replies are involved. Microphones are used only for local sound-and-silence detection; recorded audio is not uploaded.

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
2. Open the two role links in separate browsers or devices and place their speakers and microphones within earshot.
3. Prepare the non-opening speaker first and allow microphone access. It will begin listening.
4. Prepare the opening speaker, then press **Start conversation**.
5. Each browser detects the expected peer line and 850 ms of trailing silence, then plays its own next line. Both browsers display the known text as it is heard or played.

Use speakers rather than headphones. A quiet room and moderate playback volume give the sound detector the clearest handoffs. The microphone meter should visibly move while the other browser is speaking.

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
