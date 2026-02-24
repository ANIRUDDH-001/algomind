// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── jsdom polyfills ───
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
Element.prototype.scrollIntoView = vi.fn();

if (typeof window !== 'undefined') {
    class MockPointerEvent extends Event {
        button: number;
        ctrlKey: boolean;
        pointerType: string;
        constructor(type: string, props: PointerEventInit) {
            super(type, props);
            this.button = props.button || 0;
            this.ctrlKey = props.ctrlKey || false;
            this.pointerType = props.pointerType || 'mouse';
        }
    }
    window.PointerEvent = MockPointerEvent as any;
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();
}

// ─── Mocks ───
const mockPush = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: vi.fn(),
}));

vi.mock('@/components/auth/AuthProvider', () => ({
    useAuth: vi.fn(),
}));

vi.mock('@/hooks/useAdmin', () => ({
    useAdmin: vi.fn(),
}));

vi.mock('@/lib/demo/manager', () => ({
    isDemoMode: vi.fn(),
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ layoutId, children, whileTap, ...props }: any) => (
            <div data-layoutid={layoutId} data-testid="motion-div" {...props}>{children}</div>
        ),
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('next/link', () => ({
    default: ({ children, href, className, ...props }: any) => (
        <a href={href} className={className} {...props}>{children}</a>
    ),
}));

vi.mock('@/components/demo/DemoBanner', () => ({
    DemoBanner: () => <div data-testid="demo-banner">Demo Mode</div>,
}));

vi.mock('@/lib/utils', () => ({
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children, asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children, className, style, ...props }: any) => (
        <div data-testid="dropdown-content" className={className} style={style} {...props}>{children}</div>
    ),
    DropdownMenuItem: ({ children, onClick, className, ...props }: any) => (
        <div data-testid="dropdown-item" role="menuitem" onClick={onClick} className={className} {...props}>{children}</div>
    ),
    DropdownMenuLabel: ({ children, className }: any) => (
        <div data-testid="dropdown-label" className={className}>{children}</div>
    ),
    DropdownMenuSeparator: ({ className, style }: any) => (
        <hr data-testid="dropdown-separator" className={className} style={style} />
    ),
}));

vi.mock('lucide-react', () => ({
    LogOut: (props: any) => <span data-testid="icon-logout" className={props.className} />,
    Settings: (props: any) => <span data-testid="icon-settings" className={props.className} />,
    BarChart: (props: any) => <span data-testid="icon-barchart" className={props.className} />,
    Home: (props: any) => <span data-testid="icon-home" className={props.className} />,
    Mic: (props: any) => <span data-testid="icon-mic" className={props.className} />,
    Shield: (props: any) => <span data-testid="icon-shield" className={props.className} />,
    Flag: (props: any) => <span data-testid="icon-flag" className={props.className} />,
    Briefcase: (props: any) => <span data-testid="icon-briefcase" className={props.className} />,
    BookOpen: (props: any) => <span data-testid="icon-bookopen" className={props.className} />,
}));

// ─── Import mocks for direct access ───
import { useAuth } from '@/components/auth/AuthProvider';
import { usePathname } from 'next/navigation';
import { useAdmin } from '@/hooks/useAdmin';
import { isDemoMode } from '@/lib/demo/manager';

// ─── Import component ───
import { Navbar } from '../Navbar';

describe('Navbar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPush.mockClear();
        mockSignOut.mockClear();

        (usePathname as any).mockReturnValue('/');
        (useAdmin as any).mockReturnValue({ isAdmin: false });
        (isDemoMode as any).mockReturnValue(false);
        (useAuth as any).mockReturnValue({
            user: { id: '1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } },
            signOut: mockSignOut,
            loading: false,
            isConfigured: true,
        });

        global.fetch = vi.fn().mockImplementation((url: string) => {
            if (url.includes('/api/user/account-type')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ accountType: 'candidate' }) });
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
        });

        window.innerWidth = 1024;
    });

    afterEach(() => {
        cleanup();
    });

    it('1. Desktop (> 768px): bottom nav is NOT rendered (has md:hidden class)', async () => {
        const { container } = render(<Navbar />);
        await waitFor(() => {
            const bottomNavs = container.querySelectorAll('nav');
            const bottomNav = Array.from(bottomNavs).find(n => n.className.includes('bottom-0'));
            expect(bottomNav).toBeDefined();
            expect(bottomNav!.className).toContain('md:hidden');
        });
    });

    it('2. Mobile simulation: bottom nav IS present in DOM when user is logged in', async () => {
        window.innerWidth = 375;
        const { container } = render(<Navbar />);
        await waitFor(() => {
            const bottomNavs = container.querySelectorAll('nav');
            const bottomNav = Array.from(bottomNavs).find(n => n.className.includes('bottom-0'));
            expect(bottomNav).toBeDefined();
        });
    });

    it('3. Mobile: bottom nav is hidden when user is NOT logged in (guest)', async () => {
        (useAuth as any).mockReturnValue({
            user: null, signOut: mockSignOut, loading: false, isConfigured: true,
        });
        window.innerWidth = 375;
        const { container } = render(<Navbar />);
        const bottomNavs = container.querySelectorAll('nav');
        const bottomNav = Array.from(bottomNavs).find(n => n.className.includes('bottom-0'));
        expect(bottomNav).toBeUndefined();
    });

    it('4. Bottom nav has 4 items for candidate account type', async () => {
        window.innerWidth = 375;
        const { container } = render(<Navbar />);
        await waitFor(() => {
            const bottomNavs = container.querySelectorAll('nav');
            const bottomNav = Array.from(bottomNavs).find(n => n.className.includes('bottom-0'));
            const links = bottomNav?.querySelectorAll('a');
            expect(links?.length).toBe(4);
        });
    });

    it("5. Active route link has 'text-indigo-400' class (not blue)", async () => {
        (usePathname as any).mockReturnValue('/practice');
        const { container } = render(<Navbar />);
        await waitFor(() => {
            // Desktop nav link
            const desktopLinks = container.querySelectorAll('a[href="/practice"]');
            const desktopLink = desktopLinks[0];
            expect(desktopLink.className).toContain('text-indigo-400');

            // Mobile nav icon
            const bottomNavs = container.querySelectorAll('nav');
            const bottomNav = Array.from(bottomNavs).find(n => n.className.includes('bottom-0'));
            const mobileLink = bottomNav?.querySelector('a[href="/practice"]');
            const mobileSpan = mobileLink?.querySelector('span');
            expect(mobileSpan?.className).toContain('text-indigo-400');
        });
    });

    it("6. Inactive links have 'text-zinc-500' class", async () => {
        (usePathname as any).mockReturnValue('/');
        const { container } = render(<Navbar />);
        await waitFor(() => {
            const bottomNavs = container.querySelectorAll('nav');
            const bottomNav = Array.from(bottomNavs).find(n => n.className.includes('bottom-0'));
            const inactiveIcon = bottomNav?.querySelector('a[href="/practice"] [data-testid*="icon"]');
            expect(inactiveIcon?.className).toContain('text-zinc-500');
        });
    });

    it('7. Navbar top bar renders on all routes except /login', async () => {
        (usePathname as any).mockReturnValue('/login');
        const { container } = render(<Navbar />);
        expect(container.innerHTML).toBe('');
    });

    it('8. Logo renders with zinc gradient text (not slate)', () => {
        render(<Navbar />);
        const logoText = screen.getByText('AlgoMind');
        expect(logoText.className).toContain('from-zinc-100');
        expect(logoText.className).toContain('to-zinc-500');
    });

    it('9. Desktop nav links use layoutId="nav-active" for the indicator', async () => {
        const { container } = render(<Navbar />);
        await waitFor(() => {
            const indicator = container.querySelector('[data-layoutid="nav-active"]');
            expect(indicator).not.toBeNull();
        });
    });

    it('10. Active indicator has indigo background (not blue-600)', async () => {
        window.innerWidth = 375;
        const { container } = render(<Navbar />);
        await waitFor(() => {
            const mobileIndicator = container.querySelector('[data-layoutid="mobile-nav-active"]');
            expect(mobileIndicator).not.toBeNull();
            expect(mobileIndicator!.className).toContain('bg-indigo-400');
        });
    });

    it('11. User avatar button shows first letter of email', () => {
        render(<Navbar />);
        const avatarLetter = screen.getByText('T');
        expect(avatarLetter).toBeDefined();
    });

    it('12. Avatar hover shows glow ring div with negative inset', () => {
        const { container } = render(<Navbar />);
        const glowRing = container.querySelector('[class*="-inset-0.5"]');
        expect(glowRing).not.toBeNull();
        expect(glowRing!.className).toContain('opacity-0');
        expect(glowRing!.className).toContain('group-hover:opacity-100');
    });

    it('13. Dropdown menu renders with surface-2 background (not slate-900)', () => {
        const { container } = render(<Navbar />);
        const dropdownContent = container.querySelector('[data-testid="dropdown-content"]');
        expect(dropdownContent).not.toBeNull();
        const style = (dropdownContent as HTMLElement).style;
        expect(style.background).toContain('var(--surface-2)');
    });

    it('14. Sign out option calls signOut and redirects', async () => {
        const { container } = render(<Navbar />);
        const menuItems = container.querySelectorAll('[data-testid="dropdown-item"]');
        // Sign Out is the last menu item
        const signOutItem = Array.from(menuItems).find(el => el.textContent?.includes('Sign Out'));
        expect(signOutItem).toBeDefined();

        await act(async () => {
            fireEvent.click(signOutItem!);
        });

        await waitFor(() => {
            expect(mockSignOut).toHaveBeenCalled();
            expect(mockPush).toHaveBeenCalledWith('/');
        });
    });
});
