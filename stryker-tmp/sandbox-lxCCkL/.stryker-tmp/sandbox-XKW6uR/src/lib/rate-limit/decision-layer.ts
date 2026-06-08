/**
 * @codesage
 * @file      src/lib/rate-limit/decision-layer.ts
 * @purpose   Rate limiting policies across user, IP, and sessions.
 * @tech      Node.js, Upstash Redis
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 
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
export type EndpointClass = 'critical' | 'service' | 'non-critical';
export type FailureMode = 'fail-open' | 'fail-closed';
interface EndpointPolicy {
  endpointClass: EndpointClass;
  failureMode: FailureMode;
}
const DEFAULT_POLICY: EndpointPolicy = stryMutAct_9fa48("2666") ? {} : (stryCov_9fa48("2666"), {
  endpointClass: stryMutAct_9fa48("2667") ? "" : (stryCov_9fa48("2667"), 'non-critical'),
  failureMode: stryMutAct_9fa48("2668") ? "" : (stryCov_9fa48("2668"), 'fail-open')
});
const ENDPOINT_POLICIES: Record<string, EndpointPolicy> = stryMutAct_9fa48("2669") ? {} : (stryCov_9fa48("2669"), {
  assess_start: stryMutAct_9fa48("2670") ? {} : (stryCov_9fa48("2670"), {
    endpointClass: stryMutAct_9fa48("2671") ? "" : (stryCov_9fa48("2671"), 'critical'),
    failureMode: stryMutAct_9fa48("2672") ? "" : (stryCov_9fa48("2672"), 'fail-closed')
  }),
  assess_complete: stryMutAct_9fa48("2673") ? {} : (stryCov_9fa48("2673"), {
    endpointClass: stryMutAct_9fa48("2674") ? "" : (stryCov_9fa48("2674"), 'critical'),
    failureMode: stryMutAct_9fa48("2675") ? "" : (stryCov_9fa48("2675"), 'fail-closed')
  }),
  assess_chat: stryMutAct_9fa48("2676") ? {} : (stryCov_9fa48("2676"), {
    endpointClass: stryMutAct_9fa48("2677") ? "" : (stryCov_9fa48("2677"), 'critical'),
    failureMode: stryMutAct_9fa48("2678") ? "" : (stryCov_9fa48("2678"), 'fail-closed')
  }),
  execute_code: stryMutAct_9fa48("2679") ? {} : (stryCov_9fa48("2679"), {
    endpointClass: stryMutAct_9fa48("2680") ? "" : (stryCov_9fa48("2680"), 'critical'),
    failureMode: stryMutAct_9fa48("2681") ? "" : (stryCov_9fa48("2681"), 'fail-closed')
  }),
  ai_model_selection: stryMutAct_9fa48("2682") ? {} : (stryCov_9fa48("2682"), {
    endpointClass: stryMutAct_9fa48("2683") ? "" : (stryCov_9fa48("2683"), 'critical'),
    failureMode: stryMutAct_9fa48("2684") ? "" : (stryCov_9fa48("2684"), 'fail-closed')
  }),
  replay_generate: stryMutAct_9fa48("2685") ? {} : (stryCov_9fa48("2685"), {
    endpointClass: stryMutAct_9fa48("2686") ? "" : (stryCov_9fa48("2686"), 'service'),
    failureMode: stryMutAct_9fa48("2687") ? "" : (stryCov_9fa48("2687"), 'fail-closed')
  }),
  interview_analysis: stryMutAct_9fa48("2688") ? {} : (stryCov_9fa48("2688"), {
    endpointClass: stryMutAct_9fa48("2689") ? "" : (stryCov_9fa48("2689"), 'service'),
    failureMode: stryMutAct_9fa48("2690") ? "" : (stryCov_9fa48("2690"), 'fail-closed')
  }),
  voice_transcribe: stryMutAct_9fa48("2691") ? {} : (stryCov_9fa48("2691"), {
    endpointClass: stryMutAct_9fa48("2692") ? "" : (stryCov_9fa48("2692"), 'service'),
    failureMode: stryMutAct_9fa48("2693") ? "" : (stryCov_9fa48("2693"), 'fail-closed')
  }),
  chat: stryMutAct_9fa48("2694") ? {} : (stryCov_9fa48("2694"), {
    endpointClass: stryMutAct_9fa48("2695") ? "" : (stryCov_9fa48("2695"), 'service'),
    failureMode: stryMutAct_9fa48("2696") ? "" : (stryCov_9fa48("2696"), 'fail-closed')
  }),
  user_rate_limit: stryMutAct_9fa48("2697") ? {} : (stryCov_9fa48("2697"), {
    endpointClass: stryMutAct_9fa48("2698") ? "" : (stryCov_9fa48("2698"), 'service'),
    failureMode: stryMutAct_9fa48("2699") ? "" : (stryCov_9fa48("2699"), 'fail-closed')
  }),
  weekly_session_limit: stryMutAct_9fa48("2700") ? {} : (stryCov_9fa48("2700"), {
    endpointClass: stryMutAct_9fa48("2701") ? "" : (stryCov_9fa48("2701"), 'service'),
    failureMode: stryMutAct_9fa48("2702") ? "" : (stryCov_9fa48("2702"), 'fail-closed')
  }),
  flags: stryMutAct_9fa48("2703") ? {} : (stryCov_9fa48("2703"), {
    endpointClass: stryMutAct_9fa48("2704") ? "" : (stryCov_9fa48("2704"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2705") ? "" : (stryCov_9fa48("2705"), 'fail-open')
  }),
  verify_code: stryMutAct_9fa48("2706") ? {} : (stryCov_9fa48("2706"), {
    endpointClass: stryMutAct_9fa48("2707") ? "" : (stryCov_9fa48("2707"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2708") ? "" : (stryCov_9fa48("2708"), 'fail-open')
  }),
  employer_export: stryMutAct_9fa48("2709") ? {} : (stryCov_9fa48("2709"), {
    endpointClass: stryMutAct_9fa48("2710") ? "" : (stryCov_9fa48("2710"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2711") ? "" : (stryCov_9fa48("2711"), 'fail-open')
  }),
  health: stryMutAct_9fa48("2712") ? {} : (stryCov_9fa48("2712"), {
    endpointClass: stryMutAct_9fa48("2713") ? "" : (stryCov_9fa48("2713"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2714") ? "" : (stryCov_9fa48("2714"), 'fail-open')
  }),
  connectivity: stryMutAct_9fa48("2715") ? {} : (stryCov_9fa48("2715"), {
    endpointClass: stryMutAct_9fa48("2716") ? "" : (stryCov_9fa48("2716"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2717") ? "" : (stryCov_9fa48("2717"), 'fail-open')
  }),
  debug: stryMutAct_9fa48("2718") ? {} : (stryCov_9fa48("2718"), {
    endpointClass: stryMutAct_9fa48("2719") ? "" : (stryCov_9fa48("2719"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2720") ? "" : (stryCov_9fa48("2720"), 'fail-open')
  }),
  whisper_guest: stryMutAct_9fa48("2721") ? {} : (stryCov_9fa48("2721"), {
    endpointClass: stryMutAct_9fa48("2722") ? "" : (stryCov_9fa48("2722"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2723") ? "" : (stryCov_9fa48("2723"), 'fail-open')
  }),
  learn_diagnostic: stryMutAct_9fa48("2724") ? {} : (stryCov_9fa48("2724"), {
    endpointClass: stryMutAct_9fa48("2725") ? "" : (stryCov_9fa48("2725"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2726") ? "" : (stryCov_9fa48("2726"), 'fail-open')
  }),
  learn_concept: stryMutAct_9fa48("2727") ? {} : (stryCov_9fa48("2727"), {
    endpointClass: stryMutAct_9fa48("2728") ? "" : (stryCov_9fa48("2728"), 'non-critical'),
    failureMode: stryMutAct_9fa48("2729") ? "" : (stryCov_9fa48("2729"), 'fail-open')
  })
});
export function classifyEndpoint(endpoint?: string): EndpointClass {
  if (stryMutAct_9fa48("2730")) {
    {}
  } else {
    stryCov_9fa48("2730");
    if (stryMutAct_9fa48("2733") ? false : stryMutAct_9fa48("2732") ? true : stryMutAct_9fa48("2731") ? endpoint : (stryCov_9fa48("2731", "2732", "2733"), !endpoint)) return DEFAULT_POLICY.endpointClass;
    return stryMutAct_9fa48("2734") ? ENDPOINT_POLICIES[endpoint]?.endpointClass && DEFAULT_POLICY.endpointClass : (stryCov_9fa48("2734"), (stryMutAct_9fa48("2735") ? ENDPOINT_POLICIES[endpoint].endpointClass : (stryCov_9fa48("2735"), ENDPOINT_POLICIES[endpoint]?.endpointClass)) ?? DEFAULT_POLICY.endpointClass);
  }
}
export function getFailureMode(endpoint?: string): FailureMode {
  if (stryMutAct_9fa48("2736")) {
    {}
  } else {
    stryCov_9fa48("2736");
    if (stryMutAct_9fa48("2739") ? false : stryMutAct_9fa48("2738") ? true : stryMutAct_9fa48("2737") ? endpoint : (stryCov_9fa48("2737", "2738", "2739"), !endpoint)) return DEFAULT_POLICY.failureMode;
    return stryMutAct_9fa48("2740") ? ENDPOINT_POLICIES[endpoint]?.failureMode && DEFAULT_POLICY.failureMode : (stryCov_9fa48("2740"), (stryMutAct_9fa48("2741") ? ENDPOINT_POLICIES[endpoint].failureMode : (stryCov_9fa48("2741"), ENDPOINT_POLICIES[endpoint]?.failureMode)) ?? DEFAULT_POLICY.failureMode);
  }
}
export function isCriticalEndpoint(endpoint?: string): boolean {
  if (stryMutAct_9fa48("2742")) {
    {}
  } else {
    stryCov_9fa48("2742");
    return stryMutAct_9fa48("2745") ? classifyEndpoint(endpoint) !== 'critical' : stryMutAct_9fa48("2744") ? false : stryMutAct_9fa48("2743") ? true : (stryCov_9fa48("2743", "2744", "2745"), classifyEndpoint(endpoint) === (stryMutAct_9fa48("2746") ? "" : (stryCov_9fa48("2746"), 'critical')));
  }
}
export function getAllEndpointPolicies(): Record<string, EndpointPolicy> {
  if (stryMutAct_9fa48("2747")) {
    {}
  } else {
    stryCov_9fa48("2747");
    return stryMutAct_9fa48("2748") ? {} : (stryCov_9fa48("2748"), {
      ...ENDPOINT_POLICIES
    });
  }
}