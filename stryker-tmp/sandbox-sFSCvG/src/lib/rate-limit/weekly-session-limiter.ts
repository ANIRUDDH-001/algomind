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
  if (stryMutAct_9fa48("0")) {
    {}
  } else {
    stryCov_9fa48("0");
    const emailClause = email ? stryMutAct_9fa48("1") ? `` : (stryCov_9fa48("1"), `,email.eq.${email}`) : stryMutAct_9fa48("2") ? "Stryker was here!" : (stryCov_9fa48("2"), '');
    const {
      data: coOwner
    } = await getServiceClient().from(stryMutAct_9fa48("3") ? "" : (stryCov_9fa48("3"), 'co_owners')).select(stryMutAct_9fa48("4") ? "" : (stryCov_9fa48("4"), 'id')).or(stryMutAct_9fa48("5") ? `` : (stryCov_9fa48("5"), `user_id.eq.${userId}${emailClause}`)).limit(1).maybeSingle();
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
  if (stryMutAct_9fa48("6")) {
    {}
  } else {
    stryCov_9fa48("6");
    // 1. Global gate switch
    const gatingEnabled = await isSessionGatingEnabled();
    if (stryMutAct_9fa48("9") ? false : stryMutAct_9fa48("8") ? true : stryMutAct_9fa48("7") ? gatingEnabled : (stryCov_9fa48("7", "8", "9"), !gatingEnabled)) {
      if (stryMutAct_9fa48("10")) {
        {}
      } else {
        stryCov_9fa48("10");
        return stryMutAct_9fa48("11") ? {} : (stryCov_9fa48("11"), {
          allowed: stryMutAct_9fa48("12") ? false : (stryCov_9fa48("12"), true),
          sessionsUsed: 0,
          limit: null,
          sessionsRemaining: null,
          reason: stryMutAct_9fa48("13") ? "" : (stryCov_9fa48("13"), 'gating_disabled')
        });
      }
    }

    // 2. Subscription status — premium/college bypass
    const {
      status: subscriptionStatus
    } = await getUserSubscriptionStatus(userId);
    if (stryMutAct_9fa48("16") ? subscriptionStatus === 'free' : stryMutAct_9fa48("15") ? false : stryMutAct_9fa48("14") ? true : (stryCov_9fa48("14", "15", "16"), subscriptionStatus !== (stryMutAct_9fa48("17") ? "" : (stryCov_9fa48("17"), 'free')))) {
      if (stryMutAct_9fa48("18")) {
        {}
      } else {
        stryCov_9fa48("18");
        return stryMutAct_9fa48("19") ? {} : (stryCov_9fa48("19"), {
          allowed: stryMutAct_9fa48("20") ? false : (stryCov_9fa48("20"), true),
          sessionsUsed: 0,
          limit: null,
          sessionsRemaining: null,
          reason: stryMutAct_9fa48("21") ? "" : (stryCov_9fa48("21"), 'premium')
        });
      }
    }

    // 3. Admin / owner bypass
    const {
      data: profile
    } = await getServiceClient().from(stryMutAct_9fa48("22") ? "" : (stryCov_9fa48("22"), 'profiles')).select(stryMutAct_9fa48("23") ? "" : (stryCov_9fa48("23"), 'account_type, rate_limit_override, email')).eq(stryMutAct_9fa48("24") ? "" : (stryCov_9fa48("24"), 'id'), userId).single();
    const coOwner = await isCoOwner(userId, stryMutAct_9fa48("25") ? profile.email : (stryCov_9fa48("25"), profile?.email));
    if (stryMutAct_9fa48("28") ? (profile?.account_type === 'admin' || profile?.account_type === 'owner' || coOwner) && profile?.rate_limit_override === 0 : stryMutAct_9fa48("27") ? false : stryMutAct_9fa48("26") ? true : (stryCov_9fa48("26", "27", "28"), (stryMutAct_9fa48("30") ? (profile?.account_type === 'admin' || profile?.account_type === 'owner') && coOwner : stryMutAct_9fa48("29") ? false : (stryCov_9fa48("29", "30"), (stryMutAct_9fa48("32") ? profile?.account_type === 'admin' && profile?.account_type === 'owner' : stryMutAct_9fa48("31") ? false : (stryCov_9fa48("31", "32"), (stryMutAct_9fa48("34") ? profile?.account_type !== 'admin' : stryMutAct_9fa48("33") ? false : (stryCov_9fa48("33", "34"), (stryMutAct_9fa48("35") ? profile.account_type : (stryCov_9fa48("35"), profile?.account_type)) === (stryMutAct_9fa48("36") ? "" : (stryCov_9fa48("36"), 'admin')))) || (stryMutAct_9fa48("38") ? profile?.account_type !== 'owner' : stryMutAct_9fa48("37") ? false : (stryCov_9fa48("37", "38"), (stryMutAct_9fa48("39") ? profile.account_type : (stryCov_9fa48("39"), profile?.account_type)) === (stryMutAct_9fa48("40") ? "" : (stryCov_9fa48("40"), 'owner')))))) || coOwner)) || (stryMutAct_9fa48("42") ? profile?.rate_limit_override !== 0 : stryMutAct_9fa48("41") ? false : (stryCov_9fa48("41", "42"), (stryMutAct_9fa48("43") ? profile.rate_limit_override : (stryCov_9fa48("43"), profile?.rate_limit_override)) === 0)))) {
      if (stryMutAct_9fa48("44")) {
        {}
      } else {
        stryCov_9fa48("44");
        return stryMutAct_9fa48("45") ? {} : (stryCov_9fa48("45"), {
          allowed: stryMutAct_9fa48("46") ? false : (stryCov_9fa48("46"), true),
          sessionsUsed: 0,
          limit: null,
          sessionsRemaining: null,
          reason: stryMutAct_9fa48("47") ? "" : (stryCov_9fa48("47"), 'admin')
        });
      }
    }

    // 4. Get per-type limit from system_config
    const configKey = (stryMutAct_9fa48("50") ? sessionType !== 'interview' : stryMutAct_9fa48("49") ? false : stryMutAct_9fa48("48") ? true : (stryCov_9fa48("48", "49", "50"), sessionType === (stryMutAct_9fa48("51") ? "" : (stryCov_9fa48("51"), 'interview')))) ? SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_INTERVIEW_LIMIT : SYSTEM_CONFIG_KEYS.FREE_TIER_WEEKLY_LEARN_LIMIT;
    const rawLimit = await getSystemConfig(configKey);
    const effectiveLimit = stryMutAct_9fa48("52") ? profile?.rate_limit_override && (parseInt(rawLimit, 10) || 5) : (stryCov_9fa48("52"), (stryMutAct_9fa48("53") ? profile.rate_limit_override : (stryCov_9fa48("53"), profile?.rate_limit_override)) ?? (stryMutAct_9fa48("56") ? parseInt(rawLimit, 10) && 5 : stryMutAct_9fa48("55") ? false : stryMutAct_9fa48("54") ? true : (stryCov_9fa48("54", "55", "56"), parseInt(rawLimit, 10) || 5)));

    // 5. Get current per-type usage
    const sessionsUsed = await fetchWeeklyTypeCount(userId, sessionType);
    const sessionsRemaining = stryMutAct_9fa48("57") ? Math.min(0, effectiveLimit - sessionsUsed) : (stryCov_9fa48("57"), Math.max(0, stryMutAct_9fa48("58") ? effectiveLimit + sessionsUsed : (stryCov_9fa48("58"), effectiveLimit - sessionsUsed)));
    return stryMutAct_9fa48("59") ? {} : (stryCov_9fa48("59"), {
      allowed: stryMutAct_9fa48("63") ? sessionsUsed >= effectiveLimit : stryMutAct_9fa48("62") ? sessionsUsed <= effectiveLimit : stryMutAct_9fa48("61") ? false : stryMutAct_9fa48("60") ? true : (stryCov_9fa48("60", "61", "62", "63"), sessionsUsed < effectiveLimit),
      sessionsUsed,
      limit: effectiveLimit,
      sessionsRemaining,
      reason: (stryMutAct_9fa48("67") ? sessionsUsed >= effectiveLimit : stryMutAct_9fa48("66") ? sessionsUsed <= effectiveLimit : stryMutAct_9fa48("65") ? false : stryMutAct_9fa48("64") ? true : (stryCov_9fa48("64", "65", "66", "67"), sessionsUsed < effectiveLimit)) ? stryMutAct_9fa48("68") ? "" : (stryCov_9fa48("68"), 'within_limit') : stryMutAct_9fa48("69") ? "" : (stryCov_9fa48("69"), 'limit_exceeded')
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
  if (stryMutAct_9fa48("70")) {
    {}
  } else {
    stryCov_9fa48("70");
    // First run the read-only check to see if they are bypassed (premium, admin, disabled)
    // If they are bypassed, we do not need to increment the free-tier counter in the DB
    const readOnlyCheck = await checkWeeklySessionLimitReadOnly(userId, sessionType);
    if (stryMutAct_9fa48("73") ? (readOnlyCheck.reason === 'premium' || readOnlyCheck.reason === 'admin') && readOnlyCheck.reason === 'gating_disabled' : stryMutAct_9fa48("72") ? false : stryMutAct_9fa48("71") ? true : (stryCov_9fa48("71", "72", "73"), (stryMutAct_9fa48("75") ? readOnlyCheck.reason === 'premium' && readOnlyCheck.reason === 'admin' : stryMutAct_9fa48("74") ? false : (stryCov_9fa48("74", "75"), (stryMutAct_9fa48("77") ? readOnlyCheck.reason !== 'premium' : stryMutAct_9fa48("76") ? false : (stryCov_9fa48("76", "77"), readOnlyCheck.reason === (stryMutAct_9fa48("78") ? "" : (stryCov_9fa48("78"), 'premium')))) || (stryMutAct_9fa48("80") ? readOnlyCheck.reason !== 'admin' : stryMutAct_9fa48("79") ? false : (stryCov_9fa48("79", "80"), readOnlyCheck.reason === (stryMutAct_9fa48("81") ? "" : (stryCov_9fa48("81"), 'admin')))))) || (stryMutAct_9fa48("83") ? readOnlyCheck.reason !== 'gating_disabled' : stryMutAct_9fa48("82") ? false : (stryCov_9fa48("82", "83"), readOnlyCheck.reason === (stryMutAct_9fa48("84") ? "" : (stryCov_9fa48("84"), 'gating_disabled')))))) {
      if (stryMutAct_9fa48("85")) {
        {}
      } else {
        stryCov_9fa48("85");
        return readOnlyCheck;
      }
    }

    // We are here -> user is subject to limits. The limit must be an actual number.
    const limit = stryMutAct_9fa48("86") ? readOnlyCheck.limit && 5 : (stryCov_9fa48("86"), readOnlyCheck.limit ?? 5);
    const {
      data,
      error
    } = await getServiceClient().rpc(stryMutAct_9fa48("87") ? "" : (stryCov_9fa48("87"), 'check_and_increment_weekly_usage'), stryMutAct_9fa48("88") ? {} : (stryCov_9fa48("88"), {
      p_user_id: userId,
      p_session_type: sessionType,
      p_weekly_limit: limit
    }));
    if (stryMutAct_9fa48("91") ? (error || !data) && (data as any[]).length === 0 : stryMutAct_9fa48("90") ? false : stryMutAct_9fa48("89") ? true : (stryCov_9fa48("89", "90", "91"), (stryMutAct_9fa48("93") ? error && !data : stryMutAct_9fa48("92") ? false : (stryCov_9fa48("92", "93"), error || (stryMutAct_9fa48("94") ? data : (stryCov_9fa48("94"), !data)))) || (stryMutAct_9fa48("96") ? (data as any[]).length !== 0 : stryMutAct_9fa48("95") ? false : (stryCov_9fa48("95", "96"), (data as any[]).length === 0)))) {
      if (stryMutAct_9fa48("97")) {
        {}
      } else {
        stryCov_9fa48("97");
        console.error(stryMutAct_9fa48("98") ? "" : (stryCov_9fa48("98"), '[WeeklyLimiter] RPC failed:'), stryMutAct_9fa48("99") ? error.message : (stryCov_9fa48("99"), error?.message));
        // Fail-closed: deny access if we can't check the limit
        return stryMutAct_9fa48("100") ? {} : (stryCov_9fa48("100"), {
          allowed: stryMutAct_9fa48("101") ? true : (stryCov_9fa48("101"), false),
          sessionsUsed: stryMutAct_9fa48("102") ? +1 : (stryCov_9fa48("102"), -1),
          limit,
          sessionsRemaining: 0,
          reason: stryMutAct_9fa48("103") ? "" : (stryCov_9fa48("103"), 'limit_exceeded')
        });
      }
    }
    const result = (data as any[])[0] as {
      allowed: boolean;
      sessions_used: number;
      limit_value: number;
    };
    return stryMutAct_9fa48("104") ? {} : (stryCov_9fa48("104"), {
      allowed: result.allowed,
      sessionsUsed: result.sessions_used,
      limit: result.limit_value,
      sessionsRemaining: stryMutAct_9fa48("105") ? Math.min(0, result.limit_value - result.sessions_used) : (stryCov_9fa48("105"), Math.max(0, stryMutAct_9fa48("106") ? result.limit_value + result.sessions_used : (stryCov_9fa48("106"), result.limit_value - result.sessions_used))),
      reason: result.allowed ? stryMutAct_9fa48("107") ? "" : (stryCov_9fa48("107"), 'within_limit') : stryMutAct_9fa48("108") ? "" : (stryCov_9fa48("108"), 'limit_exceeded')
    });
  }
}

/**
 * @deprecated Use checkAndIncrementWeeklySession instead.
 * Kept for backward compatibility during migration.
 */
export async function checkWeeklySessionLimit(userId: string, sessionType: SessionType): Promise<WeeklySessionLimitResult> {
  if (stryMutAct_9fa48("109")) {
    {}
  } else {
    stryCov_9fa48("109");
    console.warn((stryMutAct_9fa48("110") ? "" : (stryCov_9fa48("110"), '[WeeklyLimiter] checkWeeklySessionLimit is deprecated and has a TOCTOU race. ')) + (stryMutAct_9fa48("111") ? "" : (stryCov_9fa48("111"), 'Use checkAndIncrementWeeklySession instead.')));
    return checkAndIncrementWeeklySession(userId, sessionType);
  }
}

/**
 * Get the current count for one session type this week.
 */
async function fetchWeeklyTypeCount(userId: string, sessionType: SessionType): Promise<number> {
  if (stryMutAct_9fa48("112")) {
    {}
  } else {
    stryCov_9fa48("112");
    const weekStart = getMondayUTC();
    const col = (stryMutAct_9fa48("115") ? sessionType !== 'interview' : stryMutAct_9fa48("114") ? false : stryMutAct_9fa48("113") ? true : (stryCov_9fa48("113", "114", "115"), sessionType === (stryMutAct_9fa48("116") ? "" : (stryCov_9fa48("116"), 'interview')))) ? stryMutAct_9fa48("117") ? "" : (stryCov_9fa48("117"), 'interview_sessions_used') : stryMutAct_9fa48("118") ? "" : (stryCov_9fa48("118"), 'learn_sessions_used');
    const {
      data
    } = await getServiceClient().from(stryMutAct_9fa48("119") ? "" : (stryCov_9fa48("119"), 'user_weekly_usage')).select(col).eq(stryMutAct_9fa48("120") ? "" : (stryCov_9fa48("120"), 'user_id'), userId).eq(stryMutAct_9fa48("121") ? "" : (stryCov_9fa48("121"), 'week_start'), weekStart).maybeSingle();
    if (stryMutAct_9fa48("124") ? false : stryMutAct_9fa48("123") ? true : stryMutAct_9fa48("122") ? data : (stryCov_9fa48("122", "123", "124"), !data)) return 0;
    return stryMutAct_9fa48("125") ? (data as Record<string, number>)[col] && 0 : (stryCov_9fa48("125"), (data as Record<string, number>)[col] ?? 0);
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
  if (stryMutAct_9fa48("126")) {
    {}
  } else {
    stryCov_9fa48("126");
    const weekStart = getMondayUTC();
    const {
      data
    } = await getServiceClient().from(stryMutAct_9fa48("127") ? "" : (stryCov_9fa48("127"), 'user_weekly_usage')).select(stryMutAct_9fa48("128") ? "" : (stryCov_9fa48("128"), 'interview_sessions_used, learn_sessions_used')).eq(stryMutAct_9fa48("129") ? "" : (stryCov_9fa48("129"), 'user_id'), userId).eq(stryMutAct_9fa48("130") ? "" : (stryCov_9fa48("130"), 'week_start'), weekStart).maybeSingle();
    const interview = stryMutAct_9fa48("131") ? data?.interview_sessions_used && 0 : (stryCov_9fa48("131"), (stryMutAct_9fa48("132") ? data.interview_sessions_used : (stryCov_9fa48("132"), data?.interview_sessions_used)) ?? 0);
    const learn = stryMutAct_9fa48("133") ? data?.learn_sessions_used && 0 : (stryCov_9fa48("133"), (stryMutAct_9fa48("134") ? data.learn_sessions_used : (stryCov_9fa48("134"), data?.learn_sessions_used)) ?? 0);
    return stryMutAct_9fa48("135") ? {} : (stryCov_9fa48("135"), {
      interview,
      learn,
      total: stryMutAct_9fa48("136") ? interview - learn : (stryCov_9fa48("136"), interview + learn)
    });
  }
}
function getMondayUTC(): string {
  if (stryMutAct_9fa48("137")) {
    {}
  } else {
    stryCov_9fa48("137");
    const now = new Date();
    const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = utc.getUTCDay();
    const offset = (stryMutAct_9fa48("140") ? day !== 0 : stryMutAct_9fa48("139") ? false : stryMutAct_9fa48("138") ? true : (stryCov_9fa48("138", "139", "140"), day === 0)) ? 6 : stryMutAct_9fa48("141") ? day + 1 : (stryCov_9fa48("141"), day - 1);
    stryMutAct_9fa48("142") ? utc.setTime(utc.getUTCDate() - offset) : (stryCov_9fa48("142"), utc.setUTCDate(stryMutAct_9fa48("143") ? utc.getUTCDate() + offset : (stryCov_9fa48("143"), utc.getUTCDate() - offset)));
    return stryMutAct_9fa48("144") ? utc.toISOString().split('T')[0] && '' : (stryCov_9fa48("144"), utc.toISOString().split(stryMutAct_9fa48("145") ? "" : (stryCov_9fa48("145"), 'T'))[0] ?? (stryMutAct_9fa48("146") ? "Stryker was here!" : (stryCov_9fa48("146"), '')));
  }
}