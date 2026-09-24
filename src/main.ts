import "./styles.css";
import { inject } from "@vercel/analytics";
import { Conversation, type VoiceConversation } from "@elevenlabs/client";

type Role = "a" | "b";
type ConnectionState = "idle" | "connecting" | "connected" | "error";

interface ScriptLine {
  speaker: Role;
  text: string;
}

interface RoomConfig {
  agentAId: string;
  agentBId: string;
  agentAName: string;
  agentBName: string;
  script: ScriptLine[];
}

const DEFAULT_SCRIPT: ScriptLine[] = [
  { speaker: "a", text: "Hi Eli. The connection is live. Can you hear me clearly?" },
  { speaker: "b", text: "Loud and clear, Nora. I can hear you perfectly." },
  { speaker: "a", text: "Great. Let's confirm the studio handoff for tomorrow morning." },
  { speaker: "b", text: "Confirmed. I'll be there at nine with the final recording." },
  { speaker: "a", text: "Perfect. That's everything from me." },
  { speaker: "b", text: "Same here. Talk to you tomorrow." },
];

const DEFAULT_CONFIG: RoomConfig = {
  agentAId: import.meta.env.VITE_ELEVENLABS_AGENT_A_ID ?? "",
  agentBId: import.meta.env.VITE_ELEVENLABS_AGENT_B_ID ?? "",
  agentAName: import.meta.env.VITE_AGENT_A_NAME ?? "Nora",
  agentBName: import.meta.env.VITE_AGENT_B_NAME ?? "Eli",
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
    return {
      agentAId: parsed.agentAId ?? "",
      agentBId: parsed.agentBId ?? "",
      agentAName: parsed.agentAName?.trim() || DEFAULT_CONFIG.agentAName,
      agentBName: parsed.agentBName?.trim() || DEFAULT_CONFIG.agentBName,
      script: parsed.script.filter(
        (line): line is ScriptLine =>
          (line?.speaker === "a" || line?.speaker === "b") && typeof line.text === "string",
      ),
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
        <span class="lab-badge">ElevenLabs two-agent lab</span>
      </header>

      <section class="director-hero">
        <p class="kicker">Two voices · two browsers · one scene</p>
        <h1>Put a conversation<br>on <em>the air.</em></h1>
        <p class="hero-copy">Connect two independent ElevenLabs agents, place the browsers within earshot, and watch their known dialogue appear as live captions.</p>
      </section>

      <section class="setup-grid" aria-labelledby="setup-heading">
        <div class="setup-intro">
          <span class="section-index">01 / SETUP</span>
          <h2 id="setup-heading">Cast the two voices</h2>
          <p>Use public ElevenLabs agent IDs. Agent A should be configured to speak first; Agent B should wait for incoming speech.</p>
        </div>

        <form id="room-form" class="setup-form">
          <div class="agent-input agent-a-input">
            <span class="agent-letter">A</span>
            <div class="input-stack">
              <label for="agent-a-name">Display name</label>
              <input id="agent-a-name" value="${escapeHtml(config.agentAName)}" autocomplete="off" required>
            </div>
            <div class="input-stack id-input">
              <label for="agent-a-id">ElevenLabs agent ID</label>
              <input id="agent-a-id" value="${escapeHtml(config.agentAId)}" placeholder="agent_…" autocomplete="off" required>
            </div>
          </div>

          <div class="agent-input agent-b-input">
            <span class="agent-letter">B</span>
            <div class="input-stack">
              <label for="agent-b-name">Display name</label>
              <input id="agent-b-name" value="${escapeHtml(config.agentBName)}" autocomplete="off" required>
            </div>
            <div class="input-stack id-input">
              <label for="agent-b-id">ElevenLabs agent ID</label>
              <input id="agent-b-id" value="${escapeHtml(config.agentBId)}" placeholder="agent_…" autocomplete="off" required>
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
              <span><small>Launch browser</small>Agent A</span><b aria-hidden="true">↗</b>
            </button>
            <button class="launch-button launch-b" type="submit" name="launch" value="b">
              <span><small>Launch browser</small>Agent B</span><b aria-hidden="true">↗</b>
            </button>
          </div>
          <button id="copy-links" class="copy-links" type="button">Copy both role links</button>
        </form>
      </section>

      <footer class="director-footer"><span>Browser-to-browser via room audio</span><span>No API key stored in this client</span></footer>
    </main>
  `;

  const form = element<HTMLFormElement>("room-form");
  const scriptInput = element<HTMLTextAreaElement>("script");
  const lineCount = element<HTMLElement>("line-count");
  const error = element<HTMLElement>("form-error");

  function readForm(): RoomConfig | null {
    try {
      const room: RoomConfig = {
        agentAId: element<HTMLInputElement>("agent-a-id").value.trim(),
        agentBId: element<HTMLInputElement>("agent-b-id").value.trim(),
        agentAName: element<HTMLInputElement>("agent-a-name").value.trim(),
        agentBName: element<HTMLInputElement>("agent-b-name").value.trim(),
        script: parseScript(scriptInput.value),
      };
      if (!room.agentAId || !room.agentBId) throw new Error("Add both ElevenLabs agent IDs.");
      if (!room.agentAName || !room.agentBName) throw new Error("Add a display name for each agent.");
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

  scriptInput.addEventListener("input", () => {
    try {
      const count = parseScript(scriptInput.value).length;
      lineCount.textContent = `${count} ${count === 1 ? "turn" : "turns"}`;
    } catch {
      lineCount.textContent = "0 turns";
    }
  });

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
      await navigator.clipboard.writeText(`Agent A: ${roleUrl("a", room)}\nAgent B: ${roleUrl("b", room)}`);
      button.textContent = "Both links copied";
      window.setTimeout(() => (button.textContent = "Copy both role links"), 1800);
    } catch {
      error.textContent = "The browser blocked clipboard access. Launch each role and copy its URL instead.";
    }
  });
}

function renderAgent(role: Role): void {
  const config = configFromUrl();
  const isA = role === "a";
  const selfName = isA ? config.agentAName : config.agentBName;
  const peerName = isA ? config.agentBName : config.agentAName;
  const agentId = isA ? config.agentAId : config.agentBId;
  let session: VoiceConversation | null = null;
  let state: ConnectionState = "idle";
  let animationFrame = 0;
  let transcriptSequence = 0;
  const transcriptNodes = new Map<string, HTMLElement>();

  document.body.dataset.role = role;
  document.body.innerHTML = `
    <main class="console-shell">
      <header class="console-header">
        <a class="wordmark" href="${escapeHtml(window.location.pathname)}" aria-label="Back to setup">
          <span class="wordmark-signal" aria-hidden="true"><i></i><i></i><i></i></span>
          CrossTalk
        </a>
        <div class="room-state"><span id="state-dot"></span><span id="state-label">OFF AIR</span></div>
      </header>

      <section class="identity-band">
        <div>
          <p class="kicker">Browser ${role.toUpperCase()} · ElevenLabs voice agent</p>
          <h1>${escapeHtml(selfName)}</h1>
        </div>
        <div class="peer-route">
          <span>IN CONVERSATION WITH</span>
          <strong>${escapeHtml(peerName)}</strong>
        </div>
      </section>

      <section class="live-grid">
        <aside class="session-panel">
          <div class="orb-stage" aria-hidden="true">
            <div id="voice-orb" class="voice-orb"><span></span><span></span><span></span></div>
            <p id="mode-label">READY</p>
          </div>

          <div class="meters" aria-label="Live audio levels">
            <div><span>MIC</span><i><b id="input-meter"></b></i></div>
            <div><span>VOICE</span><i><b id="output-meter"></b></i></div>
          </div>

          <button id="session-button" class="session-button" type="button" ${agentId ? "" : "disabled"}>
            <span id="button-label">Start session</span><b aria-hidden="true">●</b>
          </button>
          <p id="session-note" class="session-note">${agentId ? "Microphone permission is requested when you start." : "No agent ID was supplied. Return to setup."}</p>
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
              <p>Speech will appear here<br>when the session begins.</p>
            </div>
          </div>
        </section>

        <aside class="script-panel">
          <div class="panel-heading compact"><div><span class="section-index">KNOWN / SCRIPT</span><h2>Run of show</h2></div></div>
          <ol class="script-list">
            ${config.script
              .map((line, index) => `<li data-speaker="${line.speaker}"><span>${String(index + 1).padStart(2, "0")}</span><div><b>${escapeHtml(line.speaker === "a" ? config.agentAName : config.agentBName)}</b><p>${escapeHtml(line.text)}</p></div></li>`)
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
  const inputMeter = element<HTMLElement>("input-meter");
  const outputMeter = element<HTMLElement>("output-meter");

  function setState(next: ConnectionState, message?: string): void {
    state = next;
    document.body.dataset.connection = next;
    stateDot.className = next;
    stateLabel.textContent = next === "connected" ? "ON AIR" : next === "connecting" ? "CONNECTING" : next === "error" ? "CHECK SETUP" : "OFF AIR";
    button.disabled = next === "connecting" || !agentId;
    buttonLabel.textContent = next === "connected" ? "End session" : next === "connecting" ? "Connecting…" : "Start session";
    if (message) note.textContent = message;
  }

  function speakerFor(messageRole: "user" | "agent"): { role: Role; name: string } {
    if (messageRole === "agent") return { role, name: selfName };
    return { role: isA ? "b" : "a", name: peerName };
  }

  function addTranscript(message: string, messageRole: "user" | "agent", eventId?: number): void {
    if (!message.trim()) return;
    document.getElementById("empty-transcript")?.remove();
    const speaker = speakerFor(messageRole);
    const key = eventId === undefined ? `message-${transcriptSequence++}` : `${messageRole}-${eventId}`;
    let row = transcriptNodes.get(key);
    if (!row) {
      row = document.createElement("article");
      row.className = "transcript-line";
      row.dataset.speaker = speaker.role;
      row.innerHTML = `<div><span class="speaker-pip"></span><b>${escapeHtml(speaker.name)}</b><time>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p></p>`;
      transcriptNodes.set(key, row);
      transcript.append(row);
    }
    const paragraph = row.querySelector("p");
    if (paragraph) paragraph.textContent = message;
    row.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  function animateMeters(): void {
    if (!session || state !== "connected") return;
    const level = (data: Uint8Array): number => data.length ? Math.max(...data) / 255 : 0;
    inputMeter.style.transform = `scaleX(${Math.max(0.02, level(session.getInputByteFrequencyData()))})`;
    outputMeter.style.transform = `scaleX(${Math.max(0.02, level(session.getOutputByteFrequencyData()))})`;
    animationFrame = window.requestAnimationFrame(animateMeters);
  }

  async function startSession(): Promise<void> {
    setState("connecting", "Opening the ElevenLabs voice channel…");
    try {
      session = await Conversation.startSession({
        agentId,
        connectionType: "webrtc",
        textOnly: false,
        dynamicVariables: {
          speaker_name: selfName,
          partner_name: peerName,
          conversation_script: scriptToText(config.script),
          browser_role: role.toUpperCase(),
        },
        onConnect: ({ conversationId }) => {
          setState("connected", `Live · conversation ${conversationId.slice(-8)}`);
          animationFrame = window.requestAnimationFrame(animateMeters);
        },
        onDisconnect: () => {
          window.cancelAnimationFrame(animationFrame);
          session = null;
          orb.dataset.mode = "";
          modeLabel.textContent = "READY";
          inputMeter.style.transform = "scaleX(0.02)";
          outputMeter.style.transform = "scaleX(0.02)";
          setState("idle", "Session ended. The transcript stays on this screen.");
        },
        onMessage: ({ message, role: messageRole, event_id: eventId }) => addTranscript(message, messageRole, eventId),
        onModeChange: ({ mode }) => {
          orb.dataset.mode = mode;
          modeLabel.textContent = mode === "speaking" ? `${selfName.toUpperCase()} SPEAKING` : "LISTENING";
        },
        onError: (message) => setState("error", message || "The ElevenLabs session reported an error."),
      });
    } catch (caught) {
      session = null;
      const message = caught instanceof Error ? caught.message : "Could not start the voice session.";
      setState("error", message);
    }
  }

  async function endSession(): Promise<void> {
    button.disabled = true;
    note.textContent = "Closing the voice channel…";
    await session?.endSession();
  }

  button.addEventListener("click", () => void (state === "connected" ? endSession() : startSession()));
  element<HTMLButtonElement>("clear-transcript").addEventListener("click", () => {
    transcriptNodes.clear();
    transcript.innerHTML = `<div id="empty-transcript" class="empty-transcript"><span>●</span><p>Speech will appear here<br>when the session begins.</p></div>`;
  });
  window.addEventListener("pagehide", () => {
    window.cancelAnimationFrame(animationFrame);
    void session?.endSession();
  });
}

const currentRole = roleFromUrl();
if (currentRole) renderAgent(currentRole);
else renderDirector();
