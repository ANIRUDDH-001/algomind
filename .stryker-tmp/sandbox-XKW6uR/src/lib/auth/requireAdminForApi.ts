/**
 * @codesage
 * @file      src/lib/auth/requireAdminForApi.ts
 * @purpose   Authentication guards, roles, and session management.
 * @tech      Node.js, NextAuth / Auth handlers
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck
function stryNS_9fa48() {
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
import { createServerSupabase } from '@/lib/supabase/server';
import { authorizedApiResult, forbiddenApiResult, type ApiAuthCheckResult, unauthorizedApiResult } from '@/lib/auth/account-type';
export async function requireAdminForApi(): Promise<ApiAuthCheckResult> {
  if (stryMutAct_9fa48("2299")) {
    {}
  } else {
    stryCov_9fa48("2299");
    const supabase = await createServerSupabase();
    const {
      data: {
        user
      },
      error
    } = await supabase.auth.getUser();
    if (stryMutAct_9fa48("2302") ? error && !user : stryMutAct_9fa48("2301") ? false : stryMutAct_9fa48("2300") ? true : (stryCov_9fa48("2300", "2301", "2302"), error || (stryMutAct_9fa48("2303") ? user : (stryCov_9fa48("2303"), !user)))) {
      if (stryMutAct_9fa48("2304")) {
        {}
      } else {
        stryCov_9fa48("2304");
        return unauthorizedApiResult();
      }
    }
    const {
      data: isAdmin,
      error: adminErr
    } = await supabase.rpc(stryMutAct_9fa48("2305") ? "" : (stryCov_9fa48("2305"), 'check_is_admin'));
    if (stryMutAct_9fa48("2308") ? adminErr && !isAdmin : stryMutAct_9fa48("2307") ? false : stryMutAct_9fa48("2306") ? true : (stryCov_9fa48("2306", "2307", "2308"), adminErr || (stryMutAct_9fa48("2309") ? isAdmin : (stryCov_9fa48("2309"), !isAdmin)))) {
      if (stryMutAct_9fa48("2310")) {
        {}
      } else {
        stryCov_9fa48("2310");
        console.error(stryMutAct_9fa48("2311") ? "" : (stryCov_9fa48("2311"), 'Admin Check Failed:'), stryMutAct_9fa48("2312") ? {} : (stryCov_9fa48("2312"), {
          adminErr,
          isAdmin,
          userId: user.id
        }));
        return forbiddenApiResult();
      }
    }
    return authorizedApiResult(stryMutAct_9fa48("2313") ? {} : (stryCov_9fa48("2313"), {
      id: user.id,
      email: user.email
    }));
  }
}