import "./styles.css";
import { inject } from "@vercel/analytics";
import { startAcousticEngine, type AcousticEngine } from "./audio/engine";
import { extendCover, findAudioOnset, mixCarrierIntoCover, trimWithFade } from "./audio/mix";
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
import { createDeviceId, decodeFrame } from "./core/frame";
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
const messageInput = element<HTMLTextAreaElement>("message-input");
const sendButton = element<HTMLButtonElement>("send-button");
const byteCount = element<HTMLOutputElement>("byte-count");

type Activity = "idle" | "preparing" | "queued" | "transmitting";

interface Session {
  readonly engine: AcousticEngine;
  readonly conversation: Conversation;
  readonly preset: FrequencyPreset;
}

let session: Session | undefined;
let joining = false;
let activity: Activity = "idle";
let hearing = false;
let transmitChain: Promise<void> = Promise.resolve();
let cachedCover: { file: File | undefined; buffer: AudioBuffer } | undefined;
const outgoingStatus = new Map<number, HTMLElement>();

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

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function scrollThreadToEnd(): void {
  thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
}

function appendBubble(text: string, from: "me" | "them", meta: string): HTMLElement {
  threadEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = `bubble bubble-${from}`;
  const body = document.createElement("p");
  body.textContent = text;
  const status = document.createElement("small");
  status.textContent = meta;
  item.append(body, status);
  thread.append(item);
  scrollThreadToEnd();
  return status;
}

function appendNotice(text: string): void {
  threadEmpty.hidden = true;
  const item = document.createElement("li");
  item.className = "thread-notice";
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

function render(): void {
  const conversation = session?.conversation;
  const myTurn = conversation?.turn === "mine";
  const busyTransmitting = activity !== "idle";
  const bytes = utf8ByteLength(messageInput.value);
  const validLength = bytes > 0 && bytes <= MAX_MESSAGE_BYTES;

  byteCount.textContent = `${bytes} / ${MAX_MESSAGE_BYTES} bytes`;
  byteCount.classList.toggle("is-error", bytes > MAX_MESSAGE_BYTES);
  messageInput.disabled = !myTurn;
  messageInput.placeholder = myTurn ? "Type a message" : "Their turn — wait for a reply";
  sendButton.disabled = !myTurn || busyTransmitting || !validLength;
  waitingBar.hidden = !conversation || myTurn;
  resendButton.disabled = busyTransmitting;

  let label = myTurn ? "Your turn" : "Their turn";
  let tone = myTurn ? "ready" : "waiting";
  if (activity === "preparing") [label, tone] = ["Preparing audio", "active"];
  else if (activity === "queued") [label, tone] = ["Waiting for a clear channel", "active"];
  else if (activity === "transmitting") [label, tone] = ["Transmitting", "active"];
  else if (hearing) [label, tone] = ["Hearing a signal", "hearing"];
  linkStatus.dataset.tone = tone;
  linkStatus.innerHTML = "<i></i> ";
  linkStatus.append(label);
}

async function coverFor(engine: AcousticEngine): Promise<AudioBuffer> {
  const file = coverInput.files?.[0];
  if (cachedCover && cachedCover.file === file) return cachedCover.buffer;
  const bytes = await loadCoverAudio(file);
  if (!isWavFile(bytes)) throw new Error("The cover file is not a valid RIFF/WAVE file.");
  const buffer = await engine.decodeAudio(bytes);
  cachedCover = { file, buffer };
  return buffer;
}

async function buildTransmission(active: Session, wire: string): Promise<Float32Array[]> {
  const { engine, preset } = active;
  const cover = await coverFor(engine);
  const channels = Array.from({ length: cover.numberOfChannels }, (_, index) => cover.getChannelData(index));
  const carrier = await encodeUltrasound(wire, preset, engine.sampleRate);
  const delay = findAudioOnset(channels, engine.sampleRate) + Math.round(OVERLAY_DELAY_SECONDS * engine.sampleRate);
  const end = delay + carrier.length + Math.round(TAIL_AFTER_CARRIER_SECONDS * engine.sampleRate);
  const extended = extendCover(channels, end, engine.sampleRate);
  const mixed = mixCarrierIntoCover(extended, carrier, delay, Number(signalStrength.value), engine.sampleRate);
  return trimWithFade(mixed.channels, end, engine.sampleRate);
}

function transmit(message: OutgoingMessage): Promise<void> {
  const active = session;
  const run = async (): Promise<void> => {
    if (session !== active || !active) return;
    const stillActive = (): boolean => session === active;
    try {
      activity = "preparing";
      render();
      const audio = await buildTransmission(active, message.wire);
      if (!stillActive()) return;

      activity = "queued";
      setBubbleStatus(message, "Waiting for a clear channel…");
      render();
      await active.engine.waitForClearChannel(() => !stillActive());
      if (!stillActive()) return;

      activity = "transmitting";
      setBubbleStatus(message, "Transmitting…");
      render();
      await active.engine.play(audio);
      if (!stillActive()) return;
      if (active.conversation.pending === message) setBubbleStatus(message, `Sent ${timeNow()} · awaiting reply`);
    } catch (error) {
      if (!stillActive()) return;
      setBubbleStatus(message, error instanceof Error ? error.message : "Transmission failed.", "error");
    } finally {
      if (stillActive()) {
        activity = "idle";
        render();
      }
    }
  };
  transmitChain = transmitChain.then(run);
  return transmitChain;
}

function send(): void {
  if (!session || sendButton.disabled) return;
  const text = messageInput.value;
  const message = session.conversation.send(text);
  outgoingStatus.set(message.frame.sequence, appendBubble(text, "me", "Preparing…"));
  messageInput.value = "";
  resizeInput();
  render();
  void transmit(message);
}

function resend(): void {
  const message = session?.conversation.pending;
  if (!message || activity !== "idle") return;
  setBubbleStatus(message, "Resending…");
  void transmit(message);
}

function handleData(bytes: Uint8Array): void {
  const active = session;
  if (!active) return;
  const frame = decodeFrame(bytes);
  if (!frame) return;

  const outcome = active.conversation.receive(frame);
  if (outcome.kind === "message") {
    if (outcome.acknowledges) setBubbleStatus(outcome.acknowledges, "Delivered ✓", "done");
    appendBubble(frame.text, "them", `${timeNow()} · verified`);
    render();
    messageInput.focus();
  } else if (outcome.kind === "resend-reply") {
    appendNotice("They missed your last reply — sending it again.");
    setBubbleStatus(outcome.message, "Resending…");
    void transmit(outcome.message);
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
    messageInput.focus();
  } catch (error) {
    joinError.textContent =
      error instanceof Error ? `Could not start the microphone: ${error.message}` : "Could not start the microphone.";
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
  outgoingStatus.clear();
  for (const item of [...thread.children]) if (item !== threadEmpty) item.remove();
  threadEmpty.hidden = false;
  messageInput.value = "";
  chatPanel.hidden = true;
  joinPanel.hidden = false;
  await active.engine.stop();
}

function resizeInput(): void {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 140)}px`;
}

function showExampleCover(): void {
  coverInput.value = "";
  fileLabel.textContent = "Included example speech";
  fileDescription.textContent = "8.8 seconds · looped when a message needs longer";
  useExampleButton.hidden = true;
}

channelSelect.addEventListener("change", updateChannelBand);
joinButton.addEventListener("click", () => void join());
leaveButton.addEventListener("click", () => void leave());
settingsToggle.addEventListener("click", () => {
  settingsPanel.hidden = !settingsPanel.hidden;
  settingsToggle.setAttribute("aria-expanded", String(!settingsPanel.hidden));
});
coverInput.addEventListener("change", () => {
  const file = coverInput.files?.[0];
  if (!file) return showExampleCover();
  fileLabel.textContent = file.name;
  fileDescription.textContent = "Custom WAV · looped when a message needs longer";
  useExampleButton.hidden = false;
});
useExampleButton.addEventListener("click", showExampleCover);
signalStrength.addEventListener("input", () => {
  strengthOutput.textContent = `−${Math.abs(Number(signalStrength.value))} dB`;
});
messageInput.addEventListener("input", () => {
  resizeInput();
  render();
});
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
});
composer.addEventListener("submit", (event) => {
  event.preventDefault();
  send();
});
resendButton.addEventListener("click", resend);
window.addEventListener("pagehide", () => void leave());

updateChannelBand();
