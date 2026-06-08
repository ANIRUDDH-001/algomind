/**
 * @module kai-context/builder
 * @description buildStudentContext - assembles the full StudentContext for a user.
 *              Called at session start. Result is cached in Redis for 24 hours.
 * @phase Phase 2B
 */
// @ts-nocheck

// 


import { getRedis } from '@/lib/upstash/client';
import { getServiceClient } from '@/lib/supabase/service';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getWeeklySessionLimit } from '@/lib/config/system-config';
import { checkWeeklySessionLimitReadOnly } from '@/lib/rate-limit/weekly-session-limiter';
import type {
  StudentContext,
  ConceptSnapshot,
  PerformanceSummary,
  KaiMemoryStructured,
  StudentContextPromptBlock,
} from './types';
import type { Json } from '@/types/supabase';

const STUDENT_CONTEXT_CACHE_KEY = (userId: string) => `student_context:${userId}`;
const STUDENT_CONTEXT_TTL_SECONDS = 60 * 60 * 24;

export async function buildStudentContext(userId: string): Promise<StudentContext> {
  const cacheKey = STUDENT_CONTEXT_CACHE_KEY(userId);

  try {
    const redis = getRedis();
    if (redis) {
      const cached = await redis.get<StudentContext>(cacheKey);
      if (cached) {
        return cached;
      }
    }
  } catch {
    // Redis failure is non-fatal.
  }

  const context = await assembleStudentContext(userId);

  try {
    const redis = getRedis();
    if (redis) {
      await redis.set(cacheKey, context, { ex: STUDENT_CONTEXT_TTL_SECONDS });
    }
  } catch {
    // Redis failure is non-fatal.
  }

  return context;
}

export async function invalidateStudentContext(userId: string): Promise<void> {
  try {
    const redis = getRedis();
    if (redis) {
      await redis.del(STUDENT_CONTEXT_CACHE_KEY(userId));
    }
  } catch {
    // Cache invalidation failure is non-fatal.
  }
}

export function buildStudentContextPromptBlock(ctx: StudentContext): string {
  const weak = ctx.weakestConcepts
    .slice(0, 5)
    .map((concept) => `${concept.displayName}(${(concept.confidence * 100).toFixed(0)}%)`)
    .join(', ') || 'None tracked yet';

  const strong = ctx.strongestConcepts
    .slice(0, 3)
    .map((concept) => `${concept.displayName}(${(concept.confidence * 100).toFixed(0)}%)`)
    .join(', ') || 'None tracked yet';

  const perf = ctx.performance;
  const perfStr = perf.totalSessionsCompleted > 0
    ? `${perf.totalSessionsCompleted} sessions, avg ${perf.averageScore?.toFixed(1) ?? 'N/A'}/10, last ${perf.lastSessionScore?.toFixed(1) ?? 'N/A'}/10`
    : 'No sessions yet';

  const memStructured = ctx.kaiMemoryStructured;
  const memStr = memStructured
    ? `Strength: ${memStructured.topStrength ?? 'unknown'}. Weakness: ${memStructured.mainWeakness ?? 'unknown'}. Style: ${memStructured.communicationStyle ?? 'unknown'}. Focus: ${memStructured.focusForNextSession ?? 'unknown'}.`
    : ctx.kaiMemoryText?.slice(0, 200) ?? 'No prior memory.';

  const subStr = ctx.subscription.status === 'free'
    ? `Free: ${ctx.subscription.sessionsUsedThisWeek}/${ctx.subscription.weeklyLimit} sessions used`
    : `${ctx.subscription.status} subscriber (unlimited)`;

  const diagStr = ctx.hasCompletedDiagnostic
    ? 'Diagnostic: complete'
    : 'Diagnostic: pending (first-time user)';

  const block: StudentContextPromptBlock = {
    weakConcepts: weak,
    strongConcepts: strong,
    sessionHistory: perfStr,
    kaiMemory: memStr,
    subscriptionNote: subStr,
    diagnosticStatus: diagStr,
  };

  return `<student_context>
<weak_concepts>${xmlEscape(block.weakConcepts)}</weak_concepts>
<strong_concepts>${xmlEscape(block.strongConcepts)}</strong_concepts>
<session_history>${xmlEscape(block.sessionHistory)}</session_history>
<kai_memory>${xmlEscape(block.kaiMemory)}</kai_memory>
<subscription>${xmlEscape(block.subscriptionNote)}</subscription>
<diagnostic_status>${xmlEscape(block.diagnosticStatus)}</diagnostic_status>
</student_context>`;
}

async function assembleStudentContext(userId: string): Promise<StudentContext> {
  const [
    kgSummaries,
    profileData,
    performanceData,
    subscriptionData,
    weeklyLimit,
    weeklyUsageResult,
    weeklyLearnLimitResult,
    nextRecommendedConceptResult,
  ] = await Promise.allSettled([
    getKnowledgeGraphService().getConceptSummaries(userId),
    fetchProfileData(userId),
    fetchPerformanceData(userId),
    getUserSubscriptionStatus(userId),
    getWeeklySessionLimit(),
    fetchWeeklyLearnUsage(userId),
    checkWeeklySessionLimitReadOnly(userId, 'learn'),
    getKnowledgeGraphService().getNextRecommendedConcept(userId),
  ]);

  const summaries = kgSummaries.status === 'fulfilled' ? kgSummaries.value : [];
  const profile = profileData.status === 'fulfilled' ? profileData.value : null;
  const perf = performanceData.status === 'fulfilled' ? performanceData.value : defaultPerformance();
  const sub = subscriptionData.status === 'fulfilled'
    ? subscriptionData.value
    : { status: 'free' as const, expiresAt: null };
  const limit = weeklyLimit.status === 'fulfilled' ? weeklyLimit.value : 5;
  const weeklyUsage = weeklyUsageResult.status === 'fulfilled' ? weeklyUsageResult.value : 0;
  const weeklyLearnLimit = weeklyLearnLimitResult.status === 'fulfilled' ? weeklyLearnLimitResult.value : null;
  const nextRecommendedConcept = nextRecommendedConceptResult.status === 'fulfilled'
    ? nextRecommendedConceptResult.value
    : null;

  const allSnapshots: ConceptSnapshot[] = summaries.map((summary) => ({
    slug: summary.slug,
    displayName: summary.displayName,
    confidence: summary.confidence,
    level: summary.level,
    evidenceCount: summary.evidenceCount,
  }));

  const withEvidence = allSnapshots.filter((snapshot) => snapshot.evidenceCount > 0);
  const weakest = [...withEvidence].sort((a, b) => a.confidence - b.confidence).slice(0, 5);
  const strongest = [...withEvidence].sort((a, b) => b.confidence - a.confidence).slice(0, 3);

  const sessionsUsedThisWeek = weeklyLearnLimit ? weeklyLearnLimit.sessionsUsed : weeklyUsage;
  const effectiveWeeklyLimit = weeklyLearnLimit
    ? weeklyLearnLimit.limit
    : (sub.status === 'free' ? limit : null);
  const sessionsRemaining = weeklyLearnLimit
    ? weeklyLearnLimit.sessionsRemaining
    : (sub.status === 'free' ? Math.max(0, limit - weeklyUsage) : null);

  return {
    userId,
    builtAt: new Date().toISOString(),
    hasCompletedDiagnostic: withEvidence.length > 0,
    weakestConcepts: weakest,
    strongestConcepts: strongest,
    allConceptSummaries: allSnapshots,
    nextRecommendedConcept: nextRecommendedConcept ?? weakest[0]?.slug ?? allSnapshots[0]?.slug ?? null,
    performance: perf,
    kaiMemoryText: profile?.kaiMemory ?? null,
    kaiMemoryStructured: profile?.kaiMemoryStructured ?? null,
    subscription: {
      status: sub.status,
      sessionsUsedThisWeek,
      weeklyLimit: effectiveWeeklyLimit,
      sessionsRemaining,
    },
    accountType: profile?.accountType ?? 'candidate',
  };
}

async function fetchProfileData(userId: string): Promise<{
  kaiMemory: string | null;
  kaiMemoryStructured: KaiMemoryStructured | null;
  accountType: 'candidate' | 'employer' | 'admin' | 'owner';
} | null> {
  const [profileRes, learnerRes] = await Promise.allSettled([
    getServiceClient()
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .single(),
    getServiceClient()
      .from('learner_profiles')
      .select('kai_memory, kai_memory_structured')
      .eq('user_id', userId)
      .single(),
  ]);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value.data : null;
  const learner = learnerRes.status === 'fulfilled' ? learnerRes.value.data : null;

  return {
    kaiMemory: learner?.kai_memory ?? null,
    kaiMemoryStructured: normalizeKaiMemoryStructured(learner?.kai_memory_structured ?? null),
    accountType: normalizeAccountType(profile?.account_type),
  };
}

async function fetchPerformanceData(userId: string): Promise<PerformanceSummary> {
  const { data } = await getServiceClient()
    .from('interview_sessions')
    .select('overall_score, completed_at, created_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20);

  if (!data || data.length === 0) {
    return defaultPerformance();
  }

  const scores = data
    .filter((session) => session.overall_score !== null)
    .map((session) => Number(session.overall_score));
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const dates = data.map((session) => session.completed_at ?? session.created_at);

  return {
    totalSessionsCompleted: data.length,
    averageScore: avgScore === null ? null : Math.round(avgScore * 10) / 10,
    lastSessionScore: scores[0] ?? null,
    lastSessionAt: data[0]?.completed_at ?? data[0]?.created_at ?? null,
    streak: computeStreak(dates),
  };
}

async function fetchWeeklyLearnUsage(userId: string): Promise<number> {
  const weekStart = getWeekStart();
  const { data } = await getServiceClient()
    .from('user_weekly_usage')
    .select('learn_sessions_used')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (!data) {
    return 0;
  }
  return data.learn_sessions_used ?? 0;
}

function getWeekStart(): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - offsetToMonday);
  return date.toISOString().split('T')[0] ?? '';
}

function computeStreak(sessionDates: (string | null)[]): number {
  const uniqueDays = sessionDates
    .filter((value): value is string => Boolean(value))
    .map((value) => toUtcDateOnly(value))
    .filter((value, index, array) => array.indexOf(value) === index);

  if (uniqueDays.length === 0) {
    return 0;
  }

  const today = toUtcDateOnly(new Date().toISOString());
  if (uniqueDays[0] !== today) {
    return 0;
  }

  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(`${uniqueDays[i - 1]}T00:00:00.000Z`);
    const curr = new Date(`${uniqueDays[i]}T00:00:00.000Z`);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function toUtcDateOnly(isoString: string): string {
  return new Date(isoString).toISOString().split('T')[0] ?? '';
}

function normalizeKaiMemoryStructured(value: Json): KaiMemoryStructured | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const topStrength = extractSkillString(record.topStrength);
  const mainWeakness = extractSkillString(record.mainWeakness);
  const communicationStyle = typeof record.communicationStyle === 'string'
    ? record.communicationStyle
    : null;
  const focusForNextSession = typeof record.focusForNextSession === 'string'
    ? record.focusForNextSession
    : null;

  if (!topStrength && !mainWeakness && !communicationStyle && !focusForNextSession) {
    return null;
  }

  return {
    topStrength,
    mainWeakness,
    communicationStyle,
    focusForNextSession,
  };
}

function extractSkillString(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  return typeof record.skill === 'string' ? record.skill : null;
}

function normalizeAccountType(value: unknown): 'candidate' | 'employer' | 'admin' | 'owner' {
  if (value === 'candidate' || value === 'employer' || value === 'admin' || value === 'owner') {
    return value;
  }
  return 'candidate';
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function defaultPerformance(): PerformanceSummary {
  return {
    totalSessionsCompleted: 0,
    averageScore: null,
    lastSessionScore: null,
    lastSessionAt: null,
    streak: 0,
  };
}
