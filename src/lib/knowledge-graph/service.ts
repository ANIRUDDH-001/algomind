/**
 * @module knowledge-graph/service
 * @description KnowledgeGraphService - reads and writes all concept confidence data.
 *              Single source of truth for personalization.
 * @phase Phase 2A
 */

import { getServiceClient } from '@/lib/supabase/service';
import { getRedis } from '@/lib/upstash/client';
import { logSystemEvent } from '@/lib/monitoring/events';
import type { Tables } from '@/types/supabase';
import type { ConceptTag } from '@/types/knowledge-graph';
import { getConfidenceLevel } from '@/types/knowledge-graph';
import type {
  KGConceptState,
  KGDiagnosticResult,
  KGLearnAssessment,
  KGConceptSummary,
  KGSignalHistoryEntry,
  KGUserCache,
} from './types';

const KG_CACHE_KEY = (userId: string) => `kg:concepts:${userId}`;
const STUDENT_CONTEXT_CACHE_KEY = (userId: string) => `student_context:${userId}`;
const CONCEPT_TAGS_CACHE_KEY = 'kg:concept_tags:all';
const KG_CACHE_TTL_SECONDS = 60 * 60;
const CONCEPT_TAGS_TTL_SECONDS = 60 * 60 * 24;

type ConceptStateRow = Tables<'concept_states'>;

export class KnowledgeGraphService {
  private static instance: KnowledgeGraphService;

  static getInstance(): KnowledgeGraphService {
    if (!KnowledgeGraphService.instance) {
      KnowledgeGraphService.instance = new KnowledgeGraphService();
    }
    return KnowledgeGraphService.instance;
  }

  // Read operations

  async getConceptStates(userId: string): Promise<KGConceptState[]> {
    const cacheKey = KG_CACHE_KEY(userId);

    try {
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get<KGUserCache>(cacheKey);
        if (cached?.conceptStates) {
          void logSystemEvent({
            type: 'kg_cache_hit',
            userId,
          });
          return cached.conceptStates;
        }
        void logSystemEvent({
          type: 'kg_cache_miss',
          userId,
        });
      }
    } catch {
      // Redis failure is non-fatal.
    }

    return this.fetchAndCacheConceptStates(userId);
  }

  async getWeakestConcepts(userId: string, limit = 5): Promise<KGConceptState[]> {
    const states = await this.getConceptStates(userId);
    return states
      .filter((state) => state.evidenceCount > 0)
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, limit);
  }

  async getStrongestConcepts(userId: string, limit = 5): Promise<KGConceptState[]> {
    const states = await this.getConceptStates(userId);
    return states
      .filter((state) => state.evidenceCount > 0)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  async getSingleConceptState(userId: string, conceptSlug: string): Promise<KGConceptState | null> {
    const states = await this.getConceptStates(userId);
    return states.find((state) => state.conceptSlug === conceptSlug) ?? null;
  }

  async hasCompletedDiagnostic(userId: string): Promise<boolean> {
    const states = await this.getConceptStates(userId);
    return states.some((state) => state.evidenceCount > 0);
  }

  async getConceptSummaries(userId: string): Promise<KGConceptSummary[]> {
    const [states, tags] = await Promise.all([
      this.getConceptStates(userId),
      this.getAllConceptTags(),
    ]);

    const stateBySlug = new Map(states.map((state) => [state.conceptSlug, state]));

    return tags.map((tag) => {
      const state = stateBySlug.get(tag.id);
      const confidence = state?.confidence ?? 0.5;
      return {
        slug: tag.id,
        displayName: tag.display_name,
        confidence,
        evidenceCount: state?.evidenceCount ?? 0,
        level: state?.evidenceCount ? getConfidenceLevel(confidence) : 'unknown',
        icon: tag.icon ?? 'list',
        lastSessionType: state?.lastSessionType ?? null,
        lastSignalAt: state?.lastSignalAt ?? null,
      };
    });
  }

  async getNextRecommendedConcept(userId: string): Promise<string | null> {
    const [states, tags] = await Promise.all([
      this.getConceptStates(userId),
      this.getAllConceptTags(),
    ]);

    const learnedSlugs = new Set(
      states
        .filter((state) => state.evidenceCount > 0)
        .map((state) => state.conceptSlug)
    );

    const unlearned = tags
      .filter((tag) => !learnedSlugs.has(tag.id))
      .map((tag) => tag.id);

    if (unlearned.length > 0) {
      return unlearned[0] ?? null;
    }

    const weakest = await this.getWeakestConcepts(userId, 1);
    return weakest[0]?.conceptSlug ?? null;
  }

  // Write operations

  async initializeFromDiagnostic(userId: string, results: KGDiagnosticResult[]): Promise<void> {
    const payload = results.map((result) => ({
      concept_slug: result.conceptSlug,
      confidence: result.confidence,
    }));

    const { error } = await getServiceClient().rpc('initialize_concept_states', {
      p_user_id: userId,
      p_results: JSON.stringify(payload),
    });

    if (error) {
      await logSystemEvent({
        type: 'db_error',
        userId,
        errorMessage: error.message,
        metadata: {
          context: 'knowledge_graph.initialize_from_diagnostic',
          operation: 'initialize_concept_states',
        },
      });
      throw new Error(`KnowledgeGraphService.initializeFromDiagnostic failed: ${error.message}`);
    }

    await this.invalidateCache(userId);
  }

  async onLearnSessionCompleted(sessionId: string, assessment: KGLearnAssessment): Promise<void> {
    const payload = {
      understood: assessment.understood,
      struggled: assessment.struggled,
      notes: assessment.notes,
      confidence_delta: assessment.confidenceDelta,
    };

    const { error } = await getServiceClient().rpc('on_learn_session_completed', {
      p_session_id: sessionId,
      p_kai_assessment: JSON.stringify(payload),
    });

    if (error) {
      await logSystemEvent({
        type: 'db_error',
        errorMessage: error.message,
        metadata: {
          context: 'knowledge_graph.on_learn_session_completed',
          sessionId,
          operation: 'on_learn_session_completed',
        },
      });
      throw new Error(`KnowledgeGraphService.onLearnSessionCompleted failed: ${error.message}`);
    }

    try {
      const { data } = await getServiceClient()
        .from('learn_sessions')
        .select('user_id')
        .eq('id', sessionId)
        .single();

      if (data?.user_id) {
        await this.invalidateCache(data.user_id);
      }
    } catch {
      // Cache invalidation lookup failure is non-fatal.
    }
  }

  // Cache management

  async invalidateCache(userId: string): Promise<void> {
    try {
      const redis = getRedis();
      if (redis) {
        await redis.del(KG_CACHE_KEY(userId), STUDENT_CONTEXT_CACHE_KEY(userId));
      }
    } catch {
      // Cache invalidation failure is non-fatal.
    }
  }

  // Private helpers

  private async fetchAndCacheConceptStates(userId: string): Promise<KGConceptState[]> {
    const { data, error } = await getServiceClient()
      .from('concept_states')
      .select('*')
      .eq('user_id', userId)
      .order('confidence', { ascending: true });

    if (error) {
      await logSystemEvent({
        type: 'db_error',
        userId,
        errorMessage: error.message,
        metadata: {
          context: 'knowledge_graph.fetch_and_cache_concept_states',
          operation: 'select_concept_states',
        },
      });
      return [];
    }

    const states = (data ?? []).map((row) => this.mapDBRowToKGConceptState(row));

    try {
      const redis = getRedis();
      if (redis) {
        const cache: KGUserCache = {
          conceptStates: states,
          builtAt: new Date().toISOString(),
          ttlHint: KG_CACHE_TTL_SECONDS,
        };
        await redis.set(KG_CACHE_KEY(userId), cache, { ex: KG_CACHE_TTL_SECONDS });
      }
    } catch {
      // Cache write failure is non-fatal.
    }

    return states;
  }

  private async getAllConceptTags(): Promise<ConceptTag[]> {
    try {
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get<ConceptTag[]>(CONCEPT_TAGS_CACHE_KEY);
        if (cached) {
          return cached;
        }
      }
    } catch {
      // Redis read failure is non-fatal.
    }

    const { data, error } = await getServiceClient()
      .from('concept_tags')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      await logSystemEvent({
        type: 'db_error',
        errorMessage: error.message,
        metadata: {
          context: 'knowledge_graph.get_all_concept_tags',
          operation: 'select_concept_tags',
        },
      });
      return [];
    }

    const tags = (data ?? []) as ConceptTag[];

    try {
      const redis = getRedis();
      if (redis) {
        await redis.set(CONCEPT_TAGS_CACHE_KEY, tags, { ex: CONCEPT_TAGS_TTL_SECONDS });
      }
    } catch {
      // Cache write failure is non-fatal.
    }

    return tags;
  }

  private mapDBRowToKGConceptState(row: ConceptStateRow): KGConceptState {
    const updatedAt = row.updated_at ?? row.created_at ?? new Date(0).toISOString();
    const lastSignalAt = row.last_signal_at ?? updatedAt;

    return {
      id: row.id,
      userId: row.user_id,
      conceptSlug: row.concept_slug,
      confidence: Number(row.confidence ?? 0),
      evidenceCount: Number(row.evidence_count ?? 0),
      signalHistory: this.normalizeSignalHistory(row.signal_history),
      lastSessionId: row.last_session_id,
      lastSessionType: this.normalizeLastSessionType(row.last_session_type),
      lastSignalAt,
      updatedAt,
    };
  }

  private normalizeSignalHistory(signalHistory: ConceptStateRow['signal_history']): KGSignalHistoryEntry[] {
    if (!Array.isArray(signalHistory)) {
      return [];
    }

    return signalHistory
      .map((entry): KGSignalHistoryEntry | null => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const type = record.type;
        const delta = record.delta;
        const at = record.at;

        if (
          (type === 'session_complete' ||
            type === 'struggle_detected' ||
            type === 'understood_confirmed' ||
            type === 'diagnostic_initial') &&
          typeof delta === 'number' &&
          typeof at === 'string'
        ) {
          return { type, delta, at };
        }

        return null;
      })
      .filter((entry): entry is KGSignalHistoryEntry => entry !== null);
  }

  private normalizeLastSessionType(
    value: ConceptStateRow['last_session_type']
  ): KGConceptState['lastSessionType'] {
    if (value === 'interview' || value === 'learn' || value === 'diagnostic') {
      return value;
    }
    return null;
  }
}

export function getKnowledgeGraphService(): KnowledgeGraphService {
  return KnowledgeGraphService.getInstance();
}
