
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

    // STEP 2: Dashboard Overview - Cognitive Profile
    {
        id: 2,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'overview',
        target: '[data-tour="cognitive-profile"]',
        title: 'Cognitive Profile',
        content: 'Visualize your strengths and weaknesses across key algorithmic concepts.',
        spotlightShape: 'rectangle',
        position: 'right', // Adjusted to right as per user guide
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

    // STEP 3: Dashboard Overview - Performance Insights
    {
        id: 3,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'overview',
        target: '[data-tour="performance-insights"]',
        title: 'Performance Insights',
        content: 'Track your practice time, problems solved, and average score improvement.',
        spotlightShape: 'rectangle',
        position: 'left',
        shouldShow: (user) => !!user
    },

    // STEP 4: Dashboard Overview - Journey Progress
    {
        id: 4,
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

    // STEP 5: Dashboard Overview - Export Report
    {
        id: 5,
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

    // STEP 6: Dashboard - Skills Tab
    {
        id: 6,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'skills',
        target: '[data-tour="skills-grid"]',
        title: 'Specific Skills',
        content: 'Deep dive into each skill area to see detailed trends and mastery levels.',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            router.push('/dashboard?tab=skills');
            await wait(500);
        }
    },

    // STEP 7: Dashboard - History Tab
    {
        id: 7,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'history',
        target: '[data-tour="history-list"]',
        title: 'Session History',
        content: 'Review past interviews, transcriptions, and code solutions.',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            router.push('/dashboard?tab=history');
            await wait(500);
        }
    },

    // STEP 8: Dashboard - Insights Tab
    {
        id: 8,
        type: 'spotlight',
        route: '/dashboard',
        tab: 'insights',
        target: '[data-tour="recommendations"]',
        title: 'AI Insights',
        content: 'Get personalized recommendations on what to practice next based on your performance.',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            router.push('/dashboard?tab=insights');
            await wait(500);
        }
    },

    // STEP 9: Practice - Interview Modes
    {
        id: 9,
        type: 'spotlight',
        route: '/practice',
        target: '[data-tour="mode-toggle"]',
        title: 'Two Interview Modes',
        content: 'Switch between Voice Mode (speak your solution) and Code Mode (write and run code).',
        spotlightShape: 'rectangle',
        position: 'bottom',
        action: async ({ router }) => {
            if (!window.location.pathname.startsWith('/interview') && !window.location.pathname.startsWith('/practice')) {
                router.push('/interview');
                await wait(1000);
            }
        }
    },

    // STEP 10: Practice - Meet Kai
    {
        id: 10,
        type: 'spotlight',
        route: '/interview',
        target: '[data-tour="chat-panel"]',
        title: 'Meet Kai',
        content: 'Your AI interviewer Kai will guide you through the problem. Speak naturally!',
        spotlightShape: 'rectangle',
        position: 'left'
    },

    // STEP 11: Practice - Language Selection
    {
        id: 11,
        type: 'spotlight',
        route: '/interview',
        target: '[data-tour="language-select"]',
        title: 'Language Selection',
        content: 'Choose your preferred programming language for the coding implementation.',
        spotlightShape: 'rectangle',
        position: 'bottom'
    },

    // STEP 12: Settings - Voice Capabilities
    {
        id: 12,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="voice-capabilities"]',
        title: '🔊 Customize AI Voice',
        content: "Choose Kai's voice and adjust the speaking speed (0.5x - 2.0x).",
        spotlightShape: 'rectangle',
        position: 'top', // User guide said top or rectangle
        shouldShow: (user) => !!user,
        action: async ({ router }) => {
            if (window.location.pathname !== '/settings') {
                router.push('/settings');
                await wait(500);
            }
        }
    },

    // STEP 13: Settings - Demo Mode
    {
        id: 13,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="demo-mode"]',
        title: '🎭 Demo Mode',
        content: 'Try AlgoMind risk-free with pre-filled data. Toggle ON → Visit Dashboard to explore!',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user
    },

    // STEP 14: Settings - Intro Button
    {
        id: 14,
        type: 'spotlight',
        route: '/settings',
        target: '[data-tour="intro-button"]',
        title: '🔄 Restart Tour',
        content: 'Forgot something? Click "Intro" to replay the complete guide or share it with teammates.',
        spotlightShape: 'rectangle',
        position: 'top',
        shouldShow: (user) => !!user
    },

    // STEP 15: Final - Celebration
    {
        id: 15,
        type: 'modal',
        title: "🎉 You're All Set!",
        content: "You've mastered AlgoMind basics. Ready to ace your DSA interviews?",
        action: async ({ router }) => {
            router.push('/');
        }
    }
];

