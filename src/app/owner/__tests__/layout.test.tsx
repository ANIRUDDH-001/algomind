/**
 * @file src/app/owner/__tests__/layout.test.tsx
 * @purpose Smoke tests for owner layout: back navigation and HTML landmark integrity.
 * @tech Vitest, React Testing Library, JSDOM
 */
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock Next.js Link to render a plain anchor in tests
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock Next.js navigation hooks used by the layout
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/owner/overview'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Stub out auth / Supabase calls the layout might trigger
vi.mock('@/lib/supabase/client', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}));

// Import the layout component — adjust path if the default export name differs
import OwnerLayout from '../layout';

afterEach(() => cleanup());

describe('OwnerLayout', () => {
  it('renders a link back to /dashboard', () => {
    render(
      <OwnerLayout>
        <div data-testid="child">content</div>
      </OwnerLayout>
    );
    // There should be at least one anchor pointing to /dashboard
    const backLinks = screen
      .getAllByRole('link')
      .filter((el) => el.getAttribute('href') === '/dashboard');
    expect(backLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render a nested <main> landmark inside owner layout', () => {
    const { container } = render(
      <OwnerLayout>
        <div>child</div>
      </OwnerLayout>
    );
    const mainElements = container.querySelectorAll('main');
    // The root layout renders its own <main>; owner layout must NOT add another one
    expect(mainElements.length).toBe(0);
  });

  it('renders children inside the content area', () => {
    render(
      <OwnerLayout>
        <div data-testid="owner-child">hello owner</div>
      </OwnerLayout>
    );
    expect(screen.getByTestId('owner-child')).toBeDefined();
  });
});
