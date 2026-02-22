import { expect, test, describe } from 'vitest';
import { COMMON_QUESTIONS, getPreWarmQueries, getTopPreWarmQueries } from '../common-questions';

describe('common-questions', () => {
    test('COMMON_QUESTIONS should not be empty', () => {
        expect(COMMON_QUESTIONS.length).toBeGreaterThan(0);
    });

    test('getPreWarmQueries should return all queries', () => {
        const queries = getPreWarmQueries();
        expect(queries).toHaveLength(COMMON_QUESTIONS.length);
        expect(queries[0]).toBeTypeOf('string');
    });

    test('getTopPreWarmQueries should return sorted top n queries', () => {
        const top5 = getTopPreWarmQueries(5);
        expect(top5).toHaveLength(5);

        // Simple/medium should be at the top
        const allTop = getTopPreWarmQueries(COMMON_QUESTIONS.length);
        const lastQuestionStr = allTop[allTop.length - 1];
        const lastQuestionObj = COMMON_QUESTIONS.find(q => q.query === lastQuestionStr);
        expect(lastQuestionObj?.complexity).toBe('complex');
    });
});
