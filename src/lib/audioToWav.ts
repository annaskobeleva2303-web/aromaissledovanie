// Конвертация любого аудио-Blob (WebM/Opus, MP4/AAC и т.д.) в WAV (PCM 16-bit).
// Нужно потому, что ProxyAPI (прокси к Whisper) не умеет извлекать длительность
// из WebM/Opus-стримов MediaRecorder и возвращает 400
// "Cannot extract audio duration. Invalid file or format.".
// WAV содержит размер данных в заголовке — Whisper всегда читает его без проблем.

export async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AudioCtx: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) throw new Error("AudioContext не поддерживается");

  // OfflineAudioContext не нужен — берём обычный, только для decodeAudioData.
  const ctx = new AudioCtx();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    // decodeAudioData в Safari требует копию буфера.
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    return encodeWav(audioBuffer);
  } finally {
    // Закрываем контекст, чтобы освободить ресурсы.
    if (typeof ctx.close === "function") {
      try { await ctx.close(); } catch { /* ignore */ }
    }
  }
}

function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;

  // Сводим в один Float32 (interleaved).
  const interleaved = new Float32Array(numFrames * numChannels);
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channelData.push(audioBuffer.getChannelData(c));
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      interleaved[i * numChannels + c] = channelData[c][i];
    }
  }

  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);            // PCM chunk size
  view.setUint16(20, 1, true);             // format = PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);            // bits per sample
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, interleaved[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
