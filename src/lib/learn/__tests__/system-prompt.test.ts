import { describe, it, expect } from 'vitest';
import { buildLearnSystemPrompt, buildKaiMemoryUpdatePrompt } from '../system-prompt';

describe('Learn Mode System Prompts', () => {
    describe('buildLearnSystemPrompt', () => {
        const baseParams = {
            problemTitle: 'Two Sum',
            problemDifficulty: 'Easy',
            problemDescription: 'Given an array of integers...',
            conceptTags: ['Array', 'Hash Table'],
            kaiMemory: null as string | null,
            userPreviousScore: null as number | null,
        };

        it('should include English-only rules by default (hinglishActive=false)', () => {
            const prompt = buildLearnSystemPrompt(baseParams);
            expect(prompt).toContain('You are Kai, a warm and patient DSA tutor');
            expect(prompt).toContain('Respond in clear English only');
            expect(prompt).not.toContain('Hinglish');
            expect(prompt).not.toContain('Samjha?');
        });

        it('should include Hinglish rules when hinglishActive=true', () => {
            const prompt = buildLearnSystemPrompt({ ...baseParams, hinglishActive: true });
            expect(prompt).toContain('You are Kai, a warm and patient DSA tutor');
            expect(prompt).toContain('Hinglish');
            expect(prompt).toContain('Samjha?');
        });

        it('should inject problem context correctly', () => {
            const prompt = buildLearnSystemPrompt(baseParams);
            expect(prompt).toContain('Two Sum');
            expect(prompt).toContain('Easy');
            expect(prompt).toContain('Array, Hash Table');
            expect(prompt).toContain('Given an array of integers...');
        });

        it('should inject user memory when provided', () => {
            const prompt = buildLearnSystemPrompt({
                ...baseParams,
                kaiMemory: 'Student struggles with hash maps but understands arrays well.'
            });
            expect(prompt).toContain('About this student');
            expect(prompt).toContain('Student struggles with hash maps');
        });

        it('should inject previous score context when provided', () => {
            const prompt = buildLearnSystemPrompt({
                ...baseParams,
                userPreviousScore: 4
            });
            expect(prompt).toContain('Student scored 4/10');
        });

        it('should not include memory or score sections if not provided', () => {
            const prompt = buildLearnSystemPrompt(baseParams);
            expect(prompt).not.toContain('About this student');
            expect(prompt).not.toContain('Student scored');
        });
    });

    describe('buildKaiMemoryUpdatePrompt', () => {
        it('should return a structured coaching memory prompt', () => {
            const prompt = buildKaiMemoryUpdatePrompt();
            expect(prompt).toContain('memory');
            expect(prompt).toContain('third person');
            expect(typeof prompt).toBe('string');
            expect(prompt.length).toBeGreaterThan(50);
        });
    });
});
