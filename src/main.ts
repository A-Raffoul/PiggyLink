import "./styles.css";
import { inject } from "@vercel/analytics";
import { startAcousticReceiver, type AcousticReceiver, type CaptureSettings } from "./audio/capture";
import { findAudioOnset, mixCarrierIntoCover } from "./audio/mix";
import {
  FREQUENCY_PRESETS,
  MAX_MESSAGE_BYTES,
  OVERLAY_DELAY_SECONDS,
  formatKhz,
  getFrequencyPreset,
  utf8ByteLength,
} from "./core/config";
import { loadCoverAudio } from "./core/cover";
import { decodePrivateFrame, encodePrivateFrame } from "./core/frame";
import {
  exportTrialEventsCsv,
  formatTrialMessage,
  isTrialMessage,
  recordTrialEvent,
  type TrialEvent,
} from "./core/trials";
import { isWavFile } from "./core/wav";
import { encodeUltrasound } from "./modem/ggwave";

inject();

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const senderTab = element<HTMLButtonElement>("sender-tab");
const receiverTab = element<HTMLButtonElement>("receiver-tab");
const senderPanel = element<HTMLElement>("sender-panel");
const receiverPanel = element<HTMLElement>("receiver-panel");
const coverInput = element<HTMLInputElement>("cover-file");
const fileLabel = element<HTMLElement>("file-label");
const fileDescription = element<HTMLElement>("file-description");
const useExampleButton = element<HTMLButtonElement>("use-example");
const privateMessage = element<HTMLTextAreaElement>("private-message");
const byteCount = element<HTMLOutputElement>("byte-count");
const messageError = element<HTMLElement>("message-error");
const senderFrequency = element<HTMLSelectElement>("sender-frequency");
const receiverFrequency = element<HTMLSelectElement>("receiver-frequency");
const senderBand = element<HTMLElement>("sender-band");
const receiverBand = element<HTMLElement>("receiver-band");
const signalStrength = element<HTMLInputElement>("signal-strength");
const strengthOutput = element<HTMLOutputElement>("strength-output");
const transmitButton = element<HTMLButtonElement>("transmit-button");
const senderStatus = element<HTMLElement>("sender-status");
const trialFirst = element<HTMLInputElement>("trial-first");
const trialCount = element<HTMLInputElement>("trial-count");
const trialPause = element<HTMLSelectElement>("trial-pause");
const startTrialsButton = element<HTMLButtonElement>("start-trials");
const stopTrialsButton = element<HTMLButtonElement>("stop-trials");
const trialStatus = element<HTMLElement>("trial-status");
const listenButton = element<HTMLButtonElement>("listen-button");
const stopButton = element<HTMLButtonElement>("stop-button");
const receiverRoleStatus = element<HTMLElement>("receiver-role-status");
const captureTitle = element<HTMLElement>("capture-title");
const captureDescription = element<HTMLElement>("capture-description");
const captureSettings = element<HTMLElement>("capture-settings");
const frameCount = element<HTMLElement>("frame-count");
const spectrumCanvas = element<HTMLCanvasElement>("spectrum");
const receivedMessage = element<HTMLElement>("received-message");
const receivedMeta = element<HTMLElement>("received-meta");
const trialLogSummary = element<HTMLElement>("trial-log-summary");
const trialLogCount = element<HTMLElement>("trial-log-count");
const trialLogList = element<HTMLOListElement>("trial-log-list");
const exportTrialsButton = element<HTMLButtonElement>("export-trials");
const clearTrialsButton = element<HTMLButtonElement>("clear-trials");

let receiver: AcousticReceiver | undefined;
let receiverStartGeneration = 0;
let senderContext: AudioContext | undefined;
let playingSource: AudioBufferSourceNode | undefined;
let batchCancelled = false;
let cancelBatchPause: (() => void) | undefined;
let trialEvents: TrialEvent[] = [];

function frequencyOptionMarkup(select: HTMLSelectElement): void {
  for (const preset of FREQUENCY_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${preset.label} · ${formatKhz(preset.actualHz)}–${formatKhz(preset.endHz)}`;
    select.append(option);
  }
}

frequencyOptionMarkup(senderFrequency);
frequencyOptionMarkup(receiverFrequency);

function updateBandLabels(): void {
  const senderPreset = getFrequencyPreset(senderFrequency.value);
  const receiverPreset = getFrequencyPreset(receiverFrequency.value);
  senderBand.textContent = `Actual ggwave band: ${formatKhz(senderPreset.actualHz)}–${formatKhz(senderPreset.endHz)}`;
  receiverBand.textContent = `Listening at ${formatKhz(receiverPreset.actualHz)}–${formatKhz(receiverPreset.endHz)}`;
}

function updateMessageCount(): boolean {
  const count = utf8ByteLength(privateMessage.value);
  const valid = count > 0 && count <= MAX_MESSAGE_BYTES;
  byteCount.textContent = `${count} / ${MAX_MESSAGE_BYTES} bytes`;
  byteCount.classList.toggle("is-error", count > MAX_MESSAGE_BYTES);
  messageError.textContent = count > MAX_MESSAGE_BYTES ? "Message exceeds the 32-byte UTF-8 limit." : "";
  return valid;
}

function setSenderStatus(message: string, state: "normal" | "error" | "success" = "normal"): void {
  senderStatus.textContent = message;
  senderStatus.dataset.state = state;
}

function setTrialStatus(message: string, state: "normal" | "error" | "success" = "normal"): void {
  trialStatus.textContent = message;
  trialStatus.dataset.state = state;
}

function modeFromHash(): "sender" | "receiver" {
  return window.location.hash === "#receiver" ? "receiver" : "sender";
}

async function setMode(mode: "sender" | "receiver"): Promise<void> {
  const showSender = mode === "sender";
  senderPanel.hidden = !showSender;
  receiverPanel.hidden = showSender;
  senderTab.classList.toggle("is-active", showSender);
  receiverTab.classList.toggle("is-active", !showSender);
  senderTab.setAttribute("aria-selected", String(showSender));
  receiverTab.setAttribute("aria-selected", String(!showSender));
  if (showSender && receiver) await stopListening();
}

senderTab.addEventListener("click", () => {
  window.location.hash = "sender";
});
receiverTab.addEventListener("click", () => {
  window.location.hash = "receiver";
});
window.addEventListener("hashchange", () => void setMode(modeFromHash()));

coverInput.addEventListener("change", () => {
  const file = coverInput.files?.[0];
  if (file) {
    fileLabel.textContent = file.name;
    fileDescription.textContent = "Custom lossless WAV · selected for this session";
    useExampleButton.hidden = false;
    setSenderStatus("Custom WAV selected. Ready when the message is valid.");
  } else {
    showExampleCover();
  }
});

function showExampleCover(): void {
  coverInput.value = "";
  fileLabel.textContent = "Included example speech";
  fileDescription.textContent = "8.8 seconds · 48 kHz mono · ready to transmit";
  useExampleButton.hidden = true;
  setSenderStatus("Included example ready. Enter a private message.");
}

useExampleButton.addEventListener("click", showExampleCover);
privateMessage.addEventListener("input", updateMessageCount);
senderFrequency.addEventListener("change", updateBandLabels);
receiverFrequency.addEventListener("change", updateBandLabels);
signalStrength.addEventListener("input", () => {
  strengthOutput.textContent = `−${Math.abs(Number(signalStrength.value))} dB`;
});

function getSenderContext(): AudioContext {
  senderContext ??= new AudioContext({ sampleRate: 48_000 });
  return senderContext;
}

async function playTransmission(message: string): Promise<{ presetLabel: string }> {
  const file = coverInput.files?.[0];
  try {
    const fileBytes = await loadCoverAudio(file);
    if (!isWavFile(fileBytes)) throw new Error("The selected file is not a valid RIFF/WAVE file.");

    const audioContext = getSenderContext();
    await audioContext.resume();
    const cover = await audioContext.decodeAudioData(fileBytes.slice(0));
    const preset = getFrequencyPreset(senderFrequency.value);
    const framedMessage = encodePrivateFrame(message);
    const carrier = await encodeUltrasound(framedMessage, preset, audioContext.sampleRate);
    const channels = Array.from({ length: cover.numberOfChannels }, (_, index) => cover.getChannelData(index));
    const speechOnset = findAudioOnset(channels, audioContext.sampleRate);
    const delaySamples = speechOnset + Math.round(OVERLAY_DELAY_SECONDS * audioContext.sampleRate);
    const requiredSeconds = (delaySamples + carrier.length) / audioContext.sampleRate;

    if (cover.length < delaySamples + carrier.length) {
      throw new Error(
        `This WAV is ${cover.duration.toFixed(1)} s; the encoded message needs at least ${requiredSeconds.toFixed(1)} s.`,
      );
    }

    const mixed = mixCarrierIntoCover(
      channels,
      carrier,
      delaySamples,
      Number(signalStrength.value),
      audioContext.sampleRate,
    );
    const output = audioContext.createBuffer(
      mixed.channels.length,
      mixed.channels[0]?.length ?? 0,
      audioContext.sampleRate,
    );
    mixed.channels.forEach((channel, index) => output.getChannelData(index).set(channel));

    playingSource?.stop();
    const source = audioContext.createBufferSource();
    playingSource = source;
    source.buffer = output;
    source.connect(audioContext.destination);
    const playbackComplete = new Promise<void>((resolve) => {
      source.onended = () => {
        if (playingSource === source) playingSource = undefined;
        resolve();
      };
    });
    source.start();
    await playbackComplete;
    return { presetLabel: preset.label };
  } catch (error) {
    throw error instanceof Error ? error : new Error("Transmission failed.");
  }
}

async function transmit(): Promise<void> {
  if (!updateMessageCount()) {
    setSenderStatus("Enter a private message between 1 and 32 UTF-8 bytes.", "error");
    return;
  }

  transmitButton.disabled = true;
  setSenderStatus("Preparing the ggwave signal…");
  try {
    const result = await playTransmission(privateMessage.value);
    setSenderStatus(`Transmission complete · ${result.presetLabel} · ${signalStrength.value} dB`, "success");
  } catch (error) {
    setSenderStatus(error instanceof Error ? error.message : "Transmission failed.", "error");
  } finally {
    transmitButton.disabled = false;
  }
}

function parseTrialSettings(): { first: number; count: number; pauseMilliseconds: number } {
  const first = Number(trialFirst.value);
  const count = Number(trialCount.value);
  const pauseMilliseconds = Number(trialPause.value) * 1_000;
  formatTrialMessage(first);
  if (!Number.isInteger(count) || count < 1 || count > 100 || first + count - 1 > 9_999) {
    throw new Error("Choose 1–100 trials that stay within message 9999.");
  }
  return { first, count, pauseMilliseconds };
}

function setBatchActive(active: boolean): void {
  transmitButton.disabled = active;
  coverInput.disabled = active;
  privateMessage.disabled = active;
  senderFrequency.disabled = active;
  signalStrength.disabled = active;
  trialFirst.disabled = active;
  trialCount.disabled = active;
  trialPause.disabled = active;
  startTrialsButton.hidden = active;
  stopTrialsButton.hidden = !active;
}

function waitForBatchPause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      cancelBatchPause = undefined;
      resolve();
    }, milliseconds);
    cancelBatchPause = () => {
      window.clearTimeout(timer);
      cancelBatchPause = undefined;
      resolve();
    };
  });
}

async function runTrialBatch(): Promise<void> {
  if (playingSource) {
    setTrialStatus("Wait for the current transmission to finish before starting a batch.", "error");
    return;
  }

  let settings: { first: number; count: number; pauseMilliseconds: number };
  try {
    settings = parseTrialSettings();
  } catch (error) {
    setTrialStatus(error instanceof Error ? error.message : "Invalid trial settings.", "error");
    return;
  }

  batchCancelled = false;
  setBatchActive(true);
  try {
    for (let offset = 0; offset < settings.count; offset += 1) {
      if (batchCancelled) break;
      const message = formatTrialMessage(settings.first + offset);
      setTrialStatus(`Trial ${offset + 1}/${settings.count}: sending ${message}…`);
      setSenderStatus(`Baseline trial ${message} is transmitting…`);
      await playTransmission(message);
      if (batchCancelled) break;

      if (offset < settings.count - 1) {
        setTrialStatus(`Trial ${offset + 1}/${settings.count}: ${message} complete · pausing before next send…`);
        await waitForBatchPause(settings.pauseMilliseconds);
      }
    }
    setTrialStatus(
      batchCancelled ? "Batch stopped. Received numbered trials remain in the receiver log." : "Batch complete. Export the receiver log before the next condition.",
      batchCancelled ? "normal" : "success",
    );
  } catch (error) {
    setTrialStatus(error instanceof Error ? error.message : "Batch transmission failed.", "error");
  } finally {
    cancelBatchPause = undefined;
    setBatchActive(false);
  }
}

function stopTrialBatch(): void {
  batchCancelled = true;
  cancelBatchPause?.();
  try {
    playingSource?.stop();
  } catch {
    // A source can already have ended between the button tap and this call.
  }
}

function renderTrialLog(): void {
  const duplicates = trialEvents.filter((event) => event.duplicate).length;
  const unique = trialEvents.length - duplicates;
  trialLogCount.textContent = String(trialEvents.length);
  trialLogSummary.textContent =
    trialEvents.length === 0
      ? "No numbered trials decoded this session."
      : `${unique} unique · ${duplicates} duplicate${duplicates === 1 ? "" : "s"}`;
  trialLogList.replaceChildren(
    ...trialEvents
      .slice(-8)
      .reverse()
      .map((event) => {
        const item = document.createElement("li");
        item.textContent = `${event.message} · ${event.duplicate ? "duplicate" : "unique"} · ${new Date(event.receivedAt).toLocaleTimeString()}`;
        return item;
      }),
  );
  exportTrialsButton.disabled = trialEvents.length === 0;
  clearTrialsButton.disabled = trialEvents.length === 0;
}

function downloadTrialLog(): void {
  const blob = new Blob([exportTrialEventsCsv(trialEvents)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sottolink-baseline-${new Date().toISOString().replaceAll(":", "-")}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function showCaptureSettings(settings: CaptureSettings): void {
  const values = [
    `${settings.sampleRate.toLocaleString()} Hz`,
    settings.echoCancellation === undefined ? "Not reported" : settings.echoCancellation ? "On" : "Off",
    settings.noiseSuppression === undefined ? "Not reported" : settings.noiseSuppression ? "On" : "Off",
    settings.autoGainControl === undefined ? "Not reported" : settings.autoGainControl ? "On" : "Off",
  ];
  const outputs = captureSettings.querySelectorAll("dd");
  outputs.forEach((output, index) => {
    output.textContent = values[index] ?? "—";
  });
}

function setReceiverActive(active: boolean): void {
  listenButton.hidden = active;
  stopButton.hidden = !active;
  receiverFrequency.disabled = active;
  receiverRoleStatus.classList.toggle("is-listening", active);
  receiverRoleStatus.innerHTML = `<i></i> ${active ? "Listening" : "Idle"}`;
  captureTitle.textContent = active ? "Microphone is listening" : "Microphone is off";
  captureDescription.textContent = active
    ? "Keep this page visible and play the sender audio nearby."
    : "Choose the matching frequency, then start listening.";
}

async function startListening(): Promise<void> {
  const startGeneration = ++receiverStartGeneration;
  listenButton.disabled = true;
  receivedMessage.textContent = "Waiting for a valid transmission…";
  receivedMeta.textContent = "Only integrity-checked messages appear here.";
  frameCount.textContent = "0 frames";

  try {
    const preset = getFrequencyPreset(receiverFrequency.value);
    const startedReceiver = await startAcousticReceiver({
      preset,
      canvas: spectrumCanvas,
      onData(data) {
        const rawFrame = new TextDecoder().decode(data);
        const message = decodePrivateFrame(rawFrame);
        if (message === null) {
          receivedMeta.textContent = "A modem payload was rejected by the SottoLink integrity check.";
          return;
        }
        receivedMessage.textContent = message;
        receivedMeta.textContent = `Verified · ${utf8ByteLength(message)} bytes · ${preset.label}`;
        if (isTrialMessage(message)) {
          trialEvents = [...trialEvents, recordTrialEvent(trialEvents, message, preset.label)];
          renderTrialLog();
        }
      },
      onFrame(count) {
        frameCount.textContent = `${count.toLocaleString()} frames`;
      },
      onSettings: showCaptureSettings,
    });
    if (startGeneration !== receiverStartGeneration || modeFromHash() !== "receiver") {
      await startedReceiver.stop();
      return;
    }
    receiver = startedReceiver;
    setReceiverActive(true);
  } catch (error) {
    if (startGeneration !== receiverStartGeneration) return;
    receivedMessage.textContent = "Could not start the microphone.";
    receivedMeta.textContent = error instanceof Error ? error.message : "Microphone access failed.";
  } finally {
    if (startGeneration === receiverStartGeneration) listenButton.disabled = false;
  }
}

async function stopListening(): Promise<void> {
  receiverStartGeneration += 1;
  const activeReceiver = receiver;
  receiver = undefined;
  await activeReceiver?.stop();
  setReceiverActive(false);
}

transmitButton.addEventListener("click", () => void transmit());
startTrialsButton.addEventListener("click", () => void runTrialBatch());
stopTrialsButton.addEventListener("click", stopTrialBatch);
listenButton.addEventListener("click", () => void startListening());
stopButton.addEventListener("click", () => void stopListening());
exportTrialsButton.addEventListener("click", downloadTrialLog);
clearTrialsButton.addEventListener("click", () => {
  trialEvents = [];
  renderTrialLog();
});
window.addEventListener("pagehide", () => {
  stopTrialBatch();
  playingSource?.stop();
  void stopListening();
});

updateBandLabels();
updateMessageCount();
renderTrialLog();
void setMode(modeFromHash());
