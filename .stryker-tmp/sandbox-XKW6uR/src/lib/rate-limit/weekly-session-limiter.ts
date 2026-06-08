/**
 * @codesage
 * @file      src/lib/rate-limit/weekly-session-limiter.ts
 * @purpose   Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Session state
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

/**
 * @module rate-limit/weekly-session-limiter
 * @description Per-type weekly session limit enforcement for the freemium gate.
 *              Interview and learn sessions have independent limits, both configurable
 *              from the owner dashboard.
 *
 *              Key design decisions:
 *              - Increment is ATOMIC via DB function (no SELECT+UPDATE race condition)
 *              - Increment is AWAITED — failure blocks the session, not fire-and-forget
 *              - Per-type: interview and learn limits are independent
 *              - Premium users bypass all limits
 *              - Admin/owner accounts bypass all limits
 *              - enable_session_gating=false bypasses all limits globally
 */function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { getServiceClient } from '@/lib/supabase/service';
import { getUserSubscriptionStatus } from '@/lib/supabase/user-preferences';
import { getSystemConfig, isSessionGatingEnabled } from '@/lib/config/system-config';
import { SYSTEM_CONFIG_KEYS } from '@/lib/config/system-config-keys';
async function isCoOwner(userId: string, email?: string | null): Promise<boolean> {
  if (stryMutAct_9fa48("2749")) {
    {}
  } else {
    stryCov_9fa48("2749");
    const emailClause = email ? stryMutAct_9fa48("2750") ? `` : (stryCov_9fa48("2750"), `,email.eq.${email}`) : stryMutAct_9fa48("2751") ? "Stryker was here!" : (stryCov_9fa48("2751"), '');
    const {
      data: coOwner
    } = await getServiceClient().from(stryMutAct_9fa48("2752") ? "" : (stryCov_9fa48("2752"), 'co_owners')).select(stryMutAct_9fa48("2753") ? "" : (stryCov_9fa48("2753"), 'id')).or(stryMutAct_9fa48("2754") ? `` : (stryCov_9fa48("2754"), `user_id.eq.${userId}${emailClause}`)).limit(1).maybeSingle();
    return Boolean(coOwner);
  }
}
export type SessionType = 'interview' | 'learn';
export interface WeeklySessionLimitResult {
  allowed: boolean;
  sessionsUsed: number;
  limit: number | null; // null = unlimited
  sessionsRemaining: number | null;
  reason: 'premium' | 'admin' | 'gating_disabled' | 'within_limit' | 'limit_exceeded';
}

/**
 * Read-only check to see if a user has reached their weekly session limit.
 * This does NOT consume a session. Use this for UI rendering only.
 */
export async function checkWeeklySessionLimitReadOnly(userId: string, sessionType: SessionType): Promise<WeeklySessionLimitResult> {
  if (stryMutAct_9fa48("2755")) {
    {}
  } else {
    stryCov_9fa48("2755");
    // 1. Global gate switch
    const gatingEnabled = await isSessionGatingEnabled();
    if (stryMutAct_9fa48("2758") ? false : stryMutAct_9fa48("2757") ? true : stryMutAct_9fa48("2756") ? gatingEnabled : (stryCov_9fa48("2756", "2757", "2758"), !gatingEnabled)) {
      if (stryMutAct_9fa48("2759")) {
        {}
      } else {
        stryCov_9fa48("2759");
        return stryMutAct_9fa48("2760") ? {} : (stryCov_9fa48("2760"), {
          allowed: stryMutAct_9fa48("2761") ? false : (stryCov_9fa48("2761"), true),
          sessionsUsed: 0,
          limit: null,
          sessionsRemaining: null,
          reason: stryMutAct_9fa48("2762") ? "" : (stryCov_9fa48("2762"), 'gating_disabled')
        });
      }
    }

    // 2. Subscription status — premium/college bypass
    const {
      status: subscriptionStatus
    } = await getUserSubscriptionStatus(userId);
    if (stryMutAct_9fa48("2765") ? subscriptionStatus === 'free' : stryMutAct_9fa48("2764") ? false : stryMutAct_9fa48("2763") ? true : (stryCov_9fa48("2763", "2764", "2765"), subscriptionStatus !== (stryMutAct_9fa48("2766") ? "" : (stryCov_9fa48("2766"), 'free')))) {
      if (stryMutAct_9fa48("2767")) {
        {}
      } else {
        stryCov_9fa48("2767");
        return stryMutAct_9fa48("2768") ? {} : (stryCov_9fa48("2768"), {
          allowed: stryMutAct_9fa48("2769") ? false : (stryCov_9fa48("2769"), true),
          sessionsUsed: 0,
          limit: null,
          sessionsRemaining: null,
          reason: stryMutAct_9fa48("2770") ? "" : (stryCov_9fa48("2770"), 'premium')
        });
      }
    }

    // 3. Admin / owner bypass
    const {
      data: profile
    } = await getServiceClient().from(stryMutAct_9fa48("2771") ? "" : (stryCov_9fa48("2771"), 'profiles')).select(stryMutAct_9fa48("2772") ? "" : (stryCov_9fa48("2772"), 'account_type, rate_limit_override, email')).eq(stryMutAct_9fa48("2773") ? "" : (stryCov_9fa48("2773"), 'id'), userId).single();
    const coOwner = await isCoOwner(userId, stryMutAct_9fa48("2774") ? profile.email : (stryCov_9fa48("2774"), profile?.email));
    if (stryMutAct_9fa48("2777") ? (profile?.account_type === 'admin' || profile?.account_type === 'owner' || coOwner) && profile?.rate_limit_override === 0 : stryMutAct_9fa48("2776") ? false : stryMutAct_9fa48("2775") ? true : (stryCov_9fa48("2775", "2776", "2777"), (stryMutAct_9fa48("2779") ? (profile?.account_type === 'admin' || profile?.account_type === 'owner') && coOwner : stryMutAct_9fa48("2778") ? false : (stryCov_9fa48("2778", "2779"), (stryMutAct_9fa48("2781") ? profile?.account_type === 'admin' && profile?.account_type === 'owner' : stryMutAct_9fa48("2780") ? false : (stryCov_9fa48("2780", "2781"), (stryMutAct_9fa48("2783") ? profile?.account_type !== 'admin' : stryMutAct_9fa48("2782") ? false : (stryCov_9fa48("2782", "2783"), (stryMutAct_9fa48("2784") ? profile.account_type : (stryCov_9fa48("2784"), profile?.account_type)) === (stryMutAct_9fa48("2785") ? "" : (stryCov_9fa48("2785"), 'admin')))) || (stryMutAct_9fa48("2787") ? profile?.account_type !== 'owner' : stryMutAct_9fa48("2786") ? false : (stryCov_9fa48("2786", "2787"), (stryMutAct_9fa48("2788") ? profile.account_type : (stryCov_9fa48("2788"), profile?.account_type)) === (stryMutAct_9fa48("2789") ? "" : (stryCov_9fa48("2789"), 'owner')))))) || coOwner)) || (stryMutAct_9fa48("2791") ? profile?.rate_limit_override !== 0 : stryMutAct_9fa48("2790") ? false : (stryCov_9fa48("2790", "2791"), (stryMutAct_9fa48("2792") ? profile.rate_limit_override : (stryCov_9fa48("2792"), profile?.rate_limit_override)) === 0)))) {
      if (stryMutAct_9fa48("2793")) {
        {}
      } else {
        stryCov_9fa48("2793");
        return stryMutAct_9fa48("2794") ? {} : (stryCov_9fa48("2794"), {
          allowed: stryMutAct_9fa48("2795") ? false : (stryCov_9fa48("2795"), true),
          sessionsUsed: 0,
          limit: null,
          sessionsRemaining: null,
          reason: stryMutAct_9fa48("2796") ? "" : (stryCov_9fa48("2796"), 'admin')
        });
      }
    }

    // 4. Get per-type limit from system_config
    const configKey = (stryMutAct_9fa48("2799") ? sessionType !== 'interview' : stryMutAct_9fa48("2798") ? false : stryMutAct_9fa48("2797") ? true : (stryCov_9fa48("2797", "2798", "2799"), sessionType === (stryMutAct_9fa48("2800") ? "" : (stryCov_9fa48("2800"), 'interview')))) ? SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT : SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_LEARN_LIMIT;
    const rawLimit = await getSystemConfig(configKey);
    const effectiveLimit = stryMutAct_9fa48("2801") ? profile?.rate_limit_override && (parseInt(rawLimit, 10) || 5) : (stryCov_9fa48("2801"), (stryMutAct_9fa48("2802") ? profile.rate_limit_override : (stryCov_9fa48("2802"), profile?.rate_limit_override)) ?? (stryMutAct_9fa48("2805") ? parseInt(rawLimit, 10) && 5 : stryMutAct_9fa48("2804") ? false : stryMutAct_9fa48("2803") ? true : (stryCov_9fa48("2803", "2804", "2805"), parseInt(rawLimit, 10) || 5)));

    // 5. Get current per-type usage
    const sessionsUsed = await fetchWeeklyTypeCount(userId, sessionType);
    const sessionsRemaining = stryMutAct_9fa48("2806") ? Math.min(0, effectiveLimit - sessionsUsed) : (stryCov_9fa48("2806"), Math.max(0, stryMutAct_9fa48("2807") ? effectiveLimit + sessionsUsed : (stryCov_9fa48("2807"), effectiveLimit - sessionsUsed)));
    return stryMutAct_9fa48("2808") ? {} : (stryCov_9fa48("2808"), {
      allowed: stryMutAct_9fa48("2812") ? sessionsUsed >= effectiveLimit : stryMutAct_9fa48("2811") ? sessionsUsed <= effectiveLimit : stryMutAct_9fa48("2810") ? false : stryMutAct_9fa48("2809") ? true : (stryCov_9fa48("2809", "2810", "2811", "2812"), sessionsUsed < effectiveLimit),
      sessionsUsed,
      limit: effectiveLimit,
      sessionsRemaining,
      reason: (stryMutAct_9fa48("2816") ? sessionsUsed >= effectiveLimit : stryMutAct_9fa48("2815") ? sessionsUsed <= effectiveLimit : stryMutAct_9fa48("2814") ? false : stryMutAct_9fa48("2813") ? true : (stryCov_9fa48("2813", "2814", "2815", "2816"), sessionsUsed < effectiveLimit)) ? stryMutAct_9fa48("2817") ? "" : (stryCov_9fa48("2817"), 'within_limit') : stryMutAct_9fa48("2818") ? "" : (stryCov_9fa48("2818"), 'limit_exceeded')
    });
  }
}

/**
 * Atomically checks AND increments the weekly session count for a user.
 *
 * IMPORTANT: This function ALWAYS increments the counter when called.
 * Do not call it unless you intend to consume a session slot.
 * If the result is allowed=false, the increment is rolled back internally.
 */
export async function checkAndIncrementWeeklySession(userId: string, sessionType: SessionType): Promise<WeeklySessionLimitResult> {
  if (stryMutAct_9fa48("2819")) {
    {}
  } else {
    stryCov_9fa48("2819");
    // First run the read-only check to see if they are bypassed (premium, admin, disabled)
    // If they are bypassed, we do not need to increment the free-tier counter in the DB
    const readOnlyCheck = await checkWeeklySessionLimitReadOnly(userId, sessionType);
    if (stryMutAct_9fa48("2822") ? (readOnlyCheck.reason === 'premium' || readOnlyCheck.reason === 'admin') && readOnlyCheck.reason === 'gating_disabled' : stryMutAct_9fa48("2821") ? false : stryMutAct_9fa48("2820") ? true : (stryCov_9fa48("2820", "2821", "2822"), (stryMutAct_9fa48("2824") ? readOnlyCheck.reason === 'premium' && readOnlyCheck.reason === 'admin' : stryMutAct_9fa48("2823") ? false : (stryCov_9fa48("2823", "2824"), (stryMutAct_9fa48("2826") ? readOnlyCheck.reason !== 'premium' : stryMutAct_9fa48("2825") ? false : (stryCov_9fa48("2825", "2826"), readOnlyCheck.reason === (stryMutAct_9fa48("2827") ? "" : (stryCov_9fa48("2827"), 'premium')))) || (stryMutAct_9fa48("2829") ? readOnlyCheck.reason !== 'admin' : stryMutAct_9fa48("2828") ? false : (stryCov_9fa48("2828", "2829"), readOnlyCheck.reason === (stryMutAct_9fa48("2830") ? "" : (stryCov_9fa48("2830"), 'admin')))))) || (stryMutAct_9fa48("2832") ? readOnlyCheck.reason !== 'gating_disabled' : stryMutAct_9fa48("2831") ? false : (stryCov_9fa48("2831", "2832"), readOnlyCheck.reason === (stryMutAct_9fa48("2833") ? "" : (stryCov_9fa48("2833"), 'gating_disabled')))))) {
      if (stryMutAct_9fa48("2834")) {
        {}
      } else {
        stryCov_9fa48("2834");
        return readOnlyCheck;
      }
    }

    // We are here -> user is subject to limits. The limit must be an actual number.
    const limit = stryMutAct_9fa48("2835") ? readOnlyCheck.limit && 5 : (stryCov_9fa48("2835"), readOnlyCheck.limit ?? 5);
    const {
      data,
      error
    } = await getServiceClient().rpc(stryMutAct_9fa48("2836") ? "" : (stryCov_9fa48("2836"), 'check_and_increment_weekly_usage'), stryMutAct_9fa48("2837") ? {} : (stryCov_9fa48("2837"), {
      p_user_id: userId,
      p_session_type: sessionType,
      p_weekly_limit: limit
    }));
    if (stryMutAct_9fa48("2840") ? (error || !data) && (data as any[]).length === 0 : stryMutAct_9fa48("2839") ? false : stryMutAct_9fa48("2838") ? true : (stryCov_9fa48("2838", "2839", "2840"), (stryMutAct_9fa48("2842") ? error && !data : stryMutAct_9fa48("2841") ? false : (stryCov_9fa48("2841", "2842"), error || (stryMutAct_9fa48("2843") ? data : (stryCov_9fa48("2843"), !data)))) || (stryMutAct_9fa48("2845") ? (data as any[]).length !== 0 : stryMutAct_9fa48("2844") ? false : (stryCov_9fa48("2844", "2845"), (data as any[]).length === 0)))) {
      if (stryMutAct_9fa48("2846")) {
        {}
      } else {
        stryCov_9fa48("2846");
        console.error(stryMutAct_9fa48("2847") ? "" : (stryCov_9fa48("2847"), '[WeeklyLimiter] RPC failed:'), stryMutAct_9fa48("2848") ? error.message : (stryCov_9fa48("2848"), error?.message));
        // Fail-closed: deny access if we can't check the limit
        return stryMutAct_9fa48("2849") ? {} : (stryCov_9fa48("2849"), {
          allowed: stryMutAct_9fa48("2850") ? true : (stryCov_9fa48("2850"), false),
          sessionsUsed: stryMutAct_9fa48("2851") ? +1 : (stryCov_9fa48("2851"), -1),
          limit,
          sessionsRemaining: 0,
          reason: stryMutAct_9fa48("2852") ? "" : (stryCov_9fa48("2852"), 'limit_exceeded')
        });
      }
    }
    const result = (data as any[])[0] as {
      allowed: boolean;
      sessions_used: number;
      limit_value: number;
    };
    return stryMutAct_9fa48("2853") ? {} : (stryCov_9fa48("2853"), {
      allowed: result.allowed,
      sessionsUsed: result.sessions_used,
      limit: result.limit_value,
      sessionsRemaining: stryMutAct_9fa48("2854") ? Math.min(0, result.limit_value - result.sessions_used) : (stryCov_9fa48("2854"), Math.max(0, stryMutAct_9fa48("2855") ? result.limit_value + result.sessions_used : (stryCov_9fa48("2855"), result.limit_value - result.sessions_used))),
      reason: result.allowed ? stryMutAct_9fa48("2856") ? "" : (stryCov_9fa48("2856"), 'within_limit') : stryMutAct_9fa48("2857") ? "" : (stryCov_9fa48("2857"), 'limit_exceeded')
    });
  }
}

/**
 * @deprecated Use checkAndIncrementWeeklySession instead.
 * Kept for backward compatibility during migration.
 */
export async function checkWeeklySessionLimit(userId: string, sessionType: SessionType): Promise<WeeklySessionLimitResult> {
  if (stryMutAct_9fa48("2858")) {
    {}
  } else {
    stryCov_9fa48("2858");
    console.warn((stryMutAct_9fa48("2859") ? "" : (stryCov_9fa48("2859"), '[WeeklyLimiter] checkWeeklySessionLimit is deprecated and has a TOCTOU race. ')) + (stryMutAct_9fa48("2860") ? "" : (stryCov_9fa48("2860"), 'Use checkAndIncrementWeeklySession instead.')));
    return checkAndIncrementWeeklySession(userId, sessionType);
  }
}

/**
 * Get the current count for one session type this week.
 */
async function fetchWeeklyTypeCount(userId: string, sessionType: SessionType): Promise<number> {
  if (stryMutAct_9fa48("2861")) {
    {}
  } else {
    stryCov_9fa48("2861");
    const weekStart = getMondayUTC();
    const col = (stryMutAct_9fa48("2864") ? sessionType !== 'interview' : stryMutAct_9fa48("2863") ? false : stryMutAct_9fa48("2862") ? true : (stryCov_9fa48("2862", "2863", "2864"), sessionType === (stryMutAct_9fa48("2865") ? "" : (stryCov_9fa48("2865"), 'interview')))) ? stryMutAct_9fa48("2866") ? "" : (stryCov_9fa48("2866"), 'interview_sessions_used') : stryMutAct_9fa48("2867") ? "" : (stryCov_9fa48("2867"), 'learn_sessions_used');
    const {
      data
    } = await getServiceClient().from(stryMutAct_9fa48("2868") ? "" : (stryCov_9fa48("2868"), 'user_weekly_usage')).select(col).eq(stryMutAct_9fa48("2869") ? "" : (stryCov_9fa48("2869"), 'user_id'), userId).eq(stryMutAct_9fa48("2870") ? "" : (stryCov_9fa48("2870"), 'week_start'), weekStart).maybeSingle();
    if (stryMutAct_9fa48("2873") ? false : stryMutAct_9fa48("2872") ? true : stryMutAct_9fa48("2871") ? data : (stryCov_9fa48("2871", "2872", "2873"), !data)) return 0;
    return stryMutAct_9fa48("2874") ? (data as Record<string, number>)[col] && 0 : (stryCov_9fa48("2874"), (data as Record<string, number>)[col] ?? 0);
  }
}

/**
 * Get counts for BOTH types — used by /api/knowledge/session-limit and owner stats.
 */
export async function getWeeklySessionCount(userId: string): Promise<{
  interview: number;
  learn: number;
  total: number;
}> {
  if (stryMutAct_9fa48("2875")) {
    {}
  } else {
    stryCov_9fa48("2875");
    const weekStart = getMondayUTC();
    const {
      data
    } = await getServiceClient().from(stryMutAct_9fa48("2876") ? "" : (stryCov_9fa48("2876"), 'user_weekly_usage')).select(stryMutAct_9fa48("2877") ? "" : (stryCov_9fa48("2877"), 'interview_sessions_used, learn_sessions_used')).eq(stryMutAct_9fa48("2878") ? "" : (stryCov_9fa48("2878"), 'user_id'), userId).eq(stryMutAct_9fa48("2879") ? "" : (stryCov_9fa48("2879"), 'week_start'), weekStart).maybeSingle();
    const interview = stryMutAct_9fa48("2880") ? data?.interview_sessions_used && 0 : (stryCov_9fa48("2880"), (stryMutAct_9fa48("2881") ? data.interview_sessions_used : (stryCov_9fa48("2881"), data?.interview_sessions_used)) ?? 0);
    const learn = stryMutAct_9fa48("2882") ? data?.learn_sessions_used && 0 : (stryCov_9fa48("2882"), (stryMutAct_9fa48("2883") ? data.learn_sessions_used : (stryCov_9fa48("2883"), data?.learn_sessions_used)) ?? 0);
    return stryMutAct_9fa48("2884") ? {} : (stryCov_9fa48("2884"), {
      interview,
      learn,
      total: stryMutAct_9fa48("2885") ? interview - learn : (stryCov_9fa48("2885"), interview + learn)
    });
  }
}
function getMondayUTC(): string {
  if (stryMutAct_9fa48("2886")) {
    {}
  } else {
    stryCov_9fa48("2886");
    const now = new Date();
    const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = utc.getUTCDay();
    const offset = (stryMutAct_9fa48("2889") ? day !== 0 : stryMutAct_9fa48("2888") ? false : stryMutAct_9fa48("2887") ? true : (stryCov_9fa48("2887", "2888", "2889"), day === 0)) ? 6 : stryMutAct_9fa48("2890") ? day + 1 : (stryCov_9fa48("2890"), day - 1);
    stryMutAct_9fa48("2891") ? utc.setTime(utc.getUTCDate() - offset) : (stryCov_9fa48("2891"), utc.setUTCDate(stryMutAct_9fa48("2892") ? utc.getUTCDate() + offset : (stryCov_9fa48("2892"), utc.getUTCDate() - offset)));
    return stryMutAct_9fa48("2893") ? utc.toISOString().split('T')[0] && '' : (stryCov_9fa48("2893"), utc.toISOString().split(stryMutAct_9fa48("2894") ? "" : (stryCov_9fa48("2894"), 'T'))[0] ?? (stryMutAct_9fa48("2895") ? "Stryker was here!" : (stryCov_9fa48("2895"), '')));
  }
}