
export interface TourStep {
    id: number | string;
    type?: 'modal' | 'spotlight';
    route?: string;
    tab?: string;
    target?: string;
    title?: string;
    content?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    spotlightShape?: 'circle' | 'rectangle' | 'rounded';
    action?: (params: { router: any }) => Promise<void>;
    shouldShow?: (user: any) => boolean;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const TOUR_STEPS: TourStep[] = [
    // STEP 0: Welcome Modal
    {
        id: 0,
        type: 'modal',
        title: 'Welcome to AlgoMind!',
        content: "Let's take a quick 2-minute tour to show you how to start practice interviews, track your progress, and customize your experience.",
        action: undefined
    },

    // STEP 1: Home - Command Center
    {
        id: 1,
        type: 'spotlight',
        route: '/',
        target: '[data-tour="home-actions"]',
        title: '🎯 Your Command Center',
        content: 'Three ways to enhance your DSA skills:\n• Quick Practice\n• Browse Problems\n• View Dashboard',
        spotlightShape: 'rectangle',
        position: 'bottom',
        action: async ({ router }) => {
            if (window.location.pathname !== '/') {
                router.push('/');
                await wait(500);
            }
        }
    },

    // STEP 2: Dashboard - Performance Overview
    {
        id: 2,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'overview',
        target: '[data-tour="performance-insights"]',
        title: 'Performance Overview',
        content: 'Track your practice stats, strengths, and cognitive profile all in one place.',
        spotlightShape: 'rectangle',
        position: 'bottom',
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            if (window.location.pathname !== '/dashboard') {
                router.push('/dashboard');
                await wait(800);
            }
            // Ensure overview tab
            const url = new URL(window.location.href);
            if (url.searchParams.get('tab') !== 'overview') {
                router.push('/dashboard?tab=overview');
                await wait(500);
            }
        }
    },

    // STEP 3: Dashboard - Journey Progress
    {
        id: 3,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'overview',
        target: '[data-tour="journey-progress"]',
        title: 'Journey Progress',
        content: 'View your timeline of sessions and upcoming milestones.',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user
    },

    // STEP 4: Dashboard - Export Report
    {
        id: 4,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'overview',
        target: '[data-id="export-report-btn"]',
        title: '📄 Export Report',
        content: 'Download detailed PDF reports of your all-time progress.',
        spotlightShape: 'rectangle',
        position: 'bottom',
        shouldShow: (user) => !!user
    },

    // STEP 5: Dashboard - Skills Tab (Points to Tab Button)
    {
        id: 5,
        type: 'spotlight',
        route: '/dashboard',
        target: '[data-tour="tab-skills"]',
        title: 'Specific Skills',
        content: 'Check the "Skills" tab to deep dive into trends and mastery levels.',
        spotlightShape: 'rounded',
        position: 'bottom',
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            // Just point to the tab, don't necessarily navigate inside it yet
            // optimizing for visibility of the target
        }
    },

    // STEP 6: Dashboard - History Tab (Points to Tab Button)
    {
        id: 6,
        type: 'spotlight',
        route: '/dashboard',
        target: '[data-tour="tab-history"]',
        title: 'Session History',
        content: 'Access the "History" tab to review past interviews and transcripts.',
        spotlightShape: 'rounded',
        position: 'bottom',
        shouldShow: (user) => !!user
    },

    // STEP 7: Dashboard - Insights Tab (Points to Tab Button)
    {
        id: 7,
        type: 'spotlight',
        route: '/dashboard',
        target: '[data-tour="tab-insights"]',
        title: 'AI Insights',
        content: 'See personalized recommendations in the "Insights" tab.',
        spotlightShape: 'rounded',
        position: 'bottom',
        shouldShow: (user) => !!user
    },

    // STEP 8: Practice - Full Interview Experience
    {
        id: 8,
        type: 'spotlight',
        route: '/interview',
        target: '[data-tour="chat-panel"]',
        title: 'The Interview Interface',
        content: 'This is your workspace. Switch between Voice Mode and Code Editor manually using the controls here. Kai will guide you!',
        spotlightShape: 'rectangle',
        position: 'center',
        action: async ({ router }) => {
            if (!window.location.pathname.startsWith('/interview') && !window.location.pathname.startsWith('/practice')) {
                router.push('/interview');
                await wait(1500);
            }
        }
    },

    // STEP 9: Settings - Voice Capabilities
    {
        id: 9,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="voice-capabilities"]',
        title: '🔊 Customize AI Voice',
        content: "Choose Kai's voice and adjust the speaking speed (0.5x - 2.0x).",
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            if (window.location.pathname !== '/settings') {
                router.push('/settings');
                await wait(500);
            }
        }
    },

    // STEP 10: Settings - Demo Mode
    {
        id: 10,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="demo-mode"]',
        title: '🎭 Demo Mode',
        content: 'Try AlgoMind risk-free with pre-filled data. Toggle ON → Visit Dashboard to explore!',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user
    },

    // STEP 11: Settings - Intro Button
    {
        id: 11,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="intro-button"]',
        title: '🔄 Restart Tour',
        content: 'Forgot something? Click "Intro" to replay the complete guide or share it with teammates.',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user
    },

    // STEP 12: Final - Celebration
    {
        id: 12,
        type: 'modal',
        title: "🎉 You're All Set!",
        content: "You've mastered AlgoMind basics. Ready to ace your DSA interviews?",
        action: async ({ router }) => {
            router.push('/');
        }
    }
];

