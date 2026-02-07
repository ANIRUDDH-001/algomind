
export interface TourStep {
    id: string;
    targetPath: string; // URL path to navigate to
    selector: string; // CSS selector for the element to highlight
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    guestAllowed?: boolean; // If false, skip for guests
    demoOnly?: boolean; // If true, only show in demo mode
    action?: (isDemo: boolean) => void; // Optional action (e.g., set demo mode)
}

export const TOUR_STEPS: TourStep[] = [
    // STEP 1: Home Dashboard
    {
        id: 'home-actions',
        targetPath: '/',
        selector: '[data-tour="home-actions"]', // Need to add this data attribute
        title: 'Your Command Center',
        content: `Three ways to enhance your DSA skills:
• Quick Practice - Jump into voice interviews
• Browse Problems - Explore 223 curated problems
• View Dashboard - Track your progress`,
        position: 'bottom',
        guestAllowed: true,
    },
    // STEP 2: Dashboard - Overview
    {
        id: 'dashboard-overview',
        targetPath: '/dashboard',
        selector: '[data-tour="cognitive-radar"]',
        title: 'Your Cognitive Profile',
        content: `This radar chart tracks 8 key skills like Problem Decomposition, Pattern Recognition, and Algorithmic Thinking. Watch your profile evolve as you practice!`,
        position: 'right',
        guestAllowed: false,
    },
    // STEP 3: Dashboard - Performance
    {
        id: 'dashboard-insights',
        targetPath: '/dashboard',
        selector: '[data-tour="performance-insights"]',
        title: 'Real-Time Insights',
        content: `Track your total practice time, problems solved, average score, and performance trends. Identify your top strengths and growth areas.`,
        position: 'left',
        guestAllowed: false,
    },
    // STEP 4: Dashboard - Journey
    {
        id: 'dashboard-journey',
        targetPath: '/dashboard',
        selector: '[data-tour="journey-progress"]',
        title: 'Your Practice Journey',
        content: `See your recent sessions and scores. Click any session to export a detailed PDF report and track problem difficulty over time.`,
        position: 'top',
        guestAllowed: false,
    },
    // STEP 5: Dashboard - Skills Tab
    {
        id: 'skills-tab',
        targetPath: '/dashboard?tab=skills', // Assuming query param or verify if separate route/tab logic needed
        selector: '[data-tour="skills-grid"]',
        title: 'Skill Breakdown',
        content: `Each skill shows your current score, trend direction, and performance graph. Focus on declining skills for maximum growth!`,
        position: 'top',
        guestAllowed: false,
    },
    // STEP 6: Dashboard - History Tab
    {
        id: 'history-tab',
        targetPath: '/dashboard?tab=history',
        selector: '[data-tour="history-list"]',
        title: 'Complete History',
        content: `Access all your past sessions with duration, timestamps, and scores. Export individual session reports.`,
        position: 'top',
        guestAllowed: false,
        demoOnly: false, // Hidden in demo mode logic handled in component
    },
    // STEP 7: Dashboard - Insights Tab
    {
        id: 'insights-tab',
        targetPath: '/dashboard?tab=insights',
        selector: '[data-tour="recommendations"]',
        title: 'AI-Powered Recommendations',
        content: `Get personalized learning paths with High and Medium priority areas, plus curated recommended problems for your level.`,
        position: 'top',
        guestAllowed: false,
    },
    // STEP 8: Practice Interface
    {
        id: 'practice-interface',
        targetPath: '/interview?tour=true', // Special flag to maybe trigger guest/demo mode
        selector: '[data-tour="problem-panel"]',
        title: 'Two Interview Modes',
        content: `• Voice Mode: Speak your solution (Gemini AI users)
• Code Editor: Write and test code

Problem statement on the left, solution space on the right.`,
        position: 'right',
        guestAllowed: true,
    },
    // STEP 9: Interview Chat
    {
        id: 'interview-chat',
        targetPath: '/interview',
        selector: '[data-tour="chat-panel"]',
        title: 'Meet Kai - Your AI Interviewer',
        content: `Kai introduces the problem and engages in a back-and-forth dialogue. You have a 20-minute limit and 20 turns max per session.`,
        position: 'left',
        guestAllowed: true,
    },
    // STEP 10: Language Selection
    {
        id: 'language-select',
        targetPath: '/interview',
        selector: '[data-tour="language-select"]',
        title: 'Multi-Language Support',
        content: `Choose from Python, JavaScript, TypeScript, Java, or C++. You can switch languages anytime during practice!`,
        position: 'bottom',
        guestAllowed: true,
    },
    // STEP 11: Settings - Voice
    {
        id: 'settings-voice',
        targetPath: '/settings',
        selector: '[data-tour="voice-capabilities"]',
        title: 'Customize AI Voice',
        content: `Choose Kai's voice and adjust the speaking speed (0.5x - 2.0x). Test the voice to ensure interviews feel natural.`,
        position: 'right',
        guestAllowed: true,
    },
    // STEP 12: Settings - Demo Mode
    {
        id: 'settings-demo',
        targetPath: '/settings',
        selector: '[data-tour="demo-mode"]',
        title: 'Demo Mode',
        content: `Try AlgoMind risk-free with pre-filled dashboard data. Toggle ON to explore with sample interactions without consuming real sessions.`,
        position: 'right',
        guestAllowed: true,
    },
    // STEP 13: Settings - Intro Button
    {
        id: 'settings-intro',
        targetPath: '/settings',
        selector: '[data-tour="intro-button"]',
        title: 'Restart This Tour Anytime',
        content: `Forgot something? Click "Start Tour" here to replay the complete guide or share it with teammates.`,
        position: 'left',
        guestAllowed: true,
    },
    // STEP 14: Final
    {
        id: 'final-step',
        targetPath: '/',
        selector: 'body', // Full screen
        title: "You're All Set!",
        content: `You've mastered AlgoMind basics!
Navigate dashboard tabs, start voice/code interviews, and track your progress.

Ready to ace your DSA interviews?`,
        position: 'center',
        guestAllowed: true,
    }
];
