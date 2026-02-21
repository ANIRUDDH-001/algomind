'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';

export interface CompanyProfile {
    id: string;
    name: string;
    emoji: string;
    theme_color: string;
    persona_prompt: string;
}

// Default fallback data in case DB fetch fails or table isn't populated yet
const DEFAULT_COMPANIES: CompanyProfile[] = [
    {
        id: 'general',
        name: 'General',
        emoji: '🧠',
        theme_color: 'slate',
        persona_prompt: ''
    },
    {
        id: 'google',
        name: 'Google',
        emoji: '🔍',
        theme_color: 'blue',
        persona_prompt: 'You are interviewing for Google. Focus heavily on algorithmic efficiency, Big-O complexity (time and space), and scaling considerations. Expect candidates to find the most optimal solution. Be rigorous but collaborative.'
    },
    {
        id: 'meta',
        name: 'Meta',
        emoji: '♾️',
        theme_color: 'blue-purple',
        persona_prompt: 'You are interviewing for Meta. Prioritize speed, bug-free coding on the first try, and handling edge cases perfectly. Push the candidate to move quickly and implement the solution without hesitation once the approach is agreed upon.'
    },
    {
        id: 'amazon',
        name: 'Amazon',
        emoji: '📦',
        theme_color: 'amber',
        persona_prompt: 'You are interviewing for Amazon. Emphasize Leadership Principles, especially "Deliver Results" and "Dive Deep". Focus on practical, maintainable code, object-oriented design where applicable, and dealing with ambiguous requirements.'
    },
    {
        id: 'startup',
        name: 'Startup',
        emoji: '🚀',
        theme_color: 'green',
        persona_prompt: 'You are interviewing for a fast-growing YC Startup. Value "getting things done", pragmatism, and full-stack awareness over micro-optimizations. Ask about how they would organize the code for quick iterations and handle changing requirements.'
    }
];

interface CompanyModeSelectorProps {
    selectedCompany: string | null;
    onSelect: (companyId: string | null, persona: string | null) => void;
}

export function CompanyModeSelector({ selectedCompany, onSelect }: CompanyModeSelectorProps) {
    const [companies, setCompanies] = useState<CompanyProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchProfiles() {
            try {
                const supabase = getSupabase();
                if (!supabase) throw new Error("Supabase not configured");
                const { data, error } = await supabase
                    .from('company_profiles')
                    .select('*')
                    .order('name');

                if (error || !data || data.length === 0) {
                    console.log('Using default company profiles (DB table missing or empty)');
                    setCompanies(DEFAULT_COMPANIES);

                    if (selectedCompany) {
                        const matched = DEFAULT_COMPANIES.find(c => c.id === selectedCompany);
                        if (matched) onSelect(matched.id, matched.persona_prompt);
                    }
                } else {
                    // Prepend "General" if not in DB
                    const hasGeneral = data.find((c: CompanyProfile) => c.id === 'general');
                    const fullList = hasGeneral ? data : [DEFAULT_COMPANIES[0], ...data];
                    setCompanies(fullList as CompanyProfile[]);

                    if (selectedCompany) {
                        const matched = (fullList as CompanyProfile[]).find(c => c.id === selectedCompany);
                        if (matched) onSelect(matched.id, matched.persona_prompt);
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch company profiles, using defaults', err);
                setCompanies(DEFAULT_COMPANIES);
            } finally {
                setIsLoading(false);
            }
        }

        fetchProfiles();
    }, []);

    // Helper to get Tailwind classes based on theme_color string
    const getColorClasses = (color: string, isActive: boolean) => {
        if (!isActive) {
            return "bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200";
        }

        switch (color) {
            case 'blue':
                return "bg-blue-500/20 border-blue-500 text-blue-400";
            case 'blue-purple':
                return "bg-indigo-500/20 border-indigo-500 text-indigo-400";
            case 'amber':
                return "bg-amber-500/20 border-amber-500 text-amber-500";
            case 'green':
                return "bg-emerald-500/20 border-emerald-500 text-emerald-400";
            case 'slate':
            default:
                return "bg-slate-700/50 border-slate-500 text-white";
        }
    };

    if (isLoading) {
        return (
            <div className="w-full mb-6">
                <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Interview Mode</h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex-none w-[120px] h-12 bg-slate-800/50 animate-pulse rounded-xl border border-slate-800" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full mb-6">
            <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Interview Mode</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                {companies.map((company) => {
                    const isActive = selectedCompany === company.id || (selectedCompany === null && company.id === 'general');

                    return (
                        <button
                            key={company.id}
                            onClick={() => {
                                if (company.id === 'general') {
                                    onSelect(null, null);
                                } else {
                                    onSelect(company.id, company.persona_prompt);
                                }
                            }}
                            className={cn(
                                "flex-none snap-start min-w-[120px] h-12 px-4 rounded-xl border transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm",
                                getColorClasses(company.theme_color, isActive),
                                isActive ? "shadow-[0_0_15px_rgba(0,0,0,0.2)] scale-[1.02]" : "scale-100"
                            )}
                        >
                            <span className="text-lg">{company.emoji}</span>
                            <span>{company.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
