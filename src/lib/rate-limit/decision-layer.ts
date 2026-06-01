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
export type EndpointClass = 'critical' | 'service' | 'non-critical';
export type FailureMode = 'fail-open' | 'fail-closed';

interface EndpointPolicy {
    endpointClass: EndpointClass;
    failureMode: FailureMode;
}

const DEFAULT_POLICY: EndpointPolicy = {
    endpointClass: 'non-critical',
    failureMode: 'fail-open',
};

const ENDPOINT_POLICIES: Record<string, EndpointPolicy> = {
    assess_start: { endpointClass: 'critical', failureMode: 'fail-closed' },
    assess_complete: { endpointClass: 'critical', failureMode: 'fail-closed' },
    assess_chat: { endpointClass: 'critical', failureMode: 'fail-closed' },
    execute_code: { endpointClass: 'critical', failureMode: 'fail-closed' },
    ai_model_selection: { endpointClass: 'critical', failureMode: 'fail-closed' },
    replay_generate: { endpointClass: 'service', failureMode: 'fail-closed' },
    interview_analysis: { endpointClass: 'service', failureMode: 'fail-closed' },
    voice_transcribe: { endpointClass: 'service', failureMode: 'fail-closed' },
    chat: { endpointClass: 'service', failureMode: 'fail-closed' },
    user_rate_limit: { endpointClass: 'service', failureMode: 'fail-closed' },
    weekly_session_limit: { endpointClass: 'service', failureMode: 'fail-closed' },
    flags: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    verify_code: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    employer_export: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    health: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    connectivity: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    debug: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    whisper_guest: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    learn_diagnostic: { endpointClass: 'non-critical', failureMode: 'fail-open' },
    learn_concept: { endpointClass: 'non-critical', failureMode: 'fail-open' },
};

export function classifyEndpoint(endpoint?: string): EndpointClass {
    if (!endpoint) return DEFAULT_POLICY.endpointClass;
    return ENDPOINT_POLICIES[endpoint]?.endpointClass ?? DEFAULT_POLICY.endpointClass;
}

export function getFailureMode(endpoint?: string): FailureMode {
    if (!endpoint) return DEFAULT_POLICY.failureMode;
    return ENDPOINT_POLICIES[endpoint]?.failureMode ?? DEFAULT_POLICY.failureMode;
}

export function isCriticalEndpoint(endpoint?: string): boolean {
    return classifyEndpoint(endpoint) === 'critical';
}

export function getAllEndpointPolicies(): Record<string, EndpointPolicy> {
    return { ...ENDPOINT_POLICIES };
}
