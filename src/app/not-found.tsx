import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Brain } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-4 text-center"
      style={{ background: 'var(--surface-base)' }}
    >
      <div
        className="absolute w-96 h-96 rounded-full blur-[120px] pointer-events-none opacity-20"
        style={{ background: 'var(--accent-primary)' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md">
        <Image
          src="/icon-192x192.png"
          alt="AlgoMind"
          width={56}
          height={56}
          className="rounded-xl drop-shadow-[0_0_12px_rgba(99,102,241,0.4)]"
        />

        <div>
          <p className="text-8xl font-black text-gradient mb-2">404</p>
          <h1 className="text-2xl font-black text-white mb-3">Page not found</h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            This page doesn&apos;t exist or was moved. Try heading back to a known destination.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-300 transition-all"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/interview"
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
          >
            <Brain className="w-4 h-4" />
            Start Interview
          </Link>
        </div>
      </div>
    </div>
  );
}