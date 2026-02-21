'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Zap, Brain, Share2, Briefcase, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function EmployerPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [accountType, setAccountType] = useState<string | null>(null);
    const [checkingType, setCheckingType] = useState(true);

    // Upgrade state
    const [companyName, setCompanyName] = useState('');
    const [isUpgrading, setIsUpgrading] = useState(false);
    const [upgradeError, setUpgradeError] = useState('');

    useEffect(() => {
        if (!user) {
            setCheckingType(false);
            return;
        }

        const fetchType = async () => {
            const supabase = getSupabase();
            if (!supabase) {
                setCheckingType(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('account_type')
                .eq('id', user.id)
                .single();

            if (!error && data?.account_type) {
                if (data.account_type === 'employer') {
                    router.push('/employer/dashboard');
                } else {
                    setAccountType(data.account_type);
                }
            }
            setCheckingType(false);
        };

        fetchType();
    }, [user, router]);

    const handleGetStarted = () => {
        router.push('/login?redirectTo=/employer/dashboard');
    };

    const handleUpgrade = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpgradeError('');

        const trimmed = companyName.trim();
        if (trimmed.length < 2 || trimmed.length > 100) {
            setUpgradeError('Company name must be between 2 and 100 characters');
            return;
        }

        setIsUpgrading(true);
        try {
            const res = await fetch('/api/employer/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: trimmed })
            });

            if (res.ok) {
                toast.success('Account upgraded successfully! Welcome to Employer.');
                router.refresh(); // Sync server-side session to reflect new account_type
                router.push('/employer/dashboard');
            } else {
                const err = await res.json();
                const msg = (err as { error?: string }).error || 'Upgrade failed. Please try again.';
                toast.error(msg);
                setUpgradeError(msg);
                setIsUpgrading(false);
            }
        } catch {
            const msg = 'Network error. Please check your connection and try again.';
            toast.error(msg);
            setUpgradeError(msg);
            setIsUpgrading(false);
        }
    };

    // Show loading state while checking auth and account type
    if (authLoading || checkingType) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
            </div>
        );
    }

    // If logged in as candidate, show the upgrade prompt
    if (user && accountType === 'candidate') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
                <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-sm p-8 rounded-xl border border-slate-700 text-center">
                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Briefcase className="w-8 h-8 text-blue-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">Are you hiring?</h2>
                    <p className="text-slate-300 mb-8">
                        Upgrade your account to Employer to start screening candidates with AI-powered technical interviews.
                    </p>

                    <form onSubmit={handleUpgrade} className="space-y-4 text-left">
                        <div>
                            <label htmlFor="companyName" className="block text-sm font-medium text-slate-300 mb-1">
                                Company Name
                            </label>
                            <input
                                id="companyName"
                                type="text"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Acme Corp"
                                required
                                minLength={2}
                                maxLength={100}
                                disabled={isUpgrading}
                            />
                        </div>

                        {upgradeError && (
                            <p className="text-red-400 text-sm">{upgradeError}</p>
                        )}

                        <Button
                            type="submit"
                            disabled={isUpgrading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2"
                        >
                            {isUpgrading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                            Upgrade to Employer
                        </Button>
                    </form>
                </div>
            </div>
        );
    }

    // Public marketing page
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
            <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-32">
                {/* Hero Section */}
                <div className="text-center mb-20 max-w-4xl mx-auto">
                    <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 leading-tight">
                        Screen candidates with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">AI-powered</span> technical interviews
                    </h1>
                    <p className="text-xl sm:text-2xl text-slate-300 mb-10 leading-relaxed">
                        Create a timed interview link. Send to candidates. Get back structured cognitive reports.
                    </p>

                    <Button
                        onClick={handleGetStarted}
                        size="lg"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-7 text-xl rounded-full shadow-lg shadow-blue-900/50 transition-all hover:scale-105"
                    >
                        Get Started Free <span className="ml-2">→</span>
                    </Button>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mt-24">
                    <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-colors group">
                        <div className="w-14 h-14 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-500/20 transition-colors">
                            <Zap className="w-7 h-7 text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">No setup</h3>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Generate an interview link in seconds. No complex integrations or applicant tracking systems required.
                        </p>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700 hover:border-purple-500/50 transition-colors group">
                        <div className="w-14 h-14 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-purple-500/20 transition-colors">
                            <Brain className="w-7 h-7 text-purple-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">AI-graded</h3>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Our AI agents conduct a rigorous, conversational technical interview and evaluate problem-solving skills fairly.
                        </p>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-colors group">
                        <div className="w-14 h-14 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-500/20 transition-colors">
                            <Share2 className="w-7 h-7 text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-4">Shareable reports</h3>
                        <p className="text-slate-400 text-lg leading-relaxed">
                            Receive a detailed cognitive narrative report for each candidate that you can share with your hiring team.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
