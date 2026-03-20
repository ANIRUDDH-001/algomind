import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const isE2EFallback =
      (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
      req.cookies.get('playwright-e2e')?.value === 'true';

    if (isE2EFallback) {
      return NextResponse.json({ id: 'test-user', email: 'test@example.com' });
    }

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ id: user.id, email: user.email });
}
