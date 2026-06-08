// @ts-nocheck
'use client';
/**
 * @codesage
 * @file      src/lib/tour/index.ts
 * @purpose   App tour manager configuration.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type KaiMood = 'waving' | 'celebrating';
export type StepType = 'modal' | 'spotlight';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
export type SpotlightShape = 'rectangle' | 'rounded' | 'pill';

export interface TourStep {
    id: number;
    type: StepType;
    // Spotlight-only fields
    route?: string;            // pathname to navigate to, e.g. '/dashboard'
    routeParams?: string;      // search params, e.g. '?problemId=two-sum'
    tabParam?: string;         // ?tab= value if needed, e.g. 'history'
    target?: string;           // CSS selector for the highlighted element
    position?: TooltipPosition;// which side of the target to put the tooltip
    shape?: SpotlightShape;    // border-radius of the highlight ring
    mobilePosition?: 'top' | 'bottom'; // bottom sheet anchor on mobile
    // Content
    title: string;
    body: string;              // the explanation paragraph shown in the card
    kaiSays: string;           // short line (~8 words) spoken aloud + shown as hint
    // Modal-only
    kaiMood?: KaiMood;         // 'waving' for welcome, 'celebrating' for finish
    ctaLabel?: string;         // button label override for the final modal
}

// ─── Steps ────────────────────────────────────────────────────────────────────
// 13 steps. Steps 0 and 12 are modals (full-screen with Kai 3D cube).
// Steps 1–11 are spotlights.
//
// AUDIO BUDGET: kaiSays across all 13 steps totals ~60s at normal speech rate.
// Reading + clicking budget: ~90s total user time.

export const TOUR_STEPS: TourStep[] = [

    // ── STEP 0 ─── Welcome Modal ───────────────────────────────────────────────
    {
        id: 0,
        type: 'modal',
        kaiMood: 'waving',
        title: "Hi, I'm Kai — your AI interview coach",
        body: "I'll show you around AlgoMind in about 90 seconds — every screen, every feature. By the end you'll know exactly how to use this to prepare for your next FAANG interview.",
        kaiSays: "Hi! I'm Kai. Tour takes ninety seconds.",
        ctaLabel: "Show Me Around",
    },

    // ── STEP 1 ─── Homepage Hero CTA ──────────────────────────────────────────
    {
        id: 1,
        type: 'spotlight',
        route: '/',
        target: '[data-tour="home-hero-cta"]',
        position: 'bottom',
        shape: 'rounded',
        title: 'Your Launch Pad',
        body: 'Three paths from here: jump straight into a voice interview, review your learn path, or check your dashboard. Most days you start with Interview.',
        kaiSays: "Your jump-off point — three paths forward.",
    },

    // ── STEP 2 ─── Interview — Difficulty Mode Selector ───────────────────────
    {
        id: 2,
        type: 'spotlight',
        route: '/interview',
        routeParams: '?problemId=two-sum',
        target: '[data-tour="difficulty-mode-selector"]',
        position: 'bottom',
        shape: 'rectangle',
        title: 'Choose Your Interview Mode',
        body: 'Warm-Up is forgiving — hints freely given, slower pace. Practice is the standard bar. Crunch adds real time pressure. Sprint gives you two problems back-to-back. Pick based on what you need today.',
        kaiSays: "Four modes. Match what you're training for.",
    },

    // ── STEP 3 ─── Interview — Problem List ───────────────────────────────────
    {
        id: 3,
        type: 'spotlight',
        route: '/interview',
        routeParams: '?problemId=two-sum',
        target: '[data-tour="problem-list"]',
        position: 'top',
        shape: 'rectangle',
        mobilePosition: 'bottom',
        title: '500+ Curated Problems',
        body: 'Filter by difficulty, topic, or curated lists like Blind 75. Attempted problems are marked so you know what to revisit. Hit Random Problem for a surprise pick.',
        kaiSays: "Five-hundred problems. Filter by topic or company.",
    },

    // ── STEP 4 ─── Interview — Problem Panel ──────────────────────────────────
    {
        id: 4,
        type: 'spotlight',
        route: '/interview',
        // NOTE: use two-sum for faster load — this is a known DB ID
        // For guests the page resolves it via getRandomProblem — that's fine
        routeParams: '?problemId=two-sum',
        target: '[data-tour="problem-panel"]',
        position: 'right',
        shape: 'rectangle',
        mobilePosition: 'bottom',
        title: 'Your Problem Workspace',
        body: 'The problem statement, constraints, and examples live here. Read it fully before speaking — this is your reading time, just like a real interview. Hints are available if you get stuck.',
        kaiSays: "Read first. Think. Then speak out loud.",
    },

    // ── STEP 5 ─── Interview — Begin Button ───────────────────────────────────
    {
        id: 5,
        type: 'spotlight',
        route: '/interview',
        routeParams: '?problemId=two-sum',
        target: '[data-tour="begin-button"]',
        position: 'top',
        shape: 'rounded',
        mobilePosition: 'top',
        title: 'Start the Interview',
        body: "When you're ready, press Begin. I'll introduce the problem, ask clarifying questions, probe your approach, push back on shaky reasoning, and debrief your complexity analysis. Voice or text — your call.",
        kaiSays: "Press this when ready. I'll guide you through.",
    },

    // ── STEP 6 ─── Interview — Code Editor Language ───────────────────────────
    {
        id: 6,
        type: 'spotlight',
        route: '/interview',
        routeParams: '?problemId=two-sum',
        target: '[data-tour="language-select"]',
        position: 'bottom',
        shape: 'rectangle',
        mobilePosition: 'bottom',
        title: 'Code Editor — I Read Both',
        body: "Write your solution while you explain it. I evaluate your code — correctness, naming, consistency with what you said you'd write — not just your conversation. Ten languages supported.",
        kaiSays: "I grade your code too — not just words.",
    },

    // ── STEP 7 ─── Dashboard — Cognitive Radar ────────────────────────────────
    {
        id: 7,
        type: 'spotlight',
        route: '/dashboard',
        tabParam: 'knowledge',
        target: '[data-tour="cognitive-profile"]',
        position: 'right',
        shape: 'rectangle',
        mobilePosition: 'bottom',
        title: 'Knowledge Map And Focus Areas',
        body: "Use this concept map to see what is strong, shaky, or untouched across your DSA journey. Pair it with recommendation cards to pick the next best practice problem.",
        kaiSays: "This map shows what to practice next.",
    },

    // ── STEP 8 ─── Dashboard — Performance Stats ──────────────────────────────
    {
        id: 8,
        type: 'spotlight',
        route: '/dashboard',
        tabParam: 'overview',
        target: '[data-tour="performance-insights"]',
        position: 'left',
        shape: 'rectangle',
        mobilePosition: 'bottom',
        title: 'Live Performance Stats',
        body: 'Current streak, total sessions, average score, and skill distribution — all updated the moment a session saves. The demo shows 12 sessions of real progression.',
        kaiSays: "Streak, sessions, average score — all live.",
    },

    // ── STEP 9 ─── Dashboard — Journey Timeline ───────────────────────────────
    {
        id: 9,
        type: 'spotlight',
        route: '/dashboard',
        tabParam: 'overview',
        target: '[data-tour="journey-progress"]',
        position: 'top',
        shape: 'rectangle',
        mobilePosition: 'top',
        title: 'Your Session Timeline',
        body: 'Each dot is a session. Colour = difficulty (green Easy, amber Medium, red Hard). Height = score. The upward arc in the demo is what consistent daily practice produces.',
        kaiSays: "Every session plotted. Your arc over time.",
    },

    // ── STEP 10 ─── Dashboard — History Tab ───────────────────────────────────
    {
        id: 10,
        type: 'spotlight',
        route: '/dashboard',
        tabParam: 'history',
        target: '[data-tour="history-list"]',
        position: 'top',
        shape: 'rectangle',
        mobilePosition: 'top',
        title: 'Full Session History',
        body: 'Every session saved with full analysis inside. Click any row to open the report card: animated score circle, 8-skill breakdown, key moments from the transcript, and a Hire Decision.',
        kaiSays: "Click any session. Full analysis inside.",
    },

    // ── STEP 11 ─── Dashboard — Insights Tab ──────────────────────────────────
    {
        id: 11,
        type: 'spotlight',
        route: '/dashboard',
        tabParam: 'insights',
        target: '[data-tour="insights"]',
        position: 'top',
        shape: 'rectangle',
        mobilePosition: 'top',
        title: 'AI Coaching Cards',
        body: "Personalised cards generated from your session patterns. Examples: 'Your Complexity Analysis has dropped 3 sessions in a row.' 'You've never attempted a Dynamic Programming problem.' 'You're ready for Hard — your Medium average is 7.2.' Cards refresh after each session.",
        kaiSays: "AI coaching cards refresh after every session.",
    },

    // ── STEP 12 ─── Settings — Voice ──────────────────────────────────────────
    {
        id: 12,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="voice-capabilities"]',
        position: 'top',
        shape: 'rectangle',
        mobilePosition: 'top',
        title: 'Tune My Voice',
        body: "Choose how I sound and how fast I speak. Speed range is 0.5× to 2.0×. First-time tip: set it to 0.85× — gives you thinking time while I give feedback. You can change this any time.",
        kaiSays: "Tune my voice. Try zero point eight five.",
    },

    // ── STEP 13 ─── Final Modal: Analysis Preview + CTA ───────────────────────
    {
        id: 13,
        type: 'modal',
        kaiMood: 'celebrating',
        title: "One more thing — your Report Card",
        body: "After every real session you get a full Report Card: an animated score circle, your 8-skill breakdown with specific evidence from the transcript, AI-identified key moments (approach found, self-corrections, missed opportunities), 'What You Should Have Said' examples for weak areas — and a Hire Decision from me. This is where the real learning happens.",
        kaiSays: "You're ready. Go ace your first session.",
        ctaLabel: "Start My First Session",
    },
];

// ─── waitForElement ───────────────────────────────────────────────────────────
// Polls document.querySelector every 100ms until the element appears or
// timeoutMs elapses. Returns the element or null (never throws).
// This is the core reliability fix vs the old wait(800) approach.

export function waitForElement(
    selector: string,
    timeoutMs = 5000
): Promise<Element | null> {
    return new Promise((resolve) => {
        // Immediate check — element may already be in the DOM
        const immediate = document.querySelector(selector);
        if (immediate) {
            resolve(immediate);
            return;
        }

        const deadline = Date.now() + timeoutMs;
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve(el);
                return;
            }
            if (Date.now() >= deadline) {
                clearInterval(interval);
                resolve(null); // timed out — tooltip will float centered
            }
        }, 100);
    });
}

// ─── speakHint ────────────────────────────────────────────────────────────────
// Reads the kaiSays line using Web Speech API (SpeechSynthesis).
// No API key required. Graceful no-op on unsupported browsers.
// Always cancels previous utterance before starting the new one.

export function speakHint(text: string, enabled: boolean): void {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    if (!window.speechSynthesis || !text.trim()) return;

    window.speechSynthesis.cancel();

    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.pitch = 1.05;
    utt.volume = 0.8;

    // Prefer a natural en-* voice. getVoices() is async on some browsers —
    // attach an event handler if the list is empty on first call.
    const trySpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            const nice = voices.find(
                (v) =>
                    v.lang.startsWith('en') &&
                    (v.name.includes('Google') ||
                        v.name.includes('Samantha') || // macOS
                        v.name.includes('Daniel') ||   // macOS UK
                        v.name.includes('Alex'))       // macOS legacy
            ) || voices.find((v) => v.lang.startsWith('en'));
            if (nice) utt.voice = nice;
        }
        window.speechSynthesis.speak(utt);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            trySpeak();
        };
    } else {
        trySpeak();
    }
}

export function stopSpeech(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
}
