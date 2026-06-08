import { describe, it, expect, vi, beforeEach } from 'vitest';
import { redisIncr, __resetCircuitForTests, __resetRedisInstanceForTests } from '../client';
import { Redis } from '@upstash/redis';

vi.mock('@upstash/redis', () => {
    return {
        Redis: vi.fn(),
    };
});

describe('redisIncr — atomic pipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetCircuitForTests();
        __resetRedisInstanceForTests();
        process.env.UPSTASH_REDIS_REST_URL = 'http://localhost';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    });

    it('calls pipeline().incr() and pipeline().expire() together', async () => {
        const pipelineMock = {
            incr: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([1, 1]),
        };
        
        vi.mocked(Redis).mockImplementation(function() {
            return {
                pipeline: () => pipelineMock,
            };
        } as any);

        const result = await redisIncr('test-key', 60);

        expect(pipelineMock.incr).toHaveBeenCalledWith('test-key');
        expect(pipelineMock.expire).toHaveBeenCalledWith('test-key', 60, 'NX');
        expect(pipelineMock.exec).toHaveBeenCalledTimes(1);
        expect(result).toBe(1);
    });

    it('does not call expire when no TTL is provided', async () => {
        const pipelineMock = {
            incr: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([3]),
        };
        
        vi.mocked(Redis).mockImplementation(() => ({
            pipeline: () => pipelineMock,
        }) as any);

        await redisIncr('test-key');

        expect(pipelineMock.expire).not.toHaveBeenCalled();
    });

    it('returns 0 and does not throw when pipeline fails', async () => {
        vi.mocked(Redis).mockImplementation(function() {
            return {
                pipeline: () => ({
                    incr: vi.fn().mockReturnThis(),
                    expire: vi.fn().mockReturnThis(),
                    exec: vi.fn().mockRejectedValue(new Error('Connection refused')),
                }),
            };
        } as any);

        const result = await redisIncr('test-key', 60);
        expect(result).toBe(0); // fail-open
    });

    it('does NOT execute incr and expire as separate awaited calls', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.resolve(__dirname, '../client.ts'),
            'utf-8'
        );
        const oldPattern = /await redis\.incr[\s\S]{0,100}await redis\.expire/;
        expect(src).not.toMatch(oldPattern);
    });
});
