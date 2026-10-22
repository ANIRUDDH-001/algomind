/**
 * @codesage
 * @file      src/components/voice/VoiceCheckLink.tsx
 * @purpose   "Check mic & speaker" link to the /voice-check self-test, shown on interview pre-start screens.
 * @tech      Next.js Link, Tailwind CSS
 * @connects  InterviewSession (mobile pre-start), DesktopLayout (desktop pre-start)
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Opens in a new tab so the loaded problem (often a random pick) survives the check. */
export function VoiceCheckLink({ className }: { className?: string }) {
    return (
        <Link
            href="/voice-check"
            target="_blank"
            rel="noopener"
            className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-200 hover:underline underline-offset-4', className)}
        >
            <Headphones className="w-3.5 h-3.5" aria-hidden />
            Check mic &amp; speaker
        </Link>
    );
}
