/**
 * @codesage
 * @file      src/app/voice-check/page.tsx
 * @purpose   Server wrapper for the /voice-check self-test (mic, speech detection, transcription, speaker).
 * @tech      Next.js
 * @connects  VoiceCheckClient
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { VoiceCheckClient } from '@/components/voice/VoiceCheckClient';

export const metadata = {
    title: 'Voice check',
    description: 'Test your microphone and speaker before a voice interview with Kai.',
};

export default function VoiceCheckPage() {
    return (
        <div className="min-h-screen pb-20 md:pb-4 px-4" style={{ background: 'var(--surface-base)' }}>
            <VoiceCheckClient />
        </div>
    );
}
