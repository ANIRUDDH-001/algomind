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
