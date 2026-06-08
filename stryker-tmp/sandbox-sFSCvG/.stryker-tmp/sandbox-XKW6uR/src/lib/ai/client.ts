// @ts-nocheck
// 
// Unified AI Client with Multi-Provider Support
// When AWS Bedrock flag is ON, Bedrock models are PRIMARY (tried first).
// When OFF, uses Gemini/Groq with automatic rate-limit-based fallback.
// DB-driven model routing with cross-tier fallback
// DIRECT API CALLS implementation (No SDKs)

//  -- automated unused local suppression
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
import { CHAT_MODELS, ModelConfig, Provider } from './providers';
import { getRateLimiter, IntelligentRateLimiter } from './rate-limiter';
import { getIntentClassifier } from './intent-classifier';
import { getModelTelemetry } from '../analytics/model-telemetry';
import { getResponseCache } from './response-cache';
import type { CacheIdentity } from './response-cache';
import { getActiveModels } from './model-registry';
import { buildRoutingStagePlan, getEmergencyFallbackModels, getModelsForUseCase, isCrossTierFallbackEnabled, resolveToModelConfig } from './model-routing';
import { logSystemEvent } from '../monitoring/events';
import type { GenerateResponseOptions, AIResponse } from './types';
import { checkTokenBudget, recordTokenUsage } from './cost-guard';

// Types
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
export interface CompletionOptions {
  preferredProvider?: Provider;
  category?: string; // e.g. 'reasoning', 'coding', 'fast' - maps to tiers if needed
  maxTokens?: number;
  temperature?: number;
  estimatedTokens?: number;
  systemPrompt?: string; // Legacy support
  // Disables LLM intent classification pass when routing is smart
  enableLLMPass?: boolean;
  /** Optional external cancellation signal */
  signal?: AbortSignal;
  /** OpenAI-compatible response_format for structured output (e.g. { type: 'json_object' }) */
  responseFormat?: {
    type: string;
    [key: string]: unknown;
  };
  correlationId?: string;
  userId?: string;
  sessionId?: string;
}
export interface CompletionResult {
  success: boolean;
  modelUsed?: string;
  provider?: Provider;
  response?: string;
  error?: string;
  attemptedModels: string[];
  budgetExceeded?: boolean;
}

// Unified AI Client
export class UnifiedAIClient {
  private rateLimiter: IntelligentRateLimiter;
  private readonly GROQ_API_URL = stryMutAct_9fa48("274") ? "" : (stryCov_9fa48("274"), "https://api.groq.com/openai/v1/chat/completions");
  private readonly GEMINI_API_BASE = stryMutAct_9fa48("275") ? "" : (stryCov_9fa48("275"), "https://generativelanguage.googleapis.com/v1beta/models");
  constructor() {
    if (stryMutAct_9fa48("276")) {
      {}
    } else {
      stryCov_9fa48("276");
      this.rateLimiter = getRateLimiter();
      this.validateConfig();
    }
  }
  private validateConfig() {
    if (stryMutAct_9fa48("277")) {
      {}
    } else {
      stryCov_9fa48("277");
      if (stryMutAct_9fa48("280") ? false : stryMutAct_9fa48("279") ? true : stryMutAct_9fa48("278") ? process.env.GROQ_API_KEY : (stryCov_9fa48("278", "279", "280"), !process.env.GROQ_API_KEY)) {
        if (stryMutAct_9fa48("281")) {
          {}
        } else {
          stryCov_9fa48("281");
          console.warn(stryMutAct_9fa48("282") ? "" : (stryCov_9fa48("282"), "Using UnifiedAIClient without GROQ_API_KEY"));
        }
      }
      if (stryMutAct_9fa48("285") ? !process.env.GEMINI_API_KEY || !process.env.GOOGLE_API_KEY : stryMutAct_9fa48("284") ? false : stryMutAct_9fa48("283") ? true : (stryCov_9fa48("283", "284", "285"), (stryMutAct_9fa48("286") ? process.env.GEMINI_API_KEY : (stryCov_9fa48("286"), !process.env.GEMINI_API_KEY)) && (stryMutAct_9fa48("287") ? process.env.GOOGLE_API_KEY : (stryCov_9fa48("287"), !process.env.GOOGLE_API_KEY)))) {
        if (stryMutAct_9fa48("288")) {
          {}
        } else {
          stryCov_9fa48("288");
          console.warn(stryMutAct_9fa48("289") ? "" : (stryCov_9fa48("289"), "Using UnifiedAIClient without GEMINI_API_KEY or GOOGLE_API_KEY"));
        }
      }
    }
  }

  /**
   * Generate completion with automatic fallback based on provider rules
   */
  async generateCompletion(messages: Message[], options: CompletionOptions = {}): Promise<CompletionResult> {
    if (stryMutAct_9fa48("290")) {
      {}
    } else {
      stryCov_9fa48("290");
      const attemptedModels: string[] = stryMutAct_9fa48("291") ? ["Stryker was here"] : (stryCov_9fa48("291"), []);
      const correlationId = stryMutAct_9fa48("292") ? options.correlationId && crypto.randomUUID() : (stryCov_9fa48("292"), options.correlationId ?? crypto.randomUUID());
      const callStart = Date.now();
      if (stryMutAct_9fa48("295") ? options.userId || options.sessionId : stryMutAct_9fa48("294") ? false : stryMutAct_9fa48("293") ? true : (stryCov_9fa48("293", "294", "295"), options.userId && options.sessionId)) {
        if (stryMutAct_9fa48("296")) {
          {}
        } else {
          stryCov_9fa48("296");
          const budget = await checkTokenBudget(options.userId, options.sessionId, stryMutAct_9fa48("299") ? options.estimatedTokens && 500 : stryMutAct_9fa48("298") ? false : stryMutAct_9fa48("297") ? true : (stryCov_9fa48("297", "298", "299"), options.estimatedTokens || 500));
          if (stryMutAct_9fa48("302") ? false : stryMutAct_9fa48("301") ? true : stryMutAct_9fa48("300") ? budget.allowed : (stryCov_9fa48("300", "301", "302"), !budget.allowed)) {
            if (stryMutAct_9fa48("303")) {
              {}
            } else {
              stryCov_9fa48("303");
              return stryMutAct_9fa48("304") ? {} : (stryCov_9fa48("304"), {
                success: stryMutAct_9fa48("305") ? false : (stryCov_9fa48("305"), true),
                modelUsed: stryMutAct_9fa48("306") ? "" : (stryCov_9fa48("306"), 'budget_guard'),
                response: (stryMutAct_9fa48("309") ? budget.reason !== 'daily_limit' : stryMutAct_9fa48("308") ? false : stryMutAct_9fa48("307") ? true : (stryCov_9fa48("307", "308", "309"), budget.reason === (stryMutAct_9fa48("310") ? "" : (stryCov_9fa48("310"), 'daily_limit')))) ? stryMutAct_9fa48("311") ? "" : (stryCov_9fa48("311"), "You've reached your daily usage limit. Your limit resets in a few hours.") : stryMutAct_9fa48("312") ? "" : (stryCov_9fa48("312"), 'This session has reached its token limit. Please start a new session.'),
                attemptedModels,
                budgetExceeded: stryMutAct_9fa48("313") ? false : (stryCov_9fa48("313"), true)
              });
            }
          }
        }
      }

      // Determine use case from options
      const useCase: 'chat' | 'analysis' = (stryMutAct_9fa48("316") ? options.category === 'intelligence' && options.category === 'analysis' : stryMutAct_9fa48("315") ? false : stryMutAct_9fa48("314") ? true : (stryCov_9fa48("314", "315", "316"), (stryMutAct_9fa48("318") ? options.category !== 'intelligence' : stryMutAct_9fa48("317") ? false : (stryCov_9fa48("317", "318"), options.category === (stryMutAct_9fa48("319") ? "" : (stryCov_9fa48("319"), 'intelligence')))) || (stryMutAct_9fa48("321") ? options.category !== 'analysis' : stryMutAct_9fa48("320") ? false : (stryCov_9fa48("320", "321"), options.category === (stryMutAct_9fa48("322") ? "" : (stryCov_9fa48("322"), 'analysis')))))) ? stryMutAct_9fa48("323") ? "" : (stryCov_9fa48("323"), 'analysis') : stryMutAct_9fa48("324") ? "" : (stryCov_9fa48("324"), 'chat');

      // Compatibility path: explicit provider overrides keep legacy semantics.
      // Deterministic stage routing is used when provider is not explicitly forced.
      if (stryMutAct_9fa48("326") ? false : stryMutAct_9fa48("325") ? true : (stryCov_9fa48("325", "326"), options.preferredProvider)) {
        if (stryMutAct_9fa48("327")) {
          {}
        } else {
          stryCov_9fa48("327");
          let forcedProvider = options.preferredProvider;
          if (stryMutAct_9fa48("330") ? forcedProvider !== 'local' : stryMutAct_9fa48("329") ? false : stryMutAct_9fa48("328") ? true : (stryCov_9fa48("328", "329", "330"), forcedProvider === (stryMutAct_9fa48("331") ? "" : (stryCov_9fa48("331"), 'local')))) {
            if (stryMutAct_9fa48("332")) {
              {}
            } else {
              stryCov_9fa48("332");
              forcedProvider = stryMutAct_9fa48("333") ? "" : (stryCov_9fa48("333"), 'groq');
            }
          }
          const models = await getActiveModels();
          const primaryResult = await this.tryProvider(forcedProvider, messages, stryMutAct_9fa48("334") ? {} : (stryCov_9fa48("334"), {
            ...options,
            correlationId
          }), attemptedModels, models);
          if (stryMutAct_9fa48("336") ? false : stryMutAct_9fa48("335") ? true : (stryCov_9fa48("335", "336"), primaryResult.success)) {
            if (stryMutAct_9fa48("337")) {
              {}
            } else {
              stryCov_9fa48("337");
              if (stryMutAct_9fa48("340") ? primaryResult.modelUsed || primaryResult.provider : stryMutAct_9fa48("339") ? false : stryMutAct_9fa48("338") ? true : (stryCov_9fa48("338", "339", "340"), primaryResult.modelUsed && primaryResult.provider)) {
                if (stryMutAct_9fa48("341")) {
                  {}
                } else {
                  stryCov_9fa48("341");
                  void logSystemEvent(stryMutAct_9fa48("342") ? {} : (stryCov_9fa48("342"), {
                    type: stryMutAct_9fa48("343") ? "" : (stryCov_9fa48("343"), 'llm_request'),
                    correlationId,
                    metadata: stryMutAct_9fa48("344") ? {} : (stryCov_9fa48("344"), {
                      useCase,
                      model_id: primaryResult.modelUsed,
                      provider: primaryResult.provider,
                      duration_ms: stryMutAct_9fa48("345") ? Date.now() + callStart : (stryCov_9fa48("345"), Date.now() - callStart),
                      messageCount: messages.length
                    })
                  }));
                }
              }
              return primaryResult;
            }
          }
          if (stryMutAct_9fa48("348") ? forcedProvider !== 'gemini' : stryMutAct_9fa48("347") ? false : stryMutAct_9fa48("346") ? true : (stryCov_9fa48("346", "347", "348"), forcedProvider === (stryMutAct_9fa48("349") ? "" : (stryCov_9fa48("349"), 'gemini')))) {
            if (stryMutAct_9fa48("350")) {
              {}
            } else {
              stryCov_9fa48("350");
              console.warn(stryMutAct_9fa48("351") ? "" : (stryCov_9fa48("351"), '[UnifiedAIClient] Gemini failed, falling back to Groq'));
              const fallbackResult = await this.tryProvider(stryMutAct_9fa48("352") ? "" : (stryCov_9fa48("352"), 'groq'), messages, stryMutAct_9fa48("353") ? {} : (stryCov_9fa48("353"), {
                ...options,
                correlationId
              }), attemptedModels, models);
              if (stryMutAct_9fa48("355") ? false : stryMutAct_9fa48("354") ? true : (stryCov_9fa48("354", "355"), fallbackResult.success)) {
                if (stryMutAct_9fa48("356")) {
                  {}
                } else {
                  stryCov_9fa48("356");
                  if (stryMutAct_9fa48("359") ? fallbackResult.modelUsed || fallbackResult.provider : stryMutAct_9fa48("358") ? false : stryMutAct_9fa48("357") ? true : (stryCov_9fa48("357", "358", "359"), fallbackResult.modelUsed && fallbackResult.provider)) {
                    if (stryMutAct_9fa48("360")) {
                      {}
                    } else {
                      stryCov_9fa48("360");
                      void logSystemEvent(stryMutAct_9fa48("361") ? {} : (stryCov_9fa48("361"), {
                        type: stryMutAct_9fa48("362") ? "" : (stryCov_9fa48("362"), 'llm_request'),
                        correlationId,
                        metadata: stryMutAct_9fa48("363") ? {} : (stryCov_9fa48("363"), {
                          useCase,
                          model_id: fallbackResult.modelUsed,
                          provider: fallbackResult.provider,
                          duration_ms: stryMutAct_9fa48("364") ? Date.now() + callStart : (stryCov_9fa48("364"), Date.now() - callStart),
                          messageCount: messages.length
                        })
                      }));
                    }
                  }
                  return fallbackResult;
                }
              }
            }
          }
          return stryMutAct_9fa48("365") ? {} : (stryCov_9fa48("365"), {
            success: stryMutAct_9fa48("366") ? true : (stryCov_9fa48("366"), false),
            error: stryMutAct_9fa48("367") ? "" : (stryCov_9fa48("367"), 'All allowed models failed.'),
            attemptedModels
          });
        }
      }

      // ── PRIMARY: Bedrock (when ENABLE_AWS_BEDROCK is ON) ────────────
      // When the flag is ON, Bedrock is the primary provider.
      // Free providers (Groq/Gemini) become the fallback.
      if (stryMutAct_9fa48("369") ? false : stryMutAct_9fa48("368") ? true : (stryCov_9fa48("368", "369"), process.env.AWS_ACCESS_KEY_ID)) {
        if (stryMutAct_9fa48("370")) {
          {}
        } else {
          stryCov_9fa48("370");
          try {
            if (stryMutAct_9fa48("371")) {
              {}
            } else {
              stryCov_9fa48("371");
              const {
                getGlobalFeatureFlag: getFlag
              } = await import('@/lib/feature-flags-server');
              const bedrockEnabled = await getFlag(stryMutAct_9fa48("372") ? "" : (stryCov_9fa48("372"), 'ENABLE_AWS_BEDROCK'));
              if (stryMutAct_9fa48("374") ? false : stryMutAct_9fa48("373") ? true : (stryCov_9fa48("373", "374"), bedrockEnabled)) {
                if (stryMutAct_9fa48("375")) {
                  {}
                } else {
                  stryCov_9fa48("375");
                  const {
                    callBedrockModel
                  } = await import('./bedrock-client');
                  const {
                    logAWSUsage,
                    estimateBedrockCost
                  } = await import('@/lib/aws/usage-logger');
                  // Get Bedrock models from DB routing table
                  const bedrockModels = stryMutAct_9fa48("376") ? await getModelsForUseCase(useCase) : (stryCov_9fa48("376"), (await getModelsForUseCase(useCase)).filter(stryMutAct_9fa48("377") ? () => undefined : (stryCov_9fa48("377"), m => stryMutAct_9fa48("380") ? m.provider !== 'bedrock' : stryMutAct_9fa48("379") ? false : stryMutAct_9fa48("378") ? true : (stryCov_9fa48("378", "379", "380"), m.provider === (stryMutAct_9fa48("381") ? "" : (stryCov_9fa48("381"), 'bedrock'))))));
                  const modelId = (stryMutAct_9fa48("385") ? bedrockModels.length <= 0 : stryMutAct_9fa48("384") ? bedrockModels.length >= 0 : stryMutAct_9fa48("383") ? false : stryMutAct_9fa48("382") ? true : (stryCov_9fa48("382", "383", "384", "385"), bedrockModels.length > 0)) ? bedrockModels[0].modelId : stryMutAct_9fa48("386") ? "" : (stryCov_9fa48("386"), 'openai.gpt-oss-120b-1:0'); // default Bedrock model when not in DB

                  try {
                    if (stryMutAct_9fa48("387")) {
                      {}
                    } else {
                      stryCov_9fa48("387");
                      const response = await callBedrockModel(modelId, messages, options.systemPrompt, options.maxTokens, options.signal);
                      const tokensUsed = Math.ceil(stryMutAct_9fa48("388") ? response.length * 4 : (stryCov_9fa48("388"), response.length / 4));
                      if (stryMutAct_9fa48("391") ? options.userId && options.sessionId || tokensUsed > 0 : stryMutAct_9fa48("390") ? false : stryMutAct_9fa48("389") ? true : (stryCov_9fa48("389", "390", "391"), (stryMutAct_9fa48("393") ? options.userId || options.sessionId : stryMutAct_9fa48("392") ? true : (stryCov_9fa48("392", "393"), options.userId && options.sessionId)) && (stryMutAct_9fa48("396") ? tokensUsed <= 0 : stryMutAct_9fa48("395") ? tokensUsed >= 0 : stryMutAct_9fa48("394") ? true : (stryCov_9fa48("394", "395", "396"), tokensUsed > 0)))) {
                        if (stryMutAct_9fa48("397")) {
                          {}
                        } else {
                          stryCov_9fa48("397");
                          void recordTokenUsage(options.userId, options.sessionId, tokensUsed);
                        }
                      }
                      void logSystemEvent(stryMutAct_9fa48("398") ? {} : (stryCov_9fa48("398"), {
                        type: stryMutAct_9fa48("399") ? "" : (stryCov_9fa48("399"), 'llm_request'),
                        correlationId,
                        metadata: stryMutAct_9fa48("400") ? {} : (stryCov_9fa48("400"), {
                          useCase,
                          model_id: modelId,
                          provider: stryMutAct_9fa48("401") ? "" : (stryCov_9fa48("401"), 'bedrock'),
                          duration_ms: stryMutAct_9fa48("402") ? Date.now() + callStart : (stryCov_9fa48("402"), Date.now() - callStart),
                          messageCount: messages.length
                        })
                      }));
                      // Log Bedrock usage for budget tracking
                      const inputChars = stryMutAct_9fa48("403") ? messages.reduce((sum, m) => sum + (m.content?.length || 0), 0) - (options.systemPrompt?.length || 0) : (stryCov_9fa48("403"), messages.reduce(stryMutAct_9fa48("404") ? () => undefined : (stryCov_9fa48("404"), (sum, m) => stryMutAct_9fa48("405") ? sum - (m.content?.length || 0) : (stryCov_9fa48("405"), sum + (stryMutAct_9fa48("408") ? m.content?.length && 0 : stryMutAct_9fa48("407") ? false : stryMutAct_9fa48("406") ? true : (stryCov_9fa48("406", "407", "408"), (stryMutAct_9fa48("409") ? m.content.length : (stryCov_9fa48("409"), m.content?.length)) || 0)))), 0) + (stryMutAct_9fa48("412") ? options.systemPrompt?.length && 0 : stryMutAct_9fa48("411") ? false : stryMutAct_9fa48("410") ? true : (stryCov_9fa48("410", "411", "412"), (stryMutAct_9fa48("413") ? options.systemPrompt.length : (stryCov_9fa48("413"), options.systemPrompt?.length)) || 0)));
                      logAWSUsage(stryMutAct_9fa48("414") ? {} : (stryCov_9fa48("414"), {
                        service: stryMutAct_9fa48("415") ? "" : (stryCov_9fa48("415"), 'bedrock'),
                        operation: stryMutAct_9fa48("416") ? "" : (stryCov_9fa48("416"), 'InvokeModel'),
                        region: stryMutAct_9fa48("419") ? process.env.AWS_BEDROCK_REGION && 'us-east-1' : stryMutAct_9fa48("418") ? false : stryMutAct_9fa48("417") ? true : (stryCov_9fa48("417", "418", "419"), process.env.AWS_BEDROCK_REGION || (stryMutAct_9fa48("420") ? "" : (stryCov_9fa48("420"), 'us-east-1'))),
                        bytesProcessed: stryMutAct_9fa48("421") ? inputChars - response.length : (stryCov_9fa48("421"), inputChars + response.length),
                        estimatedCostUsd: estimateBedrockCost(inputChars, response.length),
                        metadata: stryMutAct_9fa48("422") ? {} : (stryCov_9fa48("422"), {
                          model: modelId,
                          useCase,
                          primary: stryMutAct_9fa48("423") ? false : (stryCov_9fa48("423"), true)
                        })
                      })).catch(() => {});
                      return stryMutAct_9fa48("424") ? {} : (stryCov_9fa48("424"), {
                        success: stryMutAct_9fa48("425") ? false : (stryCov_9fa48("425"), true),
                        modelUsed: modelId,
                        provider: 'bedrock' as Provider,
                        response,
                        attemptedModels: stryMutAct_9fa48("426") ? [] : (stryCov_9fa48("426"), [...attemptedModels, stryMutAct_9fa48("427") ? `` : (stryCov_9fa48("427"), `bedrock-${modelId}`)])
                      });
                    }
                  } catch (bedrockErr) {
                    if (stryMutAct_9fa48("428")) {
                      {}
                    } else {
                      stryCov_9fa48("428");
                      console.warn(stryMutAct_9fa48("429") ? `` : (stryCov_9fa48("429"), `[UnifiedAIClient] Bedrock primary (${modelId}) failed, falling back to free providers:`), bedrockErr instanceof Error ? bedrockErr.message : bedrockErr);
                      attemptedModels.push(stryMutAct_9fa48("430") ? `` : (stryCov_9fa48("430"), `bedrock-${modelId}`));
                      // Fall through to free providers below
                    }
                  }
                }
              }
            }
          } catch (flagErr) {
            if (stryMutAct_9fa48("431")) {
              {}
            } else {
              stryCov_9fa48("431");
              console.warn(stryMutAct_9fa48("432") ? "" : (stryCov_9fa48("432"), '[UnifiedAIClient] Could not check Bedrock flag:'), flagErr instanceof Error ? flagErr.message : flagErr);
            }
          }
        }
      }

      // ── FALLBACK: DB-routed free providers (Groq/Gemini) ────────────
      const crossTierFallbackEnabled = await isCrossTierFallbackEnabled();
      const routingStages = buildRoutingStagePlan(useCase, crossTierFallbackEnabled);
      const allActiveModels = await getActiveModels();
      for (const routingStage of routingStages) {
        if (stryMutAct_9fa48("433")) {
          {}
        } else {
          stryCov_9fa48("433");
          const stageModels = (stryMutAct_9fa48("436") ? routingStage.stage !== 'emergency' : stryMutAct_9fa48("435") ? false : stryMutAct_9fa48("434") ? true : (stryCov_9fa48("434", "435", "436"), routingStage.stage === (stryMutAct_9fa48("437") ? "" : (stryCov_9fa48("437"), 'emergency')))) ? getEmergencyFallbackModels(routingStage.useCase) : await getModelsForUseCase(routingStage.useCase);
          if (stryMutAct_9fa48("440") ? stageModels.length !== 0 : stryMutAct_9fa48("439") ? false : stryMutAct_9fa48("438") ? true : (stryCov_9fa48("438", "439", "440"), stageModels.length === 0)) {
            if (stryMutAct_9fa48("441")) {
              {}
            } else {
              stryCov_9fa48("441");
              continue;
            }
          }
          if (stryMutAct_9fa48("444") ? routingStage.stage !== 'secondary' : stryMutAct_9fa48("443") ? false : stryMutAct_9fa48("442") ? true : (stryCov_9fa48("442", "443", "444"), routingStage.stage === (stryMutAct_9fa48("445") ? "" : (stryCov_9fa48("445"), 'secondary')))) {
            if (stryMutAct_9fa48("446")) {
              {}
            } else {
              stryCov_9fa48("446");
              console.warn(stryMutAct_9fa48("447") ? `` : (stryCov_9fa48("447"), `[UnifiedAIClient] Primary ${useCase} routing exhausted, entering deterministic secondary stage (${routingStage.useCase}).`));
            }
          }
          if (stryMutAct_9fa48("450") ? routingStage.stage !== 'emergency' : stryMutAct_9fa48("449") ? false : stryMutAct_9fa48("448") ? true : (stryCov_9fa48("448", "449", "450"), routingStage.stage === (stryMutAct_9fa48("451") ? "" : (stryCov_9fa48("451"), 'emergency')))) {
            if (stryMutAct_9fa48("452")) {
              {}
            } else {
              stryCov_9fa48("452");
              console.warn(stryMutAct_9fa48("453") ? `` : (stryCov_9fa48("453"), `[UnifiedAIClient] Entering emergency fallback stage for ${routingStage.useCase}.`));
            }
          }
          for (const routed of stageModels) {
            if (stryMutAct_9fa48("454")) {
              {}
            } else {
              stryCov_9fa48("454");
              if (stryMutAct_9fa48("456") ? false : stryMutAct_9fa48("455") ? true : (stryCov_9fa48("455", "456"), attemptedModels.includes(routed.modelId))) continue;
              const modelConfig = resolveToModelConfig(routed);
              const rateLimit = await this.rateLimiter.canUseModel(modelConfig.id, allActiveModels, options.estimatedTokens);
              if (stryMutAct_9fa48("459") ? false : stryMutAct_9fa48("458") ? true : stryMutAct_9fa48("457") ? rateLimit.allowed : (stryCov_9fa48("457", "458", "459"), !rateLimit.allowed)) continue;
              const maxTokens = stryMutAct_9fa48("460") ? routed.maxTokensOverride && options.maxTokens : (stryCov_9fa48("460"), routed.maxTokensOverride ?? options.maxTokens);
              const result = await this.callModel(modelConfig, messages, stryMutAct_9fa48("461") ? {} : (stryCov_9fa48("461"), {
                ...options,
                maxTokens,
                correlationId
              }));
              attemptedModels.push(modelConfig.id);
              if (stryMutAct_9fa48("463") ? false : stryMutAct_9fa48("462") ? true : (stryCov_9fa48("462", "463"), result.success)) {
                if (stryMutAct_9fa48("464")) {
                  {}
                } else {
                  stryCov_9fa48("464");
                  const tokensUsed = Math.ceil(stryMutAct_9fa48("465") ? (result.response?.length || 0) * 4 : (stryCov_9fa48("465"), (stryMutAct_9fa48("468") ? result.response?.length && 0 : stryMutAct_9fa48("467") ? false : stryMutAct_9fa48("466") ? true : (stryCov_9fa48("466", "467", "468"), (stryMutAct_9fa48("469") ? result.response.length : (stryCov_9fa48("469"), result.response?.length)) || 0)) / 4));
                  this.rateLimiter.recordRequest(modelConfig.id, tokensUsed);
                  if (stryMutAct_9fa48("472") ? options.userId && options.sessionId || tokensUsed > 0 : stryMutAct_9fa48("471") ? false : stryMutAct_9fa48("470") ? true : (stryCov_9fa48("470", "471", "472"), (stryMutAct_9fa48("474") ? options.userId || options.sessionId : stryMutAct_9fa48("473") ? true : (stryCov_9fa48("473", "474"), options.userId && options.sessionId)) && (stryMutAct_9fa48("477") ? tokensUsed <= 0 : stryMutAct_9fa48("476") ? tokensUsed >= 0 : stryMutAct_9fa48("475") ? true : (stryCov_9fa48("475", "476", "477"), tokensUsed > 0)))) {
                    if (stryMutAct_9fa48("478")) {
                      {}
                    } else {
                      stryCov_9fa48("478");
                      void recordTokenUsage(options.userId, options.sessionId, tokensUsed);
                    }
                  }
                  void logSystemEvent(stryMutAct_9fa48("479") ? {} : (stryCov_9fa48("479"), {
                    type: stryMutAct_9fa48("480") ? "" : (stryCov_9fa48("480"), 'llm_request'),
                    correlationId,
                    metadata: stryMutAct_9fa48("481") ? {} : (stryCov_9fa48("481"), {
                      useCase,
                      model_id: modelConfig.id,
                      provider: modelConfig.provider,
                      duration_ms: stryMutAct_9fa48("482") ? Date.now() + callStart : (stryCov_9fa48("482"), Date.now() - callStart),
                      messageCount: messages.length
                    })
                  }));
                  return stryMutAct_9fa48("483") ? {} : (stryCov_9fa48("483"), {
                    success: stryMutAct_9fa48("484") ? false : (stryCov_9fa48("484"), true),
                    modelUsed: modelConfig.id,
                    provider: modelConfig.provider,
                    response: result.response,
                    attemptedModels
                  });
                }
              }
              this.rateLimiter.recordError(modelConfig.id, result.error);
              console.warn(stryMutAct_9fa48("485") ? `` : (stryCov_9fa48("485"), `[UnifiedAIClient] Model ${modelConfig.id} failed: ${result.error}`));
            }
          }
        }
      }
      return stryMutAct_9fa48("486") ? {} : (stryCov_9fa48("486"), {
        success: stryMutAct_9fa48("487") ? true : (stryCov_9fa48("487"), false),
        error: stryMutAct_9fa48("488") ? "" : (stryCov_9fa48("488"), "All allowed models failed."),
        attemptedModels
      });
    }
  }

  /**
   * Try all available models for a specific provider
   */
  async tryProvider(provider: Provider, messages: Message[], options: CompletionOptions, attemptedModels: string[], activeModels: ModelConfig[]): Promise<CompletionResult> {
    if (stryMutAct_9fa48("489")) {
      {}
    } else {
      stryCov_9fa48("489");
      // Get models for this provider
      const models = stryMutAct_9fa48("490") ? activeModels : (stryCov_9fa48("490"), activeModels.filter(stryMutAct_9fa48("491") ? () => undefined : (stryCov_9fa48("491"), m => stryMutAct_9fa48("494") ? m.provider !== provider : stryMutAct_9fa48("493") ? false : stryMutAct_9fa48("492") ? true : (stryCov_9fa48("492", "493", "494"), m.provider === provider))));

      // Sort by tier (lower is better/higher priority)
      stryMutAct_9fa48("495") ? models : (stryCov_9fa48("495"), models.sort(stryMutAct_9fa48("496") ? () => undefined : (stryCov_9fa48("496"), (a, b) => stryMutAct_9fa48("497") ? a.tier + b.tier : (stryCov_9fa48("497"), a.tier - b.tier))));
      for (const model of models) {
        if (stryMutAct_9fa48("498")) {
          {}
        } else {
          stryCov_9fa48("498");
          // Check Rate Limiter
          const rateLimit = await this.rateLimiter.canUseModel(model.id, activeModels, options.estimatedTokens);
          if (stryMutAct_9fa48("501") ? false : stryMutAct_9fa48("500") ? true : stryMutAct_9fa48("499") ? rateLimit.allowed : (stryCov_9fa48("499", "500", "501"), !rateLimit.allowed)) {
            if (stryMutAct_9fa48("502")) {
              {}
            } else {
              stryCov_9fa48("502");
              continue;
            }
          }

          // Attempt Call
          const result = await this.callModel(model, messages, options);
          attemptedModels.push(model.id);
          if (stryMutAct_9fa48("504") ? false : stryMutAct_9fa48("503") ? true : (stryCov_9fa48("503", "504"), result.success)) {
            if (stryMutAct_9fa48("505")) {
              {}
            } else {
              stryCov_9fa48("505");
              // Record Success
              // Estimate tokens from response length if not provided (4 chars ~= 1 token)
              const tokensUsed = Math.ceil(stryMutAct_9fa48("506") ? (result.response?.length || 0) * 4 : (stryCov_9fa48("506"), (stryMutAct_9fa48("509") ? result.response?.length && 0 : stryMutAct_9fa48("508") ? false : stryMutAct_9fa48("507") ? true : (stryCov_9fa48("507", "508", "509"), (stryMutAct_9fa48("510") ? result.response.length : (stryCov_9fa48("510"), result.response?.length)) || 0)) / 4));
              this.rateLimiter.recordRequest(model.id, tokensUsed);
              if (stryMutAct_9fa48("513") ? options.userId && options.sessionId || tokensUsed > 0 : stryMutAct_9fa48("512") ? false : stryMutAct_9fa48("511") ? true : (stryCov_9fa48("511", "512", "513"), (stryMutAct_9fa48("515") ? options.userId || options.sessionId : stryMutAct_9fa48("514") ? true : (stryCov_9fa48("514", "515"), options.userId && options.sessionId)) && (stryMutAct_9fa48("518") ? tokensUsed <= 0 : stryMutAct_9fa48("517") ? tokensUsed >= 0 : stryMutAct_9fa48("516") ? true : (stryCov_9fa48("516", "517", "518"), tokensUsed > 0)))) {
                if (stryMutAct_9fa48("519")) {
                  {}
                } else {
                  stryCov_9fa48("519");
                  void recordTokenUsage(options.userId, options.sessionId, tokensUsed);
                }
              }
              return stryMutAct_9fa48("520") ? {} : (stryCov_9fa48("520"), {
                success: stryMutAct_9fa48("521") ? false : (stryCov_9fa48("521"), true),
                modelUsed: model.id,
                provider: model.provider,
                response: result.response,
                attemptedModels
              });
            }
          } else {
            if (stryMutAct_9fa48("522")) {
              {}
            } else {
              stryCov_9fa48("522");
              // Record Failure
              this.rateLimiter.recordError(model.id, result.error);
              console.warn(stryMutAct_9fa48("523") ? `` : (stryCov_9fa48("523"), `[UnifiedAIClient] Model ${model.id} failed: ${result.error}`));
            }
          }
        }
      }
      return stryMutAct_9fa48("524") ? {} : (stryCov_9fa48("524"), {
        success: stryMutAct_9fa48("525") ? true : (stryCov_9fa48("525"), false),
        attemptedModels
      });
    }
  }

  /**
   * Execute specific model call via Fetch
   */
  async callModel(model: ModelConfig, messages: Message[], options: CompletionOptions): Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }> {
    if (stryMutAct_9fa48("526")) {
      {}
    } else {
      stryCov_9fa48("526");
      try {
        if (stryMutAct_9fa48("527")) {
          {}
        } else {
          stryCov_9fa48("527");
          if (stryMutAct_9fa48("530") ? model.provider !== 'groq' : stryMutAct_9fa48("529") ? false : stryMutAct_9fa48("528") ? true : (stryCov_9fa48("528", "529", "530"), model.provider === (stryMutAct_9fa48("531") ? "" : (stryCov_9fa48("531"), 'groq')))) {
            if (stryMutAct_9fa48("532")) {
              {}
            } else {
              stryCov_9fa48("532");
              return await this.callGroq(model.id, messages, options);
            }
          } else if (stryMutAct_9fa48("535") ? model.provider !== 'gemini' : stryMutAct_9fa48("534") ? false : stryMutAct_9fa48("533") ? true : (stryCov_9fa48("533", "534", "535"), model.provider === (stryMutAct_9fa48("536") ? "" : (stryCov_9fa48("536"), 'gemini')))) {
            if (stryMutAct_9fa48("537")) {
              {}
            } else {
              stryCov_9fa48("537");
              return await this.callGemini(model.id, messages, options);
            }
          } else if (stryMutAct_9fa48("540") ? model.provider !== 'bedrock' : stryMutAct_9fa48("539") ? false : stryMutAct_9fa48("538") ? true : (stryCov_9fa48("538", "539", "540"), model.provider === (stryMutAct_9fa48("541") ? "" : (stryCov_9fa48("541"), 'bedrock')))) {
            if (stryMutAct_9fa48("542")) {
              {}
            } else {
              stryCov_9fa48("542");
              const {
                callBedrockModel
              } = await import('./bedrock-client');
              const response = await callBedrockModel(model.id, messages, options.systemPrompt, options.maxTokens, options.signal);
              return stryMutAct_9fa48("543") ? {} : (stryCov_9fa48("543"), {
                success: stryMutAct_9fa48("544") ? false : (stryCov_9fa48("544"), true),
                response
              });
            }
          }
          return stryMutAct_9fa48("545") ? {} : (stryCov_9fa48("545"), {
            success: stryMutAct_9fa48("546") ? true : (stryCov_9fa48("546"), false),
            error: stryMutAct_9fa48("547") ? "" : (stryCov_9fa48("547"), "Unsupported provider")
          });
        }
      } catch (error) {
        if (stryMutAct_9fa48("548")) {
          {}
        } else {
          stryCov_9fa48("548");
          if (stryMutAct_9fa48("551") ? error instanceof Error || error.name === 'TimeoutError' : stryMutAct_9fa48("550") ? false : stryMutAct_9fa48("549") ? true : (stryCov_9fa48("549", "550", "551"), error instanceof Error && (stryMutAct_9fa48("553") ? error.name !== 'TimeoutError' : stryMutAct_9fa48("552") ? true : (stryCov_9fa48("552", "553"), error.name === (stryMutAct_9fa48("554") ? "" : (stryCov_9fa48("554"), 'TimeoutError')))))) {
            if (stryMutAct_9fa48("555")) {
              {}
            } else {
              stryCov_9fa48("555");
              void logSystemEvent(stryMutAct_9fa48("556") ? {} : (stryCov_9fa48("556"), {
                type: stryMutAct_9fa48("557") ? "" : (stryCov_9fa48("557"), 'model_timeout'),
                provider: model.provider,
                modelId: model.id,
                correlationId: options.correlationId
              }));
              return stryMutAct_9fa48("558") ? {} : (stryCov_9fa48("558"), {
                success: stryMutAct_9fa48("559") ? true : (stryCov_9fa48("559"), false),
                error: stryMutAct_9fa48("560") ? `` : (stryCov_9fa48("560"), `Request timeout after ${(stryMutAct_9fa48("563") ? model.provider !== 'groq' : stryMutAct_9fa48("562") ? false : stryMutAct_9fa48("561") ? true : (stryCov_9fa48("561", "562", "563"), model.provider === (stryMutAct_9fa48("564") ? "" : (stryCov_9fa48("564"), 'groq')))) ? stryMutAct_9fa48("565") ? "" : (stryCov_9fa48("565"), '15') : (stryMutAct_9fa48("568") ? model.provider !== 'gemini' : stryMutAct_9fa48("567") ? false : stryMutAct_9fa48("566") ? true : (stryCov_9fa48("566", "567", "568"), model.provider === (stryMutAct_9fa48("569") ? "" : (stryCov_9fa48("569"), 'gemini')))) ? stryMutAct_9fa48("570") ? "" : (stryCov_9fa48("570"), '25') : stryMutAct_9fa48("571") ? "" : (stryCov_9fa48("571"), '30')}s`)
              });
            }
          }
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorCodeMatch = errorMessage.match(stryMutAct_9fa48("573") ? /\((\D{3})\)/ : stryMutAct_9fa48("572") ? /\((\d)\)/ : (stryCov_9fa48("572", "573"), /\((\d{3})\)/));
          const errorCode = errorCodeMatch ? errorCodeMatch[1] : undefined;
          if (stryMutAct_9fa48("576") ? errorCode !== '429' : stryMutAct_9fa48("575") ? false : stryMutAct_9fa48("574") ? true : (stryCov_9fa48("574", "575", "576"), errorCode === (stryMutAct_9fa48("577") ? "" : (stryCov_9fa48("577"), '429')))) {
            if (stryMutAct_9fa48("578")) {
              {}
            } else {
              stryCov_9fa48("578");
              void logSystemEvent(stryMutAct_9fa48("579") ? {} : (stryCov_9fa48("579"), {
                type: stryMutAct_9fa48("580") ? "" : (stryCov_9fa48("580"), 'model_429'),
                provider: model.provider,
                modelId: model.id,
                errorCode: stryMutAct_9fa48("581") ? "" : (stryCov_9fa48("581"), '429'),
                correlationId: options.correlationId
              }));
            }
          } else if (stryMutAct_9fa48("584") ? errorCode !== '404' : stryMutAct_9fa48("583") ? false : stryMutAct_9fa48("582") ? true : (stryCov_9fa48("582", "583", "584"), errorCode === (stryMutAct_9fa48("585") ? "" : (stryCov_9fa48("585"), '404')))) {
            if (stryMutAct_9fa48("586")) {
              {}
            } else {
              stryCov_9fa48("586");
              void logSystemEvent(stryMutAct_9fa48("587") ? {} : (stryCov_9fa48("587"), {
                type: stryMutAct_9fa48("588") ? "" : (stryCov_9fa48("588"), 'model_deprecated'),
                provider: model.provider,
                modelId: model.id,
                errorCode: stryMutAct_9fa48("589") ? "" : (stryCov_9fa48("589"), '404'),
                correlationId: options.correlationId
              }));
            }
          } else if (stryMutAct_9fa48("592") ? errorMessage.toLowerCase().includes('timeout') && errorMessage.toLowerCase().includes('fetch failed') : stryMutAct_9fa48("591") ? false : stryMutAct_9fa48("590") ? true : (stryCov_9fa48("590", "591", "592"), (stryMutAct_9fa48("593") ? errorMessage.toUpperCase().includes('timeout') : (stryCov_9fa48("593"), errorMessage.toLowerCase().includes(stryMutAct_9fa48("594") ? "" : (stryCov_9fa48("594"), 'timeout')))) || (stryMutAct_9fa48("595") ? errorMessage.toUpperCase().includes('fetch failed') : (stryCov_9fa48("595"), errorMessage.toLowerCase().includes(stryMutAct_9fa48("596") ? "" : (stryCov_9fa48("596"), 'fetch failed')))))) {
            if (stryMutAct_9fa48("597")) {
              {}
            } else {
              stryCov_9fa48("597");
              void logSystemEvent(stryMutAct_9fa48("598") ? {} : (stryCov_9fa48("598"), {
                type: stryMutAct_9fa48("599") ? "" : (stryCov_9fa48("599"), 'model_timeout'),
                provider: model.provider,
                modelId: model.id,
                correlationId: options.correlationId
              }));
            }
          } else {
            if (stryMutAct_9fa48("600")) {
              {}
            } else {
              stryCov_9fa48("600");
              void logSystemEvent(stryMutAct_9fa48("601") ? {} : (stryCov_9fa48("601"), {
                type: stryMutAct_9fa48("602") ? "" : (stryCov_9fa48("602"), 'model_error'),
                provider: model.provider,
                modelId: model.id,
                errorMessage,
                correlationId: options.correlationId
              }));
            }
          }
          return stryMutAct_9fa48("603") ? {} : (stryCov_9fa48("603"), {
            success: stryMutAct_9fa48("604") ? true : (stryCov_9fa48("604"), false),
            error: errorMessage
          });
        }
      }
    }
  }

  /**
   * Call Groq API
   */
  private async callGroq(modelId: string, messages: Message[], options: CompletionOptions) {
    if (stryMutAct_9fa48("605")) {
      {}
    } else {
      stryCov_9fa48("605");
      if (stryMutAct_9fa48("608") ? false : stryMutAct_9fa48("607") ? true : stryMutAct_9fa48("606") ? process.env.GROQ_API_KEY : (stryCov_9fa48("606", "607", "608"), !process.env.GROQ_API_KEY)) return stryMutAct_9fa48("609") ? {} : (stryCov_9fa48("609"), {
        success: stryMutAct_9fa48("610") ? true : (stryCov_9fa48("610"), false),
        error: stryMutAct_9fa48("611") ? "" : (stryCov_9fa48("611"), "Missing GROQ_API_KEY")
      });
      const systemPrompt = options.systemPrompt;
      const apiMessages = stryMutAct_9fa48("612") ? [] : (stryCov_9fa48("612"), [...messages]);

      // Prepend system prompt if exists and not already in messages
      if (stryMutAct_9fa48("615") ? systemPrompt || apiMessages[0]?.role !== 'system' : stryMutAct_9fa48("614") ? false : stryMutAct_9fa48("613") ? true : (stryCov_9fa48("613", "614", "615"), systemPrompt && (stryMutAct_9fa48("617") ? apiMessages[0]?.role === 'system' : stryMutAct_9fa48("616") ? true : (stryCov_9fa48("616", "617"), (stryMutAct_9fa48("618") ? apiMessages[0].role : (stryCov_9fa48("618"), apiMessages[0]?.role)) !== (stryMutAct_9fa48("619") ? "" : (stryCov_9fa48("619"), 'system')))))) {
        if (stryMutAct_9fa48("620")) {
          {}
        } else {
          stryCov_9fa48("620");
          apiMessages.unshift(stryMutAct_9fa48("621") ? {} : (stryCov_9fa48("621"), {
            role: stryMutAct_9fa48("622") ? "" : (stryCov_9fa48("622"), 'system'),
            content: systemPrompt
          }));
        }
      }
      const body: Record<string, unknown> = stryMutAct_9fa48("623") ? {} : (stryCov_9fa48("623"), {
        model: modelId,
        messages: apiMessages,
        max_tokens: options.maxTokens,
        temperature: stryMutAct_9fa48("624") ? options.temperature && 0.7 : (stryCov_9fa48("624"), options.temperature ?? 0.7)
      });
      if (stryMutAct_9fa48("626") ? false : stryMutAct_9fa48("625") ? true : (stryCov_9fa48("625", "626"), options.responseFormat)) {
        if (stryMutAct_9fa48("627")) {
          {}
        } else {
          stryCov_9fa48("627");
          body.response_format = options.responseFormat;
        }
      }
      const response = await fetch(this.GROQ_API_URL, stryMutAct_9fa48("628") ? {} : (stryCov_9fa48("628"), {
        method: stryMutAct_9fa48("629") ? "" : (stryCov_9fa48("629"), "POST"),
        headers: stryMutAct_9fa48("630") ? {} : (stryCov_9fa48("630"), {
          "Authorization": stryMutAct_9fa48("631") ? `` : (stryCov_9fa48("631"), `Bearer ${process.env.GROQ_API_KEY}`),
          "Content-Type": stryMutAct_9fa48("632") ? "" : (stryCov_9fa48("632"), "application/json")
        }),
        body: JSON.stringify(body),
        signal: stryMutAct_9fa48("633") ? options.signal && AbortSignal.timeout(15000) : (stryCov_9fa48("633"), options.signal ?? AbortSignal.timeout(15000))
      }));
      if (stryMutAct_9fa48("636") ? false : stryMutAct_9fa48("635") ? true : stryMutAct_9fa48("634") ? response.ok : (stryCov_9fa48("634", "635", "636"), !response.ok)) {
        if (stryMutAct_9fa48("637")) {
          {}
        } else {
          stryCov_9fa48("637");
          const err = await response.text();
          throw new Error(stryMutAct_9fa48("638") ? `` : (stryCov_9fa48("638"), `Groq API Error (${response.status}): ${err}`));
        }
      }
      const data = await response.json();
      const content = stryMutAct_9fa48("641") ? data.choices[0]?.message?.content : stryMutAct_9fa48("640") ? data.choices?.[0].message?.content : stryMutAct_9fa48("639") ? data.choices?.[0]?.message.content : (stryCov_9fa48("639", "640", "641"), data.choices?.[0]?.message?.content);
      if (stryMutAct_9fa48("644") ? false : stryMutAct_9fa48("643") ? true : stryMutAct_9fa48("642") ? content : (stryCov_9fa48("642", "643", "644"), !content)) return stryMutAct_9fa48("645") ? {} : (stryCov_9fa48("645"), {
        success: stryMutAct_9fa48("646") ? true : (stryCov_9fa48("646"), false),
        error: stryMutAct_9fa48("647") ? "" : (stryCov_9fa48("647"), "Empty response from Groq")
      });
      return stryMutAct_9fa48("648") ? {} : (stryCov_9fa48("648"), {
        success: stryMutAct_9fa48("649") ? false : (stryCov_9fa48("649"), true),
        response: content
      });
    }
  }

  /**
   * Call Gemini API
   */
  private async callGemini(modelId: string, messages: Message[], options: CompletionOptions) {
    if (stryMutAct_9fa48("650")) {
      {}
    } else {
      stryCov_9fa48("650");
      const apiKey = stryMutAct_9fa48("653") ? process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY : stryMutAct_9fa48("652") ? false : stryMutAct_9fa48("651") ? true : (stryCov_9fa48("651", "652", "653"), process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      if (stryMutAct_9fa48("656") ? false : stryMutAct_9fa48("655") ? true : stryMutAct_9fa48("654") ? apiKey : (stryCov_9fa48("654", "655", "656"), !apiKey)) return stryMutAct_9fa48("657") ? {} : (stryCov_9fa48("657"), {
        success: stryMutAct_9fa48("658") ? true : (stryCov_9fa48("658"), false),
        error: stryMutAct_9fa48("659") ? "" : (stryCov_9fa48("659"), "Missing GEMINI_API_KEY or GOOGLE_API_KEY")
      });
      const url = stryMutAct_9fa48("660") ? `` : (stryCov_9fa48("660"), `${this.GEMINI_API_BASE}/${modelId}:generateContent?key=${apiKey}`);

      // Convert messages to Gemini format
      // System prompt is separate in v1beta
      const contents = stryMutAct_9fa48("661") ? messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{
          text: m.content
        }]
      })) : (stryCov_9fa48("661"), messages.filter(stryMutAct_9fa48("662") ? () => undefined : (stryCov_9fa48("662"), m => stryMutAct_9fa48("665") ? m.role === 'system' : stryMutAct_9fa48("664") ? false : stryMutAct_9fa48("663") ? true : (stryCov_9fa48("663", "664", "665"), m.role !== (stryMutAct_9fa48("666") ? "" : (stryCov_9fa48("666"), 'system'))))).map(stryMutAct_9fa48("667") ? () => undefined : (stryCov_9fa48("667"), m => stryMutAct_9fa48("668") ? {} : (stryCov_9fa48("668"), {
        role: (stryMutAct_9fa48("671") ? m.role !== 'assistant' : stryMutAct_9fa48("670") ? false : stryMutAct_9fa48("669") ? true : (stryCov_9fa48("669", "670", "671"), m.role === (stryMutAct_9fa48("672") ? "" : (stryCov_9fa48("672"), 'assistant')))) ? stryMutAct_9fa48("673") ? "" : (stryCov_9fa48("673"), 'model') : stryMutAct_9fa48("674") ? "" : (stryCov_9fa48("674"), 'user'),
        parts: stryMutAct_9fa48("675") ? [] : (stryCov_9fa48("675"), [stryMutAct_9fa48("676") ? {} : (stryCov_9fa48("676"), {
          text: m.content
        })])
      }))));
      const systemInstruction = options.systemPrompt ? stryMutAct_9fa48("677") ? {} : (stryCov_9fa48("677"), {
        parts: stryMutAct_9fa48("678") ? [] : (stryCov_9fa48("678"), [stryMutAct_9fa48("679") ? {} : (stryCov_9fa48("679"), {
          text: options.systemPrompt
        })])
      }) : messages.find(stryMutAct_9fa48("680") ? () => undefined : (stryCov_9fa48("680"), m => stryMutAct_9fa48("683") ? m.role !== 'system' : stryMutAct_9fa48("682") ? false : stryMutAct_9fa48("681") ? true : (stryCov_9fa48("681", "682", "683"), m.role === (stryMutAct_9fa48("684") ? "" : (stryCov_9fa48("684"), 'system'))))) ? stryMutAct_9fa48("685") ? {} : (stryCov_9fa48("685"), {
        parts: stryMutAct_9fa48("686") ? [] : (stryCov_9fa48("686"), [stryMutAct_9fa48("687") ? {} : (stryCov_9fa48("687"), {
          text: messages.find(stryMutAct_9fa48("688") ? () => undefined : (stryCov_9fa48("688"), m => stryMutAct_9fa48("691") ? m.role !== 'system' : stryMutAct_9fa48("690") ? false : stryMutAct_9fa48("689") ? true : (stryCov_9fa48("689", "690", "691"), m.role === (stryMutAct_9fa48("692") ? "" : (stryCov_9fa48("692"), 'system')))))!.content
        })])
      }) : undefined;
      const body: {
        contents: {
          role: string;
          parts: {
            text: string;
          }[];
        }[];
        generationConfig: {
          maxOutputTokens?: number;
          temperature: number;
        };
        systemInstruction?: {
          parts: {
            text: string;
          }[];
        };
      } = stryMutAct_9fa48("693") ? {} : (stryCov_9fa48("693"), {
        contents,
        generationConfig: stryMutAct_9fa48("694") ? {} : (stryCov_9fa48("694"), {
          maxOutputTokens: options.maxTokens,
          temperature: stryMutAct_9fa48("695") ? options.temperature && 0.7 : (stryCov_9fa48("695"), options.temperature ?? 0.7)
        })
      });
      if (stryMutAct_9fa48("697") ? false : stryMutAct_9fa48("696") ? true : (stryCov_9fa48("696", "697"), systemInstruction)) {
        if (stryMutAct_9fa48("698")) {
          {}
        } else {
          stryCov_9fa48("698");
          body.systemInstruction = systemInstruction;
        }
      }
      const response = await fetch(url, stryMutAct_9fa48("699") ? {} : (stryCov_9fa48("699"), {
        method: stryMutAct_9fa48("700") ? "" : (stryCov_9fa48("700"), "POST"),
        headers: stryMutAct_9fa48("701") ? {} : (stryCov_9fa48("701"), {
          "Content-Type": stryMutAct_9fa48("702") ? "" : (stryCov_9fa48("702"), "application/json")
        }),
        body: JSON.stringify(body),
        signal: stryMutAct_9fa48("703") ? options.signal && AbortSignal.timeout(25000) : (stryCov_9fa48("703"), options.signal ?? AbortSignal.timeout(25000))
      }));
      if (stryMutAct_9fa48("706") ? false : stryMutAct_9fa48("705") ? true : stryMutAct_9fa48("704") ? response.ok : (stryCov_9fa48("704", "705", "706"), !response.ok)) {
        if (stryMutAct_9fa48("707")) {
          {}
        } else {
          stryCov_9fa48("707");
          const err = await response.text();
          throw new Error(stryMutAct_9fa48("708") ? `` : (stryCov_9fa48("708"), `Gemini API Error (${response.status}): ${err}`));
        }
      }
      const data = await response.json();
      const content = stryMutAct_9fa48("713") ? data.candidates[0]?.content?.parts?.[0]?.text : stryMutAct_9fa48("712") ? data.candidates?.[0].content?.parts?.[0]?.text : stryMutAct_9fa48("711") ? data.candidates?.[0]?.content.parts?.[0]?.text : stryMutAct_9fa48("710") ? data.candidates?.[0]?.content?.parts[0]?.text : stryMutAct_9fa48("709") ? data.candidates?.[0]?.content?.parts?.[0].text : (stryCov_9fa48("709", "710", "711", "712", "713"), data.candidates?.[0]?.content?.parts?.[0]?.text);
      if (stryMutAct_9fa48("716") ? false : stryMutAct_9fa48("715") ? true : stryMutAct_9fa48("714") ? content : (stryCov_9fa48("714", "715", "716"), !content)) return stryMutAct_9fa48("717") ? {} : (stryCov_9fa48("717"), {
        success: stryMutAct_9fa48("718") ? true : (stryCov_9fa48("718"), false),
        error: stryMutAct_9fa48("719") ? "" : (stryCov_9fa48("719"), "Empty response from Gemini")
      });
      return stryMutAct_9fa48("720") ? {} : (stryCov_9fa48("720"), {
        success: stryMutAct_9fa48("721") ? false : (stryCov_9fa48("721"), true),
        response: content
      });
    }
  }

  /**
   * Helper to try all Groq models specifically
   */
  async tryAllGroqModels(messages: Message[], options: CompletionOptions) {
    if (stryMutAct_9fa48("722")) {
      {}
    } else {
      stryCov_9fa48("722");
      const models = await getActiveModels();
      return this.tryProvider(stryMutAct_9fa48("723") ? "" : (stryCov_9fa48("723"), 'groq'), messages, options, stryMutAct_9fa48("724") ? ["Stryker was here"] : (stryCov_9fa48("724"), []), models);
    }
  }

  // --- Legacy / Compatibility Methods ---

  /**
   * Legacy chat method for backward compatibility
   */
  async chat(messages: Message[], options: {
    preferredTier?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
  } = {}) {
    if (stryMutAct_9fa48("725")) {
      {}
    } else {
      stryCov_9fa48("725");
      const result = await this.generateCompletion(messages, stryMutAct_9fa48("726") ? {} : (stryCov_9fa48("726"), {
        preferredProvider: options.preferredTier ? stryMutAct_9fa48("727") ? "" : (stryCov_9fa48("727"), 'groq') : undefined,
        // loose mapping
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt
      }));
      if (stryMutAct_9fa48("730") ? false : stryMutAct_9fa48("729") ? true : stryMutAct_9fa48("728") ? result.success : (stryCov_9fa48("728", "729", "730"), !result.success)) {
        if (stryMutAct_9fa48("731")) {
          {}
        } else {
          stryCov_9fa48("731");
          throw new Error(stryMutAct_9fa48("734") ? result.error && "Chat generation failed" : stryMutAct_9fa48("733") ? false : stryMutAct_9fa48("732") ? true : (stryCov_9fa48("732", "733", "734"), result.error || (stryMutAct_9fa48("735") ? "" : (stryCov_9fa48("735"), "Chat generation failed"))));
        }
      }

      // Return format expected by legacy code
      return stryMutAct_9fa48("736") ? {} : (stryCov_9fa48("736"), {
        response: result.response,
        modelUsed: result.modelUsed,
        provider: result.provider
      });
    }
  }

  // --- Smart Routing (Intent-Classified) ---

  /**
   * Check if smart routing is enabled via env var.
   * The feature-flags module is 'use client', so we check the env var directly
   * for server-side code.
   */
  private isSmartRoutingEnabled(): boolean {
    if (stryMutAct_9fa48("737")) {
      {}
    } else {
      stryCov_9fa48("737");
      const envVal = process.env.NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING;
      return stryMutAct_9fa48("740") ? envVal === 'true' && envVal === '1' : stryMutAct_9fa48("739") ? false : stryMutAct_9fa48("738") ? true : (stryCov_9fa48("738", "739", "740"), (stryMutAct_9fa48("742") ? envVal !== 'true' : stryMutAct_9fa48("741") ? false : (stryCov_9fa48("741", "742"), envVal === (stryMutAct_9fa48("743") ? "" : (stryCov_9fa48("743"), 'true')))) || (stryMutAct_9fa48("745") ? envVal !== '1' : stryMutAct_9fa48("744") ? false : (stryCov_9fa48("744", "745"), envVal === (stryMutAct_9fa48("746") ? "" : (stryCov_9fa48("746"), '1')))));
    }
  }

  /**
   * Strip internal reasoning tokens from AI output before returning to callers.
   * Handles all known tag variants across providers.
   * Operates on the complete response string — for streaming use the stateful
   * buffer in generateStream() (Phase 2).
   */
  private stripThinkingTokens(raw: string): string {
    if (stryMutAct_9fa48("747")) {
      {}
    } else {
      stryCov_9fa48("747");
      return stryMutAct_9fa48("748") ? raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '') : (stryCov_9fa48("748"), raw.replace(stryMutAct_9fa48("752") ? /<think>[\s\s]*?<\/think>/gi : stryMutAct_9fa48("751") ? /<think>[\S\S]*?<\/think>/gi : stryMutAct_9fa48("750") ? /<think>[^\s\S]*?<\/think>/gi : stryMutAct_9fa48("749") ? /<think>[\s\S]<\/think>/gi : (stryCov_9fa48("749", "750", "751", "752"), /<think>[\s\S]*?<\/think>/gi), stryMutAct_9fa48("753") ? "Stryker was here!" : (stryCov_9fa48("753"), '')).replace(stryMutAct_9fa48("757") ? /<thinking>[\s\s]*?<\/thinking>/gi : stryMutAct_9fa48("756") ? /<thinking>[\S\S]*?<\/thinking>/gi : stryMutAct_9fa48("755") ? /<thinking>[^\s\S]*?<\/thinking>/gi : stryMutAct_9fa48("754") ? /<thinking>[\s\S]<\/thinking>/gi : (stryCov_9fa48("754", "755", "756", "757"), /<thinking>[\s\S]*?<\/thinking>/gi), stryMutAct_9fa48("758") ? "Stryker was here!" : (stryCov_9fa48("758"), '')).replace(stryMutAct_9fa48("762") ? /<reasoning>[\s\s]*?<\/reasoning>/gi : stryMutAct_9fa48("761") ? /<reasoning>[\S\S]*?<\/reasoning>/gi : stryMutAct_9fa48("760") ? /<reasoning>[^\s\S]*?<\/reasoning>/gi : stryMutAct_9fa48("759") ? /<reasoning>[\s\S]<\/reasoning>/gi : (stryCov_9fa48("759", "760", "761", "762"), /<reasoning>[\s\S]*?<\/reasoning>/gi), stryMutAct_9fa48("763") ? "Stryker was here!" : (stryCov_9fa48("763"), '')).trim());
    }
  }

  /**
   * Generate a response with intelligent model routing.
   *
   * When `preferredModel` is `'auto'` (default when smart routing is enabled),
   * the last user message is classified and routed to the optimal provider.
   *
   * Backward-compatible: callers can still pass `'groq'` or `'gemini'` to
   * force a specific provider.
   */
  async generateResponse(messages: Message[], options: GenerateResponseOptions = {}): Promise<AIResponse> {
    if (stryMutAct_9fa48("764")) {
      {}
    } else {
      stryCov_9fa48("764");
      const totalStart = performance.now();

      // Resolve preferred model
      let preferredModel = stryMutAct_9fa48("765") ? options.preferredModel && 'auto' : (stryCov_9fa48("765"), options.preferredModel ?? (stryMutAct_9fa48("766") ? "" : (stryCov_9fa48("766"), 'auto')));

      // If smart routing is disabled, 'auto' falls back to legacy behavior (groq-first)
      if (stryMutAct_9fa48("769") ? preferredModel === 'auto' || !this.isSmartRoutingEnabled() : stryMutAct_9fa48("768") ? false : stryMutAct_9fa48("767") ? true : (stryCov_9fa48("767", "768", "769"), (stryMutAct_9fa48("771") ? preferredModel !== 'auto' : stryMutAct_9fa48("770") ? true : (stryCov_9fa48("770", "771"), preferredModel === (stryMutAct_9fa48("772") ? "" : (stryCov_9fa48("772"), 'auto')))) && (stryMutAct_9fa48("773") ? this.isSmartRoutingEnabled() : (stryCov_9fa48("773"), !this.isSmartRoutingEnabled())))) {
        if (stryMutAct_9fa48("774")) {
          {}
        } else {
          stryCov_9fa48("774");
          preferredModel = stryMutAct_9fa48("775") ? "" : (stryCov_9fa48("775"), 'groq');
        }
      }

      // ── Response Cache check (before any AI call) ─────────────────
      const isProduction = stryMutAct_9fa48("778") ? process.env.NODE_ENV !== 'production' : stryMutAct_9fa48("777") ? false : stryMutAct_9fa48("776") ? true : (stryCov_9fa48("776", "777", "778"), process.env.NODE_ENV === (stryMutAct_9fa48("779") ? "" : (stryCov_9fa48("779"), 'production')));
      const forceEnable = stryMutAct_9fa48("782") ? process.env.CACHE_BACKEND !== 'memory' : stryMutAct_9fa48("781") ? false : stryMutAct_9fa48("780") ? true : (stryCov_9fa48("780", "781", "782"), process.env.CACHE_BACKEND === (stryMutAct_9fa48("783") ? "" : (stryCov_9fa48("783"), 'memory'))); // Escape hatch
      const cacheEnabled = stryMutAct_9fa48("786") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' || process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1' || !isProduction || forceEnable : stryMutAct_9fa48("785") ? false : stryMutAct_9fa48("784") ? true : (stryCov_9fa48("784", "785", "786"), (stryMutAct_9fa48("788") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' && process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1' : stryMutAct_9fa48("787") ? true : (stryCov_9fa48("787", "788"), (stryMutAct_9fa48("790") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE !== 'true' : stryMutAct_9fa48("789") ? false : (stryCov_9fa48("789", "790"), process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === (stryMutAct_9fa48("791") ? "" : (stryCov_9fa48("791"), 'true')))) || (stryMutAct_9fa48("793") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE !== '1' : stryMutAct_9fa48("792") ? false : (stryCov_9fa48("792", "793"), process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === (stryMutAct_9fa48("794") ? "" : (stryCov_9fa48("794"), '1')))))) && (stryMutAct_9fa48("796") ? !isProduction && forceEnable : stryMutAct_9fa48("795") ? true : (stryCov_9fa48("795", "796"), (stryMutAct_9fa48("797") ? isProduction : (stryCov_9fa48("797"), !isProduction)) || forceEnable)));
      if (stryMutAct_9fa48("799") ? false : stryMutAct_9fa48("798") ? true : (stryCov_9fa48("798", "799"), cacheEnabled)) {
        if (stryMutAct_9fa48("800")) {
          {}
        } else {
          stryCov_9fa48("800");
          const cache = getResponseCache();
          const lastUserMsg = stryMutAct_9fa48("801") ? [...messages].find(m => m.role === 'user') : (stryCov_9fa48("801"), (stryMutAct_9fa48("802") ? [] : (stryCov_9fa48("802"), [...messages])).reverse().find(stryMutAct_9fa48("803") ? () => undefined : (stryCov_9fa48("803"), m => stryMutAct_9fa48("806") ? m.role !== 'user' : stryMutAct_9fa48("805") ? false : stryMutAct_9fa48("804") ? true : (stryCov_9fa48("804", "805", "806"), m.role === (stryMutAct_9fa48("807") ? "" : (stryCov_9fa48("807"), 'user'))))));
          const cacheQuery = stryMutAct_9fa48("808") ? lastUserMsg?.content && '' : (stryCov_9fa48("808"), (stryMutAct_9fa48("809") ? lastUserMsg.content : (stryCov_9fa48("809"), lastUserMsg?.content)) ?? (stryMutAct_9fa48("810") ? "Stryker was here!" : (stryCov_9fa48("810"), '')));
          const cacheIdentity: CacheIdentity = stryMutAct_9fa48("811") ? {} : (stryCov_9fa48("811"), {
            modelId: (stryMutAct_9fa48("814") ? preferredModel === 'auto' : stryMutAct_9fa48("813") ? false : stryMutAct_9fa48("812") ? true : (stryCov_9fa48("812", "813", "814"), preferredModel !== (stryMutAct_9fa48("815") ? "" : (stryCov_9fa48("815"), 'auto')))) ? preferredModel : undefined,
            promptVersion: options.promptVersion,
            ragContextHash: options.ragContextHash,
            languageCode: options.languageCode
          });
          const cached = await cache.get(cacheQuery, cacheIdentity);
          if (stryMutAct_9fa48("817") ? false : stryMutAct_9fa48("816") ? true : (stryCov_9fa48("816", "817"), cached)) {
            if (stryMutAct_9fa48("818")) {
              {}
            } else {
              stryCov_9fa48("818");
              const totalTimeMs = stryMutAct_9fa48("819") ? performance.now() + totalStart : (stryCov_9fa48("819"), performance.now() - totalStart);
              console.log((stryMutAct_9fa48("820") ? `` : (stryCov_9fa48("820"), `⚡ [Cache HIT] "${stryMutAct_9fa48("821") ? cacheQuery : (stryCov_9fa48("821"), cacheQuery.slice(0, 50))}" → ${cached.model} `)) + (stryMutAct_9fa48("822") ? `` : (stryCov_9fa48("822"), `(hits: ${cached.hitCount}, saved ~${cached.avgLatency.toFixed(0)}ms)`)));
              return stryMutAct_9fa48("823") ? {} : (stryCov_9fa48("823"), {
                response: this.stripThinkingTokens(cached.response),
                success: stryMutAct_9fa48("824") ? false : (stryCov_9fa48("824"), true),
                modelUsed: cached.model,
                attemptedModels: stryMutAct_9fa48("825") ? ["Stryker was here"] : (stryCov_9fa48("825"), []),
                routing: stryMutAct_9fa48("826") ? {} : (stryCov_9fa48("826"), {
                  classification: stryMutAct_9fa48("827") ? {} : (stryCov_9fa48("827"), {
                    complexity: 'simple' as const,
                    category: 'greeting' as const,
                    confidence: 1.0,
                    suggestedModel: cached.model,
                    reasoning: stryMutAct_9fa48("828") ? "" : (stryCov_9fa48("828"), 'response_cache_hit')
                  }),
                  routedTo: cached.model,
                  classificationTimeMs: 0,
                  totalTimeMs,
                  smartRoutingUsed: stryMutAct_9fa48("829") ? true : (stryCov_9fa48("829"), false)
                })
              });
            }
          }
        }
      }

      // Direct provider override (no classification needed)
      if (stryMutAct_9fa48("832") ? preferredModel === 'auto' : stryMutAct_9fa48("831") ? false : stryMutAct_9fa48("830") ? true : (stryCov_9fa48("830", "831", "832"), preferredModel !== (stryMutAct_9fa48("833") ? "" : (stryCov_9fa48("833"), 'auto')))) {
        if (stryMutAct_9fa48("834")) {
          {}
        } else {
          stryCov_9fa48("834");
          const result = await this.generateCompletion(messages, stryMutAct_9fa48("835") ? {} : (stryCov_9fa48("835"), {
            preferredProvider: preferredModel as Provider,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            systemPrompt: options.systemPrompt,
            estimatedTokens: options.estimatedTokens,
            category: options.category,
            signal: options.signal,
            correlationId: options.correlationId,
            userId: options.userId,
            sessionId: options.sessionId
          }));
          if (stryMutAct_9fa48("837") ? false : stryMutAct_9fa48("836") ? true : (stryCov_9fa48("836", "837"), result.response)) {
            if (stryMutAct_9fa48("838")) {
              {}
            } else {
              stryCov_9fa48("838");
              result.response = this.stripThinkingTokens(result.response);
            }
          }
          return stryMutAct_9fa48("839") ? {} : (stryCov_9fa48("839"), {
            ...result,
            routing: undefined // No smart routing metadata
          });
        }
      }

      // --- Smart Routing: classify and route ---
      const classifier = getIntentClassifier();
      const telemetry = getModelTelemetry();

      // Extract last user message for classification
      const lastUserMsg = stryMutAct_9fa48("840") ? [...messages].find(m => m.role === 'user') : (stryCov_9fa48("840"), (stryMutAct_9fa48("841") ? [] : (stryCov_9fa48("841"), [...messages])).reverse().find(stryMutAct_9fa48("842") ? () => undefined : (stryCov_9fa48("842"), m => stryMutAct_9fa48("845") ? m.role !== 'user' : stryMutAct_9fa48("844") ? false : stryMutAct_9fa48("843") ? true : (stryCov_9fa48("843", "844", "845"), m.role === (stryMutAct_9fa48("846") ? "" : (stryCov_9fa48("846"), 'user'))))));
      const query = stryMutAct_9fa48("847") ? lastUserMsg?.content && '' : (stryCov_9fa48("847"), (stryMutAct_9fa48("848") ? lastUserMsg.content : (stryCov_9fa48("848"), lastUserMsg?.content)) ?? (stryMutAct_9fa48("849") ? "Stryker was here!" : (stryCov_9fa48("849"), '')));

      // Classify intent
      const classifyStart = performance.now();
      const classification = await classifier.classify(query);
      const classificationTimeMs = stryMutAct_9fa48("850") ? performance.now() + classifyStart : (stryCov_9fa48("850"), performance.now() - classifyStart);
      const routedTo = classification.suggestedModel;
      console.log((stryMutAct_9fa48("851") ? `` : (stryCov_9fa48("851"), `🧠 [SmartRouting] "${stryMutAct_9fa48("852") ? query : (stryCov_9fa48("852"), query.slice(0, 60))}${(stryMutAct_9fa48("856") ? query.length <= 60 : stryMutAct_9fa48("855") ? query.length >= 60 : stryMutAct_9fa48("854") ? false : stryMutAct_9fa48("853") ? true : (stryCov_9fa48("853", "854", "855", "856"), query.length > 60)) ? stryMutAct_9fa48("857") ? "" : (stryCov_9fa48("857"), '...') : stryMutAct_9fa48("858") ? "Stryker was here!" : (stryCov_9fa48("858"), '')}" → `)) + (stryMutAct_9fa48("859") ? `` : (stryCov_9fa48("859"), `${classification.complexity}/${classification.category} → ${routedTo} `)) + (stryMutAct_9fa48("860") ? `` : (stryCov_9fa48("860"), `(conf: ${classification.confidence.toFixed(2)}, ${classificationTimeMs.toFixed(1)}ms)`)));

      // Streaming optimization: simple queries skip streaming for lower latency

      // Try routed provider first
      let result = await this.generateCompletion(messages, stryMutAct_9fa48("861") ? {} : (stryCov_9fa48("861"), {
        preferredProvider: routedTo as Provider,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        systemPrompt: options.systemPrompt,
        estimatedTokens: options.estimatedTokens,
        category: options.category,
        signal: options.signal,
        correlationId: options.correlationId,
        userId: options.userId,
        sessionId: options.sessionId
      }));

      // Fallback: if routed provider failed, try the alternate (only if it was gemini)
      if (stryMutAct_9fa48("864") ? !result.success || routedTo === 'gemini' : stryMutAct_9fa48("863") ? false : stryMutAct_9fa48("862") ? true : (stryCov_9fa48("862", "863", "864"), (stryMutAct_9fa48("865") ? result.success : (stryCov_9fa48("865"), !result.success)) && (stryMutAct_9fa48("867") ? routedTo !== 'gemini' : stryMutAct_9fa48("866") ? true : (stryCov_9fa48("866", "867"), routedTo === (stryMutAct_9fa48("868") ? "" : (stryCov_9fa48("868"), 'gemini')))))) {
        if (stryMutAct_9fa48("869")) {
          {}
        } else {
          stryCov_9fa48("869");
          const fallbackProvider = stryMutAct_9fa48("870") ? "" : (stryCov_9fa48("870"), 'groq');
          console.warn(stryMutAct_9fa48("871") ? `` : (stryCov_9fa48("871"), `⚠️ [SmartRouting] ${routedTo} failed, falling back to ${fallbackProvider}`));
          result = await this.generateCompletion(messages, stryMutAct_9fa48("872") ? {} : (stryCov_9fa48("872"), {
            preferredProvider: fallbackProvider as Provider,
            maxTokens: options.maxTokens,
            temperature: options.temperature,
            systemPrompt: options.systemPrompt,
            estimatedTokens: options.estimatedTokens,
            category: options.category,
            signal: options.signal,
            correlationId: options.correlationId,
            userId: options.userId,
            sessionId: options.sessionId
          }));
        }
      }
      const totalTimeMs = stryMutAct_9fa48("873") ? performance.now() + totalStart : (stryCov_9fa48("873"), performance.now() - totalStart);

      // Record telemetry
      telemetry.recordDecision(stryMutAct_9fa48("874") ? {} : (stryCov_9fa48("874"), {
        timestamp: Date.now(),
        query,
        complexity: classification.complexity,
        category: classification.category,
        confidence: classification.confidence,
        routedTo,
        actualModel: stryMutAct_9fa48("877") ? result.modelUsed && 'unknown' : stryMutAct_9fa48("876") ? false : stryMutAct_9fa48("875") ? true : (stryCov_9fa48("875", "876", "877"), result.modelUsed || (stryMutAct_9fa48("878") ? "" : (stryCov_9fa48("878"), 'unknown'))),
        smartRouting: stryMutAct_9fa48("879") ? false : (stryCov_9fa48("879"), true),
        classificationTimeMs,
        totalTimeMs,
        success: result.success
      }));
      if (stryMutAct_9fa48("881") ? false : stryMutAct_9fa48("880") ? true : (stryCov_9fa48("880", "881"), result.response)) {
        if (stryMutAct_9fa48("882")) {
          {}
        } else {
          stryCov_9fa48("882");
          result.response = this.stripThinkingTokens(result.response);
        }
      }
      return stryMutAct_9fa48("883") ? {} : (stryCov_9fa48("883"), {
        ...result,
        routing: stryMutAct_9fa48("884") ? {} : (stryCov_9fa48("884"), {
          classification,
          routedTo,
          classificationTimeMs,
          totalTimeMs,
          smartRoutingUsed: stryMutAct_9fa48("885") ? false : (stryCov_9fa48("885"), true)
        })
      });
    }
  }

  // ─── Streaming (Phase 2) ────────────────────────────────────────────
  //
  // generateStream() yields AI response chunks as they arrive from the
  // provider. Think/reasoning tags are filtered with a stateful buffer
  // so tag boundaries split across chunks are handled correctly.
  //
  // Caller is responsible for assembling chunks into a full response.

  /**
   * Stream AI response tokens. Async generator — use `for await`.
   * Strips <think>, <thinking>, <reasoning> across chunk boundaries.
   */
  async *generateStream(messages: Message[], options: Pick<GenerateResponseOptions, 'systemPrompt' | 'maxTokens' | 'temperature' | 'signal' | 'correlationId' | 'userId' | 'sessionId'> & {
    preferredModel?: 'groq' | 'gemini' | 'bedrock' | 'auto';
  } = {}): AsyncGenerator<string> {
    if (stryMutAct_9fa48("886")) {
      {}
    } else {
      stryCov_9fa48("886");
      const preferredModel = stryMutAct_9fa48("887") ? options.preferredModel && 'groq' : (stryCov_9fa48("887"), options.preferredModel ?? (stryMutAct_9fa48("888") ? "" : (stryCov_9fa48("888"), 'groq')));
      let provider: 'groq' | 'gemini' | 'bedrock' = stryMutAct_9fa48("889") ? "" : (stryCov_9fa48("889"), 'groq');
      if (stryMutAct_9fa48("892") ? (preferredModel === 'groq' || preferredModel === 'gemini') && preferredModel === 'bedrock' : stryMutAct_9fa48("891") ? false : stryMutAct_9fa48("890") ? true : (stryCov_9fa48("890", "891", "892"), (stryMutAct_9fa48("894") ? preferredModel === 'groq' && preferredModel === 'gemini' : stryMutAct_9fa48("893") ? false : (stryCov_9fa48("893", "894"), (stryMutAct_9fa48("896") ? preferredModel !== 'groq' : stryMutAct_9fa48("895") ? false : (stryCov_9fa48("895", "896"), preferredModel === (stryMutAct_9fa48("897") ? "" : (stryCov_9fa48("897"), 'groq')))) || (stryMutAct_9fa48("899") ? preferredModel !== 'gemini' : stryMutAct_9fa48("898") ? false : (stryCov_9fa48("898", "899"), preferredModel === (stryMutAct_9fa48("900") ? "" : (stryCov_9fa48("900"), 'gemini')))))) || (stryMutAct_9fa48("902") ? preferredModel !== 'bedrock' : stryMutAct_9fa48("901") ? false : (stryCov_9fa48("901", "902"), preferredModel === (stryMutAct_9fa48("903") ? "" : (stryCov_9fa48("903"), 'bedrock')))))) {
        if (stryMutAct_9fa48("904")) {
          {}
        } else {
          stryCov_9fa48("904");
          provider = preferredModel;
        }
      } else if (stryMutAct_9fa48("907") ? preferredModel !== 'auto' : stryMutAct_9fa48("906") ? false : stryMutAct_9fa48("905") ? true : (stryCov_9fa48("905", "906", "907"), preferredModel === (stryMutAct_9fa48("908") ? "" : (stryCov_9fa48("908"), 'auto')))) {
        if (stryMutAct_9fa48("909")) {
          {}
        } else {
          stryCov_9fa48("909");
          // Auto mode: for streaming, skip classification overhead — go straight
          // to Bedrock if available, else Groq. Gemini is used only when explicitly forced.
          const {
            getGlobalFeatureFlag
          } = await import('@/lib/feature-flags-server');
          const bedrockEnabled = stryMutAct_9fa48("912") ? !!process.env.AWS_ACCESS_KEY_ID || (await getGlobalFeatureFlag('ENABLE_AWS_BEDROCK')) : stryMutAct_9fa48("911") ? false : stryMutAct_9fa48("910") ? true : (stryCov_9fa48("910", "911", "912"), (stryMutAct_9fa48("913") ? !process.env.AWS_ACCESS_KEY_ID : (stryCov_9fa48("913"), !(stryMutAct_9fa48("914") ? process.env.AWS_ACCESS_KEY_ID : (stryCov_9fa48("914"), !process.env.AWS_ACCESS_KEY_ID)))) && (await getGlobalFeatureFlag(stryMutAct_9fa48("915") ? "" : (stryCov_9fa48("915"), 'ENABLE_AWS_BEDROCK'))));
          provider = bedrockEnabled ? stryMutAct_9fa48("916") ? "" : (stryCov_9fa48("916"), 'bedrock') : stryMutAct_9fa48("917") ? "" : (stryCov_9fa48("917"), 'groq');
        }
      }
      if (stryMutAct_9fa48("920") ? provider !== 'groq' : stryMutAct_9fa48("919") ? false : stryMutAct_9fa48("918") ? true : (stryCov_9fa48("918", "919", "920"), provider === (stryMutAct_9fa48("921") ? "" : (stryCov_9fa48("921"), 'groq')))) {
        if (stryMutAct_9fa48("922")) {
          {}
        } else {
          stryCov_9fa48("922");
          yield* this.streamGroq(messages, options);
        }
      } else if (stryMutAct_9fa48("925") ? provider !== 'gemini' : stryMutAct_9fa48("924") ? false : stryMutAct_9fa48("923") ? true : (stryCov_9fa48("923", "924", "925"), provider === (stryMutAct_9fa48("926") ? "" : (stryCov_9fa48("926"), 'gemini')))) {
        if (stryMutAct_9fa48("927")) {
          {}
        } else {
          stryCov_9fa48("927");
          yield* this.streamGemini(messages, options);
        }
      } else {
        if (stryMutAct_9fa48("928")) {
          {}
        } else {
          stryCov_9fa48("928");
          yield* this.streamBedrock(messages, options);
        }
      }
    }
  }

  /**
   * Stateful think-tag filter. Wraps any AsyncIterable<string> and strips
   * <think|thinking|reasoning>...</...> regions even when tags span chunks.
   *
   * Maintains a small trailing buffer (20 chars) when not filtering, so a
   * partial tag start at the very end of a chunk is not yielded prematurely.
   */
  private async *filterThinkTags(source: AsyncIterable<string>, signal?: AbortSignal): AsyncGenerator<string> {
    if (stryMutAct_9fa48("929")) {
      {}
    } else {
      stryCov_9fa48("929");
      const TAG_PAIRS: Array<{
        open: RegExp;
        close: string;
      }> = stryMutAct_9fa48("930") ? [] : (stryCov_9fa48("930"), [stryMutAct_9fa48("931") ? {} : (stryCov_9fa48("931"), {
        open: /<think\b/i,
        close: stryMutAct_9fa48("932") ? "" : (stryCov_9fa48("932"), '</think>')
      }), stryMutAct_9fa48("933") ? {} : (stryCov_9fa48("933"), {
        open: /<thinking\b/i,
        close: stryMutAct_9fa48("934") ? "" : (stryCov_9fa48("934"), '</thinking>')
      }), stryMutAct_9fa48("935") ? {} : (stryCov_9fa48("935"), {
        open: /<reasoning\b/i,
        close: stryMutAct_9fa48("936") ? "" : (stryCov_9fa48("936"), '</reasoning>')
      })]);
      let isFiltering = stryMutAct_9fa48("937") ? true : (stryCov_9fa48("937"), false);
      let activeClose = stryMutAct_9fa48("938") ? "Stryker was here!" : (stryCov_9fa48("938"), '');
      let buf = stryMutAct_9fa48("939") ? "Stryker was here!" : (stryCov_9fa48("939"), '');
      for await (const raw of source) {
        if (stryMutAct_9fa48("940")) {
          {}
        } else {
          stryCov_9fa48("940");
          if (stryMutAct_9fa48("943") ? signal.aborted : stryMutAct_9fa48("942") ? false : stryMutAct_9fa48("941") ? true : (stryCov_9fa48("941", "942", "943"), signal?.aborted)) return;
          stryMutAct_9fa48("944") ? buf -= raw : (stryCov_9fa48("944"), buf += raw);
          while (stryMutAct_9fa48("947") ? buf.length <= 0 : stryMutAct_9fa48("946") ? buf.length >= 0 : stryMutAct_9fa48("945") ? false : (stryCov_9fa48("945", "946", "947"), buf.length > 0)) {
            if (stryMutAct_9fa48("948")) {
              {}
            } else {
              stryCov_9fa48("948");
              if (stryMutAct_9fa48("951") ? false : stryMutAct_9fa48("950") ? true : stryMutAct_9fa48("949") ? isFiltering : (stryCov_9fa48("949", "950", "951"), !isFiltering)) {
                if (stryMutAct_9fa48("952")) {
                  {}
                } else {
                  stryCov_9fa48("952");
                  // Find earliest opening tag in buf
                  let earliest = stryMutAct_9fa48("953") ? +1 : (stryCov_9fa48("953"), -1);
                  let earliestClose = stryMutAct_9fa48("954") ? "Stryker was here!" : (stryCov_9fa48("954"), '');
                  for (const {
                    open,
                    close
                  } of TAG_PAIRS) {
                    if (stryMutAct_9fa48("955")) {
                      {}
                    } else {
                      stryCov_9fa48("955");
                      const m = open.exec(buf);
                      if (stryMutAct_9fa48("958") ? m || earliest === -1 || m.index < earliest : stryMutAct_9fa48("957") ? false : stryMutAct_9fa48("956") ? true : (stryCov_9fa48("956", "957", "958"), m && (stryMutAct_9fa48("960") ? earliest === -1 && m.index < earliest : stryMutAct_9fa48("959") ? true : (stryCov_9fa48("959", "960"), (stryMutAct_9fa48("962") ? earliest !== -1 : stryMutAct_9fa48("961") ? false : (stryCov_9fa48("961", "962"), earliest === (stryMutAct_9fa48("963") ? +1 : (stryCov_9fa48("963"), -1)))) || (stryMutAct_9fa48("966") ? m.index >= earliest : stryMutAct_9fa48("965") ? m.index <= earliest : stryMutAct_9fa48("964") ? false : (stryCov_9fa48("964", "965", "966"), m.index < earliest)))))) {
                        if (stryMutAct_9fa48("967")) {
                          {}
                        } else {
                          stryCov_9fa48("967");
                          earliest = m.index;
                          earliestClose = close;
                        }
                      }
                    }
                  }
                  if (stryMutAct_9fa48("970") ? earliest !== -1 : stryMutAct_9fa48("969") ? false : stryMutAct_9fa48("968") ? true : (stryCov_9fa48("968", "969", "970"), earliest === (stryMutAct_9fa48("971") ? +1 : (stryCov_9fa48("971"), -1)))) {
                    if (stryMutAct_9fa48("972")) {
                      {}
                    } else {
                      stryCov_9fa48("972");
                      // No opening tag found — yield everything except a
                      // trailing 20-char safety margin (protects partial tag starts)
                      if (stryMutAct_9fa48("976") ? buf.length <= 20 : stryMutAct_9fa48("975") ? buf.length >= 20 : stryMutAct_9fa48("974") ? false : stryMutAct_9fa48("973") ? true : (stryCov_9fa48("973", "974", "975", "976"), buf.length > 20)) {
                        if (stryMutAct_9fa48("977")) {
                          {}
                        } else {
                          stryCov_9fa48("977");
                          yield stryMutAct_9fa48("978") ? buf : (stryCov_9fa48("978"), buf.slice(0, stryMutAct_9fa48("979") ? buf.length + 20 : (stryCov_9fa48("979"), buf.length - 20)));
                          buf = stryMutAct_9fa48("980") ? buf : (stryCov_9fa48("980"), buf.slice(stryMutAct_9fa48("981") ? buf.length + 20 : (stryCov_9fa48("981"), buf.length - 20)));
                        }
                      }
                      break;
                    }
                  }

                  // Yield content before the tag
                  if (stryMutAct_9fa48("985") ? earliest <= 0 : stryMutAct_9fa48("984") ? earliest >= 0 : stryMutAct_9fa48("983") ? false : stryMutAct_9fa48("982") ? true : (stryCov_9fa48("982", "983", "984", "985"), earliest > 0)) {
                    if (stryMutAct_9fa48("986")) {
                      {}
                    } else {
                      stryCov_9fa48("986");
                      yield stryMutAct_9fa48("987") ? buf : (stryCov_9fa48("987"), buf.slice(0, earliest));
                      buf = stryMutAct_9fa48("988") ? buf : (stryCov_9fa48("988"), buf.slice(earliest));
                    }
                  }

                  // Find the end of the opening tag (the '>')
                  const closeAngle = buf.indexOf(stryMutAct_9fa48("989") ? "" : (stryCov_9fa48("989"), '>'));
                  if (stryMutAct_9fa48("992") ? closeAngle !== -1 : stryMutAct_9fa48("991") ? false : stryMutAct_9fa48("990") ? true : (stryCov_9fa48("990", "991", "992"), closeAngle === (stryMutAct_9fa48("993") ? +1 : (stryCov_9fa48("993"), -1)))) {
                    if (stryMutAct_9fa48("994")) {
                      {}
                    } else {
                      stryCov_9fa48("994");
                      // Tag not yet complete — wait for more chunks
                      break;
                    }
                  }
                  isFiltering = stryMutAct_9fa48("995") ? false : (stryCov_9fa48("995"), true);
                  activeClose = earliestClose;
                  buf = stryMutAct_9fa48("996") ? buf : (stryCov_9fa48("996"), buf.slice(stryMutAct_9fa48("997") ? closeAngle - 1 : (stryCov_9fa48("997"), closeAngle + 1)));
                }
              } else {
                if (stryMutAct_9fa48("998")) {
                  {}
                } else {
                  stryCov_9fa48("998");
                  // Inside a think tag — scan for closing tag
                  const closeIdx = stryMutAct_9fa48("999") ? buf.toUpperCase().indexOf(activeClose.toLowerCase()) : (stryCov_9fa48("999"), buf.toLowerCase().indexOf(stryMutAct_9fa48("1000") ? activeClose.toUpperCase() : (stryCov_9fa48("1000"), activeClose.toLowerCase())));
                  if (stryMutAct_9fa48("1003") ? closeIdx !== -1 : stryMutAct_9fa48("1002") ? false : stryMutAct_9fa48("1001") ? true : (stryCov_9fa48("1001", "1002", "1003"), closeIdx === (stryMutAct_9fa48("1004") ? +1 : (stryCov_9fa48("1004"), -1)))) {
                    if (stryMutAct_9fa48("1005")) {
                      {}
                    } else {
                      stryCov_9fa48("1005");
                      // Closing tag not in buffer yet — discard all but last
                      // activeClose.length chars (in case closer spans chunks)
                      const safeDiscard = stryMutAct_9fa48("1006") ? buf.length + activeClose.length : (stryCov_9fa48("1006"), buf.length - activeClose.length);
                      if (stryMutAct_9fa48("1010") ? safeDiscard <= 0 : stryMutAct_9fa48("1009") ? safeDiscard >= 0 : stryMutAct_9fa48("1008") ? false : stryMutAct_9fa48("1007") ? true : (stryCov_9fa48("1007", "1008", "1009", "1010"), safeDiscard > 0)) buf = stryMutAct_9fa48("1011") ? buf : (stryCov_9fa48("1011"), buf.slice(safeDiscard));
                      break;
                    }
                  }

                  // Found closing tag — discard up to and including it
                  isFiltering = stryMutAct_9fa48("1012") ? true : (stryCov_9fa48("1012"), false);
                  buf = stryMutAct_9fa48("1013") ? buf : (stryCov_9fa48("1013"), buf.slice(stryMutAct_9fa48("1014") ? closeIdx - activeClose.length : (stryCov_9fa48("1014"), closeIdx + activeClose.length)));
                  activeClose = stryMutAct_9fa48("1015") ? "Stryker was here!" : (stryCov_9fa48("1015"), '');
                }
              }
            }
          }
        }
      }

      // Flush remaining buffer (only if not inside a tag)
      if (stryMutAct_9fa48("1018") ? !isFiltering || buf.trim().length > 0 : stryMutAct_9fa48("1017") ? false : stryMutAct_9fa48("1016") ? true : (stryCov_9fa48("1016", "1017", "1018"), (stryMutAct_9fa48("1019") ? isFiltering : (stryCov_9fa48("1019"), !isFiltering)) && (stryMutAct_9fa48("1022") ? buf.trim().length <= 0 : stryMutAct_9fa48("1021") ? buf.trim().length >= 0 : stryMutAct_9fa48("1020") ? true : (stryCov_9fa48("1020", "1021", "1022"), (stryMutAct_9fa48("1023") ? buf.length : (stryCov_9fa48("1023"), buf.trim().length)) > 0)))) {
        if (stryMutAct_9fa48("1024")) {
          {}
        } else {
          stryCov_9fa48("1024");
          yield buf;
        }
      }
    }
  }

  /** Groq streaming provider — OpenAI-compatible SSE */
  private async *streamGroq(messages: Message[], options: NonNullable<Parameters<UnifiedAIClient['generateStream']>[1]>): AsyncGenerator<string> {
    if (stryMutAct_9fa48("1025")) {
      {}
    } else {
      stryCov_9fa48("1025");
      if (stryMutAct_9fa48("1028") ? false : stryMutAct_9fa48("1027") ? true : stryMutAct_9fa48("1026") ? process.env.GROQ_API_KEY : (stryCov_9fa48("1026", "1027", "1028"), !process.env.GROQ_API_KEY)) throw new Error(stryMutAct_9fa48("1029") ? "" : (stryCov_9fa48("1029"), 'Missing GROQ_API_KEY'));
      const models = await getActiveModels();
      const groqModels = stryMutAct_9fa48("1030") ? models : (stryCov_9fa48("1030"), models.filter(stryMutAct_9fa48("1031") ? () => undefined : (stryCov_9fa48("1031"), m => stryMutAct_9fa48("1034") ? m.provider !== 'groq' : stryMutAct_9fa48("1033") ? false : stryMutAct_9fa48("1032") ? true : (stryCov_9fa48("1032", "1033", "1034"), m.provider === (stryMutAct_9fa48("1035") ? "" : (stryCov_9fa48("1035"), 'groq'))))));
      const modelId = stryMutAct_9fa48("1036") ? groqModels[0]?.id && 'llama-3.3-70b-versatile' : (stryCov_9fa48("1036"), (stryMutAct_9fa48("1037") ? groqModels[0].id : (stryCov_9fa48("1037"), groqModels[0]?.id)) ?? (stryMutAct_9fa48("1038") ? "" : (stryCov_9fa48("1038"), 'llama-3.3-70b-versatile')));
      const apiMessages = stryMutAct_9fa48("1039") ? [] : (stryCov_9fa48("1039"), [...messages]);
      if (stryMutAct_9fa48("1042") ? options.systemPrompt || apiMessages[0]?.role !== 'system' : stryMutAct_9fa48("1041") ? false : stryMutAct_9fa48("1040") ? true : (stryCov_9fa48("1040", "1041", "1042"), options.systemPrompt && (stryMutAct_9fa48("1044") ? apiMessages[0]?.role === 'system' : stryMutAct_9fa48("1043") ? true : (stryCov_9fa48("1043", "1044"), (stryMutAct_9fa48("1045") ? apiMessages[0].role : (stryCov_9fa48("1045"), apiMessages[0]?.role)) !== (stryMutAct_9fa48("1046") ? "" : (stryCov_9fa48("1046"), 'system')))))) {
        if (stryMutAct_9fa48("1047")) {
          {}
        } else {
          stryCov_9fa48("1047");
          apiMessages.unshift(stryMutAct_9fa48("1048") ? {} : (stryCov_9fa48("1048"), {
            role: stryMutAct_9fa48("1049") ? "" : (stryCov_9fa48("1049"), 'system'),
            content: options.systemPrompt
          }));
        }
      }
      const response = await fetch(this.GROQ_API_URL, stryMutAct_9fa48("1050") ? {} : (stryCov_9fa48("1050"), {
        method: stryMutAct_9fa48("1051") ? "" : (stryCov_9fa48("1051"), 'POST'),
        headers: stryMutAct_9fa48("1052") ? {} : (stryCov_9fa48("1052"), {
          'Authorization': stryMutAct_9fa48("1053") ? `` : (stryCov_9fa48("1053"), `Bearer ${process.env.GROQ_API_KEY}`),
          'Content-Type': stryMutAct_9fa48("1054") ? "" : (stryCov_9fa48("1054"), 'application/json')
        }),
        body: JSON.stringify(stryMutAct_9fa48("1055") ? {} : (stryCov_9fa48("1055"), {
          model: modelId,
          messages: apiMessages,
          max_tokens: stryMutAct_9fa48("1056") ? options.maxTokens && 4096 : (stryCov_9fa48("1056"), options.maxTokens ?? 4096),
          temperature: stryMutAct_9fa48("1057") ? options.temperature && 0.7 : (stryCov_9fa48("1057"), options.temperature ?? 0.7),
          stream: stryMutAct_9fa48("1058") ? false : (stryCov_9fa48("1058"), true)
        })),
        signal: stryMutAct_9fa48("1059") ? options.signal && AbortSignal.timeout(30000) : (stryCov_9fa48("1059"), options.signal ?? AbortSignal.timeout(30000))
      }));
      if (stryMutAct_9fa48("1062") ? !response.ok && !response.body : stryMutAct_9fa48("1061") ? false : stryMutAct_9fa48("1060") ? true : (stryCov_9fa48("1060", "1061", "1062"), (stryMutAct_9fa48("1063") ? response.ok : (stryCov_9fa48("1063"), !response.ok)) || (stryMutAct_9fa48("1064") ? response.body : (stryCov_9fa48("1064"), !response.body)))) {
        if (stryMutAct_9fa48("1065")) {
          {}
        } else {
          stryCov_9fa48("1065");
          const errText = await response.text().catch(stryMutAct_9fa48("1066") ? () => undefined : (stryCov_9fa48("1066"), () => stryMutAct_9fa48("1067") ? "Stryker was here!" : (stryCov_9fa48("1067"), '')));
          throw new Error(stryMutAct_9fa48("1068") ? `` : (stryCov_9fa48("1068"), `Groq stream error (${response.status}): ${stryMutAct_9fa48("1069") ? errText : (stryCov_9fa48("1069"), errText.slice(0, 200))}`));
        }
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const rawChunks = this.readOpenAIStreamChunks(reader, decoder, options.signal);
      yield* this.filterThinkTags(rawChunks, options.signal);
    }
  }

  /** Shared SSE reader for OpenAI-compatible streams (Groq). */
  private async *readOpenAIStreamChunks(reader: ReadableStreamDefaultReader<Uint8Array>, decoder: TextDecoder, signal?: AbortSignal): AsyncGenerator<string> {
    if (stryMutAct_9fa48("1070")) {
      {}
    } else {
      stryCov_9fa48("1070");
      let leftover = stryMutAct_9fa48("1071") ? "Stryker was here!" : (stryCov_9fa48("1071"), '');
      while (stryMutAct_9fa48("1073") ? false : stryMutAct_9fa48("1072") ? false : (stryCov_9fa48("1072", "1073"), true)) {
        if (stryMutAct_9fa48("1074")) {
          {}
        } else {
          stryCov_9fa48("1074");
          if (stryMutAct_9fa48("1077") ? signal.aborted : stryMutAct_9fa48("1076") ? false : stryMutAct_9fa48("1075") ? true : (stryCov_9fa48("1075", "1076", "1077"), signal?.aborted)) return;
          const {
            done,
            value
          } = await reader.read();
          if (stryMutAct_9fa48("1079") ? false : stryMutAct_9fa48("1078") ? true : (stryCov_9fa48("1078", "1079"), done)) break;
          const text = stryMutAct_9fa48("1080") ? leftover - decoder.decode(value, {
            stream: true
          }) : (stryCov_9fa48("1080"), leftover + decoder.decode(value, stryMutAct_9fa48("1081") ? {} : (stryCov_9fa48("1081"), {
            stream: stryMutAct_9fa48("1082") ? false : (stryCov_9fa48("1082"), true)
          })));
          const lines = text.split(stryMutAct_9fa48("1083") ? "" : (stryCov_9fa48("1083"), '\n'));
          leftover = stryMutAct_9fa48("1084") ? lines.pop() && '' : (stryCov_9fa48("1084"), lines.pop() ?? (stryMutAct_9fa48("1085") ? "Stryker was here!" : (stryCov_9fa48("1085"), '')));
          for (const line of lines) {
            if (stryMutAct_9fa48("1086")) {
              {}
            } else {
              stryCov_9fa48("1086");
              if (stryMutAct_9fa48("1089") ? false : stryMutAct_9fa48("1088") ? true : stryMutAct_9fa48("1087") ? line.startsWith('data: ') : (stryCov_9fa48("1087", "1088", "1089"), !(stryMutAct_9fa48("1090") ? line.endsWith('data: ') : (stryCov_9fa48("1090"), line.startsWith(stryMutAct_9fa48("1091") ? "" : (stryCov_9fa48("1091"), 'data: ')))))) continue;
              const data = stryMutAct_9fa48("1093") ? line.trim() : stryMutAct_9fa48("1092") ? line.slice(6) : (stryCov_9fa48("1092", "1093"), line.slice(6).trim());
              if (stryMutAct_9fa48("1096") ? data !== '[DONE]' : stryMutAct_9fa48("1095") ? false : stryMutAct_9fa48("1094") ? true : (stryCov_9fa48("1094", "1095", "1096"), data === (stryMutAct_9fa48("1097") ? "" : (stryCov_9fa48("1097"), '[DONE]')))) return;
              try {
                if (stryMutAct_9fa48("1098")) {
                  {}
                } else {
                  stryCov_9fa48("1098");
                  const parsed = JSON.parse(data);
                  const delta = stryMutAct_9fa48("1101") ? parsed.choices[0]?.delta?.content : stryMutAct_9fa48("1100") ? parsed.choices?.[0].delta?.content : stryMutAct_9fa48("1099") ? parsed.choices?.[0]?.delta.content : (stryCov_9fa48("1099", "1100", "1101"), parsed.choices?.[0]?.delta?.content);
                  if (stryMutAct_9fa48("1104") ? typeof delta === 'string' || delta : stryMutAct_9fa48("1103") ? false : stryMutAct_9fa48("1102") ? true : (stryCov_9fa48("1102", "1103", "1104"), (stryMutAct_9fa48("1106") ? typeof delta !== 'string' : stryMutAct_9fa48("1105") ? true : (stryCov_9fa48("1105", "1106"), typeof delta === (stryMutAct_9fa48("1107") ? "" : (stryCov_9fa48("1107"), 'string')))) && delta)) yield delta;
                }
              } catch {
                // Malformed SSE line — skip
              }
            }
          }
        }
      }
    }
  }

  /** Gemini streaming provider — streamGenerateContent + alt=sse */
  private async *streamGemini(messages: Message[], options: NonNullable<Parameters<UnifiedAIClient['generateStream']>[1]>): AsyncGenerator<string> {
    if (stryMutAct_9fa48("1108")) {
      {}
    } else {
      stryCov_9fa48("1108");
      const apiKey = stryMutAct_9fa48("1111") ? process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY : stryMutAct_9fa48("1110") ? false : stryMutAct_9fa48("1109") ? true : (stryCov_9fa48("1109", "1110", "1111"), process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      if (stryMutAct_9fa48("1114") ? false : stryMutAct_9fa48("1113") ? true : stryMutAct_9fa48("1112") ? apiKey : (stryCov_9fa48("1112", "1113", "1114"), !apiKey)) throw new Error(stryMutAct_9fa48("1115") ? "" : (stryCov_9fa48("1115"), 'Missing GEMINI_API_KEY'));
      const models = await getActiveModels();
      const geminiModels = stryMutAct_9fa48("1116") ? models : (stryCov_9fa48("1116"), models.filter(stryMutAct_9fa48("1117") ? () => undefined : (stryCov_9fa48("1117"), m => stryMutAct_9fa48("1120") ? m.provider !== 'gemini' : stryMutAct_9fa48("1119") ? false : stryMutAct_9fa48("1118") ? true : (stryCov_9fa48("1118", "1119", "1120"), m.provider === (stryMutAct_9fa48("1121") ? "" : (stryCov_9fa48("1121"), 'gemini'))))));
      const modelId = stryMutAct_9fa48("1122") ? geminiModels[0]?.id && 'gemini-2.0-flash' : (stryCov_9fa48("1122"), (stryMutAct_9fa48("1123") ? geminiModels[0].id : (stryCov_9fa48("1123"), geminiModels[0]?.id)) ?? (stryMutAct_9fa48("1124") ? "" : (stryCov_9fa48("1124"), 'gemini-2.0-flash')));
      const contents = stryMutAct_9fa48("1125") ? messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{
          text: m.content
        }]
      })) : (stryCov_9fa48("1125"), messages.filter(stryMutAct_9fa48("1126") ? () => undefined : (stryCov_9fa48("1126"), m => stryMutAct_9fa48("1129") ? m.role === 'system' : stryMutAct_9fa48("1128") ? false : stryMutAct_9fa48("1127") ? true : (stryCov_9fa48("1127", "1128", "1129"), m.role !== (stryMutAct_9fa48("1130") ? "" : (stryCov_9fa48("1130"), 'system'))))).map(stryMutAct_9fa48("1131") ? () => undefined : (stryCov_9fa48("1131"), m => stryMutAct_9fa48("1132") ? {} : (stryCov_9fa48("1132"), {
        role: (stryMutAct_9fa48("1135") ? m.role !== 'assistant' : stryMutAct_9fa48("1134") ? false : stryMutAct_9fa48("1133") ? true : (stryCov_9fa48("1133", "1134", "1135"), m.role === (stryMutAct_9fa48("1136") ? "" : (stryCov_9fa48("1136"), 'assistant')))) ? stryMutAct_9fa48("1137") ? "" : (stryCov_9fa48("1137"), 'model') : stryMutAct_9fa48("1138") ? "" : (stryCov_9fa48("1138"), 'user'),
        parts: stryMutAct_9fa48("1139") ? [] : (stryCov_9fa48("1139"), [stryMutAct_9fa48("1140") ? {} : (stryCov_9fa48("1140"), {
          text: m.content
        })])
      }))));
      const systemInstruction = options.systemPrompt ? stryMutAct_9fa48("1141") ? {} : (stryCov_9fa48("1141"), {
        parts: stryMutAct_9fa48("1142") ? [] : (stryCov_9fa48("1142"), [stryMutAct_9fa48("1143") ? {} : (stryCov_9fa48("1143"), {
          text: options.systemPrompt
        })])
      }) : undefined;
      const url = stryMutAct_9fa48("1144") ? `` : (stryCov_9fa48("1144"), `${this.GEMINI_API_BASE}/${modelId}:streamGenerateContent?key=${apiKey}&alt=sse`);
      const response = await fetch(url, stryMutAct_9fa48("1145") ? {} : (stryCov_9fa48("1145"), {
        method: stryMutAct_9fa48("1146") ? "" : (stryCov_9fa48("1146"), 'POST'),
        headers: stryMutAct_9fa48("1147") ? {} : (stryCov_9fa48("1147"), {
          'Content-Type': stryMutAct_9fa48("1148") ? "" : (stryCov_9fa48("1148"), 'application/json')
        }),
        body: JSON.stringify(stryMutAct_9fa48("1149") ? {} : (stryCov_9fa48("1149"), {
          contents,
          systemInstruction,
          generationConfig: stryMutAct_9fa48("1150") ? {} : (stryCov_9fa48("1150"), {
            maxOutputTokens: stryMutAct_9fa48("1151") ? options.maxTokens && 4096 : (stryCov_9fa48("1151"), options.maxTokens ?? 4096),
            temperature: stryMutAct_9fa48("1152") ? options.temperature && 0.7 : (stryCov_9fa48("1152"), options.temperature ?? 0.7)
          })
        })),
        signal: stryMutAct_9fa48("1153") ? options.signal && AbortSignal.timeout(30000) : (stryCov_9fa48("1153"), options.signal ?? AbortSignal.timeout(30000))
      }));
      if (stryMutAct_9fa48("1156") ? !response.ok && !response.body : stryMutAct_9fa48("1155") ? false : stryMutAct_9fa48("1154") ? true : (stryCov_9fa48("1154", "1155", "1156"), (stryMutAct_9fa48("1157") ? response.ok : (stryCov_9fa48("1157"), !response.ok)) || (stryMutAct_9fa48("1158") ? response.body : (stryCov_9fa48("1158"), !response.body)))) {
        if (stryMutAct_9fa48("1159")) {
          {}
        } else {
          stryCov_9fa48("1159");
          const errText = await response.text().catch(stryMutAct_9fa48("1160") ? () => undefined : (stryCov_9fa48("1160"), () => stryMutAct_9fa48("1161") ? "Stryker was here!" : (stryCov_9fa48("1161"), '')));
          throw new Error(stryMutAct_9fa48("1162") ? `` : (stryCov_9fa48("1162"), `Gemini stream error (${response.status}): ${stryMutAct_9fa48("1163") ? errText : (stryCov_9fa48("1163"), errText.slice(0, 200))}`));
        }
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const rawChunks = async function* () {
        if (stryMutAct_9fa48("1164")) {
          {}
        } else {
          stryCov_9fa48("1164");
          let leftover = stryMutAct_9fa48("1165") ? "Stryker was here!" : (stryCov_9fa48("1165"), '');
          while (stryMutAct_9fa48("1167") ? false : stryMutAct_9fa48("1166") ? false : (stryCov_9fa48("1166", "1167"), true)) {
            if (stryMutAct_9fa48("1168")) {
              {}
            } else {
              stryCov_9fa48("1168");
              if (stryMutAct_9fa48("1171") ? options.signal.aborted : stryMutAct_9fa48("1170") ? false : stryMutAct_9fa48("1169") ? true : (stryCov_9fa48("1169", "1170", "1171"), options.signal?.aborted)) return;
              const {
                done,
                value
              } = await reader.read();
              if (stryMutAct_9fa48("1173") ? false : stryMutAct_9fa48("1172") ? true : (stryCov_9fa48("1172", "1173"), done)) break;
              const text = stryMutAct_9fa48("1174") ? leftover - decoder.decode(value, {
                stream: true
              }) : (stryCov_9fa48("1174"), leftover + decoder.decode(value, stryMutAct_9fa48("1175") ? {} : (stryCov_9fa48("1175"), {
                stream: stryMutAct_9fa48("1176") ? false : (stryCov_9fa48("1176"), true)
              })));
              const lines = text.split(stryMutAct_9fa48("1177") ? "" : (stryCov_9fa48("1177"), '\n'));
              leftover = stryMutAct_9fa48("1178") ? lines.pop() && '' : (stryCov_9fa48("1178"), lines.pop() ?? (stryMutAct_9fa48("1179") ? "Stryker was here!" : (stryCov_9fa48("1179"), '')));
              for (const line of lines) {
                if (stryMutAct_9fa48("1180")) {
                  {}
                } else {
                  stryCov_9fa48("1180");
                  if (stryMutAct_9fa48("1183") ? false : stryMutAct_9fa48("1182") ? true : stryMutAct_9fa48("1181") ? line.startsWith('data: ') : (stryCov_9fa48("1181", "1182", "1183"), !(stryMutAct_9fa48("1184") ? line.endsWith('data: ') : (stryCov_9fa48("1184"), line.startsWith(stryMutAct_9fa48("1185") ? "" : (stryCov_9fa48("1185"), 'data: ')))))) continue;
                  const data = stryMutAct_9fa48("1187") ? line.trim() : stryMutAct_9fa48("1186") ? line.slice(6) : (stryCov_9fa48("1186", "1187"), line.slice(6).trim());
                  if (stryMutAct_9fa48("1190") ? data !== '[DONE]' : stryMutAct_9fa48("1189") ? false : stryMutAct_9fa48("1188") ? true : (stryCov_9fa48("1188", "1189", "1190"), data === (stryMutAct_9fa48("1191") ? "" : (stryCov_9fa48("1191"), '[DONE]')))) return;
                  try {
                    if (stryMutAct_9fa48("1192")) {
                      {}
                    } else {
                      stryCov_9fa48("1192");
                      const parsed = JSON.parse(data);
                      const chunk = stryMutAct_9fa48("1197") ? parsed.candidates[0]?.content?.parts?.[0]?.text : stryMutAct_9fa48("1196") ? parsed.candidates?.[0].content?.parts?.[0]?.text : stryMutAct_9fa48("1195") ? parsed.candidates?.[0]?.content.parts?.[0]?.text : stryMutAct_9fa48("1194") ? parsed.candidates?.[0]?.content?.parts[0]?.text : stryMutAct_9fa48("1193") ? parsed.candidates?.[0]?.content?.parts?.[0].text : (stryCov_9fa48("1193", "1194", "1195", "1196", "1197"), parsed.candidates?.[0]?.content?.parts?.[0]?.text);
                      if (stryMutAct_9fa48("1200") ? typeof chunk === 'string' || chunk : stryMutAct_9fa48("1199") ? false : stryMutAct_9fa48("1198") ? true : (stryCov_9fa48("1198", "1199", "1200"), (stryMutAct_9fa48("1202") ? typeof chunk !== 'string' : stryMutAct_9fa48("1201") ? true : (stryCov_9fa48("1201", "1202"), typeof chunk === (stryMutAct_9fa48("1203") ? "" : (stryCov_9fa48("1203"), 'string')))) && chunk)) yield chunk;
                    }
                  } catch {
                    // Skip malformed
                  }
                }
              }
            }
          }
        }
      }();
      yield* this.filterThinkTags(rawChunks, options.signal);
    }
  }

  /**
   * Bedrock streaming — True streaming via InvokeModelWithResponseStreamCommand.
   */
  private async *streamBedrock(messages: Message[], options: NonNullable<Parameters<UnifiedAIClient['generateStream']>[1]>): AsyncGenerator<string> {
    if (stryMutAct_9fa48("1204")) {
      {}
    } else {
      stryCov_9fa48("1204");
      const {
        streamBedrockModel
      } = await import('./bedrock-client');
      const models = await getActiveModels();
      const bedrockModels = stryMutAct_9fa48("1205") ? models : (stryCov_9fa48("1205"), models.filter(stryMutAct_9fa48("1206") ? () => undefined : (stryCov_9fa48("1206"), m => stryMutAct_9fa48("1209") ? m.provider !== 'bedrock' : stryMutAct_9fa48("1208") ? false : stryMutAct_9fa48("1207") ? true : (stryCov_9fa48("1207", "1208", "1209"), m.provider === (stryMutAct_9fa48("1210") ? "" : (stryCov_9fa48("1210"), 'bedrock'))))));
      const modelId = stryMutAct_9fa48("1211") ? bedrockModels[0]?.id && 'openai.gpt-oss-120b-1:0' : (stryCov_9fa48("1211"), (stryMutAct_9fa48("1212") ? bedrockModels[0].id : (stryCov_9fa48("1212"), bedrockModels[0]?.id)) ?? (stryMutAct_9fa48("1213") ? "" : (stryCov_9fa48("1213"), 'openai.gpt-oss-120b-1:0')));
      const stream = streamBedrockModel(modelId, messages, options.systemPrompt, options.maxTokens, options.signal);
      yield* this.filterThinkTags(stream, options.signal);
    }
  }

  /**
   * Store a successful AI response in cache (if cache is enabled).
   * Called externally after streaming completes or response is finalized.
   */
  storeInCache(query: string, response: string, model: 'groq' | 'gemini' | 'bedrock', latencyMs: number, identity?: CacheIdentity): void {
    if (stryMutAct_9fa48("1214")) {
      {}
    } else {
      stryCov_9fa48("1214");
      const isProduction = stryMutAct_9fa48("1217") ? process.env.NODE_ENV !== 'production' : stryMutAct_9fa48("1216") ? false : stryMutAct_9fa48("1215") ? true : (stryCov_9fa48("1215", "1216", "1217"), process.env.NODE_ENV === (stryMutAct_9fa48("1218") ? "" : (stryCov_9fa48("1218"), 'production')));
      const forceEnable = stryMutAct_9fa48("1221") ? process.env.CACHE_BACKEND !== 'memory' : stryMutAct_9fa48("1220") ? false : stryMutAct_9fa48("1219") ? true : (stryCov_9fa48("1219", "1220", "1221"), process.env.CACHE_BACKEND === (stryMutAct_9fa48("1222") ? "" : (stryCov_9fa48("1222"), 'memory')));
      const cacheEnabled = stryMutAct_9fa48("1225") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' || process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1' || !isProduction || forceEnable : stryMutAct_9fa48("1224") ? false : stryMutAct_9fa48("1223") ? true : (stryCov_9fa48("1223", "1224", "1225"), (stryMutAct_9fa48("1227") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === 'true' && process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === '1' : stryMutAct_9fa48("1226") ? true : (stryCov_9fa48("1226", "1227"), (stryMutAct_9fa48("1229") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE !== 'true' : stryMutAct_9fa48("1228") ? false : (stryCov_9fa48("1228", "1229"), process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === (stryMutAct_9fa48("1230") ? "" : (stryCov_9fa48("1230"), 'true')))) || (stryMutAct_9fa48("1232") ? process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE !== '1' : stryMutAct_9fa48("1231") ? false : (stryCov_9fa48("1231", "1232"), process.env.NEXT_PUBLIC_FF_ENABLE_RESPONSE_CACHE === (stryMutAct_9fa48("1233") ? "" : (stryCov_9fa48("1233"), '1')))))) && (stryMutAct_9fa48("1235") ? !isProduction && forceEnable : stryMutAct_9fa48("1234") ? true : (stryCov_9fa48("1234", "1235"), (stryMutAct_9fa48("1236") ? isProduction : (stryCov_9fa48("1236"), !isProduction)) || forceEnable)));
      if (stryMutAct_9fa48("1239") ? false : stryMutAct_9fa48("1238") ? true : stryMutAct_9fa48("1237") ? cacheEnabled : (stryCov_9fa48("1237", "1238", "1239"), !cacheEnabled)) return;
      const cache = getResponseCache();
      if (stryMutAct_9fa48("1241") ? false : stryMutAct_9fa48("1240") ? true : (stryCov_9fa48("1240", "1241"), identity)) {
        if (stryMutAct_9fa48("1242")) {
          {}
        } else {
          stryCov_9fa48("1242");
          void cache.set(query, response, stryMutAct_9fa48("1243") ? {} : (stryCov_9fa48("1243"), {
            model,
            avgLatency: latencyMs,
            identity
          }));
          return;
        }
      }
      void cache.set(query, response, model, latencyMs);
    }
  }

  // --- Health Check & Admin Methods ---

  /**
   * Comprehensive health check for all models
   * Fails fast (timeout 3s) and returns detailed status
   */
  /**
   * Comprehensive health check for all models
   * Fails fast (timeout 3s) and returns detailed status
   */
  async checkAllModels(): Promise<Record<string, {
    available: boolean;
    latency?: number;
    error?: string;
    method: 'direct_check' | 'provider_representative_check' | 'heuristic';
    status: 'available' | 'unavailable' | 'unknown';
  }>> {
    if (stryMutAct_9fa48("1244")) {
      {}
    } else {
      stryCov_9fa48("1244");
      const results: Record<string, {
        available: boolean;
        latency?: number;
        error?: string;
        method: 'direct_check' | 'provider_representative_check' | 'heuristic';
        status: 'available' | 'unavailable' | 'unknown';
      }> = {};

      // We will test one model per provider to be efficient.
      const GROQ_PING_MODEL = stryMutAct_9fa48("1245") ? "" : (stryCov_9fa48("1245"), "llama-3.1-8b-instant");
      const GEMINI_PING_MODEL = stryMutAct_9fa48("1246") ? "" : (stryCov_9fa48("1246"), "gemini-2.0-flash");

      // 1. Check Groq Availability (Representative)
      let groqResult: {
        available: boolean;
        latency: number;
        error?: string;
      } = stryMutAct_9fa48("1247") ? {} : (stryCov_9fa48("1247"), {
        available: stryMutAct_9fa48("1248") ? true : (stryCov_9fa48("1248"), false),
        latency: 0,
        error: stryMutAct_9fa48("1249") ? "" : (stryCov_9fa48("1249"), "Provider Unreachable")
      });
      try {
        if (stryMutAct_9fa48("1250")) {
          {}
        } else {
          stryCov_9fa48("1250");
          const start = Date.now();
          await this.callGroq(GROQ_PING_MODEL, stryMutAct_9fa48("1251") ? [] : (stryCov_9fa48("1251"), [stryMutAct_9fa48("1252") ? {} : (stryCov_9fa48("1252"), {
            role: stryMutAct_9fa48("1253") ? "" : (stryCov_9fa48("1253"), 'user'),
            content: stryMutAct_9fa48("1254") ? "" : (stryCov_9fa48("1254"), 'ping')
          })]), stryMutAct_9fa48("1255") ? {} : (stryCov_9fa48("1255"), {
            maxTokens: 1
          }));
          groqResult = stryMutAct_9fa48("1256") ? {} : (stryCov_9fa48("1256"), {
            available: stryMutAct_9fa48("1257") ? false : (stryCov_9fa48("1257"), true),
            latency: stryMutAct_9fa48("1258") ? Date.now() + start : (stryCov_9fa48("1258"), Date.now() - start),
            error: undefined
          });
        }
      } catch (e: unknown) {
        if (stryMutAct_9fa48("1259")) {
          {}
        } else {
          stryCov_9fa48("1259");
          groqResult.error = e instanceof Error ? e.message : stryMutAct_9fa48("1262") ? String(e) && "Provider Unreachable" : stryMutAct_9fa48("1261") ? false : stryMutAct_9fa48("1260") ? true : (stryCov_9fa48("1260", "1261", "1262"), String(e) || (stryMutAct_9fa48("1263") ? "" : (stryCov_9fa48("1263"), "Provider Unreachable")));
        }
      }

      // 2. Check Gemini Availability (Representative)
      let geminiResult: {
        available: boolean;
        latency: number;
        error?: string;
      } = stryMutAct_9fa48("1264") ? {} : (stryCov_9fa48("1264"), {
        available: stryMutAct_9fa48("1265") ? true : (stryCov_9fa48("1265"), false),
        latency: 0,
        error: stryMutAct_9fa48("1266") ? "" : (stryCov_9fa48("1266"), "Provider Unreachable")
      });
      try {
        if (stryMutAct_9fa48("1267")) {
          {}
        } else {
          stryCov_9fa48("1267");
          const start = Date.now();
          await this.callGemini(GEMINI_PING_MODEL, stryMutAct_9fa48("1268") ? [] : (stryCov_9fa48("1268"), [stryMutAct_9fa48("1269") ? {} : (stryCov_9fa48("1269"), {
            role: stryMutAct_9fa48("1270") ? "" : (stryCov_9fa48("1270"), 'user'),
            content: stryMutAct_9fa48("1271") ? "" : (stryCov_9fa48("1271"), 'ping')
          })]), stryMutAct_9fa48("1272") ? {} : (stryCov_9fa48("1272"), {
            maxTokens: 1
          }));
          geminiResult = stryMutAct_9fa48("1273") ? {} : (stryCov_9fa48("1273"), {
            available: stryMutAct_9fa48("1274") ? false : (stryCov_9fa48("1274"), true),
            latency: stryMutAct_9fa48("1275") ? Date.now() + start : (stryCov_9fa48("1275"), Date.now() - start),
            error: undefined
          });
        }
      } catch (e: unknown) {
        if (stryMutAct_9fa48("1276")) {
          {}
        } else {
          stryCov_9fa48("1276");
          geminiResult.error = e instanceof Error ? e.message : stryMutAct_9fa48("1279") ? String(e) && "Provider Unreachable" : stryMutAct_9fa48("1278") ? false : stryMutAct_9fa48("1277") ? true : (stryCov_9fa48("1277", "1278", "1279"), String(e) || (stryMutAct_9fa48("1280") ? "" : (stryCov_9fa48("1280"), "Provider Unreachable")));
        }
      }
      const models = await getActiveModels();

      // 3. Map status to all models with honest reporting
      for (const model of models) {
        if (stryMutAct_9fa48("1281")) {
          {}
        } else {
          stryCov_9fa48("1281");
          // A. Handle Preview / Unverified Models (e.g. Gemini 2.5)
          if (stryMutAct_9fa48("1283") ? false : stryMutAct_9fa48("1282") ? true : (stryCov_9fa48("1282", "1283"), model.id.includes(stryMutAct_9fa48("1284") ? "" : (stryCov_9fa48("1284"), '2.5')))) {
            if (stryMutAct_9fa48("1285")) {
              {}
            } else {
              stryCov_9fa48("1285");
              results[model.id] = stryMutAct_9fa48("1286") ? {} : (stryCov_9fa48("1286"), {
                available: stryMutAct_9fa48("1287") ? true : (stryCov_9fa48("1287"), false),
                status: stryMutAct_9fa48("1288") ? "" : (stryCov_9fa48("1288"), 'unknown'),
                method: stryMutAct_9fa48("1289") ? "" : (stryCov_9fa48("1289"), 'heuristic'),
                error: stryMutAct_9fa48("1290") ? "" : (stryCov_9fa48("1290"), 'Preview model - availability not verified'),
                latency: undefined
              });
              continue;
            }
          }

          // B. Handle Groq Models
          if (stryMutAct_9fa48("1293") ? model.provider !== 'groq' : stryMutAct_9fa48("1292") ? false : stryMutAct_9fa48("1291") ? true : (stryCov_9fa48("1291", "1292", "1293"), model.provider === (stryMutAct_9fa48("1294") ? "" : (stryCov_9fa48("1294"), 'groq')))) {
            if (stryMutAct_9fa48("1295")) {
              {}
            } else {
              stryCov_9fa48("1295");
              const isPingModel = stryMutAct_9fa48("1298") ? model.id !== GROQ_PING_MODEL : stryMutAct_9fa48("1297") ? false : stryMutAct_9fa48("1296") ? true : (stryCov_9fa48("1296", "1297", "1298"), model.id === GROQ_PING_MODEL);
              results[model.id] = stryMutAct_9fa48("1299") ? {} : (stryCov_9fa48("1299"), {
                available: groqResult.available,
                latency: groqResult.available ? groqResult.latency : undefined,
                error: groqResult.available ? undefined : groqResult.error,
                method: isPingModel ? stryMutAct_9fa48("1300") ? "" : (stryCov_9fa48("1300"), 'direct_check') : stryMutAct_9fa48("1301") ? "" : (stryCov_9fa48("1301"), 'provider_representative_check'),
                status: groqResult.available ? stryMutAct_9fa48("1302") ? "" : (stryCov_9fa48("1302"), 'available') : stryMutAct_9fa48("1303") ? "" : (stryCov_9fa48("1303"), 'unavailable')
              });
            }
          } // C. Handle Gemini Models
          else if (stryMutAct_9fa48("1306") ? model.provider !== 'gemini' : stryMutAct_9fa48("1305") ? false : stryMutAct_9fa48("1304") ? true : (stryCov_9fa48("1304", "1305", "1306"), model.provider === (stryMutAct_9fa48("1307") ? "" : (stryCov_9fa48("1307"), 'gemini')))) {
            if (stryMutAct_9fa48("1308")) {
              {}
            } else {
              stryCov_9fa48("1308");
              const isPingModel = stryMutAct_9fa48("1311") ? model.id !== GEMINI_PING_MODEL : stryMutAct_9fa48("1310") ? false : stryMutAct_9fa48("1309") ? true : (stryCov_9fa48("1309", "1310", "1311"), model.id === GEMINI_PING_MODEL);
              results[model.id] = stryMutAct_9fa48("1312") ? {} : (stryCov_9fa48("1312"), {
                available: geminiResult.available,
                latency: geminiResult.available ? geminiResult.latency : undefined,
                error: geminiResult.available ? undefined : geminiResult.error,
                method: isPingModel ? stryMutAct_9fa48("1313") ? "" : (stryCov_9fa48("1313"), 'direct_check') : stryMutAct_9fa48("1314") ? "" : (stryCov_9fa48("1314"), 'provider_representative_check'),
                status: geminiResult.available ? stryMutAct_9fa48("1315") ? "" : (stryCov_9fa48("1315"), 'available') : stryMutAct_9fa48("1316") ? "" : (stryCov_9fa48("1316"), 'unavailable')
              });
            }
          }
        }
      }
      return results;
    }
  }

  /**
   * Check a SPECIFIC model on demand (Admin feature)
   * Real API call with 3s timeout
   */
  async checkSpecificModel(modelId: string): Promise<{
    available: boolean;
    latency?: number;
    error?: string;
    method: 'direct_check';
    status: 'available' | 'unavailable';
  }> {
    if (stryMutAct_9fa48("1317")) {
      {}
    } else {
      stryCov_9fa48("1317");
      const models = await getActiveModels();
      const model = models.find(stryMutAct_9fa48("1318") ? () => undefined : (stryCov_9fa48("1318"), m => stryMutAct_9fa48("1321") ? m.id !== modelId : stryMutAct_9fa48("1320") ? false : stryMutAct_9fa48("1319") ? true : (stryCov_9fa48("1319", "1320", "1321"), m.id === modelId)));
      if (stryMutAct_9fa48("1324") ? false : stryMutAct_9fa48("1323") ? true : stryMutAct_9fa48("1322") ? model : (stryCov_9fa48("1322", "1323", "1324"), !model)) {
        if (stryMutAct_9fa48("1325")) {
          {}
        } else {
          stryCov_9fa48("1325");
          return stryMutAct_9fa48("1326") ? {} : (stryCov_9fa48("1326"), {
            available: stryMutAct_9fa48("1327") ? true : (stryCov_9fa48("1327"), false),
            error: stryMutAct_9fa48("1328") ? `` : (stryCov_9fa48("1328"), `Model ID ${modelId} not found in configuration`),
            method: stryMutAct_9fa48("1329") ? "" : (stryCov_9fa48("1329"), 'direct_check'),
            status: stryMutAct_9fa48("1330") ? "" : (stryCov_9fa48("1330"), 'unavailable')
          });
        }
      }
      try {
        if (stryMutAct_9fa48("1331")) {
          {}
        } else {
          stryCov_9fa48("1331");
          const start = Date.now();

          // Create a promise that rejects after 3 seconds
          const timeoutPromise = new Promise((_, reject) => {
            if (stryMutAct_9fa48("1332")) {
              {}
            } else {
              stryCov_9fa48("1332");
              setTimeout(stryMutAct_9fa48("1333") ? () => undefined : (stryCov_9fa48("1333"), () => reject(new Error(stryMutAct_9fa48("1334") ? "" : (stryCov_9fa48("1334"), "Health check timeout (3s)")))), 3000);
            }
          });

          // Call the model
          const callPromise = this.callModel(model, stryMutAct_9fa48("1335") ? [] : (stryCov_9fa48("1335"), [stryMutAct_9fa48("1336") ? {} : (stryCov_9fa48("1336"), {
            role: stryMutAct_9fa48("1337") ? "" : (stryCov_9fa48("1337"), 'user'),
            content: stryMutAct_9fa48("1338") ? "" : (stryCov_9fa48("1338"), 'ping')
          })]), stryMutAct_9fa48("1339") ? {} : (stryCov_9fa48("1339"), {
            maxTokens: 1
          }));

          // Race against timeout
          const result = (await Promise.race([callPromise, timeoutPromise])) as CompletionResult;
          if (stryMutAct_9fa48("1342") ? false : stryMutAct_9fa48("1341") ? true : stryMutAct_9fa48("1340") ? result.success : (stryCov_9fa48("1340", "1341", "1342"), !result.success)) {
            if (stryMutAct_9fa48("1343")) {
              {}
            } else {
              stryCov_9fa48("1343");
              throw new Error(stryMutAct_9fa48("1346") ? result.error && "Unknown error" : stryMutAct_9fa48("1345") ? false : stryMutAct_9fa48("1344") ? true : (stryCov_9fa48("1344", "1345", "1346"), result.error || (stryMutAct_9fa48("1347") ? "" : (stryCov_9fa48("1347"), "Unknown error"))));
            }
          }
          return stryMutAct_9fa48("1348") ? {} : (stryCov_9fa48("1348"), {
            available: stryMutAct_9fa48("1349") ? false : (stryCov_9fa48("1349"), true),
            latency: stryMutAct_9fa48("1350") ? Date.now() + start : (stryCov_9fa48("1350"), Date.now() - start),
            method: stryMutAct_9fa48("1351") ? "" : (stryCov_9fa48("1351"), 'direct_check'),
            status: stryMutAct_9fa48("1352") ? "" : (stryCov_9fa48("1352"), 'available')
          });
        }
      } catch (error: unknown) {
        if (stryMutAct_9fa48("1353")) {
          {}
        } else {
          stryCov_9fa48("1353");
          return stryMutAct_9fa48("1354") ? {} : (stryCov_9fa48("1354"), {
            available: stryMutAct_9fa48("1355") ? true : (stryCov_9fa48("1355"), false),
            error: error instanceof Error ? error.message : String(error),
            method: stryMutAct_9fa48("1356") ? "" : (stryCov_9fa48("1356"), 'direct_check'),
            status: stryMutAct_9fa48("1357") ? "" : (stryCov_9fa48("1357"), 'unavailable')
          });
        }
      }
    }
  }

  /**
   * Health Check (Quick connectivity test)
   */
  async runHealthCheck() {
    if (stryMutAct_9fa48("1358")) {
      {}
    } else {
      stryCov_9fa48("1358");
      return this.checkAllModels();
    }
  }
  async getRateLimiterStatus() {
    if (stryMutAct_9fa48("1359")) {
      {}
    } else {
      stryCov_9fa48("1359");
      const models = await getActiveModels();
      return stryMutAct_9fa48("1360") ? {} : (stryCov_9fa48("1360"), {
        usage: await this.rateLimiter.getUsageStats(),
        remaining: await this.rateLimiter.getRemainingCapacity(models)
      });
    }
  }

  // Kept for legacy compatibility if called directly
  async getRateLimitStatus() {
    if (stryMutAct_9fa48("1361")) {
      {}
    } else {
      stryCov_9fa48("1361");
      return this.getRateLimiterStatus();
    }
  }

  // --- Embedding Support (Restored for RAG compatibility) ---
  // User asked for "Direct API calls". I should implement Gemini Embeddings via REST.
  // Local Embeddings can remain as compatible via Xenova.

  async embed(texts: string | string[], options: {
    correlationId?: string;
  } = {}): Promise<{
    embeddings: number[][];
    modelUsed: string;
    dimensions: number;
  }> {
    if (stryMutAct_9fa48("1362")) {
      {}
    } else {
      stryCov_9fa48("1362");
      const textArray = Array.isArray(texts) ? texts : stryMutAct_9fa48("1363") ? [] : (stryCov_9fa48("1363"), [texts]);

      // When AWS Bedrock is configured, try Titan embeddings FIRST (primary when flag ON)
      if (stryMutAct_9fa48("1366") ? process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY : stryMutAct_9fa48("1365") ? false : stryMutAct_9fa48("1364") ? true : (stryCov_9fa48("1364", "1365", "1366"), process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)) {
        if (stryMutAct_9fa48("1367")) {
          {}
        } else {
          stryCov_9fa48("1367");
          try {
            if (stryMutAct_9fa48("1368")) {
              {}
            } else {
              stryCov_9fa48("1368");
              const {
                getGlobalFeatureFlag: getFlag
              } = await import('@/lib/feature-flags-server');
              const bedrockEnabled = await getFlag(stryMutAct_9fa48("1369") ? "" : (stryCov_9fa48("1369"), 'ENABLE_AWS_BEDROCK'));
              if (stryMutAct_9fa48("1371") ? false : stryMutAct_9fa48("1370") ? true : (stryCov_9fa48("1370", "1371"), bedrockEnabled)) {
                if (stryMutAct_9fa48("1372")) {
                  {}
                } else {
                  stryCov_9fa48("1372");
                  const {
                    generateBedrockEmbedding
                  } = await import('./bedrock-client');
                  const results = await Promise.all(textArray.map(stryMutAct_9fa48("1373") ? () => undefined : (stryCov_9fa48("1373"), t => generateBedrockEmbedding(t))));
                  if (stryMutAct_9fa48("1376") ? results.some((r: number[]) => r.length > 0) : stryMutAct_9fa48("1375") ? false : stryMutAct_9fa48("1374") ? true : (stryCov_9fa48("1374", "1375", "1376"), results.every(stryMutAct_9fa48("1377") ? () => undefined : (stryCov_9fa48("1377"), (r: number[]) => stryMutAct_9fa48("1381") ? r.length <= 0 : stryMutAct_9fa48("1380") ? r.length >= 0 : stryMutAct_9fa48("1379") ? false : stryMutAct_9fa48("1378") ? true : (stryCov_9fa48("1378", "1379", "1380", "1381"), r.length > 0))))) {
                    if (stryMutAct_9fa48("1382")) {
                      {}
                    } else {
                      stryCov_9fa48("1382");
                      return stryMutAct_9fa48("1383") ? {} : (stryCov_9fa48("1383"), {
                        embeddings: results,
                        modelUsed: stryMutAct_9fa48("1384") ? "" : (stryCov_9fa48("1384"), 'amazon.titan-embed-text-v2:0'),
                        dimensions: stryMutAct_9fa48("1385") ? results[0]?.length && 1024 : (stryCov_9fa48("1385"), (stryMutAct_9fa48("1386") ? results[0].length : (stryCov_9fa48("1386"), results[0]?.length)) ?? 1024)
                      });
                    }
                  }
                }
              }
            }
          } catch (e) {
            if (stryMutAct_9fa48("1387")) {
              {}
            } else {
              stryCov_9fa48("1387");
              console.warn(stryMutAct_9fa48("1388") ? "" : (stryCov_9fa48("1388"), '⚠️ Bedrock Titan embedding failed, falling back to Gemini:'), e instanceof Error ? e.message : e);
              void logSystemEvent(stryMutAct_9fa48("1389") ? {} : (stryCov_9fa48("1389"), {
                type: stryMutAct_9fa48("1390") ? "" : (stryCov_9fa48("1390"), 'embedding_failed'),
                provider: stryMutAct_9fa48("1391") ? "" : (stryCov_9fa48("1391"), 'bedrock'),
                correlationId: options.correlationId
              }));
            }
          }
        }
      }

      // Fallback: Gemini Embedding
      const geminiKey = stryMutAct_9fa48("1394") ? process.env.GEMINI_API_KEY && process.env.GOOGLE_API_KEY : stryMutAct_9fa48("1393") ? false : stryMutAct_9fa48("1392") ? true : (stryCov_9fa48("1392", "1393", "1394"), process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
      if (stryMutAct_9fa48("1396") ? false : stryMutAct_9fa48("1395") ? true : (stryCov_9fa48("1395", "1396"), geminiKey)) {
        if (stryMutAct_9fa48("1397")) {
          {}
        } else {
          stryCov_9fa48("1397");
          try {
            if (stryMutAct_9fa48("1398")) {
              {}
            } else {
              stryCov_9fa48("1398");
              const results = await Promise.all(textArray.map(stryMutAct_9fa48("1399") ? () => undefined : (stryCov_9fa48("1399"), t => this.embedWithGemini(t, geminiKey))));
              return stryMutAct_9fa48("1400") ? {} : (stryCov_9fa48("1400"), {
                embeddings: results,
                modelUsed: stryMutAct_9fa48("1401") ? "" : (stryCov_9fa48("1401"), 'gemini-embedding-1'),
                dimensions: stryMutAct_9fa48("1402") ? results[0]?.length && 768 : (stryCov_9fa48("1402"), (stryMutAct_9fa48("1403") ? results[0].length : (stryCov_9fa48("1403"), results[0]?.length)) ?? 768)
              });
            }
          } catch (e) {
            if (stryMutAct_9fa48("1404")) {
              {}
            } else {
              stryCov_9fa48("1404");
              console.warn(stryMutAct_9fa48("1405") ? "" : (stryCov_9fa48("1405"), '⚠️ Gemini embedding failed:'), e instanceof Error ? e.message : e);
              void logSystemEvent(stryMutAct_9fa48("1406") ? {} : (stryCov_9fa48("1406"), {
                type: stryMutAct_9fa48("1407") ? "" : (stryCov_9fa48("1407"), 'embedding_failed'),
                provider: stryMutAct_9fa48("1408") ? "" : (stryCov_9fa48("1408"), 'gemini'),
                correlationId: options.correlationId
              }));
            }
          }
        }
      }

      // Last resort: Bedrock Titan without flag check (credentials-only)
      if (stryMutAct_9fa48("1411") ? process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY : stryMutAct_9fa48("1410") ? false : stryMutAct_9fa48("1409") ? true : (stryCov_9fa48("1409", "1410", "1411"), process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)) {
        if (stryMutAct_9fa48("1412")) {
          {}
        } else {
          stryCov_9fa48("1412");
          try {
            if (stryMutAct_9fa48("1413")) {
              {}
            } else {
              stryCov_9fa48("1413");
              const {
                generateBedrockEmbedding
              } = await import('./bedrock-client');
              const results = await Promise.all(textArray.map(stryMutAct_9fa48("1414") ? () => undefined : (stryCov_9fa48("1414"), t => generateBedrockEmbedding(t))));
              if (stryMutAct_9fa48("1417") ? results.some((r: number[]) => r.length > 0) : stryMutAct_9fa48("1416") ? false : stryMutAct_9fa48("1415") ? true : (stryCov_9fa48("1415", "1416", "1417"), results.every(stryMutAct_9fa48("1418") ? () => undefined : (stryCov_9fa48("1418"), (r: number[]) => stryMutAct_9fa48("1422") ? r.length <= 0 : stryMutAct_9fa48("1421") ? r.length >= 0 : stryMutAct_9fa48("1420") ? false : stryMutAct_9fa48("1419") ? true : (stryCov_9fa48("1419", "1420", "1421", "1422"), r.length > 0))))) {
                if (stryMutAct_9fa48("1423")) {
                  {}
                } else {
                  stryCov_9fa48("1423");
                  return stryMutAct_9fa48("1424") ? {} : (stryCov_9fa48("1424"), {
                    embeddings: results,
                    modelUsed: stryMutAct_9fa48("1425") ? "" : (stryCov_9fa48("1425"), 'amazon.titan-embed-text-v2:0'),
                    dimensions: stryMutAct_9fa48("1426") ? results[0]?.length && 1024 : (stryCov_9fa48("1426"), (stryMutAct_9fa48("1427") ? results[0].length : (stryCov_9fa48("1427"), results[0]?.length)) ?? 1024)
                  });
                }
              }
            }
          } catch (e) {
            if (stryMutAct_9fa48("1428")) {
              {}
            } else {
              stryCov_9fa48("1428");
              console.warn(stryMutAct_9fa48("1429") ? "" : (stryCov_9fa48("1429"), '⚠️ Bedrock embedding (last-resort) also failed:'), e instanceof Error ? e.message : e);
            }
          }
        }
      }

      // No local embedder. If both fail, RAG context is unavailable — graceful degradation.
      console.error(stryMutAct_9fa48("1430") ? "" : (stryCov_9fa48("1430"), '❌ All embedding providers failed. Interview will proceed without RAG context.'));
      void logSystemEvent(stryMutAct_9fa48("1431") ? {} : (stryCov_9fa48("1431"), {
        type: stryMutAct_9fa48("1432") ? "" : (stryCov_9fa48("1432"), 'embedding_failed'),
        errorMessage: stryMutAct_9fa48("1433") ? "" : (stryCov_9fa48("1433"), 'All providers failed'),
        correlationId: options.correlationId
      }));
      throw new Error(stryMutAct_9fa48("1434") ? "" : (stryCov_9fa48("1434"), 'All embedding providers failed. RAG context unavailable.'));
    }
  }
  private async embedWithGemini(text: string, apiKey: string): Promise<number[]> {
    if (stryMutAct_9fa48("1435")) {
      {}
    } else {
      stryCov_9fa48("1435");
      // Use v1beta for gemini-embedding-1
      const url = stryMutAct_9fa48("1436") ? `` : (stryCov_9fa48("1436"), `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-1:embedContent?key=${apiKey}`);
      const response = await fetch(url, stryMutAct_9fa48("1437") ? {} : (stryCov_9fa48("1437"), {
        method: stryMutAct_9fa48("1438") ? "" : (stryCov_9fa48("1438"), "POST"),
        headers: stryMutAct_9fa48("1439") ? {} : (stryCov_9fa48("1439"), {
          "Content-Type": stryMutAct_9fa48("1440") ? "" : (stryCov_9fa48("1440"), "application/json")
        }),
        body: JSON.stringify(stryMutAct_9fa48("1441") ? {} : (stryCov_9fa48("1441"), {
          content: stryMutAct_9fa48("1442") ? {} : (stryCov_9fa48("1442"), {
            parts: stryMutAct_9fa48("1443") ? [] : (stryCov_9fa48("1443"), [stryMutAct_9fa48("1444") ? {} : (stryCov_9fa48("1444"), {
              text
            })])
          })
        })),
        signal: AbortSignal.timeout(20000)
      }));
      if (stryMutAct_9fa48("1447") ? false : stryMutAct_9fa48("1446") ? true : stryMutAct_9fa48("1445") ? response.ok : (stryCov_9fa48("1445", "1446", "1447"), !response.ok)) {
        if (stryMutAct_9fa48("1448")) {
          {}
        } else {
          stryCov_9fa48("1448");
          const errBody = await response.text();
          throw new Error(stryMutAct_9fa48("1449") ? `` : (stryCov_9fa48("1449"), `Gemini embed API error (${response.status}): ${stryMutAct_9fa48("1450") ? errBody : (stryCov_9fa48("1450"), errBody.substring(0, 100))}`));
        }
      }
      const data = await response.json();
      return stryMutAct_9fa48("1453") ? data.embedding?.values && [] : stryMutAct_9fa48("1452") ? false : stryMutAct_9fa48("1451") ? true : (stryCov_9fa48("1451", "1452", "1453"), (stryMutAct_9fa48("1454") ? data.embedding.values : (stryCov_9fa48("1454"), data.embedding?.values)) || (stryMutAct_9fa48("1455") ? ["Stryker was here"] : (stryCov_9fa48("1455"), [])));
    }
  }

  // Remnant of local embedder removed
}

// Singleton instance
let clientInstance: UnifiedAIClient | null = null;
export function getAIClient(): UnifiedAIClient {
  if (stryMutAct_9fa48("1456")) {
    {}
  } else {
    stryCov_9fa48("1456");
    if (stryMutAct_9fa48("1459") ? false : stryMutAct_9fa48("1458") ? true : stryMutAct_9fa48("1457") ? clientInstance : (stryCov_9fa48("1457", "1458", "1459"), !clientInstance)) {
      if (stryMutAct_9fa48("1460")) {
        {}
      } else {
        stryCov_9fa48("1460");
        clientInstance = new UnifiedAIClient();
      }
    }
    return clientInstance;
  }
}

// Helper exports for backward compatibility and RAG imports
export async function chat(messages: Message[], options: {
  preferredTier?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
} = {}) {
  if (stryMutAct_9fa48("1461")) {
    {}
  } else {
    stryCov_9fa48("1461");
    return getAIClient().chat(messages, options);
  }
}
export async function embed(texts: string | string[], options: {
  correlationId?: string;
} = {}) {
  if (stryMutAct_9fa48("1462")) {
    {}
  } else {
    stryCov_9fa48("1462");
    return getAIClient().embed(texts, options);
  }
}