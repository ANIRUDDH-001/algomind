import { describe, expect, it } from 'vitest';
import {
    buildPromptVersionHeader,
    PROMPT_REGISTRY_VERSION,
    PROMPT_VERSION_TAGS,
} from '@/lib/interview/prompts';

describe('prompt version tagging', () => {
    it('exposes stable registry version and required tags', () => {
        expect(PROMPT_REGISTRY_VERSION).toBe('phase3.v1');
        expect(PROMPT_VERSION_TAGS.interviewChat).toBe('interview-chat.v1');
        expect(PROMPT_VERSION_TAGS.assessmentChat).toBe('assessment-chat.v1');
    });

    it('builds deterministic header format', () => {
        const header = buildPromptVersionHeader(PROMPT_VERSION_TAGS.interviewChat);
        expect(header).toBe('<prompt_version registry="phase3.v1" tag="interview-chat.v1" />');
    });
});
