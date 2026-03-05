import { ProgressStore } from '../src/lib/assessment/progress-store';
import { generateMockProgress } from '../src/__tests__/fixtures/mock-data';

/**
 * Note: This script is intended to be run in a browser console OR via a demo button in the UI
 * since it interacts with LocalStorage.
 * 
 * For the CLI, we can simulate the storage structure or export it as a JSON file.
 */
export async function seedDemoData(userId: string = 'demo-user') {
    const store = new ProgressStore();
    const mockSessions = generateMockProgress(10, userId);

    // Clear existing
    localStorage.removeItem(`algomind_progress_${userId}`);

    // Save each session
    for (const session of mockSessions) {
        await store.saveSession(session);
    }

    console.log(`✅ Successfully seeded 10 demo sessions for user: ${userId}`);
    return mockSessions;
}
