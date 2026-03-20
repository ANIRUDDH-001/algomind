import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getKnowledgeGraphService } from '@/lib/knowledge-graph';
import { invalidateStudentContext } from '@/lib/kai-context';
import { checkIpRateLimit } from '@/lib/rate-limit/ip-rate-limiter';
import { logSystemEvent } from '@/lib/monitoring/events';
import type { KGDiagnosticResult } from '@/lib/knowledge-graph/types';

interface DiagnosticRequestBody {
  results?: KGDiagnosticResult[];
}

function isValidDiagnosticResult(value: unknown): value is KGDiagnosticResult {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.conceptSlug === 'string'
    && item.conceptSlug.length > 0
    && typeof item.confidence === 'number'
    && Number.isFinite(item.confidence)
    && item.confidence >= 0
    && item.confidence <= 1;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown';
    const ipRateLimit = await checkIpRateLimit(ip, {
      maxRequests: 30,
      windowSeconds: 60,
      endpoint: 'learn_diagnostic',
    });
    if (ipRateLimit.allowed === false) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: DiagnosticRequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!Array.isArray(body.results) || body.results.length === 0 || !body.results.every(isValidDiagnosticResult)) {
      return NextResponse.json({ error: 'results must be a non-empty array of { conceptSlug, confidence }' }, { status: 400 });
    }

    await getKnowledgeGraphService().initializeFromDiagnostic(user.id, body.results);
    void invalidateStudentContext(user.id);

    const nextRecommendedConcept = await getKnowledgeGraphService().getNextRecommendedConcept(user.id);

    return NextResponse.json({
      success: true,
      initializedCount: body.results.length,
      nextRecommendedConcept,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logSystemEvent({
      type: 'db_error',
      errorMessage,
      metadata: { context: 'learn_diagnostic.post' },
    });

    return NextResponse.json({ error: 'Failed to initialize diagnostic results' }, { status: 500 });
  }
}
