'use client';

import { useState, useEffect } from 'react';
import { IntroAnimation } from '@/components/onboarding/IntroAnimation';
import { shouldShowOnboarding, markOnboardingComplete } from '@/lib/onboarding/manager';
import { enableDemoMode } from '@/lib/demo/manager';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Mic, BarChart, Brain, ArrowRight, Play, CheckCircle2 } from 'lucide-react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef } from 'react';

// --- Reusable Custom Components for Sections ---

// 3D Tilt Card for Feature Section
function TiltCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <motion.div
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX: tilt.x, rotateY: tilt.y }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      style={{ transformStyle: "preserve-3d", perspective: "1000px" }}
    >
      <div style={{ transform: "translateZ(30px)" }} className="h-full">
        {children}
      </div>
    </motion.div>
  );
}

// Fade/Slide In View wrapper (with root boundary prop)
function FadeInView({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated Counter for Stats
function AnimatedCounter({ value, label }: { value: string, label: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="text-center p-6 glass rounded-3xl h-full flex flex-col justify-center border border-white/5">
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="text-4xl md:text-5xl font-black mb-2 text-gradient"
      >
        {value}
      </motion.div>
      <div className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window !== 'undefined') {
      return shouldShowOnboarding();
    }
    return false;
  });

  const { user, loading } = useAuth();
  const router = useRouter();

  // Snap container ref
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });

  // Parallax transforms based on snap container scroll
  const yHero = useTransform(scrollYProgress, [0, 0.2], [0, 150]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.2], [1, 0]);

  // Handle Hydration mismatch safety early return if needed, but keeping main structure intact
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleOnboardingComplete = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
    if (!user) {
      enableDemoMode();
      window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: true } }));
      router.push('/dashboard');
    }
  };

  if (showOnboarding) {
    return <IntroAnimation onComplete={handleOnboardingComplete} />;
  }

  if (loading || !mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <div className="w-12 h-12 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  // Redirect authenticated users immediately to dashboard to skip marketing
  if (user) {
    router.replace('/dashboard');
    return null; // Return null while redirecting
  }

  // CSS Particles configuration
  const particles = Array.from({ length: 20 }, (_, i) => ({
    left: `${(i * 17 + 3) % 100}%`,
    top: `${(i * 23 + 5) % 100}%`,
    size: 2 + (i % 4),
    duration: 3 + (i % 4),
    delay: (i * 0.3) % 3,
  }));

  return (
    <div
      ref={scrollRef}
      className="h-[100dvh] w-full snap-y snap-mandatory overflow-y-auto overflow-x-hidden bg-surface-base text-white scroll-smooth custom-scrollbar selection:bg-indigo-500/30"
    >

      {/* Global CSS for particle animation */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float-particle {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.1; }
          50% { transform: translateY(-30px) scale(1.5); opacity: 0.6; }
        }
      `}} />

      {/* SECTION 1: HERO (Snap Item) */}
      <section className="snap-start relative min-h-[100dvh] w-full flex flex-col items-center justify-center py-20 px-4 overflow-hidden border-b border-transparent">

        {/* Background Particles field */}
        <div className="absolute inset-0 pointer-events-none" style={{ perspective: '1000px' }}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_60%)]" />
          {particles.map((p, i) => (
            <div key={i} style={{
              position: 'absolute', left: p.left, top: p.top,
              width: p.size, height: p.size, borderRadius: '50%',
              background: i % 2 === 0 ? '#6366f1' : '#8b5cf6',
              animation: `float-particle ${p.duration}s ${p.delay}s ease-in-out infinite`,
              transform: `translateZ(${(i % 5) * 50}px)` // depth via css var z translate
            }} />
          ))}
        </div>

        <motion.div
          style={{ y: yHero, opacity: opacityHero }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto w-full"
        >
          {/* 3D Animated CSS Cube Logo */}
          <div style={{ perspective: '800px' }} className="w-20 h-20 md:w-24 md:h-24 mx-auto mb-10">
            <motion.div
              style={{ transformStyle: 'preserve-3d', width: '100%', height: '100%' }}
              animate={{ rotateY: 360, rotateX: [0, 10, 0, -10, 0] }}
              transition={{ rotateY: { duration: 8, repeat: Infinity, ease: 'linear' }, rotateX: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', transform: 'translateZ(40px)', borderRadius: '12px', opacity: 0.95, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}>
                <span style={{ color: 'white', fontSize: '32px', fontWeight: 900 }}>A</span>
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', transform: 'rotateY(180deg) translateZ(40px)', borderRadius: '12px', opacity: 0.7 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(99,102,241,0.5)', transform: 'rotateY(90deg) translateZ(40px)', borderRadius: '12px' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.5)', transform: 'rotateY(-90deg) translateZ(40px)', borderRadius: '12px' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.3)', transform: 'rotateX(90deg) translateZ(40px)', borderRadius: '12px' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(139,92,246,0.3)', transform: 'rotateX(-90deg) translateZ(40px)', borderRadius: '12px' }} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="text-[clamp(2.5rem,8vw,5.5rem)] font-black leading-[1.1] tracking-tighter mb-6">
              <span className="block text-white">AI-Powered Technical</span>
              <span className="block text-gradient pb-2">Interview Practice</span>
            </h1>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-[clamp(1rem,2vw,1.25rem)] text-zinc-400 max-w-2xl mb-10 font-medium"
          >
            Practice with an AI interviewer that thinks like a senior engineer at FAANG. Get real-time voice feedback, cognitive analysis, and ace your systems design and DSA rounds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Button
              onClick={() => router.push('/login')}
              size="lg"
              className="w-full sm:w-auto btn-primary h-14 px-8 text-base shadow-[0_0_40px_rgba(99,102,241,0.3)] rounded-2xl"
            >
              Try for Free
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button
              onClick={() => window.open('https://algomind.video.demo', '_blank')} // Placeholder
              size="lg"
              className="w-full sm:w-auto btn-ghost h-14 px-8 text-base rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 relative overflow-hidden group"
            >
              <Play className="w-5 h-5 mr-2 text-indigo-400 group-hover:scale-110 transition-transform" />
              Watch Demo
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/10 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-500"
        >
          <span className="text-[10px] uppercase tracking-widest font-bold">Swipe to explore</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border-2 border-zinc-700 flex justify-center p-1"
          >
            <div className="w-1 h-2 bg-zinc-500 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* SECTION 2: FEATURES (Snap Item) */}
      <section className="snap-start min-h-[100dvh] w-full flex flex-col justify-center py-24 px-4 relative max-w-7xl mx-auto border-b border-transparent">
        <FadeInView>
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">Master every angle</h2>
            <p className="text-zinc-400 text-lg">Beyond just writing code. Prove how you think.</p>
          </div>
        </FadeInView>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">

          {/* Feature 1 */}
          <FadeInView delay={0.1}>
            <TiltCard className="h-full">
              <div className="surface-2 rounded-3xl p-6 md:p-8 h-full flex flex-col border border-white/5 overflow-hidden group">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
                  <Mic className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Voice Interview</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-grow">
                  Converse naturally with our AI. It responds in real-time, asking probing follow-ups based on your exact approach.
                </p>
                {/* Visual Mockup - Waveform */}
                <div className="mt-auto h-24 bg-surface-1 rounded-2xl border border-white/5 p-4 flex items-center justify-center gap-1.5 group-hover:border-indigo-500/40 transition-colors shadow-inner">
                  {[30, 60, 40, 90, 50, 80, 45, 20].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 rounded-full bg-indigo-500/90 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                      animate={{ height: [`${h * 0.4}%`, `${h}%`, `${h * 0.4}%`] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              </div>
            </TiltCard>
          </FadeInView>

          {/* Feature 2 */}
          <FadeInView delay={0.2}>
            <TiltCard className="h-full">
              <div className="surface-2 rounded-3xl p-6 md:p-8 h-full flex flex-col border border-white/5 overflow-hidden group">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6 shrink-0 transition-transform group-hover:scale-110 group-hover:-rotate-3 duration-300">
                  <Brain className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Cognitive Analysis</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-grow">
                  We track 8 distinct cognitive skills—from pattern recognition to edge-case awareness—to find exactly what's holding you back.
                </p>
                {/* Visual Mockup - Animated Radar SVG */}
                <div className="mt-auto h-24 bg-surface-1 rounded-2xl border border-white/5 p-4 flex items-center justify-center group-hover:border-purple-500/40 transition-colors relative overflow-hidden shadow-inner">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">
                    <polygon points="50,10 85,30 85,70 50,90 15,70 15,30" className="stroke-white/10 stroke-[0.5] fill-transparent" />
                    <polygon points="50,30 70,40 70,60 50,70 30,60 30,40" className="stroke-white/10 stroke-[0.5] fill-transparent" />
                    <motion.polygon
                      points="50,25 75,40 65,65 50,80 25,60 30,35"
                      className="fill-purple-500/40 stroke-purple-400 stroke-[1.5]"
                      initial={{ scale: 0.9, opacity: 0.6, transformOrigin: '50% 50%' }}
                      animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <circle cx="50" cy="50" r="2" className="fill-purple-300" />
                  </svg>
                  {/* Subtle sweep gradient */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-tr from-purple-500/0 via-purple-500/10 to-purple-500/0"
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  />
                </div>
              </div>
            </TiltCard>
          </FadeInView>

          {/* Feature 3 */}
          <FadeInView delay={0.3}>
            <TiltCard className="h-full">
              <div className="surface-2 rounded-3xl p-6 md:p-8 h-full flex flex-col border border-white/5 overflow-hidden group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
                  <BarChart className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Company Modes</h3>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-grow">
                  Select your target company. The AI adapts its strictness, hints, and expected optimality to match their specific rubric.
                </p>
                {/* Visual Mockup - Logos */}
                <div className="mt-auto h-24 bg-surface-1 rounded-2xl border border-white/5 p-4 flex flex-wrap gap-2 items-center justify-center group-hover:border-emerald-500/40 transition-colors shadow-inner">
                  {['Google', 'Meta', 'Amazon', 'Startup'].map((co, i) => (
                    <motion.div
                      key={co}
                      whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
                      className="px-3 py-1.5 bg-white/5 rounded-lg text-xs font-bold tracking-wider text-zinc-300 border border-white/10"
                    >
                      {co}
                    </motion.div>
                  ))}
                </div>
              </div>
            </TiltCard>
          </FadeInView>

        </div>
      </section>

      {/* SECTION 3: HOW IT WORKS (Timeline - Snap Item) */}
      <section className="snap-start min-h-[100dvh] w-full flex flex-col justify-center py-20 bg-surface-1 border-y border-white/5 relative">
        <div className="max-w-7xl mx-auto px-4 w-full">
          <FadeInView>
            <h2 className="text-3xl md:text-5xl font-black mb-12 md:mb-20 text-center">Your path to an offer</h2>
          </FadeInView>

          <div className="flex flex-col md:flex-row gap-8 relative items-center justify-center">
            {/* Background connector line (Desktop only) */}
            <div className="hidden md:block absolute top-[40px] left-[10%] right-[10%] h-0.5 bg-white/10" />

            {[
              { num: "01", title: "Choose a problem", desc: "Select from our curated list or sync with your LeetCode profile." },
              { num: "02", title: "Start Interview", desc: "Speak naturally. Explain your brute force and optimize together." },
              { num: "03", title: "Get Feedback", desc: "Receive immediate rubric-based scoring on 8 cognitive dimensions." },
              { num: "04", title: "Track Progress", desc: "Review your weaknesses and use Spaced Repetition to master them." }
            ].map((step, i) => (
              <FadeInView key={i} delay={i * 0.15} className="flex-1 w-full max-w-[280px] relative z-10">
                <div className="flex flex-row md:flex-col gap-6 md:gap-5 items-center text-left md:text-center w-full group">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl glass flex items-center justify-center text-2xl font-black text-gradient shadow-[0_0_30px_rgba(99,102,241,0.1)] border border-indigo-500/20 group-hover:border-indigo-500/50 transition-colors bg-surface-2"
                  >
                    {step.num}
                  </motion.div>
                  <div className="flex-1">
                    <h4 className="text-lg md:text-xl font-bold text-white mb-2 group-hover:text-indigo-300 transition-colors">{step.title}</h4>
                    <p className="text-sm text-zinc-400 leading-relaxed md:px-2">{step.desc}</p>
                  </div>
                </div>
              </FadeInView>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4: STATS / SOCIAL PROOF (Snap Item) */}
      <section className="snap-start min-h-[100dvh] w-full flex flex-col justify-center py-20 px-4 max-w-5xl mx-auto">
        <FadeInView>
          <h2 className="text-3xl md:text-5xl font-black mb-12 md:mb-16 text-center text-white">The platform built for success</h2>
        </FadeInView>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[400px] md:h-64">
          <TiltCard className="h-full">
            <AnimatedCounter value="1,000+" label="Curated Problems" />
          </TiltCard>
          <TiltCard className="h-full">
            <AnimatedCounter value="8" label="Cognitive Skills Tracked" />
          </TiltCard>
          <TiltCard className="h-full">
            <AnimatedCounter value="24/7" label="Voice AI Feedback" />
          </TiltCard>
        </div>
      </section>

      {/* SECTION 5: CTA BANNER & FOOTER (Snap Item) */}
      <section className="snap-start min-h-[100dvh] w-full flex flex-col justify-between pt-20 pb-0 px-4 max-w-5xl mx-auto border-t border-transparent">
        <div className="flex-grow flex flex-col justify-center">
          <FadeInView>
            <div className="relative rounded-[2.5rem] p-10 md:p-16 text-center overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.15)] border border-indigo-500/20"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))' }}
            >
              {/* Grid overlay */}
              <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

              <div className="relative z-10">
                <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight text-white drop-shadow-md">Ready to ace your next interview?</h2>
                <p className="text-lg md:text-xl text-indigo-100/90 mb-10 max-w-xl mx-auto font-medium">
                  Stop grinding silently. Start practicing how you'll actually perform.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    onClick={() => router.push('/login')}
                    size="lg"
                    className="btn-primary h-14 px-10 text-lg rounded-2xl w-full sm:w-auto hover:scale-105 active:scale-95 transition-transform"
                  >
                    Get Started Free
                  </Button>
                </div>

                <div className="mt-8 flex items-center justify-center gap-6 text-sm text-indigo-200/80 font-bold">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Free forever tier</span>
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> No payments required</span>
                </div>
              </div>
            </div>
          </FadeInView>
        </div>

        {/* Footer firmly inside the last snap block */}
        <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-600 font-medium pb-24 md:pb-8 mt-auto">
          <p>© 2026 AlgoMind. All rights reserved.</p>
        </footer>
      </section>

    </div>
  );
}
