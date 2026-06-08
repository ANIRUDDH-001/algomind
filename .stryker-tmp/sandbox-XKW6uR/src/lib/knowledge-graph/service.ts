/**
 * @module knowledge-graph/service
 * @description KnowledgeGraphService - reads and writes all concept confidence data.
 *              Single source of truth for personalization.
 * @phase Phase 2A
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
import { getServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/upstash/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import type { Tables } from '@/types/supabase';
import type { ConceptTag } from '@/types/knowledge-graph';
import { getConfidenceLevel, ALL_DSA_CONCEPT_SLUGS } from '@/types/knowledge-graph';
import { tagsToConceptSlugs } from '@/lib/knowledge-graph/tag-concept-map';
import type { KGConceptState, KGDiagnosticResult, KGLearnAssessment, KGConceptSummary, KGSignalHistoryEntry, KGUserCache } from './types';
const KG_CACHE_KEY = stryMutAct_9fa48("2314") ? () => undefined : (stryCov_9fa48("2314"), (() => {
  const KG_CACHE_KEY = (userId: string) => stryMutAct_9fa48("2315") ? `` : (stryCov_9fa48("2315"), `kg:concepts:${userId}`);
  return KG_CACHE_KEY;
})());
const STUDENT_CONTEXT_CACHE_KEY = stryMutAct_9fa48("2316") ? () => undefined : (stryCov_9fa48("2316"), (() => {
  const STUDENT_CONTEXT_CACHE_KEY = (userId: string) => stryMutAct_9fa48("2317") ? `` : (stryCov_9fa48("2317"), `student_context:${userId}`);
  return STUDENT_CONTEXT_CACHE_KEY;
})());
const CONCEPT_TAGS_CACHE_KEY = stryMutAct_9fa48("2318") ? "" : (stryCov_9fa48("2318"), 'kg:concept_tags:all');
const KG_CACHE_TTL_SECONDS = stryMutAct_9fa48("2319") ? 60 / 60 : (stryCov_9fa48("2319"), 60 * 60);
const CONCEPT_TAGS_TTL_SECONDS = stryMutAct_9fa48("2320") ? 60 * 60 / 24 : (stryCov_9fa48("2320"), (stryMutAct_9fa48("2321") ? 60 / 60 : (stryCov_9fa48("2321"), 60 * 60)) * 24);
type ConceptStateRow = Tables<'concept_states'>;
export class KnowledgeGraphService {
  private static instance: KnowledgeGraphService;
  static getInstance(): KnowledgeGraphService {
    if (stryMutAct_9fa48("2322")) {
      {}
    } else {
      stryCov_9fa48("2322");
      if (stryMutAct_9fa48("2325") ? false : stryMutAct_9fa48("2324") ? true : stryMutAct_9fa48("2323") ? KnowledgeGraphService.instance : (stryCov_9fa48("2323", "2324", "2325"), !KnowledgeGraphService.instance)) {
        if (stryMutAct_9fa48("2326")) {
          {}
        } else {
          stryCov_9fa48("2326");
          KnowledgeGraphService.instance = new KnowledgeGraphService();
        }
      }
      return KnowledgeGraphService.instance;
    }
  }

  // Read operations

  async getConceptStates(userId: string): Promise<KGConceptState[]> {
    if (stryMutAct_9fa48("2327")) {
      {}
    } else {
      stryCov_9fa48("2327");
      const cacheKey = KG_CACHE_KEY(userId);
      try {
        if (stryMutAct_9fa48("2328")) {
          {}
        } else {
          stryCov_9fa48("2328");
          const redis = getRedis();
          if (stryMutAct_9fa48("2330") ? false : stryMutAct_9fa48("2329") ? true : (stryCov_9fa48("2329", "2330"), redis)) {
            if (stryMutAct_9fa48("2331")) {
              {}
            } else {
              stryCov_9fa48("2331");
              const cached = await redis.get<KGUserCache>(cacheKey);
              if (stryMutAct_9fa48("2334") ? cached.conceptStates : stryMutAct_9fa48("2333") ? false : stryMutAct_9fa48("2332") ? true : (stryCov_9fa48("2332", "2333", "2334"), cached?.conceptStates)) {
                if (stryMutAct_9fa48("2335")) {
                  {}
                } else {
                  stryCov_9fa48("2335");
                  void logSystemEvent(stryMutAct_9fa48("2336") ? {} : (stryCov_9fa48("2336"), {
                    type: stryMutAct_9fa48("2337") ? "" : (stryCov_9fa48("2337"), 'kg_cache_hit'),
                    userId
                  }));
                  return cached.conceptStates;
                }
              }
              void logSystemEvent(stryMutAct_9fa48("2338") ? {} : (stryCov_9fa48("2338"), {
                type: stryMutAct_9fa48("2339") ? "" : (stryCov_9fa48("2339"), 'kg_cache_miss'),
                userId
              }));
            }
          }
        }
      } catch {
        // Redis failure is non-fatal.
      }
      return this.fetchAndCacheConceptStates(userId);
    }
  }
  async getWeakestConcepts(userId: string, limit = 5): Promise<KGConceptState[]> {
    if (stryMutAct_9fa48("2340")) {
      {}
    } else {
      stryCov_9fa48("2340");
      const states = await this.getConceptStates(userId);
      return stryMutAct_9fa48("2343") ? states.sort((a, b) => a.confidence - b.confidence).slice(0, limit) : stryMutAct_9fa48("2342") ? states.filter(state => state.evidenceCount > 0).slice(0, limit) : stryMutAct_9fa48("2341") ? states.filter(state => state.evidenceCount > 0).sort((a, b) => a.confidence - b.confidence) : (stryCov_9fa48("2341", "2342", "2343"), states.filter(stryMutAct_9fa48("2344") ? () => undefined : (stryCov_9fa48("2344"), state => stryMutAct_9fa48("2348") ? state.evidenceCount <= 0 : stryMutAct_9fa48("2347") ? state.evidenceCount >= 0 : stryMutAct_9fa48("2346") ? false : stryMutAct_9fa48("2345") ? true : (stryCov_9fa48("2345", "2346", "2347", "2348"), state.evidenceCount > 0))).sort(stryMutAct_9fa48("2349") ? () => undefined : (stryCov_9fa48("2349"), (a, b) => stryMutAct_9fa48("2350") ? a.confidence + b.confidence : (stryCov_9fa48("2350"), a.confidence - b.confidence))).slice(0, limit));
    }
  }
  async getStrongestConcepts(userId: string, limit = 5): Promise<KGConceptState[]> {
    if (stryMutAct_9fa48("2351")) {
      {}
    } else {
      stryCov_9fa48("2351");
      const states = await this.getConceptStates(userId);
      return stryMutAct_9fa48("2354") ? states.sort((a, b) => b.confidence - a.confidence).slice(0, limit) : stryMutAct_9fa48("2353") ? states.filter(state => state.evidenceCount > 0).slice(0, limit) : stryMutAct_9fa48("2352") ? states.filter(state => state.evidenceCount > 0).sort((a, b) => b.confidence - a.confidence) : (stryCov_9fa48("2352", "2353", "2354"), states.filter(stryMutAct_9fa48("2355") ? () => undefined : (stryCov_9fa48("2355"), state => stryMutAct_9fa48("2359") ? state.evidenceCount <= 0 : stryMutAct_9fa48("2358") ? state.evidenceCount >= 0 : stryMutAct_9fa48("2357") ? false : stryMutAct_9fa48("2356") ? true : (stryCov_9fa48("2356", "2357", "2358", "2359"), state.evidenceCount > 0))).sort(stryMutAct_9fa48("2360") ? () => undefined : (stryCov_9fa48("2360"), (a, b) => stryMutAct_9fa48("2361") ? b.confidence + a.confidence : (stryCov_9fa48("2361"), b.confidence - a.confidence))).slice(0, limit));
    }
  }
  async getSingleConceptState(userId: string, conceptSlug: string): Promise<KGConceptState | null> {
    if (stryMutAct_9fa48("2362")) {
      {}
    } else {
      stryCov_9fa48("2362");
      const states = await this.getConceptStates(userId);
      return stryMutAct_9fa48("2363") ? states.find(state => state.conceptSlug === conceptSlug) && null : (stryCov_9fa48("2363"), states.find(stryMutAct_9fa48("2364") ? () => undefined : (stryCov_9fa48("2364"), state => stryMutAct_9fa48("2367") ? state.conceptSlug !== conceptSlug : stryMutAct_9fa48("2366") ? false : stryMutAct_9fa48("2365") ? true : (stryCov_9fa48("2365", "2366", "2367"), state.conceptSlug === conceptSlug))) ?? null);
    }
  }
  async hasCompletedDiagnostic(userId: string): Promise<boolean> {
    if (stryMutAct_9fa48("2368")) {
      {}
    } else {
      stryCov_9fa48("2368");
      const states = await this.getConceptStates(userId);
      return stryMutAct_9fa48("2369") ? states.every(state => state.evidenceCount > 0) : (stryCov_9fa48("2369"), states.some(stryMutAct_9fa48("2370") ? () => undefined : (stryCov_9fa48("2370"), state => stryMutAct_9fa48("2374") ? state.evidenceCount <= 0 : stryMutAct_9fa48("2373") ? state.evidenceCount >= 0 : stryMutAct_9fa48("2372") ? false : stryMutAct_9fa48("2371") ? true : (stryCov_9fa48("2371", "2372", "2373", "2374"), state.evidenceCount > 0))));
    }
  }
  async getConceptSummaries(userId: string): Promise<KGConceptSummary[]> {
    if (stryMutAct_9fa48("2375")) {
      {}
    } else {
      stryCov_9fa48("2375");
      const [states, tags] = await Promise.all(stryMutAct_9fa48("2376") ? [] : (stryCov_9fa48("2376"), [this.getConceptStates(userId), this.getAllConceptTags()]));
      const stateBySlug = new Map(states.map(stryMutAct_9fa48("2377") ? () => undefined : (stryCov_9fa48("2377"), state => stryMutAct_9fa48("2378") ? [] : (stryCov_9fa48("2378"), [state.conceptSlug, state]))));
      return tags.map(tag => {
        if (stryMutAct_9fa48("2379")) {
          {}
        } else {
          stryCov_9fa48("2379");
          const state = stateBySlug.get(tag.id);
          const confidence = stryMutAct_9fa48("2380") ? state?.confidence && 0.5 : (stryCov_9fa48("2380"), (stryMutAct_9fa48("2381") ? state.confidence : (stryCov_9fa48("2381"), state?.confidence)) ?? 0.5);
          return stryMutAct_9fa48("2382") ? {} : (stryCov_9fa48("2382"), {
            slug: tag.id,
            displayName: tag.display_name,
            confidence,
            evidenceCount: stryMutAct_9fa48("2383") ? state?.evidenceCount && 0 : (stryCov_9fa48("2383"), (stryMutAct_9fa48("2384") ? state.evidenceCount : (stryCov_9fa48("2384"), state?.evidenceCount)) ?? 0),
            level: (stryMutAct_9fa48("2385") ? state.evidenceCount : (stryCov_9fa48("2385"), state?.evidenceCount)) ? getConfidenceLevel(confidence) : stryMutAct_9fa48("2386") ? "" : (stryCov_9fa48("2386"), 'unknown'),
            icon: stryMutAct_9fa48("2387") ? tag.icon && 'list' : (stryCov_9fa48("2387"), tag.icon ?? (stryMutAct_9fa48("2388") ? "" : (stryCov_9fa48("2388"), 'list'))),
            lastSessionType: stryMutAct_9fa48("2389") ? state?.lastSessionType && null : (stryCov_9fa48("2389"), (stryMutAct_9fa48("2390") ? state.lastSessionType : (stryCov_9fa48("2390"), state?.lastSessionType)) ?? null),
            lastSignalAt: stryMutAct_9fa48("2391") ? state?.lastSignalAt && null : (stryCov_9fa48("2391"), (stryMutAct_9fa48("2392") ? state.lastSignalAt : (stryCov_9fa48("2392"), state?.lastSignalAt)) ?? null)
          });
        }
      });
    }
  }
  async getNextRecommendedConcept(userId: string): Promise<string | null> {
    if (stryMutAct_9fa48("2393")) {
      {}
    } else {
      stryCov_9fa48("2393");
      const [states, tags] = await Promise.all(stryMutAct_9fa48("2394") ? [] : (stryCov_9fa48("2394"), [this.getConceptStates(userId), this.getAllConceptTags()]));
      const learnedSlugs = new Set(stryMutAct_9fa48("2395") ? states.map(state => state.conceptSlug) : (stryCov_9fa48("2395"), states.filter(stryMutAct_9fa48("2396") ? () => undefined : (stryCov_9fa48("2396"), state => stryMutAct_9fa48("2400") ? state.evidenceCount <= 0 : stryMutAct_9fa48("2399") ? state.evidenceCount >= 0 : stryMutAct_9fa48("2398") ? false : stryMutAct_9fa48("2397") ? true : (stryCov_9fa48("2397", "2398", "2399", "2400"), state.evidenceCount > 0))).map(stryMutAct_9fa48("2401") ? () => undefined : (stryCov_9fa48("2401"), state => state.conceptSlug))));
      const unlearned = stryMutAct_9fa48("2403") ? tags.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        const idxA = ALL_DSA_CONCEPT_SLUGS.indexOf(a.id as any);
        const idxB = ALL_DSA_CONCEPT_SLUGS.indexOf(b.id as any);
        const validIdxA = idxA >= 0 ? idxA : 999;
        const validIdxB = idxB >= 0 ? idxB : 999;
        return validIdxA - validIdxB;
      }).map(tag => tag.id) : stryMutAct_9fa48("2402") ? tags.filter(tag => !learnedSlugs.has(tag.id)).map(tag => tag.id) : (stryCov_9fa48("2402", "2403"), tags.filter(stryMutAct_9fa48("2404") ? () => undefined : (stryCov_9fa48("2404"), tag => stryMutAct_9fa48("2405") ? learnedSlugs.has(tag.id) : (stryCov_9fa48("2405"), !learnedSlugs.has(tag.id)))).sort((a, b) => {
        if (stryMutAct_9fa48("2406")) {
          {}
        } else {
          stryCov_9fa48("2406");
          if (stryMutAct_9fa48("2409") ? a.sort_order === b.sort_order : stryMutAct_9fa48("2408") ? false : stryMutAct_9fa48("2407") ? true : (stryCov_9fa48("2407", "2408", "2409"), a.sort_order !== b.sort_order)) {
            if (stryMutAct_9fa48("2410")) {
              {}
            } else {
              stryCov_9fa48("2410");
              return stryMutAct_9fa48("2411") ? (a.sort_order ?? 0) + (b.sort_order ?? 0) : (stryCov_9fa48("2411"), (stryMutAct_9fa48("2412") ? a.sort_order && 0 : (stryCov_9fa48("2412"), a.sort_order ?? 0)) - (stryMutAct_9fa48("2413") ? b.sort_order && 0 : (stryCov_9fa48("2413"), b.sort_order ?? 0)));
            }
          }
          const idxA = ALL_DSA_CONCEPT_SLUGS.indexOf(a.id as any);
          const idxB = ALL_DSA_CONCEPT_SLUGS.indexOf(b.id as any);
          const validIdxA = (stryMutAct_9fa48("2417") ? idxA < 0 : stryMutAct_9fa48("2416") ? idxA > 0 : stryMutAct_9fa48("2415") ? false : stryMutAct_9fa48("2414") ? true : (stryCov_9fa48("2414", "2415", "2416", "2417"), idxA >= 0)) ? idxA : 999;
          const validIdxB = (stryMutAct_9fa48("2421") ? idxB < 0 : stryMutAct_9fa48("2420") ? idxB > 0 : stryMutAct_9fa48("2419") ? false : stryMutAct_9fa48("2418") ? true : (stryCov_9fa48("2418", "2419", "2420", "2421"), idxB >= 0)) ? idxB : 999;
          return stryMutAct_9fa48("2422") ? validIdxA + validIdxB : (stryCov_9fa48("2422"), validIdxA - validIdxB);
        }
      }).map(stryMutAct_9fa48("2423") ? () => undefined : (stryCov_9fa48("2423"), tag => tag.id)));
      if (stryMutAct_9fa48("2427") ? unlearned.length <= 0 : stryMutAct_9fa48("2426") ? unlearned.length >= 0 : stryMutAct_9fa48("2425") ? false : stryMutAct_9fa48("2424") ? true : (stryCov_9fa48("2424", "2425", "2426", "2427"), unlearned.length > 0)) {
        if (stryMutAct_9fa48("2428")) {
          {}
        } else {
          stryCov_9fa48("2428");
          return stryMutAct_9fa48("2429") ? unlearned[0] && null : (stryCov_9fa48("2429"), unlearned[0] ?? null);
        }
      }
      const stateMap = new Map(states.map(stryMutAct_9fa48("2430") ? () => undefined : (stryCov_9fa48("2430"), s => stryMutAct_9fa48("2431") ? [] : (stryCov_9fa48("2431"), [s.conceptSlug, s.confidence]))));
      const weakestTags = stryMutAct_9fa48("2433") ? [...tags].sort((a, b) => {
        const confA = stateMap.get(a.id) ?? 0.5;
        const confB = stateMap.get(b.id) ?? 0.5;
        if (confA !== confB) return confA - confB;
        if (a.sort_order !== b.sort_order) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }

        // Ultimate tiebreaker based on DSA fundamental progression
        const idxA = ALL_DSA_CONCEPT_SLUGS.indexOf(a.id as any);
        const idxB = ALL_DSA_CONCEPT_SLUGS.indexOf(b.id as any);

        // If one is not in the list, prioritize the one in the list.
        // Otherwise use index (lower index = more fundamental = higher priority)
        const validIdxA = idxA >= 0 ? idxA : 999;
        const validIdxB = idxB >= 0 ? idxB : 999;
        return validIdxA - validIdxB;
      }) : stryMutAct_9fa48("2432") ? [...tags].filter(tag => stateMap.has(tag.id)) : (stryCov_9fa48("2432", "2433"), (stryMutAct_9fa48("2434") ? [] : (stryCov_9fa48("2434"), [...tags])).filter(stryMutAct_9fa48("2435") ? () => undefined : (stryCov_9fa48("2435"), tag => stateMap.has(tag.id))).sort((a, b) => {
        if (stryMutAct_9fa48("2436")) {
          {}
        } else {
          stryCov_9fa48("2436");
          const confA = stryMutAct_9fa48("2437") ? stateMap.get(a.id) && 0.5 : (stryCov_9fa48("2437"), stateMap.get(a.id) ?? 0.5);
          const confB = stryMutAct_9fa48("2438") ? stateMap.get(b.id) && 0.5 : (stryCov_9fa48("2438"), stateMap.get(b.id) ?? 0.5);
          if (stryMutAct_9fa48("2441") ? confA === confB : stryMutAct_9fa48("2440") ? false : stryMutAct_9fa48("2439") ? true : (stryCov_9fa48("2439", "2440", "2441"), confA !== confB)) return stryMutAct_9fa48("2442") ? confA + confB : (stryCov_9fa48("2442"), confA - confB);
          if (stryMutAct_9fa48("2445") ? a.sort_order === b.sort_order : stryMutAct_9fa48("2444") ? false : stryMutAct_9fa48("2443") ? true : (stryCov_9fa48("2443", "2444", "2445"), a.sort_order !== b.sort_order)) {
            if (stryMutAct_9fa48("2446")) {
              {}
            } else {
              stryCov_9fa48("2446");
              return stryMutAct_9fa48("2447") ? (a.sort_order ?? 0) + (b.sort_order ?? 0) : (stryCov_9fa48("2447"), (stryMutAct_9fa48("2448") ? a.sort_order && 0 : (stryCov_9fa48("2448"), a.sort_order ?? 0)) - (stryMutAct_9fa48("2449") ? b.sort_order && 0 : (stryCov_9fa48("2449"), b.sort_order ?? 0)));
            }
          }

          // Ultimate tiebreaker based on DSA fundamental progression
          const idxA = ALL_DSA_CONCEPT_SLUGS.indexOf(a.id as any);
          const idxB = ALL_DSA_CONCEPT_SLUGS.indexOf(b.id as any);

          // If one is not in the list, prioritize the one in the list.
          // Otherwise use index (lower index = more fundamental = higher priority)
          const validIdxA = (stryMutAct_9fa48("2453") ? idxA < 0 : stryMutAct_9fa48("2452") ? idxA > 0 : stryMutAct_9fa48("2451") ? false : stryMutAct_9fa48("2450") ? true : (stryCov_9fa48("2450", "2451", "2452", "2453"), idxA >= 0)) ? idxA : 999;
          const validIdxB = (stryMutAct_9fa48("2457") ? idxB < 0 : stryMutAct_9fa48("2456") ? idxB > 0 : stryMutAct_9fa48("2455") ? false : stryMutAct_9fa48("2454") ? true : (stryCov_9fa48("2454", "2455", "2456", "2457"), idxB >= 0)) ? idxB : 999;
          return stryMutAct_9fa48("2458") ? validIdxA + validIdxB : (stryCov_9fa48("2458"), validIdxA - validIdxB);
        }
      }));
      return stryMutAct_9fa48("2459") ? weakestTags[0]?.id && null : (stryCov_9fa48("2459"), (stryMutAct_9fa48("2460") ? weakestTags[0].id : (stryCov_9fa48("2460"), weakestTags[0]?.id)) ?? null);
    }
  }

  // Write operations

  async initializeFromDiagnostic(userId: string, results: KGDiagnosticResult[]): Promise<void> {
    if (stryMutAct_9fa48("2461")) {
      {}
    } else {
      stryCov_9fa48("2461");
      const payload = results.map(stryMutAct_9fa48("2462") ? () => undefined : (stryCov_9fa48("2462"), result => stryMutAct_9fa48("2463") ? {} : (stryCov_9fa48("2463"), {
        concept_slug: result.conceptSlug,
        confidence: result.confidence
      })));
      const {
        error
      } = await getServiceClient().rpc(stryMutAct_9fa48("2464") ? "" : (stryCov_9fa48("2464"), 'initialize_concept_states'), stryMutAct_9fa48("2465") ? {} : (stryCov_9fa48("2465"), {
        p_user_id: userId,
        p_results: JSON.stringify(payload)
      }));
      if (stryMutAct_9fa48("2467") ? false : stryMutAct_9fa48("2466") ? true : (stryCov_9fa48("2466", "2467"), error)) {
        if (stryMutAct_9fa48("2468")) {
          {}
        } else {
          stryCov_9fa48("2468");
          await logSystemEvent(stryMutAct_9fa48("2469") ? {} : (stryCov_9fa48("2469"), {
            type: stryMutAct_9fa48("2470") ? "" : (stryCov_9fa48("2470"), 'db_error'),
            userId,
            errorMessage: error.message,
            metadata: stryMutAct_9fa48("2471") ? {} : (stryCov_9fa48("2471"), {
              context: stryMutAct_9fa48("2472") ? "" : (stryCov_9fa48("2472"), 'knowledge_graph.initialize_from_diagnostic'),
              operation: stryMutAct_9fa48("2473") ? "" : (stryCov_9fa48("2473"), 'initialize_concept_states')
            })
          }));
          throw new Error(stryMutAct_9fa48("2474") ? `` : (stryCov_9fa48("2474"), `KnowledgeGraphService.initializeFromDiagnostic failed: ${error.message}`));
        }
      }
      await this.invalidateCache(userId);
    }
  }
  async onLearnSessionCompleted(sessionId: string, assessment: KGLearnAssessment): Promise<void> {
    if (stryMutAct_9fa48("2475")) {
      {}
    } else {
      stryCov_9fa48("2475");
      const payload = stryMutAct_9fa48("2476") ? {} : (stryCov_9fa48("2476"), {
        understood: assessment.understood,
        struggled: assessment.struggled,
        notes: assessment.notes,
        confidence_delta: assessment.confidenceDelta
      });
      const {
        error
      } = await getServiceClient().rpc(stryMutAct_9fa48("2477") ? "" : (stryCov_9fa48("2477"), 'on_learn_session_completed'), stryMutAct_9fa48("2478") ? {} : (stryCov_9fa48("2478"), {
        p_session_id: sessionId,
        p_kai_assessment: JSON.stringify(payload)
      }));
      if (stryMutAct_9fa48("2480") ? false : stryMutAct_9fa48("2479") ? true : (stryCov_9fa48("2479", "2480"), error)) {
        if (stryMutAct_9fa48("2481")) {
          {}
        } else {
          stryCov_9fa48("2481");
          await logSystemEvent(stryMutAct_9fa48("2482") ? {} : (stryCov_9fa48("2482"), {
            type: stryMutAct_9fa48("2483") ? "" : (stryCov_9fa48("2483"), 'db_error'),
            errorMessage: error.message,
            metadata: stryMutAct_9fa48("2484") ? {} : (stryCov_9fa48("2484"), {
              context: stryMutAct_9fa48("2485") ? "" : (stryCov_9fa48("2485"), 'knowledge_graph.on_learn_session_completed'),
              sessionId,
              operation: stryMutAct_9fa48("2486") ? "" : (stryCov_9fa48("2486"), 'on_learn_session_completed')
            })
          }));
          throw new Error(stryMutAct_9fa48("2487") ? `` : (stryCov_9fa48("2487"), `KnowledgeGraphService.onLearnSessionCompleted failed: ${error.message}`));
        }
      }
      try {
        if (stryMutAct_9fa48("2488")) {
          {}
        } else {
          stryCov_9fa48("2488");
          const {
            data
          } = await getServiceClient().from(stryMutAct_9fa48("2489") ? "" : (stryCov_9fa48("2489"), 'learn_sessions')).select(stryMutAct_9fa48("2490") ? "" : (stryCov_9fa48("2490"), 'user_id')).eq(stryMutAct_9fa48("2491") ? "" : (stryCov_9fa48("2491"), 'id'), sessionId).single();
          if (stryMutAct_9fa48("2494") ? data.user_id : stryMutAct_9fa48("2493") ? false : stryMutAct_9fa48("2492") ? true : (stryCov_9fa48("2492", "2493", "2494"), data?.user_id)) {
            if (stryMutAct_9fa48("2495")) {
              {}
            } else {
              stryCov_9fa48("2495");
              await this.invalidateCache(data.user_id);
            }
          }
        }
      } catch {
        // Cache invalidation lookup failure is non-fatal.
      }
    }
  }
  async onInterviewSessionCompleted(params: {
    userId: string;
    sessionId: string;
    problemTags: string[];
    primaryPattern: string | null;
    overallScore: number;
  }): Promise<void> {
    if (stryMutAct_9fa48("2496")) {
      {}
    } else {
      stryCov_9fa48("2496");
      const conceptSlugs = tagsToConceptSlugs(params.problemTags, params.primaryPattern);
      if (stryMutAct_9fa48("2499") ? conceptSlugs.length !== 0 : stryMutAct_9fa48("2498") ? false : stryMutAct_9fa48("2497") ? true : (stryCov_9fa48("2497", "2498", "2499"), conceptSlugs.length === 0)) {
        if (stryMutAct_9fa48("2500")) {
          {}
        } else {
          stryCov_9fa48("2500");
          console.info(stryMutAct_9fa48("2501") ? "" : (stryCov_9fa48("2501"), '[KG] No concept slugs mapped from tags:'), params.problemTags);
          return;
        }
      }
      const confidenceDelta = stryMutAct_9fa48("2502") ? (params.overallScore / 10 - 0.5) / 0.12 : (stryCov_9fa48("2502"), (stryMutAct_9fa48("2503") ? params.overallScore / 10 + 0.5 : (stryCov_9fa48("2503"), (stryMutAct_9fa48("2504") ? params.overallScore * 10 : (stryCov_9fa48("2504"), params.overallScore / 10)) - 0.5)) * 0.12);
      const performance = (stryMutAct_9fa48("2508") ? params.overallScore < 7 : stryMutAct_9fa48("2507") ? params.overallScore > 7 : stryMutAct_9fa48("2506") ? false : stryMutAct_9fa48("2505") ? true : (stryCov_9fa48("2505", "2506", "2507", "2508"), params.overallScore >= 7)) ? stryMutAct_9fa48("2509") ? "" : (stryCov_9fa48("2509"), 'good') : (stryMutAct_9fa48("2513") ? params.overallScore < 4 : stryMutAct_9fa48("2512") ? params.overallScore > 4 : stryMutAct_9fa48("2511") ? false : stryMutAct_9fa48("2510") ? true : (stryCov_9fa48("2510", "2511", "2512", "2513"), params.overallScore >= 4)) ? stryMutAct_9fa48("2514") ? "" : (stryCov_9fa48("2514"), 'average') : stryMutAct_9fa48("2515") ? "" : (stryCov_9fa48("2515"), 'poor');
      const updates = conceptSlugs.map(stryMutAct_9fa48("2516") ? () => undefined : (stryCov_9fa48("2516"), slug => stryMutAct_9fa48("2517") ? {} : (stryCov_9fa48("2517"), {
        concept_slug: slug,
        confidence_delta: confidenceDelta,
        last_session_id: params.sessionId,
        last_performance: performance
      })));
      const {
        data,
        error
      } = await getServiceClient().rpc(stryMutAct_9fa48("2518") ? "" : (stryCov_9fa48("2518"), 'upsert_concept_states_batch'), stryMutAct_9fa48("2519") ? {} : (stryCov_9fa48("2519"), {
        p_user_id: params.userId,
        p_updates: updates
      }));
      if (stryMutAct_9fa48("2521") ? false : stryMutAct_9fa48("2520") ? true : (stryCov_9fa48("2520", "2521"), error)) {
        if (stryMutAct_9fa48("2522")) {
          {}
        } else {
          stryCov_9fa48("2522");
          await logSystemEvent(stryMutAct_9fa48("2523") ? {} : (stryCov_9fa48("2523"), {
            type: stryMutAct_9fa48("2524") ? "" : (stryCov_9fa48("2524"), 'db_error'),
            errorMessage: error.message,
            metadata: stryMutAct_9fa48("2525") ? {} : (stryCov_9fa48("2525"), {
              context: stryMutAct_9fa48("2526") ? "" : (stryCov_9fa48("2526"), 'knowledge_graph.on_interview_session_completed'),
              userId: params.userId,
              sessionId: params.sessionId,
              conceptSlugs,
              operation: stryMutAct_9fa48("2527") ? "" : (stryCov_9fa48("2527"), 'upsert_concept_states_batch')
            })
          }));
          throw new Error(stryMutAct_9fa48("2528") ? `` : (stryCov_9fa48("2528"), `[KG] Batch upsert failed: ${error.message}`));
        }
      }
      console.info(stryMutAct_9fa48("2529") ? `` : (stryCov_9fa48("2529"), `[KG] Updated ${stryMutAct_9fa48("2530") ? data?.length && 0 : (stryCov_9fa48("2530"), (stryMutAct_9fa48("2531") ? data.length : (stryCov_9fa48("2531"), data?.length)) ?? 0)} concept states for user ${params.userId}`));
      await this.invalidateCache(params.userId);
    }
  }

  // Cache management

  async invalidateCache(userId: string): Promise<void> {
    if (stryMutAct_9fa48("2532")) {
      {}
    } else {
      stryCov_9fa48("2532");
      try {
        if (stryMutAct_9fa48("2533")) {
          {}
        } else {
          stryCov_9fa48("2533");
          const redis = getRedis();
          if (stryMutAct_9fa48("2535") ? false : stryMutAct_9fa48("2534") ? true : (stryCov_9fa48("2534", "2535"), redis)) {
            if (stryMutAct_9fa48("2536")) {
              {}
            } else {
              stryCov_9fa48("2536");
              await redis.del(KG_CACHE_KEY(userId), STUDENT_CONTEXT_CACHE_KEY(userId));
            }
          }
        }
      } catch {
        // Cache invalidation failure is non-fatal.
      }
    }
  }

  // Private helpers

  private async fetchAndCacheConceptStates(userId: string): Promise<KGConceptState[]> {
    if (stryMutAct_9fa48("2537")) {
      {}
    } else {
      stryCov_9fa48("2537");
      const {
        data,
        error
      } = await getServiceClient().from(stryMutAct_9fa48("2538") ? "" : (stryCov_9fa48("2538"), 'concept_states')).select(stryMutAct_9fa48("2539") ? "" : (stryCov_9fa48("2539"), '*')).eq(stryMutAct_9fa48("2540") ? "" : (stryCov_9fa48("2540"), 'user_id'), userId).order(stryMutAct_9fa48("2541") ? "" : (stryCov_9fa48("2541"), 'confidence'), stryMutAct_9fa48("2542") ? {} : (stryCov_9fa48("2542"), {
        ascending: stryMutAct_9fa48("2543") ? false : (stryCov_9fa48("2543"), true)
      }));
      if (stryMutAct_9fa48("2545") ? false : stryMutAct_9fa48("2544") ? true : (stryCov_9fa48("2544", "2545"), error)) {
        if (stryMutAct_9fa48("2546")) {
          {}
        } else {
          stryCov_9fa48("2546");
          await logSystemEvent(stryMutAct_9fa48("2547") ? {} : (stryCov_9fa48("2547"), {
            type: stryMutAct_9fa48("2548") ? "" : (stryCov_9fa48("2548"), 'db_error'),
            userId,
            errorMessage: error.message,
            metadata: stryMutAct_9fa48("2549") ? {} : (stryCov_9fa48("2549"), {
              context: stryMutAct_9fa48("2550") ? "" : (stryCov_9fa48("2550"), 'knowledge_graph.fetch_and_cache_concept_states'),
              operation: stryMutAct_9fa48("2551") ? "" : (stryCov_9fa48("2551"), 'select_concept_states')
            })
          }));
          return stryMutAct_9fa48("2552") ? ["Stryker was here"] : (stryCov_9fa48("2552"), []);
        }
      }
      const states = (stryMutAct_9fa48("2553") ? data && [] : (stryCov_9fa48("2553"), data ?? (stryMutAct_9fa48("2554") ? ["Stryker was here"] : (stryCov_9fa48("2554"), [])))).map(stryMutAct_9fa48("2555") ? () => undefined : (stryCov_9fa48("2555"), row => this.mapDBRowToKGConceptState(row)));
      try {
        if (stryMutAct_9fa48("2556")) {
          {}
        } else {
          stryCov_9fa48("2556");
          const redis = getRedis();
          if (stryMutAct_9fa48("2558") ? false : stryMutAct_9fa48("2557") ? true : (stryCov_9fa48("2557", "2558"), redis)) {
            if (stryMutAct_9fa48("2559")) {
              {}
            } else {
              stryCov_9fa48("2559");
              const cache: KGUserCache = stryMutAct_9fa48("2560") ? {} : (stryCov_9fa48("2560"), {
                conceptStates: states,
                builtAt: new Date().toISOString(),
                ttlHint: KG_CACHE_TTL_SECONDS
              });
              await redis.set(KG_CACHE_KEY(userId), cache, stryMutAct_9fa48("2561") ? {} : (stryCov_9fa48("2561"), {
                ex: KG_CACHE_TTL_SECONDS
              }));
            }
          }
        }
      } catch {
        // Cache write failure is non-fatal.
      }
      return states;
    }
  }
  private async getAllConceptTags(): Promise<ConceptTag[]> {
    if (stryMutAct_9fa48("2562")) {
      {}
    } else {
      stryCov_9fa48("2562");
      try {
        if (stryMutAct_9fa48("2563")) {
          {}
        } else {
          stryCov_9fa48("2563");
          const redis = getRedis();
          if (stryMutAct_9fa48("2565") ? false : stryMutAct_9fa48("2564") ? true : (stryCov_9fa48("2564", "2565"), redis)) {
            if (stryMutAct_9fa48("2566")) {
              {}
            } else {
              stryCov_9fa48("2566");
              const cached = await redis.get<ConceptTag[]>(CONCEPT_TAGS_CACHE_KEY);
              if (stryMutAct_9fa48("2568") ? false : stryMutAct_9fa48("2567") ? true : (stryCov_9fa48("2567", "2568"), cached)) {
                if (stryMutAct_9fa48("2569")) {
                  {}
                } else {
                  stryCov_9fa48("2569");
                  return cached;
                }
              }
            }
          }
        }
      } catch {
        // Redis read failure is non-fatal.
      }
      const {
        data,
        error
      } = await getServiceClient().from(stryMutAct_9fa48("2570") ? "" : (stryCov_9fa48("2570"), 'concept_tags')).select(stryMutAct_9fa48("2571") ? "" : (stryCov_9fa48("2571"), '*')).eq(stryMutAct_9fa48("2572") ? "" : (stryCov_9fa48("2572"), 'is_active'), stryMutAct_9fa48("2573") ? false : (stryCov_9fa48("2573"), true)).order(stryMutAct_9fa48("2574") ? "" : (stryCov_9fa48("2574"), 'sort_order'), stryMutAct_9fa48("2575") ? {} : (stryCov_9fa48("2575"), {
        ascending: stryMutAct_9fa48("2576") ? false : (stryCov_9fa48("2576"), true)
      }));
      if (stryMutAct_9fa48("2578") ? false : stryMutAct_9fa48("2577") ? true : (stryCov_9fa48("2577", "2578"), error)) {
        if (stryMutAct_9fa48("2579")) {
          {}
        } else {
          stryCov_9fa48("2579");
          await logSystemEvent(stryMutAct_9fa48("2580") ? {} : (stryCov_9fa48("2580"), {
            type: stryMutAct_9fa48("2581") ? "" : (stryCov_9fa48("2581"), 'db_error'),
            errorMessage: error.message,
            metadata: stryMutAct_9fa48("2582") ? {} : (stryCov_9fa48("2582"), {
              context: stryMutAct_9fa48("2583") ? "" : (stryCov_9fa48("2583"), 'knowledge_graph.get_all_concept_tags'),
              operation: stryMutAct_9fa48("2584") ? "" : (stryCov_9fa48("2584"), 'select_concept_tags')
            })
          }));
          return stryMutAct_9fa48("2585") ? ["Stryker was here"] : (stryCov_9fa48("2585"), []);
        }
      }
      const tags = (data ?? []).map(row => ({
        ...row,
        prerequisites: row.prerequisites || []
      })) as ConceptTag[];
      try {
        if (stryMutAct_9fa48("2586")) {
          {}
        } else {
          stryCov_9fa48("2586");
          const redis = getRedis();
          if (stryMutAct_9fa48("2588") ? false : stryMutAct_9fa48("2587") ? true : (stryCov_9fa48("2587", "2588"), redis)) {
            if (stryMutAct_9fa48("2589")) {
              {}
            } else {
              stryCov_9fa48("2589");
              await redis.set(CONCEPT_TAGS_CACHE_KEY, tags, stryMutAct_9fa48("2590") ? {} : (stryCov_9fa48("2590"), {
                ex: CONCEPT_TAGS_TTL_SECONDS
              }));
            }
          }
        }
      } catch {
        // Cache write failure is non-fatal.
      }
      return tags;
    }
  }
  private mapDBRowToKGConceptState(row: ConceptStateRow): KGConceptState {
    if (stryMutAct_9fa48("2591")) {
      {}
    } else {
      stryCov_9fa48("2591");
      const updatedAt = stryMutAct_9fa48("2592") ? (row.updated_at ?? row.created_at) && new Date(0).toISOString() : (stryCov_9fa48("2592"), (stryMutAct_9fa48("2593") ? row.updated_at && row.created_at : (stryCov_9fa48("2593"), row.updated_at ?? row.created_at)) ?? new Date(0).toISOString());
      const lastSignalAt = stryMutAct_9fa48("2594") ? row.last_signal_at && updatedAt : (stryCov_9fa48("2594"), row.last_signal_at ?? updatedAt);
      return stryMutAct_9fa48("2595") ? {} : (stryCov_9fa48("2595"), {
        id: row.id,
        userId: row.user_id,
        conceptSlug: row.concept_slug,
        confidence: Number(stryMutAct_9fa48("2596") ? row.confidence && 0 : (stryCov_9fa48("2596"), row.confidence ?? 0)),
        evidenceCount: Number(stryMutAct_9fa48("2597") ? row.evidence_count && 0 : (stryCov_9fa48("2597"), row.evidence_count ?? 0)),
        signalHistory: this.normalizeSignalHistory(row.signal_history),
        lastSessionId: row.last_session_id,
        lastSessionType: this.normalizeLastSessionType(row.last_session_type),
        lastSignalAt,
        updatedAt
      });
    }
  }
  private normalizeSignalHistory(signalHistory: ConceptStateRow['signal_history']): KGSignalHistoryEntry[] {
    if (stryMutAct_9fa48("2598")) {
      {}
    } else {
      stryCov_9fa48("2598");
      if (stryMutAct_9fa48("2601") ? false : stryMutAct_9fa48("2600") ? true : stryMutAct_9fa48("2599") ? Array.isArray(signalHistory) : (stryCov_9fa48("2599", "2600", "2601"), !Array.isArray(signalHistory))) {
        if (stryMutAct_9fa48("2602")) {
          {}
        } else {
          stryCov_9fa48("2602");
          return stryMutAct_9fa48("2603") ? ["Stryker was here"] : (stryCov_9fa48("2603"), []);
        }
      }
      return stryMutAct_9fa48("2604") ? signalHistory.map((entry): KGSignalHistoryEntry | null => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const type = record.type;
        const delta = record.delta;
        const at = record.at;
        if ((type === 'session_complete' || type === 'struggle_detected' || type === 'understood_confirmed' || type === 'diagnostic_initial') && typeof delta === 'number' && typeof at === 'string') {
          return {
            type,
            delta,
            at
          };
        }
        return null;
      }) : (stryCov_9fa48("2604"), signalHistory.map((entry): KGSignalHistoryEntry | null => {
        if (stryMutAct_9fa48("2605")) {
          {}
        } else {
          stryCov_9fa48("2605");
          if (stryMutAct_9fa48("2608") ? !entry && typeof entry !== 'object' : stryMutAct_9fa48("2607") ? false : stryMutAct_9fa48("2606") ? true : (stryCov_9fa48("2606", "2607", "2608"), (stryMutAct_9fa48("2609") ? entry : (stryCov_9fa48("2609"), !entry)) || (stryMutAct_9fa48("2611") ? typeof entry === 'object' : stryMutAct_9fa48("2610") ? false : (stryCov_9fa48("2610", "2611"), typeof entry !== (stryMutAct_9fa48("2612") ? "" : (stryCov_9fa48("2612"), 'object')))))) {
            if (stryMutAct_9fa48("2613")) {
              {}
            } else {
              stryCov_9fa48("2613");
              return null;
            }
          }
          const record = entry as Record<string, unknown>;
          const type = record.type;
          const delta = record.delta;
          const at = record.at;
          if (stryMutAct_9fa48("2616") ? (type === 'session_complete' || type === 'struggle_detected' || type === 'understood_confirmed' || type === 'diagnostic_initial') && typeof delta === 'number' || typeof at === 'string' : stryMutAct_9fa48("2615") ? false : stryMutAct_9fa48("2614") ? true : (stryCov_9fa48("2614", "2615", "2616"), (stryMutAct_9fa48("2618") ? type === 'session_complete' || type === 'struggle_detected' || type === 'understood_confirmed' || type === 'diagnostic_initial' || typeof delta === 'number' : stryMutAct_9fa48("2617") ? true : (stryCov_9fa48("2617", "2618"), (stryMutAct_9fa48("2620") ? (type === 'session_complete' || type === 'struggle_detected' || type === 'understood_confirmed') && type === 'diagnostic_initial' : stryMutAct_9fa48("2619") ? true : (stryCov_9fa48("2619", "2620"), (stryMutAct_9fa48("2622") ? (type === 'session_complete' || type === 'struggle_detected') && type === 'understood_confirmed' : stryMutAct_9fa48("2621") ? false : (stryCov_9fa48("2621", "2622"), (stryMutAct_9fa48("2624") ? type === 'session_complete' && type === 'struggle_detected' : stryMutAct_9fa48("2623") ? false : (stryCov_9fa48("2623", "2624"), (stryMutAct_9fa48("2626") ? type !== 'session_complete' : stryMutAct_9fa48("2625") ? false : (stryCov_9fa48("2625", "2626"), type === (stryMutAct_9fa48("2627") ? "" : (stryCov_9fa48("2627"), 'session_complete')))) || (stryMutAct_9fa48("2629") ? type !== 'struggle_detected' : stryMutAct_9fa48("2628") ? false : (stryCov_9fa48("2628", "2629"), type === (stryMutAct_9fa48("2630") ? "" : (stryCov_9fa48("2630"), 'struggle_detected')))))) || (stryMutAct_9fa48("2632") ? type !== 'understood_confirmed' : stryMutAct_9fa48("2631") ? false : (stryCov_9fa48("2631", "2632"), type === (stryMutAct_9fa48("2633") ? "" : (stryCov_9fa48("2633"), 'understood_confirmed')))))) || (stryMutAct_9fa48("2635") ? type !== 'diagnostic_initial' : stryMutAct_9fa48("2634") ? false : (stryCov_9fa48("2634", "2635"), type === (stryMutAct_9fa48("2636") ? "" : (stryCov_9fa48("2636"), 'diagnostic_initial')))))) && (stryMutAct_9fa48("2638") ? typeof delta !== 'number' : stryMutAct_9fa48("2637") ? true : (stryCov_9fa48("2637", "2638"), typeof delta === (stryMutAct_9fa48("2639") ? "" : (stryCov_9fa48("2639"), 'number')))))) && (stryMutAct_9fa48("2641") ? typeof at !== 'string' : stryMutAct_9fa48("2640") ? true : (stryCov_9fa48("2640", "2641"), typeof at === (stryMutAct_9fa48("2642") ? "" : (stryCov_9fa48("2642"), 'string')))))) {
            if (stryMutAct_9fa48("2643")) {
              {}
            } else {
              stryCov_9fa48("2643");
              return stryMutAct_9fa48("2644") ? {} : (stryCov_9fa48("2644"), {
                type,
                delta,
                at
              });
            }
          }
          return null;
        }
      }).filter(stryMutAct_9fa48("2645") ? () => undefined : (stryCov_9fa48("2645"), (entry): entry is KGSignalHistoryEntry => stryMutAct_9fa48("2648") ? entry === null : stryMutAct_9fa48("2647") ? false : stryMutAct_9fa48("2646") ? true : (stryCov_9fa48("2646", "2647", "2648"), entry !== null))));
    }
  }
  private normalizeLastSessionType(value: ConceptStateRow['last_session_type']): KGConceptState['lastSessionType'] {
    if (stryMutAct_9fa48("2649")) {
      {}
    } else {
      stryCov_9fa48("2649");
      if (stryMutAct_9fa48("2652") ? (value === 'interview' || value === 'learn') && value === 'diagnostic' : stryMutAct_9fa48("2651") ? false : stryMutAct_9fa48("2650") ? true : (stryCov_9fa48("2650", "2651", "2652"), (stryMutAct_9fa48("2654") ? value === 'interview' && value === 'learn' : stryMutAct_9fa48("2653") ? false : (stryCov_9fa48("2653", "2654"), (stryMutAct_9fa48("2656") ? value !== 'interview' : stryMutAct_9fa48("2655") ? false : (stryCov_9fa48("2655", "2656"), value === (stryMutAct_9fa48("2657") ? "" : (stryCov_9fa48("2657"), 'interview')))) || (stryMutAct_9fa48("2659") ? value !== 'learn' : stryMutAct_9fa48("2658") ? false : (stryCov_9fa48("2658", "2659"), value === (stryMutAct_9fa48("2660") ? "" : (stryCov_9fa48("2660"), 'learn')))))) || (stryMutAct_9fa48("2662") ? value !== 'diagnostic' : stryMutAct_9fa48("2661") ? false : (stryCov_9fa48("2661", "2662"), value === (stryMutAct_9fa48("2663") ? "" : (stryCov_9fa48("2663"), 'diagnostic')))))) {
        if (stryMutAct_9fa48("2664")) {
          {}
        } else {
          stryCov_9fa48("2664");
          return value;
        }
      }
      return null;
    }
  }
}
export function getKnowledgeGraphService(): KnowledgeGraphService {
  if (stryMutAct_9fa48("2665")) {
    {}
  } else {
    stryCov_9fa48("2665");
    return KnowledgeGraphService.getInstance();
  }
}