#!/usr/bin/env bash
# AlgoMind — Code Fix Script
# Run from project root: bash fix_algomind.sh
set -e

echo "🔧 AlgoMind Code Fixes Starting..."

# ─────────────────────────────────────────────────────────────
# FIX 1: spaced_repetition queue.ts
# last_reviewed → last_reviewed_at  (appears in 2 places)
# ─────────────────────────────────────────────────────────────
FILE="src/lib/spaced-repetition/queue.ts"
sed -i "s/last_reviewed: new Date().toISOString()/last_reviewed_at: new Date().toISOString()/g" "$FILE"
echo "✅ Fixed: $FILE (last_reviewed → last_reviewed_at)"

# ─────────────────────────────────────────────────────────────
# FIX 3a: candidate_submissions route — summary key
# time_expired → expired  in the summary object
# ─────────────────────────────────────────────────────────────
FILE="src/app/api/employer/submissions/[campaignId]/route.ts"
sed -i "s/time_expired: 0/expired: 0/g" "$FILE"
echo "✅ Fixed: $FILE (summary key time_expired → expired)"

# ─────────────────────────────────────────────────────────────
# FIX 3b: TypeScript types — campaign.ts
# ─────────────────────────────────────────────────────────────
FILE="src/types/campaign.ts"
sed -i "s/'time_expired'/'expired'/g" "$FILE"
echo "✅ Fixed: $FILE"

# ─────────────────────────────────────────────────────────────
# FIX 3c: CampaignInterviewSession.tsx
# ─────────────────────────────────────────────────────────────
FILE="src/components/enterprise/CampaignInterviewSession.tsx"
sed -i "s/'time_expired'/'expired'/g" "$FILE"
echo "✅ Fixed: $FILE"

# ─────────────────────────────────────────────────────────────
# FIX 3d: CandidateHistoryTable.tsx
# ─────────────────────────────────────────────────────────────
FILE="src/components/dashboard/CandidateHistoryTable.tsx"
sed -i "s/'time_expired'/'expired'/g" "$FILE"
echo "✅ Fixed: $FILE"

# ─────────────────────────────────────────────────────────────
# FIX 3e & 4: EmployerDashboard.tsx
# statusStyle key + setStatusFilter + submissionsSummary key
# ─────────────────────────────────────────────────────────────
FILE="src/components/enterprise/EmployerDashboard.tsx"
sed -i "s/time_expired:/expired:/g" "$FILE"
sed -i "s/'time_expired'/'expired'/g" "$FILE"
sed -i "s/submissionsSummary\.time_expired/submissionsSummary.expired/g" "$FILE"
echo "✅ Fixed: $FILE"

# ─────────────────────────────────────────────────────────────
# FIX 3f: question-timer.ts
# ─────────────────────────────────────────────────────────────
FILE="src/lib/campaign/question-timer.ts"
sed -i "s/'time_expired'/'expired'/g" "$FILE"
echo "✅ Fixed: $FILE"

# ─────────────────────────────────────────────────────────────
# FIX 5 & 6: admin/rag/route.ts
# triggerEmbedding() selects 'title' which doesn't exist in knowledge_chunks
# Fix the select to use topic/subtopic instead, and fix textToEmbed
# Also fix the admin list view that also selects 'title'
# ─────────────────────────────────────────────────────────────
FILE="src/app/api/admin/rag/route.ts"

# Fix triggerEmbedding select: remove 'title', keep topic, subtopic, content, keywords
sed -i "s/\.select('title, content, subtopic, keywords')/.select('topic, subtopic, content, keywords')/g" "$FILE"

# Fix textToEmbed to use topic + subtopic instead of title
sed -i 's/const textToEmbed = `\${chunk\.title}\\n\${chunk\.content}\\n\${chunk\.keywords?.join('\'' '\'')}`;/const textToEmbed = `\${chunk.topic}\${chunk.subtopic ? ': ' + chunk.subtopic : ''}\\n\${chunk.content}\\n\${chunk.keywords?.join(' ')}`;/' "$FILE"

# Fix admin list view: remove 'title' from the list select (line 30)
sed -i "s/\.select('id, topic, subtopic, title, usage_count, effectiveness_score, embedding_status, created_at'/.select('id, topic, subtopic, usage_count, effectiveness_score, embedding_status, created_at'/g" "$FILE"

echo "✅ Fixed: $FILE (triggerEmbedding + list select — removed non-existent 'title' column)"

# ─────────────────────────────────────────────────────────────
# FIX 7: StatsOverview.tsx — Remove streak feature
# Uses Python for safe multi-line surgery
# ─────────────────────────────────────────────────────────────
FILE="src/components/dashboard/StatsOverview.tsx"
python3 - << 'PYEOF'
import re

with open("src/components/dashboard/StatsOverview.tsx", "r") as f:
    content = f.read()

# 1. Remove streakData state declaration
content = content.replace(
    "\n    const [streakData, setStreakData] = useState<{ current: number; longest: number } | null>(null);",
    ""
)

# 2. Remove fetchStreak function and its call inside useEffect
# Pattern: async function fetchStreak() { ... } + fetchStreak();
content = re.sub(
    r"\n        async function fetchStreak\(\) \{.*?fetchStreak\(\);\n",
    "\n",
    content,
    flags=re.DOTALL
)

# 3. Remove the streak JSX display block
content = re.sub(
    r"\n                \{streakData && streakData\.current > 0 && \(.*?\}\)\}\n",
    "\n",
    content,
    flags=re.DOTALL
)

with open("src/components/dashboard/StatsOverview.tsx", "w") as f:
    f.write(content)

print("✅ Fixed: src/components/dashboard/StatsOverview.tsx (streak feature removed)")
PYEOF

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All code fixes applied!"
echo ""
echo "NEXT STEPS:"
echo "  1. git diff  — review all changes"
echo "  2. npm run build  — confirm no TypeScript errors"
echo "  3. git commit -m 'fix: schema/code alignment, expired status, RAG embeddings, streak removal'"
echo "  4. git push  — triggers Vercel deploy"
echo ""
echo "AFTER DEPLOY — In Supabase SQL Editor:"
echo "  Run: SELECT * FROM public.knowledge_chunks WHERE embedding_status = 'failed';"
echo "  Then hit: Admin Panel → RAG → 'Re-embed Failed' button to re-trigger the 31 chunks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"