import { redirect } from 'next/navigation';

export default function VoiceDebugPage() {
    redirect('/owner?tab=voice-debug');
}
