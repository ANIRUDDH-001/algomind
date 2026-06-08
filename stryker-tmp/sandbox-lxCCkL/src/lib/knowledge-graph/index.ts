/**
 * @module knowledge-graph
 * @description Public exports for the knowledge graph module.
 * @phase Phase 2A
 */
// @ts-nocheck


export { KnowledgeGraphService, getKnowledgeGraphService } from './service';
export type {
  KGConceptState,
  KGDiagnosticResult,
  KGLearnAssessment,
  KGConceptSummary,
} from './types';
