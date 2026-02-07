
export interface TourStep {
    id: number | string;
    type: 'modal' | 'spotlight';
    location: 'home' | 'dashboard' | 'practice' | 'settings' | 'any';
    tab?: string; // For dashboard tabs
    target?: string; // CSS selector or data-tour attribute
    title?: string;
    content?: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    action?: 'navigate' | 'wait' | null;
    actionParams?: any;
    skipTo?: string | number;
}

export const TOUR_STEPS: TourStep[] = [
    // Step 0: Welcome Modal
    {
        id: 0,
        type: 'modal',
        location: 'any',
        title: 'Welcome to AlgoMind!',
        content: `Let's take a quick 2-minute tour to show you:
    
    ✓ How to start practice interviews
    ✓ How to track your progress
    ✓ How to customize your experience`,
        action: null
    },
    // Step 1: Home - Command Center
    {
        id: 1,
        type: 'spotlight',
        location: 'home',
        target: '[data-tour="home-actions"]',
        title: 'Command Center',
        content: 'Quickly start a practice session, browse problems, or view your dashboard from here.',
        position: 'bottom',
        action: 'navigate',
        actionParams: { path: '/' }
    },
    // Step 2: Dashboard - Overview - Cognitive Profile
    {
        id: 2,
        type: 'spotlight',
        location: 'dashboard',
        tab: 'overview',
        target: '[data-tour="cognitive-profile"]', // Using ID logic from before, assuming chart has this or parent
        // If not, we will ensure it has this attribute. 
        // Actually, let's use the standard selectors we added yesterday or simpler ones.
        // We added data-tour="cognitive-radar" to the Strengths section? No, "cognitive-profile" was the chart?
        // Let's use generic robust selectors or the ones we added.
        // I will double check the dashboard file content in memory or just stick to what I added.
        // I added 'performance-insights', 'cognitive-radar' (strengths), 'journey-progress'.
        // The Chart was in DashboardCard "Cognitive Skill Profile". I need to tag it.
        // For now, I'll assume I'll tag it as 'cognitive-profile-card'
        title: 'Cognitive Profile',
        content: 'Visualize your strengths and weaknesses across key algorithmic concepts.',
        position: 'right',
        action: 'navigate',
        actionParams: { path: '/dashboard', query: { tab: 'overview' } }
    },
    // Step 3: Performance Insights
    {
        id: 3,
        type: 'spotlight',
        location: 'dashboard',
        tab: 'overview',
        target: '[data-tour="performance-insights"]',
        title: 'Performance Insights',
        content: 'Track your practice time, problems solved, and average score improvement.',
        position: 'left'
    },
    // Step 4: Journey Progress
    {
        id: 4,
        type: 'spotlight',
        location: 'dashboard',
        tab: 'overview',
        target: '[data-tour="journey-progress"]',
        title: 'Journey Progress',
        content: 'View your timeline of sessions and upcoming milestones.',
        position: 'top'
    },
    // Step 4b: Export Report (New)
    {
        id: '4b',
        type: 'spotlight',
        location: 'dashboard',
        tab: 'overview',
        target: '[data-id="export-report-btn"]', // Need to add this
        title: 'Export Reports',
        content: 'Download detailed PDF reports of your progress to share or review offline.',
        position: 'bottom'
    },
    // Step 5: Skills Tab
    {
        id: 5,
        type: 'spotlight',
        location: 'dashboard',
        tab: 'skills',
        target: '[data-tour="skills-grid"]',
        title: 'Specific Skills',
        content: 'Deep dive into each skill area to see detailed trends and mastery levels.',
        position: 'top',
        action: 'navigate',
        actionParams: { path: '/dashboard', query: { tab: 'skills' } }
    },
    // Step 6: History Tab
    {
        id: 6,
        type: 'spotlight',
        location: 'dashboard',
        tab: 'history',
        target: '[data-tour="history-list"]',
        title: 'Session History',
        content: 'Review past interviews, transcriptions, and code solutions.',
        position: 'top',
        action: 'navigate',
        actionParams: { path: '/dashboard', query: { tab: 'history' } }
    },
    // Step 7: Insights Tab
    {
        id: 7,
        type: 'spotlight',
        location: 'dashboard',
        tab: 'insights',
        target: '[data-tour="recommendations"]', // We added this
        title: 'AI Insights',
        content: 'Get personalized recommendations on what to practice next based on your performance.',
        position: 'top',
        action: 'navigate',
        actionParams: { path: '/dashboard', query: { tab: 'insights' } }
    },
    // Step 8: Practice - Modes
    {
        id: 8,
        type: 'spotlight',
        location: 'practice',
        target: '[data-tour="mode-toggle"]', // Need to tag this in InterviewSession
        title: 'Two Interview Modes',
        content: 'Switch between Voice Mode (speak your solution) and Code Mode (write and run code).',
        position: 'bottom',
        action: 'navigate',
        actionParams: { path: '/interview', waitForElement: true } // Special handling needed?
        // Note: '/interview' redirects if no problem is loaded. 
        // We might need to handle this by checking if we need to start a demo session or just show generic UI.
        // For simplicity, we assume we landing on a practice page or we trigger "Quick Practice" flow?
        // Triggering a real session might be disruptive.
        // Ideally, we navigate to '/practice' if it exists, or '/interview?demo=true'.
        // The user suggested just navigateTo('/practice'). I will assume '/interview' behaves or I will use a specific problem ID if needed.
    },
    // Step 9: Practice - Chat
    {
        id: 9,
        type: 'spotlight',
        location: 'practice',
        target: '[data-tour="chat-panel"]',
        title: 'Meet Kai',
        content: 'Your AI interviewer Kai will guide you through the problem. Speak naturally!',
        position: 'left'
    },
    // Step 10: Practice - Language
    {
        id: 10,
        type: 'spotlight',
        location: 'practice',
        target: '[data-tour="language-select"]',
        title: 'Language Selection',
        content: 'Choose your preferred programming language for the coding implementation.',
        position: 'bottom'
    },
    // Step 11: Settings - Voice
    {
        id: 11,
        type: 'spotlight',
        location: 'settings',
        target: '[data-tour="voice-capabilities"]',
        title: 'Voice Capabilities',
        content: 'Test different AI voices and adjust speaking rate to your preference.',
        position: 'top',
        action: 'navigate',
        actionParams: { path: '/settings' }
    },
    // Step 12: Settings - Demo Mode
    {
        id: 12,
        type: 'spotlight',
        location: 'settings',
        target: '[data-tour="demo-mode"]',
        title: 'Demo Mode',
        content: 'Enable Demo Mode to populate the dashboard with sample data for exploration.',
        position: 'top'
    },
    // Step 13: Settings - Intro Button
    {
        id: 13,
        type: 'spotlight',
        location: 'settings',
        target: '[data-tour="intro-button"]',
        title: 'Replay Tour',
        content: 'You can restart this tour anytime from here.',
        position: 'top'
    },
    // Step 14: Completion
    {
        id: 14,
        type: 'modal',
        location: 'any',
        title: "You're All Set!",
        content: "You're ready to ace your technical interviews. Good luck!",
        action: null
    }
];
