import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('rag contract unification', () => {
    const contextRoutePath = path.join(process.cwd(), 'src/app/api/rag/context/route.ts');
    const searchRoutePath = path.join(process.cwd(), 'src/app/api/rag/search/route.ts');

    it('uses canonical contract builder in context route', () => {
        const source = fs.readFileSync(contextRoutePath, 'utf8');
        expect(source).toContain('buildRagResponse');
        expect(source).toContain('mapRpcChunk');
    });

    it('uses canonical contract builder in search route', () => {
        const source = fs.readFileSync(searchRoutePath, 'utf8');
        expect(source).toContain('buildRagResponse');
        expect(source).toContain('mapSearchChunk');
    });

    it('returns canonical fields in both routes', () => {
        const contextSource = fs.readFileSync(contextRoutePath, 'utf8');
        const searchSource = fs.readFileSync(searchRoutePath, 'utf8');

        expect(contextSource).toContain('status');
        expect(contextSource).toContain('query');
        expect(contextSource).toContain('chunks');
        expect(contextSource).toContain('context');

        expect(searchSource).toContain('status');
        expect(searchSource).toContain('query');
        expect(searchSource).toContain('chunks');
        expect(searchSource).toContain('context');
    });
});
