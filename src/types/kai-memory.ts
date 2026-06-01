/**
 * @codesage
 * @file      src/types/kai-memory.ts
 * @purpose   Defines structures for the Kai agent's structured memory and communication style preferences.
 * @tech      TypeScript
 * @connects  Imports CognitiveSkill from assessment.ts; used by the Kai tutor agent.
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    No dead code or unused imports found.
 * @audit     CODESAGE-v1
 */

import type { CognitiveSkill } from './assessment';

export type CommunicationStyle = 'analytical' | 'conversational' | 'terse' | 'verbose' | 'structured';

export interface KaiMemoryStructured {
    topStrength: {
        skill: CognitiveSkill;
        evidence: string;
    };
    mainWeakness: {
        skill: CognitiveSkill;
        evidence: string;
    };
    communicationStyle: CommunicationStyle;
    focusForNextSession: string;
}
