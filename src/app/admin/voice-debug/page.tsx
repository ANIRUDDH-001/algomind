import { requireAdmin } from '@/lib/auth/is-admin';
import VoiceDebugClient from './client';

export default async function VoiceDebugPage() {
    await requireAdmin(); // Redirects if not admin
    return <VoiceDebugClient />;
}
