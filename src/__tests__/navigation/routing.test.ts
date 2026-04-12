// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NextRequest } from 'next/server';

const e = React.createElement;

const mockPush = vi.fn();
const mockRedirect = vi.fn();
const mockNotFound = vi.fn();
const mockUsePathname = vi.fn();
const mockUseAuth = vi.fn();
const mockUseAdmin = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockUsePathname(),
  redirect: (...args: unknown[]) => mockRedirect(...args),
  notFound: () => mockNotFound(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useAdmin', () => ({
  useAdmin: () => mockUseAdmin(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => e('div', props, children),
  },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => e('a', { href, ...props }, children),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => e('button', props, children),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => e('div', null, children),
  DropdownMenuTrigger: ({ children }: any) => e('div', null, children),
  DropdownMenuContent: ({ children }: any) => e('div', null, children),
  DropdownMenuItem: ({ children, onClick }: any) => e('div', { role: 'menuitem', onClick }, children),
  DropdownMenuLabel: ({ children }: any) => e('div', null, children),
  DropdownMenuSeparator: () => e('hr'),
}));

vi.mock('lucide-react', () => ({
  LogOut: () => e('span'),
  Settings: () => e('span'),
  BarChart: () => e('span'),
  History: () => e('span'),
  Home: () => e('span'),
  Mic: () => e('span'),
  Shield: () => e('span'),
  Flag: () => e('span'),
  Briefcase: () => e('span'),
  BookOpen: () => e('span'),
  Crown: () => e('span'),
  Brain: () => e('span'),
}));

const mockCreateServerSupabase = vi.fn();
const mockBuildStudentContext = vi.fn();
const mockGetConceptSummaries = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: () => mockCreateServerSupabase(),
}));

vi.mock('@/lib/kai-context', () => ({
  buildStudentContext: (...args: unknown[]) => mockBuildStudentContext(...args),
}));

vi.mock('@/lib/knowledge-graph', () => ({
  getKnowledgeGraphService: () => ({
    getConceptSummaries: (...args: unknown[]) => mockGetConceptSummaries(...args),
  }),
}));

const mockGetUser = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

import { Navbar } from '@/components/layout/Navbar';
import LearnPage from '@/app/learn/page';
import LearnSlugPage from '@/app/learn/[slug]/page';
import middleware from '@/middleware';

describe('Navigation routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUsePathname.mockReturnValue('/');
    mockUseAdmin.mockReturnValue({ isAdmin: false });
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'user@test.com', user_metadata: { full_name: 'User' } },
      signOut: vi.fn(),
      loading: false,
      isConfigured: true,
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accountType: 'candidate' }),
    } as Response);
  });

  it('sidebar includes Learn nav item', async () => {
    render(e(Navbar));
    expect(await screen.findAllByText('Learn')).toHaveLength(2);
  });

  it('Learn nav item has correct href', async () => {
    const { container } = render(e(Navbar));
    await waitFor(() => {
      const links = container.querySelectorAll('a[href="/learn"]');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  it('/learn redirects to /learn/diagnostic for new users', async () => {
    mockCreateServerSupabase.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    });
    mockGetConceptSummaries.mockResolvedValue([{ slug: 'arrays-strings' }]);
    mockBuildStudentContext.mockResolvedValue({
      hasCompletedDiagnostic: false,
      nextRecommendedConcept: null,
      weakestConcepts: [],
      subscription: { sessionsRemaining: 3, weeklyLimit: 3 },
    });

    await LearnPage();
    expect(mockRedirect).toHaveBeenCalledWith('/learn/diagnostic');
  });

  it('/learn shows concept picker for returning users', async () => {
    mockCreateServerSupabase.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    });
    mockGetConceptSummaries.mockResolvedValue([{ slug: 'arrays-strings' }]);
    mockBuildStudentContext.mockResolvedValue({
      hasCompletedDiagnostic: true,
      nextRecommendedConcept: 'arrays-strings',
      weakestConcepts: [],
      subscription: { sessionsRemaining: 3, weeklyLimit: 3 },
    });

    const page = await LearnPage();
    expect(page).toBeTruthy();
    expect(mockRedirect).not.toHaveBeenCalledWith('/learn/diagnostic');
  });

  it('/learn/invalid-slug returns 404', async () => {
    mockCreateServerSupabase.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    });
    mockGetConceptSummaries.mockResolvedValue([{ slug: 'arrays-strings' }]);

    await LearnSlugPage({ params: Promise.resolve({ slug: 'invalid-slug' }) });
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('learn routes are protected (redirect to sign-in when unauthenticated)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockCreateServerClient.mockReturnValue({
      auth: { getUser: mockGetUser },
    });

    const req = new NextRequest('http://localhost:3000/learn');
    const res = await middleware(req);

    expect(res.headers.get('location')).toContain('/login');
    expect(res.headers.get('location')).toContain('redirect=%2Flearn');
  });

  it('mobile bottom nav includes Learn tab', async () => {
    const { container } = render(e(Navbar));

    await waitFor(() => {
      const links = container.querySelectorAll('a[href="/learn"]');
      expect(links.length).toBeGreaterThan(0);
    });
  });
});
