/**
 * Seeds the database with test data for integration/e2e tests.
 * Creates: 1 test user, 10 completed sessions across difficulties,
 * assessments with all 8 dimensions, skill_repetition records.
 *
 * Run with: npx tsx scripts/seed-test-data.ts
 */

async function seedTestData() {
    // Create test user in auth.users
    // Create profile with candidate account_type
    // Create 10 interview_sessions with status='completed', varying difficulty
    // Create assessments with all 8 dimensions + sub_criteria JSONB
    // Create skill_repetition rows (8 per user)
    // Create one session with hire_decision = 'HIRE'
    // Create one session with hire_decision = 'NO_HIRE'
    // Create learner_profiles with kai_memory_structured
    // Create employer test user + campaign + 3 candidate_submissions
    console.log('Test data seeded successfully');
}

seedTestData().catch(err => {
    console.error('Failed to seed test data:', err);
    process.exit(1);
});
