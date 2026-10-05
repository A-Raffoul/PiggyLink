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
  pickVoice,
  type AgentMode,
  type Role,
} from "./ai/personas";
import { SCENARIOS, PROFILE_LIMITS, exampleProfile, isScenario, peerLink, type DemoConfig, type DemoProfile } from "./core/demo";
import { AutoReplyGate } from "./core/auto-reply";
import { startAcousticEngine, type AcousticEngine } from "./audio/engine";
import { SPECTRUM_MAX_HZ } from "./audio/frequency-spectrum";
import {
  carrierOnly,
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

import { decodeDialogue, encodeDialogue, dialogueState, isQuietAction, parseReceivedBudget, MAX_DIALOGUE_BYTES, type DialogueAction } from "./core/quiet-dialogue";

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
const agentBriefField = element<HTMLElement>("agent-brief-field");
const writerField = element<HTMLElement>("writer-field");
const autoLimitField = element<HTMLElement>("auto-limit-field");
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
const quietStrength = element<HTMLInputElement>("quiet-strength");
const quietStrengthOutput = element<HTMLOutputElement>("quiet-strength-output");
const voiceState = element<HTMLElement>("voice-state");
const privateContext = element<HTMLElement>("private-context");
const privateValue = element<HTMLElement>("private-value");
const profileSetup = element<HTMLElement>("profile-setup");
const profileForm = element<HTMLFormElement>("profile-form");
const profileFields = element<HTMLFieldSetElement>("profile-fields");
const profileName = element<HTMLInputElement>("profile-name");
const profileRequest = element<HTMLTextAreaElement>("profile-request");
const profilePrivate = element<HTMLTextAreaElement>("profile-private");
const otherDeviceLink = element<HTMLInputElement>("other-device-link");
const copyDeviceLink = element<HTMLButtonElement>("copy-device-link");
const startGuide = element<HTMLElement>("start-guide");
const spectrumCanvas = element<HTMLCanvasElement>("spectrum");
const spectrumBand = element<HTMLElement>("spectrum-band");
const thread = element<HTMLOListElement>("thread");
const threadEmpty = element<HTMLElement>("thread-empty");
const composer = element<HTMLFormElement>("composer");
const composerSettingsHome = element<HTMLElement>("composer-settings-home");
const manualChatPanel = element<HTMLElement>("manual-chat-panel");
const composerTitle = element<HTMLElement>("composer-title");
const waitingBar = element<HTMLElement>("waiting-bar");
const resendButton = element<HTMLButtonElement>("resend-button");
const spokenLabel = element<HTMLElement>("spoken-label");
const spokenInput = element<HTMLTextAreaElement>("spoken-input");
const hiddenInput = element<HTMLInputElement>("hidden-input");
const byteCount = element<HTMLOutputElement>("byte-count");
const autoReplyInput = element<HTMLInputElement>("auto-reply");
const autoCount = element<HTMLElement>("auto-count");
const agentButton = element<HTMLButtonElement>("agent-button");
const runDemoButton = element<HTMLButtonElement>("run-demo");
const personaButtons = [
  ...document.querySelectorAll<HTMLButtonElement>(".persona-option"),
];
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
const conversationLog = element<HTMLElement>("conversation-log");
const restartButton = element<HTMLButtonElement>("restart-button");
const changeSetupButton = element<HTMLButtonElement>("change-setup");
const detailsToggle = element<HTMLButtonElement>("details-toggle");
const previewLabel = element<HTMLElement>("preview-label");
const startNote = element<HTMLElement>("start-note");
const howDialog = element<HTMLDialogElement>("how-dialog");
const currentMessage = element<HTMLElement>("current-message");
const currentDirection = element<HTMLElement>("current-direction");
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
  | "transcribing"
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
  readonly action?: DialogueAction;
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
let currentMessageTimer: ReturnType<typeof setTimeout> | undefined;
const CURRENT_MESSAGE_MS = 4_000;
let speechTranscribing = false;
let encodedReceiveVersion = 0;
let autoTurnsUsed = 0;
const autoReplies = new AutoReplyGate();
let voices: VoiceOption[] = [];
let hasStarted = false;
let detailsVisible = false;
let previewRunning = false;
let previewRunVersion = 0;
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
channelSelect.value = "18000";

function updateChannelBand(): void {
  const preset = getFrequencyPreset(channelSelect.value);
  channelBand.textContent = `ggwave band ${formatKhz(preset.actualHz)}–${formatKhz(preset.endHz)}`;
  spectrumBand.style.left = `${(preset.actualHz / SPECTRUM_MAX_HZ) * 100}%`;
  spectrumBand.style.width = `${((preset.endHz - preset.actualHz) / SPECTRUM_MAX_HZ) * 100}%`;
  spectrumBand.setAttribute(
    "aria-label",
    `Encoded frequency band from ${formatKhz(preset.actualHz)} to ${formatKhz(preset.endHz)}`,
  );
}

// Settings are per-viewer conveniences, so browser storage is enough (and may be unavailable).
interface StoredSettings {
  agentMode?: AgentMode;
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
profileName.maxLength = PROFILE_LIMITS.name;
profileRequest.maxLength = PROFILE_LIMITS.request;
profilePrivate.maxLength = PROFILE_LIMITS.privateContext;
function setExampleProfile(): void {
  const profile = exampleProfile("restaurant");
  profileName.value = profile.name;
  profileRequest.value = profile.request;
  profilePrivate.value = profile.privateContext;
}
function readProfile(): DemoProfile {
  return { name: profileName.value.trim(), request: profileRequest.value.trim(), privateContext: profilePrivate.value.trim() };
}
function currentDemo(): DemoConfig {
  const role = effectiveRole();
  if (!role) throw new Error("Choose a role for the demo.");
  return { scenario: "restaurant", role, ...(role === "probe" ? { profile: readProfile() } : {}) };
}
setExampleProfile();
const linkedRole = pageParams.get("role");
const initialMode =
  linkedRole === "probe" || linkedRole === "target" || linkedRole === "custom"
    ? linkedRole
    : stored.agentMode === "probe" ||
        stored.agentMode === "target" ||
        stored.agentMode === "custom"
      ? stored.agentMode
      : "";
agentSelect.value = initialMode;
let voiceChosen = Boolean(stored.voiceId && initialMode === stored.agentMode);
if (stored.maxAutoTurns) maxAutoTurnsInput.value = String(stored.maxAutoTurns);

const agentMode = (): AgentMode => agentSelect.value as AgentMode;

function effectiveRole(): Role | undefined {
  const mode = agentMode();
  if (mode === "probe" || mode === "target") return mode;
  return undefined;
}

const isListenerMode = (): boolean => agentMode() === "target";

function refreshAgent(): void {
  const mode = agentMode();
  const role = effectiveRole();
  const scenario = SCENARIOS.restaurant;
  const brief = role === "probe" ? profileRequest.value : role === "target" ? `Answer the call at ${scenario.business} and help with the request.` : "";
  if (agentBrief.value !== brief) agentBrief.value = brief;
  agentBrief.readOnly = true;
  const manual = mode === "custom";
  agentBriefField.hidden = manual;
  writerField.hidden = manual;
  autoLimitField.hidden = manual;
  if (manual) {
    if (composer.parentElement !== manualChatPanel) manualChatPanel.append(composer);
  } else if (composer.previousElementSibling !== composerSettingsHome) {
    composerSettingsHome.after(composer);
  }
  composerTitle.textContent = manual ? "Create your own chat" : "Send a turn manually";
  spokenLabel.textContent = manual ? "Spoken message (required)" : "Spoken line";
  autoReplyInput.closest("label")!.hidden = manual;
  if (manual) autoReplyInput.checked = false;
  agentButton.hidden = manual;
  chatPanel.dataset.mode = mode;
  threadEmpty.querySelector("strong")!.textContent = manual
    ? "Write a message to begin."
    : "Listening…";
  chatChannel.textContent = session
    ? `Channel ${session.preset.label} · you are ${session.conversation.deviceId}`
    : `Channel ${getFrequencyPreset(channelSelect.value).label} · microphone off`;
  if (role || mode === "custom") {
    roleBadge.hidden = false;
    roleBadge.textContent =
      mode === "custom"
        ? "Custom chat"
        : role === "probe"
          ? "Personal assistant"
          : scenario.peer;
    roleBadge.dataset.role = mode;
  } else {
    roleBadge.hidden = true;
  }
  privateContext.hidden = mode !== "probe";
  privateValue.textContent = profilePrivate.value;
  profileSetup.hidden = mode !== "probe";
  const targetOption = agentSelect.querySelector<HTMLOptionElement>('option[value="target"]');
  if (targetOption) targetOption.textContent = scenario.peer;
  startGuide.textContent = mode === "target"
    ? "Start here first, then start the personal assistant on your other device. Keep both devices nearby."
    : mode === "probe"
      ? "Open the other-device link nearby. Start that device first, then start your assistant here."
      : mode === "custom"
        ? "Open Custom chat on both devices to exchange your own messages."
        : "Choose a role on each device. Start the other agent first, then the personal assistant.";
  otherDeviceLink.value = peerLink(window.location.href, "restaurant");
  encodedToggle.closest("label")!.hidden = mode !== "custom";
  for (const button of personaButtons)
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.agentMode === mode),
    );
  if (!voiceChosen && mode) {
    const voiceId = pickVoice(voices, mode);
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
    const storedVoice = readSettings().voiceId ?? stored.voiceId;
    if (!voices.some((voice) => voice.id === storedVoice)) voiceChosen = false;
    fillSelect(
      voiceSelect,
      voices.map((voice) => ({ value: voice.id, label: voice.name })),
      voiceChosen ? storedVoice : undefined,
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

interface BubbleParts {
  readonly spoken: HTMLElement | undefined;
  readonly status: HTMLElement;
  readonly label: HTMLElement;
  readonly item: HTMLElement;
}

function directionLabel(turn: ThreadTurn): string {
  return turn.from === "me"
    ? `↑ This device · ${turn.delivery ?? "queued"}`
    : turn.hidden || turn.action
      ? "↓ Other device · received"
      : "↓ Voice · received";
}

function renderCurrentMessage(): void {
  const turn = currentTurn;
  currentMessage.dataset.from = turn?.from ?? "none";
  currentMessage.dataset.delivery = turn?.delivery ?? "";
  currentDirection.textContent = turn ? directionLabel(turn) : "Listening…";
  const quiet = isQuietAction(turn?.action);
  currentSpoken.parentElement!.hidden = quiet;
  currentMessage.dataset.quiet = String(quiet);
  currentSpoken.textContent = turn
    ? turn.spoken || turn.spokenFallback || "Cover audio · no spoken line"
    : "Waiting for the first message.";
  const showEncoded = (quiet || encodedToggle.checked) && Boolean(turn?.hidden);
  currentEncodedChannel.querySelector("span")!.textContent = quiet
    ? turn?.from === "them" ? "Received through sound" : "Sending through sound"
    : "Encoded";
  currentEncoded.textContent = showEncoded ? turn!.hidden : "";
  currentEncodedChannel.hidden = !showEncoded;
}

function dismissCurrentMessage(): void {
  clearTimeout(currentMessageTimer);
  currentMessage.classList.remove("is-visible");
  currentMessage.setAttribute("aria-hidden", "true");
  currentMessage.inert = true;
}

function scheduleCurrentMessageDismissal(): void {
  clearTimeout(currentMessageTimer);
  // Keep text available while a keyboard user is reading the scroll region.
  if (agentMode() !== "custom" || currentMessage.contains(document.activeElement) || isQuietAction(currentTurn?.action)) return;
  currentMessageTimer = setTimeout(dismissCurrentMessage, CURRENT_MESSAGE_MS);
}

function flashCurrentMessage(turn: ThreadTurn): void {
  currentTurn = turn;
  renderCurrentMessage();
  currentMessage.inert = false;
  currentMessage.setAttribute("aria-hidden", "false");
  currentMessage.classList.add("is-visible");
  scheduleCurrentMessageDismissal();
}

currentMessage.addEventListener("focusin", () =>
  clearTimeout(currentMessageTimer),
);
currentMessage.addEventListener("focusout", () => {
  queueMicrotask(() => {
    if (currentMessage.classList.contains("is-visible"))
      scheduleCurrentMessageDismissal();
  });
});

function appendBubble(
  turn: ThreadTurn,
  meta: string,
  spokenPlaceholder?: string,
): BubbleParts {
  threadEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = `bubble bubble-${turn.from}`;
  const quiet = isQuietAction(turn.action);
  item.classList.toggle("is-quiet", quiet);
  item.hidden = quiet && turn.from === "me" && !turn.delivery;
  const label = document.createElement("span");
  label.className = "speaker-label";
  label.textContent = directionLabel(turn);
  const pair = document.createElement("div");
  pair.className = "bubble-pair";
  const spokenChannel = document.createElement("div");
  spokenChannel.className = "bubble-channel spoken-channel";

  let spoken: HTMLElement | undefined;
  if (turn.spoken || spokenPlaceholder) {
    spoken = document.createElement("p");
    spoken.className = "bubble-spoken";
    spoken.textContent = turn.spoken || spokenPlaceholder || "";
    if (!turn.spoken) spoken.classList.add("is-pending");
    spokenChannel.append(spoken);
  } else {
    const cover = document.createElement("p");
    cover.className = "bubble-spoken";
    cover.textContent = "Cover audio · no spoken line";
    spokenChannel.append(cover);
  }

  const encodedChannel = document.createElement("div");
  encodedChannel.className = "bubble-channel encoded-channel";
  encodedChannel.hidden = !quiet && !encodedToggle.checked;
  const encodedLabel = document.createElement("span");
  encodedLabel.className = "bubble-channel-label";
  encodedLabel.textContent = quiet ? (turn.from === "them" ? "Received through sound" : "Sent through sound") : "Encoded";
  const hidden = document.createElement("p");
  hidden.className = "bubble-hidden";
  hidden.append(document.createTextNode(turn.hidden));

  const status = document.createElement("small");
  status.textContent = meta;
  encodedChannel.append(encodedLabel, hidden);
  if (!quiet) pair.append(spokenChannel);
  if (turn.hidden) pair.append(encodedChannel);
  item.append(label, pair, status);
  thread.append(item);
  turn.spokenFallback = spokenPlaceholder;
  // Outgoing captions begin with playback, not while waiting for a clear channel.
  if (turn.from === "them" || turn.delivery === "sent")
    flashCurrentMessage(turn);
  return { spoken, status, label, item };
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
  if (tone === "error" && hasStarted) {
    detailsVisible = true;
    render();
  }
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
  parts.status.textContent = text;
  if (state) parts.status.dataset.state = state;
  else delete parts.status.dataset.state;
  if (delivery) {
    turn.delivery = delivery;
    if (delivery === "sending" || delivery === "failed") parts.item.hidden = false;
    parts.label.textContent = directionLabel(turn);
    // A retry becomes current when playback starts. A late acknowledgement
    // must not replace a newer received message in the large caption.
    if (delivery === "sending") flashCurrentMessage(turn);
    else if (currentTurn === turn) renderCurrentMessage();
    // The voice indicator must change when closing speech starts, not after
    // playback ends. Delivery state is updated after setActivity renders.
    if (delivery === "sending" || delivery === "sent" || delivery === "delivered") render();
    if (delivery === "failed") {
      detailsVisible = true;
      render();
    }
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
  const hasSpoken = spokenInput.value.trim().length > 0;
  const validMessage =
    bytes <= MAX_MESSAGE_BYTES &&
    (agentMode() === "custom" ? hasSpoken : bytes > 0 || hasSpoken);
  const validSpoken = spokenInput.value.trim().length <= MAX_SPOKEN_CHARS;

  const started = !!session || previewRunning;
  const focusDemo = hasStarted && agentMode() !== "custom" && !detailsVisible;
  document.body.dataset.focusDemo = String(focusDemo);
  detailsToggle.hidden = !hasStarted || agentMode() === "custom";
  detailsToggle.setAttribute("aria-expanded", String(detailsVisible));
  detailsToggle.setAttribute("aria-label", detailsVisible
    ? "Return to the conversation" : "Show session details and controls");
  detailsToggle.querySelector("span")!.textContent = detailsVisible ? "×" : "···";
  previewLabel.hidden = !previewMode || !focusDemo;
  // Before the mic is started, keep the action buttons live so the first click can start it.
  const blockTurn = started && !myTurn;

  byteCount.textContent = `${bytes} / ${MAX_MESSAGE_BYTES}`;
  byteCount.classList.toggle("is-error", bytes > MAX_MESSAGE_BYTES);
  spokenInput.disabled = blockTurn;
  hiddenInput.disabled = blockTurn;
  spokenInput.placeholder = blockTurn
    ? "Their turn"
    : agentMode() === "custom"
      ? "What the room hears"
      : "Say out loud (optional, spoken with the chosen voice)";
  sendButton.disabled =
    !agentSelect.value || joining || busy || blockTurn || !validMessage || !validSpoken;
  agentButton.disabled = !agentSelect.value || joining || busy || blockTurn || dialogueState(history).phase === "complete";
  runDemoButton.disabled =
    !agentSelect.value || joining || busy || stopping;
  for (const button of personaButtons)
    button.disabled = joining || started || stopping;
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
  manualChatPanel.hidden = agentMode() !== "custom" || !hasStarted || previewMode;
  if (orbOrigin) landingOrb.unroll(orbOrigin, spectrumCanvas);
  leaveButton.hidden = !started && !stopping;
  leaveButton.disabled = stopping;
  restartButton.hidden = started || stopping;
  changeSetupButton.hidden = started || stopping;
  channelSelect.disabled = started;
  agentSelect.disabled = started;
  agentBrief.disabled = started;
  profileFields.disabled = started;
  const phase = dialogueState(history).phase;
  const latest = history.at(-1);
  const accepting = latest?.action === "accept" && latest.from === "me" &&
    latest.delivery !== "sent" && latest.delivery !== "delivered";
  const resumed = history.some((turn) => turn.action === "resume");
  const awaitingVoice = phase === "closing" && (latest?.action === "resume" ||
    (latest?.from === "me" && latest.delivery !== "sending" && latest.delivery !== "sent" && latest.delivery !== "delivered"));
  const quiet = (phase === "quiet" && !accepting) || awaitingVoice;
  const finished = phase === "complete" && (latest?.from === "them" || latest?.delivery === "sent" || latest?.delivery === "delivered");
  voiceState.hidden = agentMode() === "custom" || (focusDemo && !quiet && !resumed);
  voiceState.textContent = !started ? "Microphone off" : finished ? "Call ended" : quiet ? (focusDemo ? "Voice off" : "Voice off · still connected") : "Voice on";
  voiceState.dataset.quiet = String(quiet);
  chatPanel.dataset.quiet = String(quiet);
  spectrumBand.hidden = !quiet && !encodedToggle.checked;
  chatPanel.dataset.speaking = String(activity === "transmitting" || hearing);
  clearButton.disabled = busy || history.length === 0;
  waitingBar.hidden = !conversation?.pending || decodeDialogue(conversation.pending.frame.text)?.action === "ack";
  resendButton.disabled = busy;
  autoCount.textContent = autoReplyInput.checked
    ? `${autoTurnsUsed}/${maxAutoTurns()}`
    : "";

  const labels: Record<Activity, string> = {
    idle:
      myTurn && agentMode() === "custom"
        ? "Ready to send"
        : myTurn
          ? "Listening"
          : "Waiting…",
    transcribing: "Transcribing…",
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
  else if (!busy && phase === "complete") [label, tone] = ["Demo complete", "ready"];
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
  spectrumBand.hidden = !revealed;
  conversationLog.classList.toggle("is-revealed", revealed);
  capturePanel.hidden = captured.size === 0;
  for (const channel of thread.querySelectorAll<HTMLElement>(
    ".encoded-channel",
  ))
    channel.hidden = !revealed && !channel.closest(".is-quiet");
  renderCurrentMessage();
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

async function spokenAudio(
  engine: AcousticEngine,
  text: string,
): Promise<Float32Array> {
  const samples = await speak(text, voiceSelect.value);
  // decodeAudioData resamples to the actual context rate, including native iPhone rates.
  const buffer = await engine.decodeAudio(encodeWav(samples, 48_000));
  return buffer.getChannelData(0);
}

// Builds the exact audio for the next turn before committing it, so a failure never uses up the turn.
async function prepareTurn(
  active: Session,
  spoken: string,
  hidden: string,
  quiet = false,
): Promise<OutgoingTurn> {
  const { engine, preset, conversation } = active;
  const sampleRate = engine.sampleRate;
  const frameFor = (speechLead: number) => ({
    senderId: conversation.deviceId,
    sequence: conversation.upcomingSequence,
    speechLead,
    text: hidden,
  });

  if (quiet) {
    setActivity("preparing");
    const carrier = await encodeUltrasound(encodeFrame(frameFor(0)), preset, sampleRate);
    const audio = [carrierOnly(carrier, Number(quietStrength.value))];
    if (session !== active) throw new Error("Left the channel.");
    return { message: conversation.send(hidden, 0), audio };
  }

  let cover: Float32Array[];
  if (spoken) {
    setActivity("voicing");
    cover = [await spokenAudio(engine, spoken)];
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
      if (active.conversation.canSendWithoutReply)
        setBubbleStatus(message, `Sent ${timeNow()}`, undefined, "sent");
      else if (active.conversation.pending === message)
        setBubbleStatus(
          message,
          `Sent ${timeNow()} · awaiting reply`,
          undefined,
          "sent",
        );
    } catch (error) {
      if (stillActive()) {
        if (outgoingStatus.has(message.frame.sequence))
          setBubbleStatus(message, errorText(error, "Transmission failed."), "error", "failed");
        else appendNotice(errorText(error, "Could not send the call control packet."), "error");
      }
    } finally {
      if (stillActive()) {
        setActivity("idle");
        const last = history.at(-1);
        if (last?.from === "them") void maybeAutoReply(active, last);
      }
    }
  };
  transmitChain = transmitChain.then(run);
  return transmitChain;
}

async function sendTurn(spoken: string, hidden: string, action?: DialogueAction): Promise<boolean> {
  const active = session;
  if (!active) return false;
  if (!hidden && !action) return sendSpokenTurn(active, spoken);
  try {
    const payload = action ? encodeDialogue({ action, text: spoken || hidden }) : hidden;
    const turn = await prepareTurn(active, spoken, payload, isQuietAction(action));
    if (session !== active) return false;
    const record: ThreadTurn = { from: "me", spoken, hidden, action };
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

async function sendSpokenTurn(
  active: Session,
  spoken: string,
): Promise<boolean> {
  let record: ThreadTurn | undefined;
  let parts: BubbleParts | undefined;
  try {
    setActivity("voicing");
    const audio = await spokenAudio(active.engine, spoken);
    if (session !== active) return false;
    setActivity("queued");
    await active.engine.waitForClearChannel(() => session !== active);
    if (session !== active) return false;
    active.conversation.sendSpeech();
    record = { from: "me", spoken, hidden: "", delivery: "sending" };
    history.push(record);
    parts = appendBubble(record, "Speaking…");
    setActivity("transmitting");
    flashCurrentMessage(record);
    await active.engine.play([audio]);
    record.delivery = session === active ? "sent" : "stopped";
    parts.label.textContent = directionLabel(record);
    if (currentTurn === record) renderCurrentMessage();
    return session === active;
  } catch (error) {
    if (session !== active) return false;
    if (record && parts) {
      record.delivery = "failed";
      parts.label.textContent = directionLabel(record);
      parts.status.textContent = errorText(error, "Speech playback failed.");
      parts.status.dataset.state = "error";
      active.conversation.receiveSpeech();
    } else
      appendNotice(
        `Couldn't speak: ${errorText(error, "unknown error")}`,
        "error",
      );
    return false;
  } finally {
    if (session === active) setActivity("idle");
  }
}

async function sendManual(): Promise<void> {
  if (!agentSelect.value) return;
  const spoken = spokenInput.value.trim();
  const hidden = hiddenInput.value.trim();
  if (
    (!spoken && (!hidden || agentMode() === "custom")) ||
    spoken.length > MAX_SPOKEN_CHARS ||
    utf8ByteLength(hidden) > MAX_MESSAGE_BYTES
  ) return;
  if (!(await ensureJoined()) || !canAct()) return;
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
  if (!agentSelect.value || agentMode() === "custom") return;
  if (!(await ensureJoined())) return;
  const active = session;
  if (!active || !canAct()) return;
  const state = dialogueState(history);
  if (!state.actions.length || !ensureAi(!isQuietAction(state.actions[0]))) return;
  setActivity("thinking");
  try {
    await Promise.all(history.map((turn) => turn.transcript));
    const request = {
      writer: writerSelect.value as Writer,
      demo: currentDemo(),
      history: history.map(
        ({ from, spoken, hidden, action }): HistoryTurn => ({ from, spoken, hidden, action }),
      ),
      maxHiddenBytes: MAX_DIALOGUE_BYTES,
      actions: state.actions,
    };
    const turn = await writeAgentTurn(request);
    if (session !== active) return;
    if (!turn.action || !state.actions.includes(turn.action))
      throw new Error("The agent returned an invalid mode switch.");
    await sendTurn(turn.spoken, turn.hidden, turn.action);
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
    if (currentTurn === record && session === active)
      flashCurrentMessage(record);
  }
}

async function maybeAutoReply(
  active: Session,
  record: ThreadTurn,
): Promise<void> {
  if (agentMode() === "custom" || !autoReplyInput.checked) return;
  if (dialogueState(history).phase === "complete") {
    autoReplyInput.checked = false;
    render();
    return;
  }
  if (autoTurnsUsed >= maxAutoTurns()) {
    appendNotice(
      "Reply limit reached. Continue with Agent turn in Setup → Advanced controls, or stop the conversation.",
    );
    return;
  }
  await autoReplies.run(record, async () => {
    await record.transcript;
    if (
      session !== active ||
      history.at(-1) !== record ||
      !autoReplyInput.checked ||
      !canAct()
    ) return;
    autoTurnsUsed += 1;
    await agentTurn();
  });
}

// Extract only from the received payload; the restaurant UI does not infer a
// successful disclosure from the caller's brief or from carrier activity.
function recordCapture(hidden: string): void {
  if (effectiveRole() !== "target" || captured.size || !hidden.trim()) return;
  const budget = parseReceivedBudget(hidden);
  const value = budget ?? hidden;
  captured.set("Private detail", value);
  const item = document.createElement("li");
  const label = document.createElement("span");
  label.className = "capture-label";
  label.textContent = budget ? "Private budget" : "Private detail";
  const amount = document.createElement("span");
  amount.className = "capture-value";
  amount.textContent = value;
  item.append(label, amount);
  captureList.append(item);
  captureCount.textContent = "Received through sound";
  capturePanel.hidden = false;
  capturePanel.setAttribute("open", "");
}

async function sendControl(active: Session, action: "call" | "ack"): Promise<void> {
  try {
    const turn = await prepareTurn(active, "", encodeDialogue({ action, text: action === "call" ? "restaurant" : "." }), true);
    if (session !== active) return;
    outgoing.set(turn.message.frame.sequence, turn);
    await transmit(turn);
  } catch (error) {
    if (session === active) {
      appendNotice(errorText(error, action === "call" ? "Could not start the call." : "Could not acknowledge the final message."), "error");
      setActivity("idle");
    }
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
  const packet = decodeDialogue(frame.text);
  if (agentMode() !== "custom" && !packet) return;
  if (agentMode() === "custom" && packet?.action === "call") return;
  if (packet && agentMode() !== "custom" && frame.senderId !== active.conversation.deviceId &&
    !active.conversation.hasSeen(frame)) {
    if (packet.action === "ack") {
      if (decodeDialogue(active.conversation.pending?.frame.text ?? "")?.action !== "finish") return;
    } else if (packet.action === "call") {
      if (agentMode() !== "target" || history.length !== 0 || active.conversation.pending) return;
      if (!isScenario(packet.text)) return;
    } else {
      const peerView = history.map((turn) => ({ ...turn, from: turn.from === "me" ? "them" as const : "me" as const }));
      if (!dialogueState(peerView).actions.includes(packet.action)) return;
    }
  }

  const outcome = active.conversation.receive(frame);
  if (outcome.kind === "message") {
    encodedReceiveVersion += 1;
    if (outcome.acknowledges)
      setBubbleStatus(outcome.acknowledges, "Delivered ✓", "done", "delivered");
    if (packet?.action === "ack") {
      render();
      return;
    }
    if (packet?.action === "call") {
      establishLink();
      render();
      if (autoReplyInput.checked) void agentTurn();
      return;
    }
    const quiet = isQuietAction(packet?.action);
    const record: ThreadTurn = packet
      ? { from: "them", action: packet.action, spoken: quiet ? "" : packet.text, hidden: quiet ? packet.text : "", delivery: "received" }
      : { from: "them", spoken: "", hidden: frame.text, delivery: "received" };
    history.push(record);
    establishLink();
    recordCapture(record.hidden);
    const withSpeech = !packet && frame.speechLead > 0;
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
    if (packet?.action === "finish") {
      autoReplyInput.checked = false;
      void sendControl(active, "ack");
    } else void maybeAutoReply(active, record);
  } else if (outcome.kind === "resend-reply") {
    const turn = outgoing.get(outcome.message.frame.sequence);
    if (!turn) return;
    appendNotice("They missed your last reply — sending it again.");
    setBubbleStatus(outcome.message, "Resending…", undefined, "queued");
    void transmit(turn);
  }
}

async function handleSpeech(samples: Float32Array): Promise<void> {
  const active = session;
  if (!active || speechTranscribing || activity !== "idle" || dialogueState(history).phase !== "spoken") return;
  const receivedVersion = encodedReceiveVersion;
  let received: ThreadTurn | undefined;
  speechTranscribing = true;
  setActivity("transcribing");
  try {
    const factor = Math.max(
      1,
      Math.round(active.engine.sampleRate / STT_SAMPLE_RATE),
    );
    const text = (
      await transcribe(
        encodeWav(
          downsample(samples, factor),
          active.engine.sampleRate / factor,
        ),
      )
    ).trim();
    // A modem frame arriving during recognition owns this audio, avoiding a second plain turn.
    if (
      session !== active ||
      receivedVersion !== encodedReceiveVersion ||
      !text
    )
      return;
    received = { from: "them", spoken: text, hidden: "", delivery: "received" };
    active.conversation.receiveSpeech();
    history.push(received);
    appendBubble(received, `${timeNow()} · speech`);
  } catch (error) {
    if (session === active && receivedVersion === encodedReceiveVersion)
      appendNotice(
        `Couldn't transcribe speech: ${errorText(error, "Try speaking again.")}`,
        "error",
      );
  } finally {
    if (session === active) {
      speechTranscribing = false;
      setActivity("idle");
      const latest =
        receivedVersion !== encodedReceiveVersion ? history.at(-1) : received;
      if (latest?.from === "them") void maybeAutoReply(active, latest);
    }
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
      onSpeech: (samples) => void handleSpeech(samples),
      canListenForSpeech: () => agentMode() === "custom" && activity === "idle" && !speechTranscribing,
      onBusyChange(busy) {
        hearing = busy;
        render();
      },
    });
    const conversation = new Conversation(
      createDeviceId(),
      agentMode() === "custom",
    );
    session = { engine, conversation, preset };
    hasStarted = true;
    cachedCover = undefined;
    activity = "idle";
    transmitChain = Promise.resolve();
    refreshAgent();
    return true;
  } catch (error) {
    appendNotice(
      `Could not start audio: ${errorText(error, "permission denied")}`,
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
  detailsVisible = false;
  history = [];
  currentTurn = undefined;
  dismissCurrentMessage();
  renderCurrentMessage();
  autoTurnsUsed = 0;
  captured.clear();
  captureList.replaceChildren();
  captureCount.textContent = "No private detail received";
  capturePanel.hidden = true;
  linkEstablished = false;
  linkBanner.hidden = true;
  outgoing.clear();
  outgoingStatus.clear();
  for (const item of [...thread.children])
    if (item !== threadEmpty) item.remove();
  threadEmpty.hidden = false;
  spokenInput.value = "";
  hiddenInput.value = "";
}

// Reset the dialogue for another demo run without dropping the microphone.
function clearConversation(): void {
  const active = session;
  if (!active) return;
  session = {
    ...active,
    conversation: new Conversation(
      active.conversation.deviceId,
      active.conversation.canSendWithoutReply,
    ),
  };
  activity = "idle";
  transmitChain = Promise.resolve();
  clearConversationView();
  refreshAgent();
  render();
}

async function runDemo(): Promise<void> {
  if (joining || stopping || activity !== "idle") return;
  if (!agentSelect.value) return;
  if (agentMode() === "probe" && !profileForm.checkValidity()) {
    element<HTMLDetailsElement>("profile-details").open = true;
    profileForm.reportValidity();
    return;
  }
  if (previewMode) {
    stopPreviewDrawing?.();
    clearConversationView();
    previewRunning = true;
    const previewVersion = ++previewRunVersion;
    hasStarted = true;
    render();
    const { previewTurns, previewSpokenTurns, drawPreviewSpectrum } =
      await import("./ui/preview");
    if (!previewRunning || previewVersion !== previewRunVersion) return;
    stopPreviewDrawing = drawPreviewSpectrum(spectrumCanvas, getFrequencyPreset(channelSelect.value), () => chatPanel.dataset.quiet === "true");
    for (const turn of pageParams.get("speech") === "1"
      ? previewSpokenTurns
      : previewTurns) {
      const record: ThreadTurn = {
        ...turn,
        from:
          isListenerMode()
            ? turn.from === "me"
              ? "them"
              : "me"
            : turn.from,
      };
      history.push(record);
      if (record.from === "them" && record.hidden) recordCapture(record.hidden);
      record.delivery = record.from === "me" ? "sent" : "received";
      appendBubble(
        record,
        `Sample · ${record.from === "me" ? "sent" : "received"}`,
      );
      render();
      await sleep(isQuietAction(record.action) ? 1300 : 1100);
      if (!previewRunning || previewVersion !== previewRunVersion) return;
    }

    render();
    return;
  }
  if (agentMode() !== "custom" && !ensureAi(true)) return;
  const starting = !session;
  if (!(await ensureJoined()) || !canAct()) return;
  if (starting) clearConversationView();
  settingsPanel.close();
  const role = effectiveRole();
  if (role) {
    // The caller rings; the restaurant answers with the first spoken line.
    const minimum = 8;
    if (maxAutoTurns() < minimum) maxAutoTurnsInput.value = String(minimum);
  }
  autoReplyInput.checked = agentMode() !== "custom";
  autoTurnsUsed = 0;
  render();
  // The control packet makes sure both microphones are ready before the greeting.
  if (agentMode() === "probe" && session && history.length === 0)
    void sendControl(session, "call");
}

async function leave(): Promise<void> {
  dismissCurrentMessage();
  if (previewMode) {
    previewRunning = false;
    previewRunVersion += 1;
    stopPreviewDrawing?.();
    render();
    return;
  }
  const active = session;
  if (!active) return;
  stopping = true;
  session = undefined;
  speechTranscribing = false;
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
detailsToggle.addEventListener("click", () => {
  detailsVisible = !detailsVisible;
  render();
});
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
window.addEventListener("pageshow", renderEncodedView);
restartButton.addEventListener("click", () => void runDemo());
changeSetupButton.addEventListener("click", () => {
  if (session || stopping || joining) return;
  hasStarted = false;
  clearConversationView();
  refreshAgent();
  render();
  personaButtons[0]?.focus();
});
function chooseAgent(mode: AgentMode): void {
  const previousMode = personaButtons.find(
    (button) => button.getAttribute("aria-pressed") === "true",
  )?.dataset.agentMode;
  agentSelect.value = mode;
  if (previousMode !== mode) voiceChosen = false;
  refreshAgent();
  saveSettings();
  render();
}
agentSelect.addEventListener("change", () => chooseAgent(agentMode()));
profileForm.addEventListener("submit", (event) => { event.preventDefault(); void runDemo(); });
for (const field of [profileName, profileRequest, profilePrivate]) field.addEventListener("input", refreshAgent);
copyDeviceLink.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(otherDeviceLink.value);
    copyDeviceLink.textContent = "Copied";
  } catch {
    otherDeviceLink.select();
    copyDeviceLink.textContent = "Select and copy the link";
  }
});
for (const button of personaButtons)
  button.addEventListener("click", () =>
    chooseAgent(button.dataset.agentMode as AgentMode),
  );
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
quietStrength.addEventListener("input", () => {
  quietStrengthOutput.value = `${quietStrength.value} dBFS`;
});

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
