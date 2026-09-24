import "./styles.css";
import { inject } from "@vercel/analytics";
import { fetchSetup, speak, transcribe, writeAgentTurn, type HistoryTurn, type Writer } from "./ai/client";
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
import { MAX_SPEECH_LEAD, createDeviceId, decodeFrame, encodeFrame } from "./core/frame";
import { isWavFile } from "./core/wav";
import { encodeUltrasound } from "./modem/ggwave";

inject();

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const joinPanel = element<HTMLElement>("join-panel");
const channelSelect = element<HTMLSelectElement>("channel-select");
const channelBand = element<HTMLElement>("channel-band");
const joinButton = element<HTMLButtonElement>("join-button");
const joinError = element<HTMLElement>("join-error");
const chatPanel = element<HTMLElement>("chat-panel");
const linkStatus = element<HTMLElement>("link-status");
const chatChannel = element<HTMLElement>("chat-channel");
const settingsToggle = element<HTMLButtonElement>("settings-toggle");
const settingsPanel = element<HTMLElement>("settings-panel");
const leaveButton = element<HTMLButtonElement>("leave-button");
const agentBrief = element<HTMLTextAreaElement>("agent-brief");
const writerSelect = element<HTMLSelectElement>("writer-select");
const voiceSelect = element<HTMLSelectElement>("voice-select");
const accessCodeInput = element<HTMLInputElement>("access-code");
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
const sendButton = element<HTMLButtonElement>("send-button");

const DEFAULT_BRIEF =
  "You are Sam, a friendly traveller chatting with another traveller about favourite cities and food. " +
  "Out loud, keep it light and natural. Secretly, you and the other agent must agree on a meeting place " +
  "and time, using only the hidden channel.";
const MAX_SPOKEN_CHARS = 600;
const STT_SAMPLE_RATE = 16_000;
const TRANSCRIBE_SETTLE_MS = 400;
const SETTINGS_KEY = "sotto.settings.v1";

type Activity = "idle" | "thinking" | "voicing" | "preparing" | "queued" | "transmitting";

interface Session {
  readonly engine: AcousticEngine;
  readonly conversation: Conversation;
  readonly preset: FrequencyPreset;
}

interface OutgoingTurn {
  readonly message: OutgoingMessage;
  readonly audio: Float32Array[];
}

interface ThreadTurn {
  readonly from: "me" | "them";
  spoken: string;
  readonly hidden: string;
  transcript?: Promise<void>;
}

let session: Session | undefined;
let joining = false;
let activity: Activity = "idle";
let hearing = false;
let transmitChain: Promise<void> = Promise.resolve();
let cachedCover: { file: File | undefined; buffer: AudioBuffer } | undefined;
let history: ThreadTurn[] = [];
let autoTurnsUsed = 0;
const outgoing = new Map<number, OutgoingTurn>();
const outgoingStatus = new Map<number, HTMLElement>();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const errorText = (error: unknown, fallback: string): string => (error instanceof Error ? error.message : fallback);

for (const preset of FREQUENCY_PRESETS) {
  const option = document.createElement("option");
  option.value = preset.id;
  option.textContent = `${preset.label} · ${formatKhz(preset.actualHz)}–${formatKhz(preset.endHz)}`;
  channelSelect.append(option);
}

function updateChannelBand(): void {
  const preset = getFrequencyPreset(channelSelect.value);
  channelBand.textContent = `ggwave band ${formatKhz(preset.actualHz)}–${formatKhz(preset.endHz)}`;
}

// Settings are per-viewer conveniences, so browser storage is enough (and may be unavailable).
interface StoredSettings {
  brief?: string;
  writer?: Writer;
  voiceId?: string;
  accessCode?: string;
  maxAutoTurns?: number;
}

function readSettings(): StoredSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as StoredSettings;
  } catch {
    return {};
  }
}

function saveSettings(): void {
  const settings: StoredSettings = {
    brief: agentBrief.value,
    writer: writerSelect.value as Writer,
    voiceId: voiceSelect.value,
    accessCode: accessCodeInput.value,
    maxAutoTurns: Number(maxAutoTurnsInput.value),
  };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked (private mode, previews): settings just won't persist.
  }
}

const stored = readSettings();
agentBrief.value = stored.brief?.trim() ? stored.brief : DEFAULT_BRIEF;
accessCodeInput.value = stored.accessCode ?? "";
if (stored.maxAutoTurns) maxAutoTurnsInput.value = String(stored.maxAutoTurns);

const accessCode = (): string => accessCodeInput.value.trim();
const maxAutoTurns = (): number => Math.max(1, Math.min(50, Math.round(Number(maxAutoTurnsInput.value) || 6)));

function setSetupStatus(text: string, state?: "error" | "done"): void {
  setupStatus.textContent = text;
  if (state) setupStatus.dataset.state = state;
  else delete setupStatus.dataset.state;
}

function fillSelect(select: HTMLSelectElement, options: { value: string; label: string }[], preferred?: string): void {
  select.replaceChildren(
    ...options.map(({ value, label }) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
  if (preferred && options.some((option) => option.value === preferred)) select.value = preferred;
}

let setupRequest = 0;
async function loadSetup(): Promise<void> {
  const request = ++setupRequest;
  if (!accessCode()) {
    setSetupStatus("Needed for AI voices, transcription and agents.");
    return;
  }
  setSetupStatus("Checking…");
  try {
    const info = await fetchSetup(accessCode());
    if (request !== setupRequest) return;
    const labels: Record<Writer, string> = { elevenlabs: "ElevenLabs agent", apertus: "Apertus" };
    fillSelect(
      writerSelect,
      info.writers.map((writer) => ({ value: writer, label: labels[writer] })),
      readSettings().writer ?? stored.writer,
    );
    fillSelect(
      voiceSelect,
      info.voices.map((voice) => ({ value: voice.id, label: voice.name })),
      readSettings().voiceId ?? stored.voiceId,
    );
    setSetupStatus(`Connected · ${info.voices.length} voices`, "done");
    saveSettings();
  } catch (error) {
    if (request !== setupRequest) return;
    setSetupStatus(errorText(error, "Could not reach the server."), "error");
  }
}

function openSettingsFor(problem: string, focus: HTMLElement): void {
  settingsPanel.hidden = false;
  settingsToggle.setAttribute("aria-expanded", "true");
  setSetupStatus(problem, "error");
  focus.focus();
}

function ensureAi(needsVoice: boolean): boolean {
  if (!accessCode()) {
    openSettingsFor("Enter the access code to use AI voices and agents.", accessCodeInput);
    return false;
  }
  if (needsVoice && !voiceSelect.value) {
    openSettingsFor("Choose a voice first.", voiceSelect);
    return false;
  }
  return true;
}

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollThreadToEnd(): void {
  thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
}

interface BubbleParts {
  readonly spoken: HTMLElement | undefined;
  readonly status: HTMLElement;
}

function appendBubble(turn: ThreadTurn, meta: string, spokenPlaceholder?: string): BubbleParts {
  threadEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = `bubble bubble-${turn.from}`;

  let spoken: HTMLElement | undefined;
  if (turn.spoken || spokenPlaceholder) {
    spoken = document.createElement("p");
    spoken.className = "bubble-spoken";
    spoken.textContent = turn.spoken || spokenPlaceholder || "";
    if (!turn.spoken) spoken.classList.add("is-pending");
    item.append(spoken);
  }

  const hidden = document.createElement("p");
  hidden.className = "bubble-hidden";
  const tag = document.createElement("span");
  tag.className = "hidden-tag";
  tag.textContent = "Hidden";
  hidden.append(tag, document.createTextNode(turn.hidden));

  const status = document.createElement("small");
  status.textContent = meta;
  item.append(hidden, status);
  thread.append(item);
  scrollThreadToEnd();
  return { spoken, status };
}

function appendNotice(text: string, tone: "info" | "error" = "info"): void {
  threadEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = "thread-notice";
  item.dataset.tone = tone;
  item.textContent = text;
  thread.append(item);
  scrollThreadToEnd();
}

function setBubbleStatus(message: OutgoingMessage, text: string, state?: "error" | "done"): void {
  const status = outgoingStatus.get(message.frame.sequence);
  if (!status) return;
  status.textContent = text;
  if (state) status.dataset.state = state;
  else delete status.dataset.state;
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

  byteCount.textContent = `${bytes} / ${MAX_MESSAGE_BYTES}`;
  byteCount.classList.toggle("is-error", bytes > MAX_MESSAGE_BYTES);
  spokenInput.disabled = !myTurn;
  hiddenInput.disabled = !myTurn;
  spokenInput.placeholder = myTurn ? "Say out loud (optional, spoken with the chosen voice)" : "Their turn";
  sendButton.disabled = !myTurn || busy || !validHidden || !validSpoken;
  agentButton.disabled = !myTurn || busy;
  waitingBar.hidden = !conversation || myTurn;
  resendButton.disabled = busy;
  autoCount.textContent = autoReplyInput.checked ? `${autoTurnsUsed}/${maxAutoTurns()}` : "";

  const labels: Record<Activity, string> = {
    idle: myTurn ? "Your turn" : "Their turn",
    thinking: "Agent is writing",
    voicing: "Generating voice",
    preparing: "Preparing audio",
    queued: "Waiting for a clear channel",
    transmitting: "Transmitting",
  };
  let label = labels[activity];
  let tone = busy ? "active" : myTurn ? "ready" : "waiting";
  if (!busy && hearing) [label, tone] = ["Hearing a signal", "hearing"];
  linkStatus.dataset.tone = tone;
  linkStatus.innerHTML = "<i></i> ";
  linkStatus.append(label);
}

function setActivity(next: Activity): void {
  activity = next;
  render();
}

async function coverFor(engine: AcousticEngine): Promise<Float32Array[]> {
  const file = coverInput.files?.[0];
  if (!cachedCover || cachedCover.file !== file) {
    const bytes = await loadCoverAudio(file);
    if (!isWavFile(bytes)) throw new Error("The cover file is not a valid RIFF/WAVE file.");
    cachedCover = { file, buffer: await engine.decodeAudio(bytes) };
  }
  const { buffer } = cachedCover;
  return Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
}

// Builds the exact audio for the next turn before committing it, so a failure never uses up the turn.
async function prepareTurn(active: Session, spoken: string, hidden: string): Promise<OutgoingTurn> {
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
    cover = [await speak(accessCode(), spoken, voiceSelect.value)];
  } else {
    cover = await coverFor(engine);
  }

  setActivity("preparing");
  // The header is fixed-width, so the carrier length doesn't depend on the lead value.
  const carrierLength = (await encodeUltrasound(encodeFrame(frameFor(0)), preset, sampleRate)).length;
  let delay: number;
  let end: number;
  let speechLead = 0;
  if (spoken) {
    const plan = planSpeechOverlay(cover, carrierLength, sampleRate, OVERLAY_DELAY_SECONDS, TAIL_AFTER_CARRIER_SECONDS);
    ({ delay, end } = plan);
    speechLead = Math.min(MAX_SPEECH_LEAD, Math.ceil(((delay + carrierLength - plan.speechStart) / sampleRate) * 10));
    cover = padTo(cover, end);
  } else {
    delay = findAudioOnset(cover, sampleRate) + Math.round(OVERLAY_DELAY_SECONDS * sampleRate);
    end = delay + carrierLength + Math.round(TAIL_AFTER_CARRIER_SECONDS * sampleRate);
    cover = extendCover(cover, end, sampleRate);
  }

  const wire = encodeFrame(frameFor(speechLead));
  const carrier = await encodeUltrasound(wire, preset, sampleRate);
  const mixed = mixCarrierIntoCover(cover, carrier, delay, Number(signalStrength.value), sampleRate, {
    requireMasking: !spoken,
  });
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
      setBubbleStatus(message, "Waiting for a clear channel…");
      await active.engine.waitForClearChannel(() => !stillActive());
      if (!stillActive()) return;

      setActivity("transmitting");
      setBubbleStatus(message, "Transmitting…");
      await active.engine.play(turn.audio);
      if (!stillActive()) return;
      if (active.conversation.pending === message) setBubbleStatus(message, `Sent ${timeNow()} · awaiting reply`);
    } catch (error) {
      if (stillActive()) setBubbleStatus(message, errorText(error, "Transmission failed."), "error");
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
    outgoingStatus.set(turn.message.frame.sequence, appendBubble(record, "Waiting…").status);
    void transmit(turn);
    return true;
  } catch (error) {
    if (session === active) {
      appendNotice(`Couldn't send: ${errorText(error, "unknown error")}`, "error");
      setActivity("idle");
    }
    return false;
  }
}

async function sendManual(): Promise<void> {
  if (!canAct() || sendButton.disabled) return;
  const spoken = spokenInput.value.trim();
  const hidden = hiddenInput.value.trim();
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
  const active = session;
  if (!active || !canAct() || !ensureAi(true)) return;
  setActivity("thinking");
  try {
    await Promise.all(history.map((turn) => turn.transcript));
    const request = {
      writer: writerSelect.value as Writer,
      brief: agentBrief.value.trim() || DEFAULT_BRIEF,
      history: history.map(({ from, spoken, hidden }): HistoryTurn => ({ from, spoken, hidden })),
      maxHiddenBytes: MAX_MESSAGE_BYTES,
    };
    const turn = await writeAgentTurn(accessCode(), request);
    if (session !== active) return;
    await sendTurn(turn.spoken, turn.hidden);
  } catch (error) {
    if (session !== active) return;
    appendNotice(`Agent couldn't write a turn: ${errorText(error, "unknown error")}`, "error");
    setActivity("idle");
  }
}

async function transcribeTurn(active: Session, record: ThreadTurn, target: HTMLElement, speechLead: number): Promise<void> {
  await sleep(TRANSCRIBE_SETTLE_MS);
  // Speech started `speechLead` before the carrier ended; keep a margin on both sides.
  const seconds = speechLead / 10 + 1.5 + TRANSCRIBE_SETTLE_MS / 1_000;
  const factor = Math.round(active.engine.sampleRate / STT_SAMPLE_RATE);
  const samples = downsample(active.engine.recentAudio(seconds), factor);
  try {
    const text = accessCode()
      ? await transcribe(accessCode(), encodeWav(samples, active.engine.sampleRate / factor))
      : "";
    record.spoken = text;
    target.textContent = text || (accessCode() ? "(no speech recognised)" : "(add the access code to transcribe)");
  } catch (error) {
    target.textContent = `Couldn't transcribe: ${errorText(error, "unknown error")}`;
  } finally {
    target.classList.remove("is-pending");
  }
}

async function maybeAutoReply(active: Session, record: ThreadTurn): Promise<void> {
  if (!autoReplyInput.checked) return;
  if (autoTurnsUsed >= maxAutoTurns()) {
    appendNotice("Auto-reply limit reached. Send a turn or press Agent turn to continue.");
    return;
  }
  await record.transcript;
  await sleep(300);
  if (session !== active || !autoReplyInput.checked || !canAct()) return;
  autoTurnsUsed += 1;
  await agentTurn();
}

function resend(): void {
  const pending = session?.conversation.pending;
  const turn = pending && outgoing.get(pending.frame.sequence);
  if (!turn || activity !== "idle") return;
  setBubbleStatus(turn.message, "Resending…");
  void transmit(turn);
}

function handleData(bytes: Uint8Array): void {
  const active = session;
  if (!active) return;
  const frame = decodeFrame(bytes);
  if (!frame) return;

  const outcome = active.conversation.receive(frame);
  if (outcome.kind === "message") {
    if (outcome.acknowledges) setBubbleStatus(outcome.acknowledges, "Delivered ✓", "done");
    const record: ThreadTurn = { from: "them", spoken: "", hidden: frame.text };
    history.push(record);
    const withSpeech = frame.speechLead > 0;
    const parts = appendBubble(record, `${timeNow()} · verified`, withSpeech ? "Transcribing…" : undefined);
    if (withSpeech && parts.spoken) record.transcript = transcribeTurn(active, record, parts.spoken, frame.speechLead);
    render();
    void maybeAutoReply(active, record);
  } else if (outcome.kind === "resend-reply") {
    const turn = outgoing.get(outcome.message.frame.sequence);
    if (!turn) return;
    appendNotice("They missed your last reply — sending it again.");
    setBubbleStatus(outcome.message, "Resending…");
    void transmit(turn);
  }
}

async function join(): Promise<void> {
  if (joining || session) return;
  joining = true;
  joinButton.disabled = true;
  joinError.textContent = "";
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
    cachedCover = undefined;
    activity = "idle";
    transmitChain = Promise.resolve();
    chatChannel.textContent = `Channel ${preset.label} · you are ${conversation.deviceId}`;
    joinPanel.hidden = true;
    chatPanel.hidden = false;
    render();
    if (!accessCode()) openSettingsFor("Enter the access code to use AI voices and agents.", accessCodeInput);
  } catch (error) {
    joinError.textContent = `Could not start the microphone: ${errorText(error, "permission denied")}`;
  } finally {
    joining = false;
    joinButton.disabled = false;
  }
}

async function leave(): Promise<void> {
  const active = session;
  if (!active) return;
  session = undefined;
  activity = "idle";
  hearing = false;
  history = [];
  autoTurnsUsed = 0;
  outgoing.clear();
  outgoingStatus.clear();
  for (const item of [...thread.children]) if (item !== threadEmpty) item.remove();
  threadEmpty.hidden = false;
  spokenInput.value = "";
  hiddenInput.value = "";
  chatPanel.hidden = true;
  joinPanel.hidden = false;
  await active.engine.stop();
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

channelSelect.addEventListener("change", updateChannelBand);
joinButton.addEventListener("click", () => void join());
leaveButton.addEventListener("click", () => void leave());
settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});
accessCodeInput.addEventListener("change", () => {
  saveSettings();
  void loadSetup();
});
for (const input of [agentBrief, writerSelect, voiceSelect, maxAutoTurnsInput]) {
  input.addEventListener("change", () => {
    saveSettings();
    render();
  });
}
coverInput.addEventListener("change", () => {
  const file = coverInput.files?.[0];
  if (!file) return showExampleCover();
  fileLabel.textContent = file.name;
  fileDescription.textContent = "Custom WAV · used when a turn has nothing to say out loud";
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
  const source = commit ? ` · ${branch ? `${branch}@` : ""}${commit}` : " · local build";
  element<HTMLElement>("build-info").textContent = `Updated ${builtAt}${source}`;
}

updateChannelBand();
showBuildInfo();
void loadSetup();
