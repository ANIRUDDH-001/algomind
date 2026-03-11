// AI Module Exports
// Provides unified access to multi-model AI capabilities
//
// Note: The legacy `chat()` export was removed in v2. Use getAIClient().generateResponse() instead.
// The `embed()` export is kept for RAG pipeline compatibility.

export * from './providers';
export * from './rate-limiter';
export * from './client';
export * from './patterns';
export * from './intent-classifier';
export * from './types';
export * from './response-chunker';
export * from './response-cache';
export * from './common-questions';
