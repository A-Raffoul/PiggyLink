import "./styles.css";
import { inject } from "@vercel/analytics";

type Role = "a" | "b";
type PerformanceState = "idle" | "preparing" | "ready" | "playing" | "complete" | "error";

interface ScriptLine {
  speaker: Role;
  text: string;
}

interface RoomConfig {
  voiceAId: string;
  voiceBId: string;
  voiceAName: string;
  voiceBName: string;
  roomId: string;
  script: ScriptLine[];
}

type RoomMessage =
  | { type: "hello"; role: Role }
  | { type: "ready"; role: Role }
  | { type: "line-start"; index: number }
  | { type: "line-complete"; index: number }
  | { type: "reset" };

const DEFAULT_SCRIPT: ScriptLine[] = [
  { speaker: "a", text: "Hi Drew. The connection is live. Can you hear me clearly?" },
  { speaker: "b", text: "Loud and clear, Rachel. I can hear you perfectly." },
  { speaker: "a", text: "Great. Let's confirm the studio handoff for tomorrow morning." },
  { speaker: "b", text: "Confirmed. I'll be there at nine with the final recording." },
  { speaker: "a", text: "Perfect. That's everything from me." },
  { speaker: "b", text: "Same here. Talk to you tomorrow." },
];

const DEFAULT_CONFIG: RoomConfig = {
  voiceAId: "21m00Tcm4TlvDq8ikWAM",
  voiceBId: "29vD33N1CtxCmqQRPOHJ",
  voiceAName: "Rachel",
  voiceBName: "Drew",
  roomId: crypto.randomUUID(),
  script: DEFAULT_SCRIPT,
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
    if (!Array.isArray(parsed.script)) return null;
    const script = parsed.script.filter(
      (line): line is ScriptLine =>
        (line?.speaker === "a" || line?.speaker === "b") &&
        typeof line.text === "string" &&
        line.text.trim().length > 0,
    );
    if (!script.length) return null;
    return {
      voiceAId: parsed.voiceAId?.trim() || DEFAULT_CONFIG.voiceAId,
      voiceBId: parsed.voiceBId?.trim() || DEFAULT_CONFIG.voiceBId,
      voiceAName: parsed.voiceAName?.trim() || DEFAULT_CONFIG.voiceAName,
      voiceBName: parsed.voiceBName?.trim() || DEFAULT_CONFIG.voiceBName,
      roomId: parsed.roomId?.trim() || crypto.randomUUID(),
      script,
    };
  } catch {
    return null;
  }
}

function parseScript(value: string): ScriptLine[] {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([AB]):\s*(.+)$/i);
      if (!match) return null;
      return { speaker: match[1]?.toLowerCase() as Role, text: match[2]?.trim() ?? "" };
    })
    .filter((line): line is ScriptLine => Boolean(line?.text));
  if (!lines.length) throw new Error("Add at least one line using “A: text” or “B: text”.");
  return lines;
}

function scriptToText(script: ScriptLine[]): string {
  return script.map((line) => `${line.speaker.toUpperCase()}: ${line.text}`).join("\n");
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
        <span class="lab-badge">ElevenLabs two-voice lab</span>
      </header>

      <section class="director-hero">
        <p class="kicker">Two voices · two windows · one script</p>
        <h1>Put a conversation<br>on <em>the air.</em></h1>
        <p class="hero-copy">Give each window one ElevenLabs voice. CrossTalk synthesizes the known lines, coordinates each turn, and reveals the dialogue as it plays.</p>
      </section>

      <section class="setup-grid" aria-labelledby="setup-heading">
        <div class="setup-intro">
          <span class="section-index">01 / SETUP</span>
          <h2 id="setup-heading">Cast the two voices</h2>
          <p>Rachel and Drew are ready by default. Replace either public voice ID whenever you want a different performance.</p>
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
                <label for="script">Known script</label>
                <span>One turn per line, prefixed with A: or B:</span>
              </div>
              <span id="line-count">${config.script.length} turns</span>
            </div>
            <textarea id="script" rows="8" spellcheck="true">${escapeHtml(scriptToText(config.script))}</textarea>
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

      <footer class="director-footer"><span>Deterministic text-to-speech performance</span><span>API key stays on the server</span></footer>
    </main>
  `;

  const form = element<HTMLFormElement>("room-form");
  const scriptInput = element<HTMLTextAreaElement>("script");
  const lineCount = element<HTMLElement>("line-count");
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
        script: parseScript(scriptInput.value),
      };
      if (!room.voiceAId || !room.voiceBId) throw new Error("Add both ElevenLabs voice IDs.");
      if (!room.voiceAName || !room.voiceBName) throw new Error("Add a name for each speaker.");
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

  scriptInput.addEventListener("input", () => {
    refreshRoom();
    try {
      const count = parseScript(scriptInput.value).length;
      lineCount.textContent = `${count} ${count === 1 ? "turn" : "turns"}`;
    } catch {
      lineCount.textContent = "0 turns";
    }
  });
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
  const ownLines = config.script.map((line, index) => ({ ...line, index })).filter((line) => line.speaker === role);
  let audioContext: AudioContext | null = null;
  let currentSource: AudioBufferSourceNode | null = null;
  let selfReady = false;
  let peerReady = false;
  let started = false;
  let finished = false;
  let currentLine = -1;
  const audioBuffers = new Map<number, AudioBuffer>();
  const transcriptNodes = new Map<number, HTMLElement>();
  const channel = new BroadcastChannel(`crosstalk:${config.roomId}`);

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
          <p class="kicker">Window ${role.toUpperCase()} · ElevenLabs text to speech</p>
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

          <div class="meters" aria-label="Performance readiness">
            <div><span>VOICE</span><i><b id="voice-meter"></b></i></div>
            <div><span>PEER</span><i><b id="peer-meter"></b></i></div>
          </div>

          <button id="session-button" class="session-button" type="button">
            <span id="button-label">Prepare ${escapeHtml(selfName)}</span><b aria-hidden="true">●</b>
          </button>
          <p id="session-note" class="session-note">Generate ${ownLines.length} ${ownLines.length === 1 ? "line" : "lines"}, then wait for the other voice window.</p>
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
              <p>Both windows prepare their voice.<br>The script then plays turn by turn.</p>
            </div>
          </div>
        </section>

        <aside class="script-panel">
          <div class="panel-heading compact"><div><span class="section-index">KNOWN / SCRIPT</span><h2>Run of show</h2></div></div>
          <ol class="script-list">
            ${config.script
              .map((line, index) => `<li id="script-line-${index}" data-speaker="${line.speaker}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(line.speaker === "a" ? config.voiceAName : config.voiceBName)}</b><p>${escapeHtml(line.text)}</p></div></li>`)
              .join("")}
          </ol>
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
    button.disabled = next === "preparing" || next === "ready" || next === "playing";
    buttonLabel.textContent =
      next === "preparing" ? "Generating voice…" :
      next === "complete" ? "Run it again" :
      next === "error" ? "Try again" : `Prepare ${selfName}`;
    if (message) note.textContent = message;
  }

  function speakerName(line: ScriptLine): string {
    return line.speaker === "a" ? config.voiceAName : config.voiceBName;
  }

  function showTranscript(index: number): void {
    const line = config.script[index];
    if (!line) return;
    document.getElementById("empty-transcript")?.remove();
    let row = transcriptNodes.get(index);
    if (!row) {
      row = document.createElement("article");
      row.className = "transcript-line";
      row.dataset.speaker = line.speaker;
      row.innerHTML = `<div><span class="speaker-pip"></span><b>${escapeHtml(speakerName(line))}</b><time>NOW</time></div><p>${escapeHtml(line.text)}</p>`;
      transcriptNodes.set(index, row);
      transcript.append(row);
    }
    document.querySelectorAll(".script-list li").forEach((item) => item.classList.remove("is-current"));
    document.getElementById(`script-line-${index}`)?.classList.add("is-current");
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  async function requestSpeech(line: ScriptLine, index: number): Promise<AudioBuffer> {
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voiceId,
        text: line.text,
        previousText: config.script[index - 1]?.text,
        nextText: config.script[index + 1]?.text,
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

  async function prepareVoice(): Promise<void> {
    setState("preparing", `Generating 0 of ${ownLines.length} lines…`);
    button.disabled = true;
    try {
      audioContext ??= new AudioContext();
      await audioContext.resume();
      for (const [position, line] of ownLines.entries()) {
        const buffer = await requestSpeech(line, line.index);
        audioBuffers.set(line.index, buffer);
        const prepared = position + 1;
        voiceMeter.style.transform = `scaleX(${prepared / Math.max(ownLines.length, 1)})`;
        note.textContent = `Generating ${prepared} of ${ownLines.length} lines…`;
      }
      selfReady = true;
      setState("ready", peerReady ? "Both voices are ready. Starting…" : `${selfName} is ready. Waiting for ${peerName}…`);
      channel.postMessage({ type: "ready", role } satisfies RoomMessage);
      maybeStart();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not prepare this voice.";
      setState("error", message);
    }
  }

  function completeLine(index: number): void {
    currentSource = null;
    currentLine = -1;
    channel.postMessage({ type: "line-complete", index } satisfies RoomMessage);
    advanceAfter(index);
  }

  function playLine(index: number): void {
    if (currentLine !== -1) return;
    const line = config.script[index];
    const buffer = audioBuffers.get(index);
    if (!line || line.speaker !== role || !buffer || !audioContext) return;
    currentLine = index;
    setState("playing", `Speaking turn ${index + 1} of ${config.script.length}…`);
    orb.dataset.mode = "speaking";
    modeLabel.textContent = `${selfName.toUpperCase()} SPEAKING`;
    showTranscript(index);
    channel.postMessage({ type: "line-start", index } satisfies RoomMessage);
    const source = audioContext.createBufferSource();
    currentSource = source;
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => completeLine(index);
    source.start();
  }

  function advanceAfter(index: number): void {
    const nextIndex = index + 1;
    const nextLine = config.script[nextIndex];
    if (!nextLine) {
      finished = true;
      orb.dataset.mode = "";
      modeLabel.textContent = "PERFORMANCE COMPLETE";
      setState("complete", "The full script has finished.");
      return;
    }
    if (nextLine.speaker === role) playLine(nextIndex);
    else {
      orb.dataset.mode = "listening";
      modeLabel.textContent = `LISTENING TO ${peerName.toUpperCase()}`;
      setState("playing", `Waiting for ${peerName}'s next line…`);
    }
  }

  function maybeStart(): void {
    if (!selfReady || !peerReady || started) return;
    started = true;
    const firstLine = config.script[0];
    setState("playing", "Both voices are ready. The performance is starting…");
    if (firstLine?.speaker === role) playLine(0);
    else {
      orb.dataset.mode = "listening";
      modeLabel.textContent = `LISTENING TO ${peerName.toUpperCase()}`;
    }
  }

  function clearTranscript(): void {
    transcriptNodes.clear();
    transcript.innerHTML = `<div id="empty-transcript" class="empty-transcript"><span>●</span><p>Both windows prepare their voice.<br>The script then plays turn by turn.</p></div>`;
    document.querySelectorAll(".script-list li").forEach((item) => item.classList.remove("is-current"));
  }

  function resetPerformance(broadcast: boolean): void {
    currentSource?.stop();
    currentSource = null;
    currentLine = -1;
    started = false;
    finished = false;
    clearTranscript();
    if (broadcast) channel.postMessage({ type: "reset" } satisfies RoomMessage);
    setState("ready", "Both voices remain prepared. Restarting…");
    window.setTimeout(maybeStart, 350);
  }

  channel.addEventListener("message", (event: MessageEvent<RoomMessage>) => {
    const message = event.data;
    if (message.type === "hello") {
      if (selfReady) channel.postMessage({ type: "ready", role } satisfies RoomMessage);
      return;
    }
    if (message.type === "ready" && message.role !== role) {
      peerReady = true;
      peerMeter.style.transform = "scaleX(1)";
      if (selfReady) note.textContent = "Both voices are ready. Starting…";
      maybeStart();
      return;
    }
    if (message.type === "line-start") {
      showTranscript(message.index);
      orb.dataset.mode = "listening";
      modeLabel.textContent = `LISTENING TO ${peerName.toUpperCase()}`;
      setState("playing", `${peerName} is speaking turn ${message.index + 1}…`);
      return;
    }
    if (message.type === "line-complete") {
      advanceAfter(message.index);
      return;
    }
    if (message.type === "reset") resetPerformance(false);
  });

  button.addEventListener("click", () => {
    if (finished) resetPerformance(true);
    else void prepareVoice();
  });
  element<HTMLButtonElement>("clear-transcript").addEventListener("click", clearTranscript);
  window.addEventListener("pagehide", () => {
    currentSource?.stop();
    channel.close();
    void audioContext?.close();
  });

  channel.postMessage({ type: "hello", role } satisfies RoomMessage);
}

const currentRole = roleFromUrl();
if (currentRole) renderVoice(currentRole);
else renderDirector();
