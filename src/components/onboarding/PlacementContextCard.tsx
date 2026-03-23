'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PlacementContextCardProps {
    onComplete: (data: { placementMonth: string; targetCompanies: string[] }) => void;
    onSkip: () => void;
}

function buildMonthOptions(): Array<{ value: string; label: string }> {
    const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
    });
    const today = new Date();
    const startYear = today.getFullYear();
    const startMonth = today.getMonth();

    return Array.from({ length: 18 }, (_, index) => {
        const date = new Date(startYear, startMonth + index, 1);
        const value = [
            String(date.getFullYear()),
            String(date.getMonth() + 1).padStart(2, '0'),
            '01',
        ].join('-');

        return {
            value,
            label: formatter.format(date),
        };
    });
}

export function PlacementContextCard({ onComplete, onSkip }: PlacementContextCardProps) {
    const monthOptions = buildMonthOptions();
    const [placementMonth, setPlacementMonth] = useState('');
    const [targetCompanies, setTargetCompanies] = useState('');

    const handleSubmit = () => {
        if (!placementMonth) return;

        onComplete({
            placementMonth,
            targetCompanies: targetCompanies
                .split(',')
                .map((company) => company.trim())
                .filter(Boolean),
        });
    };

    return (
        <section className="rounded-2xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-sm">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-white">Let&apos;s personalize your prep</h2>
                <p className="text-sm font-medium text-slate-400">Two quick questions - 30 seconds</p>
            </div>

            <div className="mt-6 space-y-6">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-100">When is your placement season?</p>
                        <label htmlFor="placement-month" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            Placement Month
                        </label>
                    </div>
                    <select
                        id="placement-month"
                        value={placementMonth}
                        onChange={(event) => setPlacementMonth(event.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none transition focus:border-indigo-500/60"
                    >
                        <option value="">Select month</option>
                        {monthOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-100">Which companies are you targeting?</p>
                        <label htmlFor="target-companies" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            Target Companies
                        </label>
                    </div>
                    <Input
                        id="target-companies"
                        value={targetCompanies}
                        onChange={(event) => setTargetCompanies(event.target.value)}
                        placeholder="e.g. Google, Microsoft, TCS, Infosys"
                        className="h-11 rounded-xl border-white/10 bg-slate-950/70 text-slate-100 placeholder:text-slate-500"
                    />
                </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button
                    onClick={handleSubmit}
                    disabled={!placementMonth}
                    className="btn-primary flex-1"
                >
                    Save & Continue
                </Button>
                <Button
                    onClick={onSkip}
                    variant="ghost"
                    className="flex-1 rounded-xl border border-white/10 bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"
                >
                    Skip for now
                </Button>
            </div>
        </section>
    );
}
