/**
 * Demo Data Generator
 *
 * Creates a realistic demo account with 3 interview sessions for "Two Sum",
 * SM2 records, assessments, and a learner profile with kai_memory.
 *
 * Usage:
 *   npx tsx src/scripts/generate-demo-data.ts <user-id>
 *
 * Run on a demo account before presenting.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PROBLEM_ID = 'two-sum';
const PROBLEM_TITLE = 'Two Sum';
const PROBLEM_DIFFICULTY = 'easy';

// Session timestamps: 20 days ago, 10 days ago, today
const now = Date.now();
const sessions = [
    {
        daysAgo: 20,
        score: 4,
        duration: 1200, // 20 min
        skills: { pd: 3, pr: 4, at: 3, ca: 4, cc: 5, ec: 3, om: 4, da: 4 },
    },
    {
        daysAgo: 10,
        score: 6,
        duration: 1500, // 25 min
        skills: { pd: 5, pr: 6, at: 6, ca: 5, cc: 7, ec: 5, om: 6, da: 6 },
    },
    {
        daysAgo: 0,
        score: 8,
        duration: 1800, // 30 min
        skills: { pd: 8, pr: 8, at: 7, ca: 8, cc: 9, ec: 7, om: 8, da: 8 },
    },
];

async function generate(userId: string) {
    console.log(`🚀 Generating demo data for user: ${userId}`);

    const sessionIds: string[] = [];

    for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i];
        const timestamp = new Date(now - s.daysAgo * 24 * 60 * 60 * 1000).toISOString();
        const previousSessionId = i > 0 ? sessionIds[i - 1] : null;

        // 1. Insert interview session
        const { data: session, error: sessionErr } = await supabase
            .from('interview_sessions')
            .insert({
                user_id: userId,
                problem_id: PROBLEM_ID,
                problem_title: PROBLEM_TITLE,
                problem_difficulty: PROBLEM_DIFFICULTY,
                overall_score: s.score,
                duration: s.duration,
                status: 'completed',
                completed_at: timestamp,
                created_at: timestamp,
                previous_session_id: previousSessionId,
                transcript: [
                    { speaker: 'interviewer', text: `Welcome! Let's work on ${PROBLEM_TITLE}. Can you describe your approach?` },
                    { speaker: 'candidate', text: 'I would use a hash map to store complements...' },
                    { speaker: 'interviewer', text: 'Good. What about the time complexity?' },
                    { speaker: 'candidate', text: 'O(n) time and O(n) space.' },
                ],
            })
            .select('id')
            .single();

        if (sessionErr || !session) {
            console.error(`❌ Failed to insert session ${i + 1}:`, sessionErr);
            continue;
        }

        sessionIds.push(session.id);
        console.log(`  ✅ Session ${i + 1}: ${session.id} (score: ${s.score}, ${s.daysAgo}d ago)`);

        // 2. Insert assessment
        const { error: assessErr } = await supabase
            .from('assessments')
            .insert({
                session_id: session.id,
                user_id: userId,
                overall_score: s.score,
                problem_decomposition: s.skills.pd,
                pattern_recognition: s.skills.pr,
                algorithmic_thinking: s.skills.at,
                complexity_analysis: s.skills.ca,
                communication_clarity: s.skills.cc,
                edge_case_awareness: s.skills.ec,
                optimization_mindset: s.skills.om,
                debugging_approach: s.skills.da,
                overall_feedback: i === 0
                    ? 'Needs improvement. Focus on breaking down the problem into steps.'
                    : i === 1
                        ? 'Good progress! Pattern recognition is improving. Keep practicing.'
                        : 'Excellent work! Strong overall performance. Ready for harder problems.',
                next_steps: i === 0
                    ? ['Practice hash map patterns', 'Work on edge cases']
                    : i === 1
                        ? ['Focus on optimization', 'Explain complexity more clearly']
                        : ['Try medium difficulty', 'Practice system design'],
            });

        if (assessErr) console.error(`  ⚠️ Assessment ${i + 1} error:`, assessErr);
        else console.log(`  ✅ Assessment ${i + 1} created`);

        // 3. Insert/update SM2 record
        const nextReview = new Date(now + (i + 1) * 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { error: sm2Err } = await supabase
            .from('spaced_repetition')
            .upsert({
                user_id: userId,
                problem_id: PROBLEM_ID,
                problem_title: PROBLEM_TITLE,
                problem_difficulty: PROBLEM_DIFFICULTY,
                repetitions: i + 1,
                interval: (i + 1) * 3,
                ease_factor: 2.5 + i * 0.1,
                next_review_date: nextReview,
                last_quality: Math.min(s.score, 5),
            }, {
                onConflict: 'user_id,problem_id',
            });

        if (sm2Err) console.error(`  ⚠️ SM2 ${i + 1} error:`, sm2Err);
        else console.log(`  ✅ SM2 record updated (next review: ${nextReview})`);
    }

    // 4. Insert learner profile with kai_memory
    const { error: profileErr } = await supabase
        .from('learner_profiles')
        .upsert({
            user_id: userId,
            kai_memory: `Session 1 (20d ago): Student struggled with Two Sum. Didn't consider hash map initially. Needed hints on complement approach. Score: 4/10.\n\nSession 2 (10d ago): Great improvement! Found hash map approach independently. Struggled with edge cases (empty array, duplicates). Score: 6/10.\n\nSession 3 (today): Excellent! Solved Two Sum with O(n) approach, handled all edge cases, explained complexity clearly. Ready for medium problems. Score: 8/10.`,
            sessions_at_last_narrative: 3,
        }, {
            onConflict: 'user_id',
        });

    if (profileErr) console.error('  ⚠️ Learner profile error:', profileErr);
    else console.log('  ✅ Learner profile with kai_memory created');

    console.log(`\n🎉 Demo data generation complete!`);
    console.log(`   Sessions: ${sessionIds.join(', ')}`);
    console.log(`   Problem: ${PROBLEM_TITLE}`);
    console.log(`   Scores: 4 → 6 → 8 (improvement arc)`);
}

// CLI entry point
const userId = process.argv[2];
if (!userId) {
    console.error('Usage: npx tsx src/scripts/generate-demo-data.ts <user-id>');
    process.exit(1);
}

generate(userId).catch(console.error);
