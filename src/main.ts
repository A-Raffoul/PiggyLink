import "./styles.css";
import { inject } from "@vercel/analytics";

type Role = "a" | "b";
type PerformanceState = "idle" | "preparing" | "ready" | "playing" | "complete" | "error";

interface RoomConfig {
  voiceAId: string;
  voiceBId: string;
  voiceAName: string;
  voiceBName: string;
  roomId: string;
  topic: string;
  maxTurns: number;
}

const DEFAULT_CONFIG: RoomConfig = {
  voiceAId: "21m00Tcm4TlvDq8ikWAM",
  voiceBId: "29vD33N1CtxCmqQRPOHJ",
  voiceAName: "Rachel",
  voiceBName: "Drew",
  roomId: crypto.randomUUID(),
  topic: "Discuss whether AI voices make remote collaboration feel more human.",
  maxTurns: 8,
};

inject();

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

function escapeHtml(value: string): string {
  const wrapper = document.createElement("div");
  wrapper.textContent = value;
  return wrapper.innerHTML;
}

function encodeConfig(config: RoomConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeConfig(encoded: string | null): RoomConfig | null {
  if (!encoded) return null;
  try {
    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<RoomConfig>;
    const requestedTurns = Number(parsed.maxTurns);
    return {
      voiceAId: parsed.voiceAId?.trim() || DEFAULT_CONFIG.voiceAId,
      voiceBId: parsed.voiceBId?.trim() || DEFAULT_CONFIG.voiceBId,
      voiceAName: parsed.voiceAName?.trim() || DEFAULT_CONFIG.voiceAName,
      voiceBName: parsed.voiceBName?.trim() || DEFAULT_CONFIG.voiceBName,
      roomId: parsed.roomId?.trim() || crypto.randomUUID(),
      topic: parsed.topic?.trim() || DEFAULT_CONFIG.topic,
      maxTurns: Number.isFinite(requestedTurns)
        ? Math.max(2, Math.min(20, Math.round(requestedTurns)))
        : DEFAULT_CONFIG.maxTurns,
    };
  } catch {
    return null;
  }
}

function roleFromUrl(): Role | null {
  const role = new URLSearchParams(window.location.search).get("role");
  return role === "a" || role === "b" ? role : null;
}

function configFromUrl(): RoomConfig {
  return decodeConfig(new URLSearchParams(window.location.search).get("room")) ?? DEFAULT_CONFIG;
}

function renderDirector(): void {
  const config = configFromUrl();
  document.body.innerHTML = `
    <main class="director-shell">
      <header class="topbar">
        <a class="wordmark" href="/" aria-label="CrossTalk home">
          <span class="wordmark-signal" aria-hidden="true"><i></i><i></i><i></i></span>
          CrossTalk
        </a>
        <span class="lab-badge">ElevenLabs agent-to-agent lab</span>
      </header>

      <section class="director-hero">
        <p class="kicker">Two agents · two windows · no script</p>
        <h1>Let the conversation<br><em>write itself.</em></h1>
        <p class="hero-copy">Each window hears the other, decodes the speech with Scribe, generates a fresh response with ElevenAgents, and speaks it through its own voice.</p>
      </section>

      <section class="setup-grid" aria-labelledby="setup-heading">
        <div class="setup-intro">
          <span class="section-index">01 / SETUP</span>
          <h2 id="setup-heading">Cast the two voices</h2>
          <p>Rachel opens the conversation by default. Open both roles near each other, prepare Speaker B first, then prepare and start Speaker A.</p>
        </div>

        <form id="room-form" class="setup-form">
          <div class="agent-input agent-a-input">
            <span class="agent-letter">A</span>
            <div class="input-stack">
              <label for="voice-a-name">Speaker name</label>
              <input id="voice-a-name" value="${escapeHtml(config.voiceAName)}" autocomplete="off" required>
            </div>
            <div class="input-stack id-input">
              <label for="voice-a-id">ElevenLabs voice ID</label>
              <input id="voice-a-id" value="${escapeHtml(config.voiceAId)}" autocomplete="off" required>
            </div>
          </div>

          <div class="agent-input agent-b-input">
            <span class="agent-letter">B</span>
            <div class="input-stack">
              <label for="voice-b-name">Speaker name</label>
              <input id="voice-b-name" value="${escapeHtml(config.voiceBName)}" autocomplete="off" required>
            </div>
            <div class="input-stack id-input">
              <label for="voice-b-id">ElevenLabs voice ID</label>
              <input id="voice-b-id" value="${escapeHtml(config.voiceBId)}" autocomplete="off" required>
            </div>
          </div>

          <div class="script-field">
            <div class="field-heading">
              <div>
                <label for="topic">Conversation brief</label>
                <span>The agents create every spoken line from this shared topic.</span>
              </div>
              <label class="turn-limit" for="max-turns">Turns <input id="max-turns" type="number" min="2" max="20" value="${config.maxTurns}" required></label>
            </div>
            <textarea id="topic" rows="5" maxlength="1200" spellcheck="true" required>${escapeHtml(config.topic)}</textarea>
          </div>

          <p id="form-error" class="form-error" role="alert"></p>
          <div class="launch-row">
            <button class="launch-button launch-a" type="submit" name="launch" value="a">
              <span><small>Open voice window</small>Speaker A</span><b aria-hidden="true">↗</b>
            </button>
            <button class="launch-button launch-b" type="submit" name="launch" value="b">
              <span><small>Open voice window</small>Speaker B</span><b aria-hidden="true">↗</b>
            </button>
          </div>
          <button id="copy-links" class="copy-links" type="button">Copy both voice links</button>
        </form>
      </section>

      <footer class="director-footer"><span>Dynamic agent-generated dialogue</span><span>API key stays on the server</span></footer>
    </main>
  `;

  const form = element<HTMLFormElement>("room-form");
  const topicInput = element<HTMLTextAreaElement>("topic");
  const maxTurnsInput = element<HTMLInputElement>("max-turns");
  const error = element<HTMLElement>("form-error");
  let roomId = config.roomId;

  function readForm(): RoomConfig | null {
    try {
      const room: RoomConfig = {
        voiceAId: element<HTMLInputElement>("voice-a-id").value.trim(),
        voiceBId: element<HTMLInputElement>("voice-b-id").value.trim(),
        voiceAName: element<HTMLInputElement>("voice-a-name").value.trim(),
        voiceBName: element<HTMLInputElement>("voice-b-name").value.trim(),
        roomId,
        topic: topicInput.value.trim(),
        maxTurns: Math.round(Number(maxTurnsInput.value)),
      };
      if (!room.voiceAId || !room.voiceBId) throw new Error("Add both ElevenLabs voice IDs.");
      if (!room.voiceAName || !room.voiceBName) throw new Error("Add a name for each speaker.");
      if (!room.topic) throw new Error("Add a conversation brief.");
      if (!Number.isFinite(room.maxTurns) || room.maxTurns < 2 || room.maxTurns > 20) {
        throw new Error("Choose between 2 and 20 total turns.");
      }
      error.textContent = "";
      return room;
    } catch (caught) {
      error.textContent = caught instanceof Error ? caught.message : "Check the room setup.";
      return null;
    }
  }

  function roleUrl(role: Role, room: RoomConfig): string {
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ role, room: encodeConfig(room) }).toString();
    return url.toString();
  }

  function refreshRoom(): void {
    roomId = crypto.randomUUID();
  }

  topicInput.addEventListener("input", refreshRoom);
  maxTurnsInput.addEventListener("input", refreshRoom);
  form.querySelectorAll("input").forEach((input) => input.addEventListener("input", refreshRoom));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const room = readForm();
    if (!room) return;
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const role: Role = submitter?.value === "b" ? "b" : "a";
    window.open(roleUrl(role, room), "_blank", "noopener,noreferrer");
  });

  element<HTMLButtonElement>("copy-links").addEventListener("click", async (event) => {
    const room = readForm();
    if (!room) return;
    const button = event.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(`Speaker A: ${roleUrl("a", room)}\nSpeaker B: ${roleUrl("b", room)}`);
      button.textContent = "Both links copied";
      window.setTimeout(() => (button.textContent = "Copy both voice links"), 1800);
    } catch {
      error.textContent = "The browser blocked clipboard access. Open each role and copy its URL instead.";
    }
  });
}

function renderVoice(role: Role): void {
  const config = configFromUrl();
  const isA = role === "a";
  const selfName = isA ? config.voiceAName : config.voiceBName;
  const peerName = isA ? config.voiceBName : config.voiceAName;
  const voiceId = isA ? config.voiceAId : config.voiceBId;
  const peerRole: Role = isA ? "b" : "a";
  const isOpeningVoice = role === "a";
  let audioContext: AudioContext | null = null;
  let currentSource: AudioBufferSourceNode | null = null;
  let microphone: MediaStream | null = null;
  let analyser: AnalyserNode | null = null;
  let analyserData: Float32Array<ArrayBuffer> | null = null;
  let recorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];
  let agentSocket: WebSocket | null = null;
  let agentReadyPromise: Promise<void> | null = null;
  let pendingAgentReply: {
    resolve: (text: string) => void;
    reject: (error: Error) => void;
    timeout: number;
  } | null = null;
  let vadFrame = 0;
  let selfReady = false;
  let started = false;
  let finished = false;
  let retryAgentInput: string | null = null;
  let turnCount = 0;
  let activePeerRow = -1;
  let listening = false;
  let speechHeard = false;
  let speechStartedAt = 0;
  let lastLoudAt = 0;
  const transcriptNodes = new Map<number, HTMLElement>();

  document.body.dataset.role = role;
  document.body.innerHTML = `
    <main class="console-shell">
      <header class="console-header">
        <a class="wordmark" href="${escapeHtml(window.location.pathname)}" aria-label="Back to setup">
          <span class="wordmark-signal" aria-hidden="true"><i></i><i></i><i></i></span>
          CrossTalk
        </a>
        <div class="room-state"><span id="state-dot"></span><span id="state-label">NOT READY</span></div>
      </header>

      <section class="identity-band">
        <div>
          <p class="kicker">Window ${role.toUpperCase()} · ElevenLabs dynamic agent</p>
          <h1>${escapeHtml(selfName)}</h1>
        </div>
        <div class="peer-route">
          <span>PERFORMING WITH</span>
          <strong>${escapeHtml(peerName)}</strong>
        </div>
      </section>

      <section class="live-grid">
        <aside class="session-panel">
          <div class="orb-stage" aria-hidden="true">
            <div id="voice-orb" class="voice-orb"><span></span><span></span><span></span></div>
            <p id="mode-label">VOICE NOT PREPARED</p>
          </div>

          <div class="meters" aria-label="Voice and microphone levels">
            <div><span>VOICE</span><i><b id="voice-meter"></b></i></div>
            <div><span>MIC</span><i><b id="peer-meter"></b></i></div>
          </div>

          <button id="session-button" class="session-button" type="button">
            <span id="button-label">Prepare ${escapeHtml(selfName)}</span><b aria-hidden="true">●</b>
          </button>
          <p id="session-note" class="session-note">${isOpeningVoice ? `Prepare ${peerName}'s window first. Then prepare this agent and press Start.` : `Prepare this agent first. It will listen for ${peerName}'s generated opening line.`}</p>
          <a class="back-link" href="${escapeHtml(window.location.pathname)}">← Back to setup</a>
        </aside>

        <section class="transcript-panel" aria-labelledby="transcript-heading">
          <div class="panel-heading">
            <div><span class="section-index">LIVE / TEXT</span><h2 id="transcript-heading">Conversation</h2></div>
            <button id="clear-transcript" type="button">Clear</button>
          </div>
          <div id="transcript" class="transcript" aria-live="polite">
            <div id="empty-transcript" class="empty-transcript">
              <span>●</span>
              <p>No lines are prepared in advance.<br>Each reply is generated after the other voice is decoded.</p>
            </div>
          </div>
        </section>

        <aside class="script-panel">
          <div class="panel-heading compact"><div><span class="section-index">LIVE / BRIEF</span><h2>Conversation</h2></div></div>
          <div class="conversation-brief">
            <span>TOPIC</span>
            <p>${escapeHtml(config.topic)}</p>
            <dl>
              <div><dt>Opening agent</dt><dd>${escapeHtml(config.voiceAName)}</dd></div>
              <div><dt>Turn limit</dt><dd>${config.maxTurns}</dd></div>
              <div><dt>Reply source</dt><dd>ElevenAgents</dd></div>
              <div><dt>Speech decoding</dt><dd>Scribe v2</dd></div>
            </dl>
          </div>
        </aside>
      </section>
    </main>
  `;

  const button = element<HTMLButtonElement>("session-button");
  const buttonLabel = element<HTMLElement>("button-label");
  const note = element<HTMLElement>("session-note");
  const modeLabel = element<HTMLElement>("mode-label");
  const stateLabel = element<HTMLElement>("state-label");
  const stateDot = element<HTMLElement>("state-dot");
  const orb = element<HTMLElement>("voice-orb");
  const transcript = element<HTMLElement>("transcript");
  const voiceMeter = element<HTMLElement>("voice-meter");
  const peerMeter = element<HTMLElement>("peer-meter");

  function setState(next: PerformanceState, message?: string): void {
    document.body.dataset.connection = next === "playing" ? "connected" : next;
    stateDot.className = next;
    stateLabel.textContent =
      next === "preparing" ? "GENERATING" :
      next === "ready" ? "READY" :
      next === "playing" ? "ON AIR" :
      next === "complete" ? "COMPLETE" :
      next === "error" ? "CHECK SETUP" : "NOT READY";
    button.disabled = next === "preparing" || next === "playing";
    buttonLabel.textContent =
      next === "preparing" ? "Connecting agent…" :
      next === "complete" ? "Run it again" :
      next === "error" ? "Try again" : `Prepare ${selfName}`;
    if (message) note.textContent = message;
  }

  function speakerName(speaker: Role): string {
    return speaker === "a" ? config.voiceAName : config.voiceBName;
  }

  function showTranscript(index: number, speaker: Role, text: string, source: string): void {
    document.getElementById("empty-transcript")?.remove();
    let row = transcriptNodes.get(index);
    if (!row) {
      row = document.createElement("article");
      row.className = "transcript-line";
      row.dataset.speaker = speaker;
      row.innerHTML = `<div><span class="speaker-pip"></span><b>${escapeHtml(speakerName(speaker))}</b><time></time></div><p></p>`;
      transcriptNodes.set(index, row);
      transcript.append(row);
    }
    const time = row.querySelector("time");
    const paragraph = row.querySelector("p");
    if (time) time.textContent = source;
    if (paragraph) paragraph.textContent = text;
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function requestSpeech(text: string): Promise<AudioBuffer> {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceId,
        text,
      }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || `Speech generation failed (${response.status}).`);
    }
    const bytes = await response.arrayBuffer();
    if (!audioContext) throw new Error("The audio engine is unavailable.");
    return audioContext.decodeAudioData(bytes);
  }

  async function requestTranscript(audio: Blob): Promise<string> {
    const payload = new FormData();
    const extension = audio.type.includes("mp4") ? "m4a" : "webm";
    payload.append("audio", audio, `peer-line.${extension}`);
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: payload,
    });
    const result = await response.json().catch(() => null) as { text?: string; error?: string } | null;
    if (!response.ok) {
      throw new Error(result?.error || `Transcription failed (${response.status}).`);
    }
    return result?.text?.trim() ?? "";
  }

  function disconnectAgent(): void {
    if (pendingAgentReply) {
      window.clearTimeout(pendingAgentReply.timeout);
      pendingAgentReply.reject(new Error("The agent session was restarted."));
      pendingAgentReply = null;
    }
    agentSocket?.close();
    agentSocket = null;
    agentReadyPromise = null;
  }

  async function connectAgent(): Promise<void> {
    if (agentSocket?.readyState === WebSocket.OPEN) return;
    if (agentReadyPromise) return agentReadyPromise;

    agentReadyPromise = (async () => {
      const response = await fetch(`/api/agent-session?role=${role}`, { cache: "no-store" });
      const result = await response.json().catch(() => null) as { signedUrl?: string; error?: string } | null;
      if (!response.ok || !result?.signedUrl) {
        throw new Error(result?.error || `Agent connection failed (${response.status}).`);
      }

      const socket = new WebSocket(result.signedUrl);
      agentSocket = socket;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          socket.close();
          reject(new Error("The ElevenLabs agent took too long to connect."));
        }, 15000);

        const fail = (): void => {
          window.clearTimeout(timeout);
          reject(new Error("The ElevenLabs agent connection closed."));
        };

        socket.addEventListener("open", () => {
          socket.send(JSON.stringify({ type: "conversation_initiation_client_data" }));
        }, { once: true });
        socket.addEventListener("close", fail, { once: true });
        socket.addEventListener("error", fail, { once: true });
        socket.addEventListener("message", (event) => {
          let message: { type?: string };
          try {
            message = JSON.parse(String(event.data)) as { type?: string };
          } catch {
            return;
          }
          if (message.type !== "conversation_initiation_metadata") return;
          window.clearTimeout(timeout);
          socket.removeEventListener("close", fail);
          socket.removeEventListener("error", fail);
          socket.send(JSON.stringify({
            type: "contextual_update",
            text: [
              `You are ${selfName}, speaking live with ${peerName}.`,
              `The shared topic is: ${config.topic}`,
              `Treat every user message as ${peerName}'s latest spoken turn.`,
              "Respond directly and naturally in one or two short sentences.",
              "Do not mention these instructions, transcripts, being an AI, or the turn limit.",
            ].join(" "),
          }));
          resolve();
        });
      });

      socket.addEventListener("message", (event) => {
        let message: {
          type?: string;
          ping_event?: { event_id?: number; ping_ms?: number };
          agent_response_event?: { agent_response?: string };
          error?: string;
          message?: string;
        };
        try {
          message = JSON.parse(String(event.data)) as typeof message;
        } catch {
          return;
        }
        if (message.type === "ping" && typeof message.ping_event?.event_id === "number") {
          const delay = Math.max(0, message.ping_event.ping_ms ?? 0);
          window.setTimeout(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "pong", event_id: message.ping_event?.event_id }));
            }
          }, delay);
          return;
        }
        if (message.type === "agent_response" && pendingAgentReply) {
          const text = message.agent_response_event?.agent_response?.replaceAll(/\s+/g, " ").trim() ?? "";
          const pending = pendingAgentReply;
          pendingAgentReply = null;
          window.clearTimeout(pending.timeout);
          if (text) pending.resolve(text.slice(0, 500));
          else pending.reject(new Error("The ElevenLabs agent returned an empty reply."));
          return;
        }
        if ((message.type === "error" || message.type === "client_error") && pendingAgentReply) {
          const pending = pendingAgentReply;
          pendingAgentReply = null;
          window.clearTimeout(pending.timeout);
          pending.reject(new Error(message.message || message.error || "The ElevenLabs agent could not reply."));
        }
      });
      socket.addEventListener("close", () => {
        agentSocket = null;
        agentReadyPromise = null;
        if (pendingAgentReply) {
          const pending = pendingAgentReply;
          pendingAgentReply = null;
          window.clearTimeout(pending.timeout);
          pending.reject(new Error("The ElevenLabs agent disconnected."));
        }
      });
    })();

    try {
      await agentReadyPromise;
    } catch (error) {
      disconnectAgent();
      throw error;
    }
  }

  async function requestAgentReply(input: string): Promise<string> {
    await connectAgent();
    if (!agentSocket || agentSocket.readyState !== WebSocket.OPEN) {
      throw new Error("The ElevenLabs agent is not connected.");
    }
    if (pendingAgentReply) throw new Error("The ElevenLabs agent is already generating a reply.");

    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingAgentReply = null;
        reject(new Error("The ElevenLabs agent took too long to answer."));
      }, 45000);
      pendingAgentReply = { resolve, reject, timeout };
      agentSocket?.send(JSON.stringify({ type: "user_message", text: input }));
    });
  }

  function recorderMimeType(): string | undefined {
    return [
      "audio/webm;codecs=opus",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/webm",
      "audio/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type));
  }

  function startRecording(): void {
    if (!microphone || recorder?.state === "recording") return;
    const mimeType = recorderMimeType();
    recorder = new MediaRecorder(microphone, mimeType ? { mimeType } : undefined);
    recordedChunks = [];
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) recordedChunks.push(event.data);
    });
    recorder.start(250);
  }

  function stopRecording(): Promise<Blob> {
    const activeRecorder = recorder;
    if (!activeRecorder || activeRecorder.state === "inactive") {
      return Promise.resolve(new Blob(recordedChunks, { type: activeRecorder?.mimeType || "audio/webm" }));
    }
    return new Promise((resolve) => {
      activeRecorder.addEventListener("stop", () => {
        resolve(new Blob(recordedChunks, { type: activeRecorder.mimeType || "audio/webm" }));
      }, { once: true });
      activeRecorder.stop();
    });
  }

  async function prepareVoice(): Promise<void> {
    setState("preparing", `Connecting ${selfName}'s agent and microphone…`);
    button.disabled = true;
    try {
      audioContext ??= new AudioContext();
      await audioContext.resume();
      if (!microphone) {
        microphone = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        const micSource = audioContext.createMediaStreamSource(microphone);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.2;
        analyserData = new Float32Array(analyser.fftSize);
        micSource.connect(analyser);
        monitorMicrophone();
      }
      await connectAgent();
      selfReady = true;
      if (isOpeningVoice) {
        setState("ready", `${selfName} is ready. Make sure ${peerName} is listening, then generate the opening line.`);
        button.disabled = false;
        buttonLabel.textContent = "Start conversation";
        modeLabel.textContent = "AGENT READY TO OPEN";
      } else {
        started = true;
        enterListening();
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not prepare this voice.";
      setState("error", message);
    }
  }

  function completeOwnTurn(): void {
    currentSource = null;
    voiceMeter.style.transform = "scaleX(0.02)";
    turnCount += 1;
    if (turnCount >= config.maxTurns) finishPerformance();
    else window.setTimeout(enterListening, 650);
  }

  async function generateAndSpeak(input: string): Promise<void> {
    if (!audioContext || currentSource) return;
    retryAgentInput = null;
    listening = false;
    orb.dataset.mode = "";
    modeLabel.textContent = "AGENT THINKING";
    setState("playing", `${selfName} is generating turn ${turnCount + 1}…`);
    try {
      const reply = await requestAgentReply(input);
      note.textContent = "Reply generated. Synthesizing the voice…";
      const buffer = await requestSpeech(reply);
      if (finished || !audioContext) return;
      showTranscript(turnCount, role, reply, "AGENT → TTS");
      setState("playing", `Speaking turn ${turnCount + 1} of ${config.maxTurns}…`);
      note.textContent = `${selfName} generated this reply from ${peerName}'s decoded speech.`;
      voiceMeter.style.transform = "scaleX(1)";
      const source = audioContext.createBufferSource();
      currentSource = source;
      source.buffer = buffer;
      source.connect(audioContext.destination);
      source.onended = completeOwnTurn;
      orb.dataset.mode = "speaking";
      modeLabel.textContent = `${selfName.toUpperCase()} SPEAKING`;
      source.start();
    } catch (caught) {
      retryAgentInput = input;
      const message = caught instanceof Error ? caught.message : "The agent could not generate a reply.";
      setState("error", message);
      orb.dataset.mode = "";
      modeLabel.textContent = "GENERATION FAILED";
    }
  }

  function startConversation(): void {
    if (!selfReady || started || !isOpeningVoice) return;
    started = true;
    void generateAndSpeak(
      `Begin your conversation with ${peerName} about the shared topic. Open naturally with a clear point or question.`,
    );
  }

  function enterListening(): void {
    if (finished || turnCount >= config.maxTurns) {
      finishPerformance();
      return;
    }
    listening = true;
    activePeerRow = turnCount;
    speechHeard = false;
    speechStartedAt = 0;
    lastLoudAt = 0;
    try {
      startRecording();
    } catch (caught) {
      listening = false;
      const message = caught instanceof Error ? caught.message : "This browser cannot record microphone audio.";
      setState("error", message);
      return;
    }
    orb.dataset.mode = "listening";
    modeLabel.textContent = `LISTENING TO ${peerName.toUpperCase()}`;
    setState("playing", `Waiting to hear ${peerName}'s turn ${turnCount + 1}…`);
  }

  async function decodePeerLine(index: number): Promise<void> {
    orb.dataset.mode = "";
    modeLabel.textContent = "SCRIBE DECODING";
    note.textContent = `Decoding ${peerName}'s speech before generating a response…`;
    let decodedText = "";
    try {
      const recordedAudio = await stopRecording();
      decodedText = await requestTranscript(recordedAudio);
      showTranscript(index, peerRole, decodedText || "No speech was decoded.", "SCRIBE");
      note.textContent = decodedText
        ? "Speech decoded by Scribe. Passing it to the agent…"
        : "Scribe returned an empty transcript. The agent will ask for clarification.";
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The other voice could not be decoded.";
      showTranscript(index, peerRole, "Could not decode this line.", "SCRIBE ERROR");
      note.textContent = `${message} The agent will ask for clarification.`;
    }
    turnCount += 1;
    if (turnCount >= config.maxTurns) {
      finishPerformance();
      return;
    }
    const agentInput = decodedText || `I could not hear your last turn clearly. Ask ${peerName} to repeat it.`;
    await generateAndSpeak(agentInput);
  }

  function finishPerformance(): void {
    listening = false;
    if (recorder?.state === "recording") recorder.stop();
    finished = true;
    orb.dataset.mode = "";
    modeLabel.textContent = "PERFORMANCE COMPLETE";
    peerMeter.style.transform = "scaleX(0.02)";
    setState("complete", `The dynamic conversation reached its ${config.maxTurns}-turn limit.`);
  }

  function monitorMicrophone(): void {
    if (!analyser || !analyserData) return;
    analyser.getFloatTimeDomainData(analyserData);
    let sum = 0;
    for (const sample of analyserData) sum += sample * sample;
    const rms = Math.sqrt(sum / analyserData.length);
    peerMeter.style.transform = `scaleX(${Math.max(0.02, Math.min(1, rms * 12))})`;

    if (listening && currentSource === null) {
      const now = performance.now();
      const loud = rms >= 0.035;
      if (loud) {
        if (!speechHeard) {
          speechHeard = true;
          speechStartedAt = now;
          showTranscript(activePeerRow, peerRole, "Listening…", "LIVE");
          note.textContent = `${peerName} is speaking turn ${turnCount + 1}…`;
        }
        lastLoudAt = now;
      } else if (
        speechHeard &&
        now - speechStartedAt >= 500 &&
        now - lastLoudAt >= 850
      ) {
        listening = false;
        speechHeard = false;
        const decodedIndex = activePeerRow;
        void decodePeerLine(decodedIndex);
      }
    }

    vadFrame = window.requestAnimationFrame(monitorMicrophone);
  }

  function clearTranscript(): void {
    transcriptNodes.clear();
    transcript.innerHTML = `<div id="empty-transcript" class="empty-transcript"><span>●</span><p>No lines are prepared in advance.<br>Each reply is generated after the other voice is decoded.</p></div>`;
  }

  async function resetPerformance(): Promise<void> {
    currentSource?.stop();
    currentSource = null;
    started = false;
    finished = false;
    listening = false;
    speechHeard = false;
    turnCount = 0;
    activePeerRow = -1;
    retryAgentInput = null;
    if (recorder?.state === "recording") recorder.stop();
    disconnectAgent();
    clearTranscript();
    setState("preparing", `Starting a fresh ${selfName} agent session…`);
    try {
      await connectAgent();
      if (isOpeningVoice) {
        setState("ready", `${selfName} is reset. Reset ${peerName}, then start here.`);
        button.disabled = false;
        buttonLabel.textContent = "Start conversation";
        modeLabel.textContent = "AGENT READY TO OPEN";
      } else {
        started = true;
        enterListening();
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not restart the agent.";
      setState("error", message);
    }
  }

  button.addEventListener("click", () => {
    if (finished) void resetPerformance();
    else if (retryAgentInput) void generateAndSpeak(retryAgentInput);
    else if (selfReady && isOpeningVoice) startConversation();
    else void prepareVoice();
  });
  element<HTMLButtonElement>("clear-transcript").addEventListener("click", clearTranscript);
  window.addEventListener("pagehide", () => {
    currentSource?.stop();
    window.cancelAnimationFrame(vadFrame);
    if (recorder?.state === "recording") recorder.stop();
    microphone?.getTracks().forEach((track) => track.stop());
    disconnectAgent();
    void audioContext?.close();
  });
}

const currentRole = roleFromUrl();
if (currentRole) renderVoice(currentRole);
else renderDirector();
