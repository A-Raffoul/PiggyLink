import "./styles.css";
import { inject } from "@vercel/analytics";
import { startAcousticReceiver, type AcousticReceiver, type CaptureSettings } from "./audio/capture";
import { findAudioOnset, mixCarrierIntoCover, transmissionPlaybackWindow } from "./audio/mix";
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
  buildTrialReport,
  createTrialPlan,
  exportTrialReportCsv,
  formatTrialMessage,
  isTrialMessage,
  recordTrialEvent,
  type TrialEvent,
  type TrialPlan,
} from "./core/trials";
import { encodeWav, isWavFile } from "./core/wav";
import { encodeUltrasound } from "./modem/ggwave";
import { createSteppedSweep } from "./core/sweep";

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
const downloadReferenceButton = element<HTMLButtonElement>("download-reference");
const playSweepButton = element<HTMLButtonElement>("play-sweep");
const sweepStatus = element<HTMLElement>("sweep-status");
const trialFirst = element<HTMLInputElement>("trial-first");
const trialCount = element<HTMLInputElement>("trial-count");
const trialPause = element<HTMLSelectElement>("trial-pause");
const startTrialsButton = element<HTMLButtonElement>("start-trials");
const stopTrialsButton = element<HTMLButtonElement>("stop-trials");
const trialStatus = element<HTMLElement>("trial-status");
const listenButton = element<HTMLButtonElement>("listen-button");
const stopButton = element<HTMLButtonElement>("stop-button");
const startRawCaptureButton = element<HTMLButtonElement>("start-raw-capture");
const stopRawCaptureButton = element<HTMLButtonElement>("stop-raw-capture");
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
const trialCondition = element<HTMLInputElement>("trial-condition");
const expectedFirst = element<HTMLInputElement>("expected-first");
const expectedCount = element<HTMLInputElement>("expected-count");
const startTrialLogButton = element<HTMLButtonElement>("start-trial-log");
const exportTrialsButton = element<HTMLButtonElement>("export-trials");
const clearTrialsButton = element<HTMLButtonElement>("clear-trials");

let receiver: AcousticReceiver | undefined;
let receiverStartGeneration = 0;
let senderContext: AudioContext | undefined;
let playingSource: AudioBufferSourceNode | undefined;
let batchCancelled = false;
let cancelBatchPause: (() => void) | undefined;
let trialEvents: TrialEvent[] = [];
let trialPlan: TrialPlan | undefined;
let lastReference: { readonly bytes: Uint8Array; readonly name: string } | undefined;

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

async function playTransmission(message: string, compact = false): Promise<{ presetLabel: string }> {
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
    let referenceChannels = mixed.channels;
    if (compact) {
      const window = transmissionPlaybackWindow(
        cover.length,
        speechOnset,
        delaySamples,
        carrier.length,
        audioContext.sampleRate,
      );
      referenceChannels = mixed.channels.map((channel) => channel.slice(window.start, window.end));
      source.start(0, window.start / audioContext.sampleRate, (window.end - window.start) / audioContext.sampleRate);
    } else {
      source.start();
    }
    lastReference = {
      bytes: encodeWav(referenceChannels, audioContext.sampleRate),
      name: `sottolink-reference-${message}-${preset.id}-${Math.abs(Number(signalStrength.value))}db.wav`,
    };
    downloadReferenceButton.disabled = false;
    await playbackComplete;
    return { presetLabel: preset.label };
  } catch (error) {
    throw error instanceof Error ? error : new Error("Transmission failed.");
  }
}

function downloadWav(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function playDiagnosticSweep(): Promise<void> {
  if (playingSource) return;
  playSweepButton.disabled = true;
  sweepStatus.textContent = "Playing 15–22 kHz diagnostic sweep…";
  const audioContext = getSenderContext();
  await audioContext.resume();
  const samples = createSteppedSweep(audioContext.sampleRate);
  const buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
  buffer.getChannelData(0).set(samples);
  const source = audioContext.createBufferSource();
  playingSource = source;
  source.buffer = buffer;
  source.connect(audioContext.destination);
  lastReference = { bytes: encodeWav([samples], audioContext.sampleRate), name: "sottolink-sweep-15-22khz.wav" };
  downloadReferenceButton.disabled = false;
  source.onended = () => { if (playingSource === source) playingSource = undefined; playSweepButton.disabled = false; sweepStatus.textContent = "Sweep complete. Download the reference WAV."; };
  source.start();
}

function startRawCapture(): void {
  if (!receiver) return;
  receiver.startRawCapture();
  startRawCaptureButton.hidden = true;
  stopRawCaptureButton.hidden = false;
  receivedMeta.textContent = "Recording raw microphone samples for diagnostics…";
}

function stopRawCapture(): void {
  const samples = receiver?.stopRawCapture();
  startRawCaptureButton.hidden = false;
  stopRawCaptureButton.hidden = true;
  if (!samples?.length) return;
  downloadWav(encodeWav([samples], 48_000), `sottolink-microphone-${new Date().toISOString().replaceAll(":", "-")}.wav`);
  receivedMeta.textContent = `Downloaded ${(samples.length / 48_000).toFixed(1)} s of raw microphone audio.`;
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
      await playTransmission(message, true);
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
  if (!trialPlan) {
    trialLogCount.textContent = "—";
    trialLogSummary.textContent = "Set the expected ID range, then start a new trial log.";
    trialLogList.replaceChildren();
    exportTrialsButton.disabled = true;
    clearTrialsButton.disabled = true;
    return;
  }

  const report = buildTrialReport(trialPlan, trialEvents);
  const received = report.filter((row) => row.result === "received").length;
  const missed = report.filter((row) => row.result === "missed").length;
  const duplicates = report.filter((row) => row.result === "duplicate").length;
  const unexpected = report.filter((row) => row.result === "unexpected").length;
  trialLogCount.textContent = `${received}/${trialPlan.count}`;
  trialLogSummary.textContent = `${received} received · ${missed} missed · ${duplicates} duplicate${duplicates === 1 ? "" : "s"}${unexpected ? ` · ${unexpected} unexpected` : ""}`;
  trialLogList.replaceChildren(
    ...report.map((row) => {
      const item = document.createElement("li");
      const time = row.receivedAt ? ` · ${new Date(row.receivedAt).toLocaleTimeString()}` : "";
      item.textContent = `${row.expectedMessage || row.receivedMessage} · ${row.result}${time}`;
      return item;
    }),
  );
  exportTrialsButton.disabled = false;
  clearTrialsButton.disabled = trialEvents.length === 0;
}

function downloadTrialLog(): void {
  if (!trialPlan) return;
  const blob = new Blob([exportTrialReportCsv(trialPlan, trialEvents)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sottolink-baseline-${new Date().toISOString().replaceAll(":", "-")}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function startTrialLog(): void {
  try {
    trialPlan = createTrialPlan(Number(expectedFirst.value), Number(expectedCount.value), trialCondition.value);
    trialEvents = [];
    renderTrialLog();
  } catch (error) {
    trialLogSummary.textContent = error instanceof Error ? error.message : "Invalid expected trial range.";
  }
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
  startRawCaptureButton.hidden = !active;
  stopRawCaptureButton.hidden = true;
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
downloadReferenceButton.addEventListener("click", () => {
  if (lastReference) downloadWav(lastReference.bytes, lastReference.name);
});
playSweepButton.addEventListener("click", () => void playDiagnosticSweep());
startTrialsButton.addEventListener("click", () => void runTrialBatch());
stopTrialsButton.addEventListener("click", stopTrialBatch);
listenButton.addEventListener("click", () => void startListening());
stopButton.addEventListener("click", () => void stopListening());
startRawCaptureButton.addEventListener("click", startRawCapture);
stopRawCaptureButton.addEventListener("click", stopRawCapture);
exportTrialsButton.addEventListener("click", downloadTrialLog);
startTrialLogButton.addEventListener("click", startTrialLog);
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
