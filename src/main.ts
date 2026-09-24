import "./styles.css";
import "./ui/demo-theme.css";
import { createOrb } from "./ui/orb";
import { initTheme } from "./ui/theme";
import { inject } from "@vercel/analytics";
import {
  fetchSetup,
  speak,
  transcribe,
  writeAgentTurn,
  type HistoryTurn,
  type VoiceOption,
  type Writer,
} from "./ai/client";
import {
  PERSONAS,
  captureFields,
  isInjection,
  pickVoice,
  type AgentMode,
  type Role,
} from "./ai/personas";
import { startAcousticEngine, type AcousticEngine } from "./audio/engine";
import {
  extendCover,
  findAudioOnset,
  mixCarrierIntoCover,
  padTo,
  planSpeechOverlay,
  trimWithFade,
} from "./audio/mix";
import { downsample, encodeWav } from "./audio/pcm";
import {
  FREQUENCY_PRESETS,
  MAX_MESSAGE_BYTES,
  OVERLAY_DELAY_SECONDS,
  TAIL_AFTER_CARRIER_SECONDS,
  formatKhz,
  getFrequencyPreset,
  utf8ByteLength,
  type FrequencyPreset,
} from "./core/config";
import { Conversation, type OutgoingMessage } from "./core/conversation";
import { loadCoverAudio } from "./core/cover";
import {
  MAX_SPEECH_LEAD,
  createDeviceId,
  decodeFrame,
  encodeFrame,
} from "./core/frame";
import { isWavFile } from "./core/wav";
import { encodeUltrasound } from "./modem/ggwave";

const pageParams = new URLSearchParams(window.location.search);
// A local design preview never opens the mic or calls the paid AI services.
const previewMode = import.meta.env.DEV && pageParams.get("preview") === "1";
if (!previewMode) inject();

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const channelSelect = element<HTMLSelectElement>("channel-select");
const channelBand = element<HTMLElement>("channel-band");
const linkStatus = element<HTMLElement>("link-status");
const chatChannel = element<HTMLElement>("chat-channel");
const settingsToggle = element<HTMLButtonElement>("settings-toggle");
const settingsPanel = element<HTMLDialogElement>("settings-panel");
const leaveButton = element<HTMLButtonElement>("leave-button");
const agentSelect = element<HTMLSelectElement>("agent-select");
const agentBrief = element<HTMLTextAreaElement>("agent-brief");
const writerSelect = element<HTMLSelectElement>("writer-select");
const voiceSelect = element<HTMLSelectElement>("voice-select");
const setupStatus = element<HTMLElement>("setup-status");
const maxAutoTurnsInput = element<HTMLInputElement>("max-auto-turns");
const coverInput = element<HTMLInputElement>("cover-file");
const fileLabel = element<HTMLElement>("file-label");
const fileDescription = element<HTMLElement>("file-description");
const useExampleButton = element<HTMLButtonElement>("use-example");
const signalStrength = element<HTMLInputElement>("signal-strength");
const strengthOutput = element<HTMLOutputElement>("strength-output");
const spectrumCanvas = element<HTMLCanvasElement>("spectrum");
const thread = element<HTMLOListElement>("thread");
const threadEmpty = element<HTMLElement>("thread-empty");
const composer = element<HTMLFormElement>("composer");
const waitingBar = element<HTMLElement>("waiting-bar");
const resendButton = element<HTMLButtonElement>("resend-button");
const spokenInput = element<HTMLTextAreaElement>("spoken-input");
const hiddenInput = element<HTMLInputElement>("hidden-input");
const byteCount = element<HTMLOutputElement>("byte-count");
const autoReplyInput = element<HTMLInputElement>("auto-reply");
const autoCount = element<HTMLElement>("auto-count");
const agentButton = element<HTMLButtonElement>("agent-button");
const runDemoButton = element<HTMLButtonElement>("run-demo");
const clearButton = element<HTMLButtonElement>("clear-button");
const sendButton = element<HTMLButtonElement>("send-button");
const capturePanel = element<HTMLElement>("capture-panel");
const captureList = element<HTMLUListElement>("capture-list");
const captureCount = element<HTMLElement>("capture-count");
const roleBadge = element<HTMLElement>("role-badge");
const linkBanner = element<HTMLElement>("link-banner");
const landingPanel = element<HTMLElement>("landing-panel");
const chatPanel = element<HTMLElement>("chat-panel");
const encodedToggle = element<HTMLInputElement>("encoded-toggle");
const encodedPanel = element<HTMLElement>("encoded-panel");
const encodedThread = element<HTMLOListElement>("encoded-thread");
const encodedEmpty = element<HTMLElement>("encoded-empty");
const conversationGrid = element<HTMLElement>("conversation-grid");
const restartButton = element<HTMLButtonElement>("restart-button");
const startNote = element<HTMLElement>("start-note");
const howDialog = element<HTMLDialogElement>("how-dialog");
const currentMessage = element<HTMLElement>("current-message");
const currentDirection = element<HTMLElement>("current-direction");
const currentContent = element<HTMLElement>("current-content");
const currentSpoken = element<HTMLElement>("current-spoken");
const currentEncoded = element<HTMLElement>("current-encoded");
const currentEncodedChannel = element<HTMLElement>("current-encoded-channel");
initTheme(element<HTMLButtonElement>("theme-toggle"));
const orbCanvas = element<HTMLCanvasElement>("orb");
const landingOrb = createOrb(orbCanvas);
window.addEventListener("pagehide", () => landingOrb.stop(), { once: true });

const MAX_SPOKEN_CHARS = 600;
const STT_SAMPLE_RATE = 16_000;
const TRANSCRIBE_SETTLE_MS = 200;
const SETTINGS_KEY = "sotto.settings.v3";

type Activity =
  | "idle"
  | "thinking"
  | "voicing"
  | "preparing"
  | "queued"
  | "transmitting";

interface Session {
  readonly engine: AcousticEngine;
  readonly conversation: Conversation;
  readonly preset: FrequencyPreset;
}

interface OutgoingTurn {
  readonly message: OutgoingMessage;
  readonly audio: Float32Array[];
}

type Delivery =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "received"
  | "failed"
  | "stopped";

interface ThreadTurn {
  readonly from: "me" | "them";
  spoken: string;
  readonly hidden: string;
  delivery?: Delivery;
  spokenFallback?: string;
  transcript?: Promise<void>;
}

let session: Session | undefined;
let joining = false;
let joinPromise: Promise<boolean> | undefined;
let activity: Activity = "idle";
let hearing = false;
let transmitChain: Promise<void> = Promise.resolve();
let cachedCover: { file: File | undefined; buffer: AudioBuffer } | undefined;
let history: ThreadTurn[] = [];
let currentTurn: ThreadTurn | undefined;
let autoTurnsUsed = 0;
let agentRole: Role | undefined;
let voices: VoiceOption[] = [];
let hasStarted = false;
let previewRunning = false;
let stopPreviewDrawing: (() => void) | undefined;
let stopping = false;
const captured = new Map<string, string>();
let linkEstablished = false;
const outgoing = new Map<number, OutgoingTurn>();
const outgoingStatus = new Map<
  number,
  { turn: ThreadTurn; parts: BubbleParts }
>();

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

for (const preset of FREQUENCY_PRESETS) {
  const option = document.createElement("option");
  option.value = preset.id;
  option.textContent = `${preset.label} · ${formatKhz(preset.actualHz)}–${formatKhz(preset.endHz)}`;
  channelSelect.append(option);
}
channelSelect.value = "15000";

function updateChannelBand(): void {
  const preset = getFrequencyPreset(channelSelect.value);
  channelBand.textContent = `ggwave band ${formatKhz(preset.actualHz)}–${formatKhz(preset.endHz)}`;
}

// Settings are per-viewer conveniences, so browser storage is enough (and may be unavailable).
interface StoredSettings {
  agentMode?: AgentMode;
  customBrief?: string;
  writer?: Writer;
  voiceId?: string;
  maxAutoTurns?: number;
}

function readSettings(): StoredSettings {
  try {
    return JSON.parse(
      localStorage.getItem(SETTINGS_KEY) ?? "{}",
    ) as StoredSettings;
  } catch {
    return {};
  }
}

function saveSettings(): void {
  if (previewMode) return;
  const settings: StoredSettings = {
    agentMode: agentSelect.value as AgentMode,
    customBrief,
    writer: writerSelect.value as Writer,
    voiceId: voiceChosen ? voiceSelect.value : undefined,
    maxAutoTurns: Number(maxAutoTurnsInput.value),
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked (private mode, previews): settings just won't persist.
  }
}

const stored = readSettings();
let customBrief = stored.customBrief ?? "";
let voiceChosen = Boolean(stored.voiceId);
const linkedRole = pageParams.get("role");
agentSelect.value =
  linkedRole === "probe" || linkedRole === "target"
    ? linkedRole
    : (stored.agentMode ?? "probe");
if (stored.maxAutoTurns) maxAutoTurnsInput.value = String(stored.maxAutoTurns);

const agentMode = (): AgentMode => agentSelect.value as AgentMode;

function effectiveRole(): Role | undefined {
  const mode = agentMode();
  if (mode === "probe" || mode === "target") return mode;
  return mode === "auto" ? agentRole : undefined;
}

function currentBrief(): string {
  if (agentMode() === "custom")
    return customBrief.trim() || PERSONAS.probe.brief;
  return PERSONAS[effectiveRole() ?? "probe"].brief;
}

function refreshAgent(): void {
  const role = effectiveRole();
  const brief =
    agentMode() === "custom" ? customBrief : role ? PERSONAS[role].brief : "";
  if (agentBrief.value !== brief) agentBrief.value = brief;
  agentBrief.placeholder =
    agentMode() === "auto" && !role
      ? "Picked when the conversation starts: whoever speaks first is the Probe, the other becomes the Target."
      : "";
  chatChannel.textContent = session
    ? `Channel ${session.preset.label} · you are ${session.conversation.deviceId}`
    : `Channel ${getFrequencyPreset(channelSelect.value).label} · microphone off`;
  if (role) {
    roleBadge.hidden = false;
    roleBadge.textContent = role === "probe" ? "Customer" : "Support bot";
    roleBadge.dataset.role = role;
  } else {
    roleBadge.hidden = true;
  }
  element<HTMLElement>("landing-role").textContent =
    role === "target"
      ? "Support bot"
      : role === "probe"
        ? "Customer"
        : agentMode() === "custom"
          ? "Custom agent"
          : "Automatic role";
  if (!voiceChosen && role) {
    const voiceId = pickVoice(voices, role);
    if (voiceId) voiceSelect.value = voiceId;
  }
}

function establishLink(): void {
  if (linkEstablished) return;
  linkEstablished = true;
  linkBanner.hidden = false;
  linkBanner.classList.add("is-live");
  window.setTimeout(() => linkBanner.classList.remove("is-live"), 6_000);
}

// In automatic mode the first device to speak is the Probe; the peer becomes the Target.
function claimRole(role: Role): void {
  if (agentMode() !== "auto" || agentRole) return;
  agentRole = role;
  refreshAgent();
}

const maxAutoTurns = (): number =>
  Math.max(1, Math.min(50, Math.round(Number(maxAutoTurnsInput.value) || 4)));

function setSetupStatus(text: string, state?: "error" | "done"): void {
  setupStatus.textContent = text;
  if (state) setupStatus.dataset.state = state;
  else delete setupStatus.dataset.state;
}

function fillSelect(
  select: HTMLSelectElement,
  options: { value: string; label: string }[],
  preferred?: string,
): void {
  select.replaceChildren(
    ...options.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  if (preferred && options.some((option) => option.value === preferred))
    select.value = preferred;
}

let setupRequest = 0;
async function loadSetup(): Promise<void> {
  const request = ++setupRequest;
  setSetupStatus("Connecting…");
  try {
    const info = await fetchSetup();
    if (request !== setupRequest) return;
    const labels: Record<Writer, string> = {
      elevenlabs: "ElevenLabs agent (Gemini)",
      apertus: "Apertus (Swiss AI, 70B)",
    };
    fillSelect(
      writerSelect,
      info.writers.map((writer) => ({ value: writer, label: labels[writer] })),
      readSettings().writer ?? stored.writer,
    );
    element<HTMLElement>("writer-note").textContent = info.writers.includes(
      "apertus",
    )
      ? "Which model writes each turn. Voice and transcription always use ElevenLabs."
      : "Apertus not detected on the server — set APERTUS_API_KEY, APERTUS_BASE_URL and APERTUS_MODEL, then redeploy.";
    voices = info.voices;
    fillSelect(
      voiceSelect,
      voices.map((voice) => ({ value: voice.id, label: voice.name })),
      readSettings().voiceId ?? stored.voiceId,
    );
    refreshAgent();
    setSetupStatus(`Connected · ${voices.length} voices`, "done");
    saveSettings();
  } catch (error) {
    if (request !== setupRequest) return;
    setSetupStatus(errorText(error, "Could not reach the server."), "error");
  }
}

function openSettingsFor(problem: string, focus: HTMLElement): void {
  if (!settingsPanel.open) settingsPanel.showModal();
  settingsToggle.setAttribute("aria-expanded", "true");
  setSetupStatus(problem, "error");
  focus.focus();
}

function ensureAi(needsVoice: boolean): boolean {
  if (needsVoice && !voiceSelect.value) {
    openSettingsFor("Choose a voice first.", voiceSelect);
    return false;
  }
  return true;
}

function timeNow(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scrollThreadToEnd(): void {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "instant"
    : "smooth";
  for (const list of [thread, encodedThread])
    list.scrollTo({ top: list.scrollHeight, behavior });
}

interface BubbleParts {
  readonly spoken: HTMLElement | undefined;
  readonly status: HTMLElement;
  readonly encodedStatus: HTMLElement;
  readonly labels: readonly HTMLElement[];
}

function directionLabel(turn: ThreadTurn): string {
  return turn.from === "me"
    ? `↑ Me · ${turn.delivery ?? "queued"}`
    : "↓ Other laptop · received";
}

function renderCurrentMessage(): void {
  const turn = currentTurn;
  currentMessage.dataset.from = turn?.from ?? "none";
  currentMessage.dataset.delivery = turn?.delivery ?? "";
  currentDirection.textContent = turn ? directionLabel(turn) : "Listening…";
  currentSpoken.textContent = turn
    ? turn.spoken || turn.spokenFallback || "Cover audio · no spoken line"
    : "Waiting for the first message.";
  currentEncoded.textContent = turn?.hidden || "Waiting for the first message.";
  currentEncodedChannel.hidden = !encodedToggle.checked;
  currentContent.classList.toggle("is-revealed", encodedToggle.checked);
}

function appendBubble(
  turn: ThreadTurn,
  meta: string,
  spokenPlaceholder?: string,
): BubbleParts {
  threadEmpty.hidden = true;
  encodedEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = `bubble bubble-${turn.from}`;
  const encodedItem = document.createElement("li");
  encodedItem.className = item.className;
  const labels: HTMLElement[] = [];
  for (const entry of [item, encodedItem]) {
    const label = document.createElement("span");
    label.className = "speaker-label";
    label.textContent = directionLabel(turn);
    entry.append(label);
    labels.push(label);
  }

  let spoken: HTMLElement | undefined;
  if (turn.spoken || spokenPlaceholder) {
    spoken = document.createElement("p");
    spoken.className = "bubble-spoken";
    spoken.textContent = turn.spoken || spokenPlaceholder || "";
    if (!turn.spoken) spoken.classList.add("is-pending");
    item.append(spoken);
  } else {
    const cover = document.createElement("p");
    cover.className = "bubble-spoken";
    cover.textContent = "Cover audio · no spoken line";
    item.append(cover);
  }

  const injection = isInjection(turn.hidden);
  if (injection) encodedItem.classList.add("is-injection");
  const hidden = document.createElement("p");
  hidden.className = "bubble-hidden";
  hidden.append(document.createTextNode(turn.hidden));

  const status = document.createElement("small");
  status.textContent = meta;
  const encodedStatus = document.createElement("small");
  encodedStatus.textContent = meta;
  item.append(status);
  encodedItem.append(hidden, encodedStatus);
  thread.append(item);
  encodedThread.append(encodedItem);
  turn.spokenFallback = spokenPlaceholder;
  currentTurn = turn;
  renderCurrentMessage();
  scrollThreadToEnd();
  return { spoken, status, encodedStatus, labels };
}

function appendNotice(text: string, tone: "info" | "error" = "info"): void {
  if (!hasStarted) {
    startNote.hidden = false;
    startNote.textContent = text;
    startNote.dataset.state = tone;
  }
  threadEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = "thread-notice";
  item.dataset.tone = tone;
  item.textContent = text;
  thread.append(item);
  scrollThreadToEnd();
}

function setBubbleStatus(
  message: OutgoingMessage,
  text: string,
  state?: "error" | "done",
  delivery?: Delivery,
): void {
  const entry = outgoingStatus.get(message.frame.sequence);
  if (!entry) return;
  const { turn, parts } = entry;
  for (const status of [parts.status, parts.encodedStatus]) {
    status.textContent = text;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  }
  if (delivery) {
    turn.delivery = delivery;
    for (const label of parts.labels) label.textContent = directionLabel(turn);
    // A retry becomes current when playback starts. A late acknowledgement
    // must not replace a newer received message in the large caption.
    if (delivery === "sending") currentTurn = turn;
    renderCurrentMessage();
  }
}

function canAct(): boolean {
  return session?.conversation.turn === "mine" && activity === "idle";
}

function render(): void {
  const conversation = session?.conversation;
  const myTurn = conversation?.turn === "mine";
  const busy = activity !== "idle";
  const bytes = utf8ByteLength(hiddenInput.value.trim());
  const validHidden = bytes > 0 && bytes <= MAX_MESSAGE_BYTES;
  const validSpoken = spokenInput.value.trim().length <= MAX_SPOKEN_CHARS;

  const started = !!session || previewRunning;
  // Before the mic is started, keep the action buttons live so the first click can start it.
  const blockTurn = started && !myTurn;

  byteCount.textContent = `${bytes} / ${MAX_MESSAGE_BYTES}`;
  byteCount.classList.toggle("is-error", bytes > MAX_MESSAGE_BYTES);
  spokenInput.disabled = blockTurn;
  hiddenInput.disabled = blockTurn;
  spokenInput.placeholder = blockTurn
    ? "Their turn"
    : "Say out loud (optional, spoken with the chosen voice)";
  sendButton.disabled =
    joining || busy || blockTurn || !validHidden || !validSpoken;
  agentButton.disabled = joining || busy || blockTurn;
  runDemoButton.disabled = joining || busy || stopping;
  restartButton.disabled = joining || busy || stopping;
  element<HTMLElement>("start-label").textContent = joining
    ? "Starting…"
    : "Start";
  const orbOrigin =
    hasStarted && !landingPanel.hidden
      ? orbCanvas.getBoundingClientRect()
      : undefined;
  landingPanel.hidden = hasStarted;
  chatPanel.hidden = !hasStarted;
  if (orbOrigin) landingOrb.unroll(orbOrigin, spectrumCanvas);
  leaveButton.hidden = !started && !stopping;
  leaveButton.disabled = stopping;
  restartButton.hidden = started || stopping;
  channelSelect.disabled = started;
  agentSelect.disabled = started;
  agentBrief.disabled = started;
  chatPanel.dataset.speaking = String(activity === "transmitting" || hearing);
  clearButton.disabled = busy || history.length === 0;
  waitingBar.hidden = !session || myTurn;
  resendButton.disabled = busy;
  autoCount.textContent = autoReplyInput.checked
    ? `${autoTurnsUsed}/${maxAutoTurns()}`
    : "";

  const labels: Record<Activity, string> = {
    idle: myTurn ? "Listening" : "Waiting…",
    thinking: "Thinking…",
    voicing: "Preparing…",
    preparing: "Preparing…",
    queued: "Waiting…",
    transmitting: "Sending…",
  };
  let label = labels[activity];
  let tone = busy ? "active" : myTurn ? "ready" : "waiting";
  if (joining) [label, tone] = ["Starting…", "active"];
  else if (previewRunning) [label, tone] = ["Preview · sample data", "ready"];
  else if (!started)
    [label, tone] = [
      hasStarted ? (previewMode ? "Preview · stopped" : "Stopped") : "Ready",
      "ready",
    ];
  else if (!busy && hearing) [label, tone] = ["Receiving…", "hearing"];
  linkStatus.dataset.tone = tone;
  linkStatus.innerHTML = "<i></i> ";
  linkStatus.append(label);
  spectrumCanvas.classList.toggle(
    "is-transmitting",
    activity === "transmitting" || hearing,
  );
}

function renderEncodedView(): void {
  const revealed = encodedToggle.checked;
  encodedPanel.hidden = !revealed;
  conversationGrid.classList.toggle("is-revealed", revealed);
  renderCurrentMessage();
  if (revealed) scrollThreadToEnd();
}

function setActivity(next: Activity): void {
  activity = next;
  render();
}

async function coverFor(engine: AcousticEngine): Promise<Float32Array[]> {
  const file = coverInput.files?.[0];
  if (!cachedCover || cachedCover.file !== file) {
    const bytes = await loadCoverAudio(file);
    if (!isWavFile(bytes))
      throw new Error("The cover file is not a valid RIFF/WAVE file.");
    cachedCover = { file, buffer: await engine.decodeAudio(bytes) };
  }
  const { buffer } = cachedCover;
  return Array.from({ length: buffer.numberOfChannels }, (_, index) =>
    buffer.getChannelData(index),
  );
}

// Builds the exact audio for the next turn before committing it, so a failure never uses up the turn.
async function prepareTurn(
  active: Session,
  spoken: string,
  hidden: string,
): Promise<OutgoingTurn> {
  const { engine, preset, conversation } = active;
  const sampleRate = engine.sampleRate;
  const frameFor = (speechLead: number) => ({
    senderId: conversation.deviceId,
    sequence: conversation.upcomingSequence,
    speechLead,
    text: hidden,
  });

  let cover: Float32Array[];
  if (spoken) {
    setActivity("voicing");
    cover = [await speak(spoken, voiceSelect.value)];
  } else {
    cover = await coverFor(engine);
  }

  setActivity("preparing");
  // The header is fixed-width, so the carrier length doesn't depend on the lead value.
  const carrierLength = (
    await encodeUltrasound(encodeFrame(frameFor(0)), preset, sampleRate)
  ).length;
  let delay: number;
  let end: number;
  let speechLead = 0;
  if (spoken) {
    const plan = planSpeechOverlay(
      cover,
      carrierLength,
      sampleRate,
      OVERLAY_DELAY_SECONDS,
      TAIL_AFTER_CARRIER_SECONDS,
    );
    ({ delay, end } = plan);
    speechLead = Math.min(
      MAX_SPEECH_LEAD,
      Math.ceil(((delay + carrierLength - plan.speechStart) / sampleRate) * 10),
    );
    cover = padTo(cover, end);
  } else {
    delay =
      findAudioOnset(cover, sampleRate) +
      Math.round(OVERLAY_DELAY_SECONDS * sampleRate);
    end =
      delay +
      carrierLength +
      Math.round(TAIL_AFTER_CARRIER_SECONDS * sampleRate);
    cover = extendCover(cover, end, sampleRate);
  }

  const wire = encodeFrame(frameFor(speechLead));
  const carrier = await encodeUltrasound(wire, preset, sampleRate);
  const mixed = mixCarrierIntoCover(
    cover,
    carrier,
    delay,
    Number(signalStrength.value),
    sampleRate,
    {
      requireMasking: !spoken,
    },
  );
  const audio = trimWithFade(mixed.channels, end, sampleRate);

  if (session !== active) throw new Error("Left the channel.");
  const message = conversation.send(hidden, speechLead);
  return { message, audio };
}

function transmit(turn: OutgoingTurn): Promise<void> {
  const active = session;
  const { message } = turn;
  const run = async (): Promise<void> => {
    if (session !== active || !active) return;
    const stillActive = (): boolean => session === active;
    try {
      setActivity("queued");
      setBubbleStatus(
        message,
        "Waiting for a clear channel…",
        undefined,
        "queued",
      );
      await active.engine.waitForClearChannel(() => !stillActive());
      if (!stillActive()) return;

      setActivity("transmitting");
      setBubbleStatus(message, "Transmitting…", undefined, "sending");
      await active.engine.play(turn.audio);
      if (!stillActive()) return;
      if (active.conversation.pending === message)
        setBubbleStatus(
          message,
          `Sent ${timeNow()} · awaiting reply`,
          undefined,
          "sent",
        );
    } catch (error) {
      if (stillActive())
        setBubbleStatus(
          message,
          errorText(error, "Transmission failed."),
          "error",
          "failed",
        );
    } finally {
      if (stillActive()) setActivity("idle");
    }
  };
  transmitChain = transmitChain.then(run);
  return transmitChain;
}

async function sendTurn(spoken: string, hidden: string): Promise<boolean> {
  const active = session;
  if (!active) return false;
  try {
    const turn = await prepareTurn(active, spoken, hidden);
    if (session !== active) return false;
    const record: ThreadTurn = { from: "me", spoken, hidden };
    history.push(record);
    outgoing.set(turn.message.frame.sequence, turn);
    const parts = appendBubble(record, "Preparing to send…");
    outgoingStatus.set(turn.message.frame.sequence, { turn: record, parts });
    void transmit(turn);
    return true;
  } catch (error) {
    if (session === active) {
      appendNotice(
        `Couldn't send: ${errorText(error, "unknown error")}`,
        "error",
      );
      setActivity("idle");
    }
    return false;
  }
}

async function sendManual(): Promise<void> {
  const spoken = spokenInput.value.trim();
  const hidden = hiddenInput.value.trim();
  if (!hidden) return;
  if (!(await ensureJoined()) || !canAct()) return;
  claimRole("probe");
  if (spoken && !ensureAi(true)) return;
  autoTurnsUsed = 0;
  setActivity("preparing");
  if (await sendTurn(spoken, hidden)) {
    spokenInput.value = "";
    hiddenInput.value = "";
    resizeInput();
    render();
  }
}

async function agentTurn(): Promise<void> {
  if (!(await ensureJoined())) return;
  const active = session;
  if (!active || !canAct()) return;
  claimRole("probe");
  if (!ensureAi(true)) return;
  setActivity("thinking");
  try {
    await Promise.all(history.map((turn) => turn.transcript));
    const request = {
      writer: writerSelect.value as Writer,
      brief: currentBrief(),
      history: history.map(
        ({ from, spoken, hidden }): HistoryTurn => ({ from, spoken, hidden }),
      ),
      maxHiddenBytes: MAX_MESSAGE_BYTES,
    };
    const turn = await writeAgentTurn(request);
    if (session !== active) return;
    await sendTurn(turn.spoken, turn.hidden);
  } catch (error) {
    if (session !== active) return;
    appendNotice(
      `Agent couldn't write a turn: ${errorText(error, "unknown error")}`,
      "error",
    );
    setActivity("idle");
  }
}

async function transcribeTurn(
  active: Session,
  record: ThreadTurn,
  target: HTMLElement,
  speechLead: number,
): Promise<void> {
  await sleep(TRANSCRIBE_SETTLE_MS);
  // Speech started `speechLead` before the carrier ended; keep a margin on both sides.
  const seconds = speechLead / 10 + 1.5 + TRANSCRIBE_SETTLE_MS / 1_000;
  const factor = Math.round(active.engine.sampleRate / STT_SAMPLE_RATE);
  const samples = downsample(active.engine.recentAudio(seconds), factor);
  try {
    const text = await transcribe(
      encodeWav(samples, active.engine.sampleRate / factor),
    );
    record.spoken = text;
    target.textContent = text || "(no speech recognised)";
    record.spokenFallback = text ? undefined : "(no speech recognised)";
  } catch (error) {
    target.textContent = `Couldn't transcribe: ${errorText(error, "unknown error")}`;
    record.spokenFallback = target.textContent;
  } finally {
    target.classList.remove("is-pending");
    if (currentTurn === record) renderCurrentMessage();
  }
}

async function maybeAutoReply(
  active: Session,
  record: ThreadTurn,
): Promise<void> {
  if (!autoReplyInput.checked) return;
  if (autoTurnsUsed >= maxAutoTurns()) {
    appendNotice(
      "Reply limit reached. Continue with Agent turn in Setup → Advanced controls, or stop the conversation.",
    );
    return;
  }
  await record.transcript;
  await sleep(150);
  if (session !== active || !autoReplyInput.checked || !canAct()) return;
  autoTurnsUsed += 1;
  await agentTurn();
}

// On the probe device, incoming hidden messages carry the target's leaked fictional fields.
function recordCapture(hidden: string): void {
  if (effectiveRole() !== "probe") return;
  let added = false;
  for (const field of captureFields(hidden)) {
    if (captured.has(field.label)) continue;
    captured.set(field.label, field.value);
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.className = "capture-label";
    label.textContent = field.label;
    const value = document.createElement("span");
    value.className = "capture-value";
    value.textContent = field.value;
    item.append(label, value);
    captureList.append(item);
    added = true;
  }
  if (added) {
    capturePanel.hidden = false;
    const n = captured.size;
    captureCount.textContent = `${n} field${n === 1 ? "" : "s"} received`;
  }
}

function resend(): void {
  const pending = session?.conversation.pending;
  const turn = pending && outgoing.get(pending.frame.sequence);
  if (!turn || activity !== "idle") return;
  setBubbleStatus(turn.message, "Resending…", undefined, "queued");
  void transmit(turn);
}

function handleData(bytes: Uint8Array): void {
  const active = session;
  if (!active) return;
  const frame = decodeFrame(bytes);
  if (!frame) return;

  const outcome = active.conversation.receive(frame);
  if (outcome.kind === "message") {
    if (outcome.acknowledges)
      setBubbleStatus(outcome.acknowledges, "Delivered ✓", "done", "delivered");
    claimRole("target");
    const record: ThreadTurn = { from: "them", spoken: "", hidden: frame.text };
    history.push(record);
    establishLink();
    recordCapture(frame.text);
    const withSpeech = frame.speechLead > 0;
    const parts = appendBubble(
      record,
      `${timeNow()} · verified`,
      withSpeech ? "Transcribing…" : undefined,
    );
    if (withSpeech && parts.spoken)
      record.transcript = transcribeTurn(
        active,
        record,
        parts.spoken,
        frame.speechLead,
      );
    render();
    void maybeAutoReply(active, record);
  } else if (outcome.kind === "resend-reply") {
    const turn = outgoing.get(outcome.message.frame.sequence);
    if (!turn) return;
    appendNotice("They missed your last reply — sending it again.");
    setBubbleStatus(outcome.message, "Resending…", undefined, "queued");
    void transmit(turn);
  }
}

async function startEngine(): Promise<boolean> {
  joining = true;
  render();
  const preset = getFrequencyPreset(channelSelect.value);
  try {
    const engine = await startAcousticEngine({
      preset,
      canvas: spectrumCanvas,
      onData: handleData,
      onBusyChange(busy) {
        hearing = busy;
        render();
      },
    });
    const conversation = new Conversation(createDeviceId());
    session = { engine, conversation, preset };
    hasStarted = true;
    cachedCover = undefined;
    activity = "idle";
    transmitChain = Promise.resolve();
    agentRole = undefined;
    refreshAgent();
    return true;
  } catch (error) {
    appendNotice(
      `Could not start the microphone: ${errorText(error, "permission denied")}`,
      "error",
    );
    return false;
  } finally {
    joining = false;
    render();
  }
}

// The mic needs a user gesture, so the engine starts lazily; concurrent callers share one attempt.
function join(): Promise<boolean> {
  if (session) return Promise.resolve(true);
  joinPromise ??= startEngine().finally(() => {
    joinPromise = undefined;
  });
  return joinPromise;
}

const ensureJoined = (): Promise<boolean> => join();

function clearConversationView(): void {
  history = [];
  currentTurn = undefined;
  renderCurrentMessage();
  autoTurnsUsed = 0;
  captured.clear();
  captureList.replaceChildren();
  captureCount.textContent = "0 fields received";
  capturePanel.hidden = true;
  linkEstablished = false;
  linkBanner.hidden = true;
  outgoing.clear();
  outgoingStatus.clear();
  for (const item of [...thread.children])
    if (item !== threadEmpty) item.remove();
  for (const item of [...encodedThread.children])
    if (item !== encodedEmpty) item.remove();
  threadEmpty.hidden = false;
  encodedEmpty.hidden = false;
  spokenInput.value = "";
  hiddenInput.value = "";
}

// Reset the dialogue for another demo run without dropping the microphone.
function clearConversation(): void {
  const active = session;
  if (!active) return;
  session = {
    ...active,
    conversation: new Conversation(active.conversation.deviceId),
  };
  activity = "idle";
  transmitChain = Promise.resolve();
  agentRole = undefined;
  clearConversationView();
  refreshAgent();
  render();
}

async function runDemo(): Promise<void> {
  if (joining || stopping || activity !== "idle") return;
  if (previewMode) {
    stopPreviewDrawing?.();
    clearConversationView();
    previewRunning = true;
    hasStarted = true;
    render();
    const { previewTurns, drawPreviewSpectrum } = await import("./ui/preview");
    if (!previewRunning) return;
    for (const turn of previewTurns) {
      const record: ThreadTurn = {
        ...turn,
        from:
          effectiveRole() === "target"
            ? turn.from === "me"
              ? "them"
              : "me"
            : turn.from,
      };
      history.push(record);
      record.delivery = record.from === "me" ? "sent" : "received";
      appendBubble(
        record,
        `Sample · ${record.from === "me" ? "sent" : "received"}`,
      );
    }
    stopPreviewDrawing = drawPreviewSpectrum(
      spectrumCanvas,
      getFrequencyPreset(channelSelect.value),
    );
    render();
    return;
  }
  if (!ensureAi(true)) return;
  const starting = !session;
  if (!(await ensureJoined()) || !canAct()) return;
  if (starting) clearConversationView();
  settingsPanel.close();
  autoReplyInput.checked = true;
  autoTurnsUsed = 0;
  render();
  // The support link starts a listener. Only the customer initiates a turn.
  if (effectiveRole() !== "target") void agentTurn();
}

async function leave(): Promise<void> {
  if (previewMode) {
    previewRunning = false;
    stopPreviewDrawing?.();
    render();
    return;
  }
  const active = session;
  if (!active) return;
  stopping = true;
  session = undefined;
  activity = "idle";
  hearing = false;
  autoReplyInput.checked = false;
  if (active.conversation.pending)
    setBubbleStatus(
      active.conversation.pending,
      "Stopped · delivery unconfirmed",
      undefined,
      "stopped",
    );
  refreshAgent();
  render();
  try {
    await active.engine.stop();
  } finally {
    stopping = false;
    render();
  }
}

function resizeInput(): void {
  spokenInput.style.height = "auto";
  spokenInput.style.height = `${Math.min(spokenInput.scrollHeight, 120)}px`;
}

function showExampleCover(): void {
  coverInput.value = "";
  fileLabel.textContent = "Included example speech";
  fileDescription.textContent = "Used when a turn has nothing to say out loud";
  useExampleButton.hidden = true;
}

function submitOnEnter(event: KeyboardEvent): void {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void sendManual();
  }
}

channelSelect.addEventListener("change", () => {
  updateChannelBand();
  // Changing the channel mid-session needs the engine restarted on the new band.
  if (session) void leave().then(join);
  else refreshAgent();
});
leaveButton.addEventListener("click", () => void leave());
settingsToggle.addEventListener("click", () => {
  settingsPanel.showModal();
  settingsToggle.setAttribute("aria-expanded", "true");
});
settingsPanel.addEventListener("close", () =>
  settingsToggle.setAttribute("aria-expanded", "false"),
);
element<HTMLButtonElement>("settings-close").addEventListener("click", () =>
  settingsPanel.close(),
);
element<HTMLButtonElement>("setup-retry").addEventListener("click", () => {
  if (!previewMode) void loadSetup();
});
element<HTMLButtonElement>("how-toggle").addEventListener("click", () =>
  howDialog.showModal(),
);
element<HTMLButtonElement>("how-close").addEventListener("click", () =>
  howDialog.close(),
);
encodedToggle.addEventListener("change", renderEncodedView);
restartButton.addEventListener("click", () => void runDemo());
agentSelect.addEventListener("change", () => {
  voiceChosen = false;
  refreshAgent();
  saveSettings();
  render();
});
agentBrief.addEventListener("input", () => {
  customBrief = agentBrief.value;
  if (agentMode() !== "custom") agentSelect.value = "custom";
  refreshAgent();
  saveSettings();
});
voiceSelect.addEventListener("change", () => {
  voiceChosen = true;
  saveSettings();
});
for (const input of [writerSelect, maxAutoTurnsInput]) {
  input.addEventListener("change", () => {
    saveSettings();
    render();
  });
}
coverInput.addEventListener("change", () => {
  const file = coverInput.files?.[0];
  if (!file) return showExampleCover();
  fileLabel.textContent = file.name;
  fileDescription.textContent =
    "Custom WAV · used when a turn has nothing to say out loud";
  useExampleButton.hidden = false;
});
useExampleButton.addEventListener("click", showExampleCover);
signalStrength.addEventListener("input", () => {
  strengthOutput.textContent = `−${Math.abs(Number(signalStrength.value))} dB`;
});
spokenInput.addEventListener("input", () => {
  resizeInput();
  render();
});
hiddenInput.addEventListener("input", render);
spokenInput.addEventListener("keydown", submitOnEnter);
hiddenInput.addEventListener("keydown", submitOnEnter);
composer.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendManual();
});
agentButton.addEventListener("click", () => {
  autoTurnsUsed = 0;
  void agentTurn();
});
runDemoButton.addEventListener("click", () => void runDemo());
clearButton.addEventListener("click", clearConversation);
autoReplyInput.addEventListener("change", () => {
  autoTurnsUsed = 0;
  render();
});
resendButton.addEventListener("click", resend);
window.addEventListener("pagehide", () => void leave());

function showBuildInfo(): void {
  const builtAt = new Date(__BUILD_TIME__).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const commit = import.meta.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const branch = import.meta.env.VERCEL_GIT_COMMIT_REF;
  const source = commit
    ? ` · ${branch ? `${branch}@` : ""}${commit}`
    : " · local build";
  element<HTMLElement>("build-info").textContent =
    `Updated ${builtAt}${source}`;
}

updateChannelBand();
refreshAgent();
render();
renderEncodedView();
showBuildInfo();
if (previewMode) {
  startNote.hidden = false;
  startNote.textContent = "Preview · sample data";
  setSetupStatus("Preview mode — voice services are not used.");
  element<HTMLButtonElement>("setup-retry").disabled = true;
  composer.hidden = true;
} else {
  void loadSetup();
}
