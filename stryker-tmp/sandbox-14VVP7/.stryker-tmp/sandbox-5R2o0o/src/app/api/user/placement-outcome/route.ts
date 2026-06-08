// @ts-nocheck
// 
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await getServiceClient()
      .from('placement_outcomes')
      .select('company_name, placed_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ outcome: null });
    }

    return NextResponse.json({
      outcome: {
        companyName: data.company_name,
        placedAt: data.placed_at,
      },
    });
  } catch (error) {
    console.error('Failed to fetch placement outcome:', error);
    return NextResponse.json({ error: 'Failed to fetch placement outcome' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json() as {
      companyName?: string;
      role?: string;
      placedAt?: string;
    };

    const companyName = body.companyName?.trim();
    const role = body.role?.trim() || null;
    const placedAt = body.placedAt;

    // Validate inputs
    if (!companyName) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    if (!placedAt || !/^\d{4}-\d{2}-\d{2}$/.test(placedAt)) {
      return NextResponse.json({ error: 'placedAt must be in YYYY-MM-DD format' }, { status: 400 });
    }

    // Fetch denormalized stats
    const { data: sessionStats, error: statsError } = await getServiceClient()
      .from('interview_sessions')
      .select('id, overall_score')
      .eq('user_id', user.id)
      .eq('status', 'completed');

    if (statsError) {
      console.warn('Failed to fetch session stats:', statsError);
    }

    const sessionCount = sessionStats?.length || 0;
    const avgScore = sessionStats && sessionStats.length > 0
      ? sessionStats.reduce((sum, s) => sum + (s.overall_score || 0), 0) / sessionStats.length
      : null;

    // Insert into placement_outcomes
    const { data, error } = await getServiceClient()
      .from('placement_outcomes')
      .insert({
        user_id: user.id,
        company_name: companyName,
        role: role,
        placed_at: placedAt,
        sessions_before_placement: sessionCount,
        avg_score_before_placement: avgScore,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to insert placement outcome:', error);
      return NextResponse.json({ error: 'Failed to save placement outcome' }, { status: 500 });
    }

    return NextResponse.json({ success: true, outcomeId: data.id });
  } catch (error) {
    console.error('Error in placement-outcome POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
