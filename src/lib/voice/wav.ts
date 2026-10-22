/**
 * @codesage
 * @file      src/lib/voice/wav.ts
 * @purpose   Minimal mono PCM16 WAV encoder for VAD audio (Float32Array @ 16 kHz) sent to Whisper.
 * @tech      TypeScript (DataView)
 * @connects  useSTT (interview/learn transcription), VoiceCheckClient (/voice-check)
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// Minimal PCM → WAV encoder
export function float32ToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);  // file size - 8
    writeString(view, 8, 'WAVE');

    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);            // PCM format chunk size
    view.setUint16(20, 1, true);             // PCM format = 1
    view.setUint16(22, numChannels, true);   // mono
    view.setUint32(24, sampleRate, true);    // sample rate
    view.setUint32(28, byteRate, true);      // byte rate
    view.setUint16(32, blockAlign, true);    // block align
    view.setUint16(34, bitsPerSample, true); // bits per sample

    // data sub-chunk (MUST start at offset 36, NOT 38)
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);      // data chunk size

    // PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
    }
    return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}
