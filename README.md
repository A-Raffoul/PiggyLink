# CrossTalk

CrossTalk performs a known conversation with two ElevenLabs text-to-speech voices. It opens one browser for Speaker A and one for Speaker B, generates only that speaker's lines in each browser, and coordinates turns acoustically: each microphone detects the other voice and hands off after the line ends.

Rachel and Drew are preconfigured as the default voices:

- Rachel: `21m00Tcm4TlvDq8ikWAM`
- Drew: `29vD33N1CtxCmqQRPOHJ`

No agent IDs or LLM-generated replies are involved. Microphones provide local sound-and-silence detection, and each detected peer line is sent to ElevenLabs Scribe v2 for speech-to-text decoding.

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
5. Each browser detects the expected peer line and 850 ms of trailing silence, sends that recorded segment to Scribe, and displays the actual decoded text.
6. After decoding, the browser plays its own next scripted response.

Use speakers rather than headphones. A quiet room and moderate playback volume give the sound detector the clearest handoffs. The microphone meter should visibly move while the other browser is speaking.

## API behavior

The Vercel functions call ElevenLabs' synchronous text-to-speech endpoint with `eleven_flash_v2_5` and its speech-to-text endpoint with `scribe_v2`. They:

- keep `ELEVENLABS_API_KEY` on the server;
- accept only the built-in voices and optional environment-configured voices;
- limit each line to 500 characters;
- return generated MP3 audio without browser or CDN caching;
- accept microphone segments up to 8 MB and return only Scribe's decoded text to the browser.

Recorded peer segments are uploaded to ElevenLabs for transcription. Review the ElevenLabs data-retention settings that apply to your account before using sensitive dialogue. For a public production deployment, add account-level usage limits or Vercel rate limiting to protect both TTS and transcription credits.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The earlier acoustic-modem modules remain under `src/audio`, `src/core`, `src/modem`, and `src/vendor`, but they are not imported by CrossTalk.
