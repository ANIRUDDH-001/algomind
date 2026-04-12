'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PlacementContextCardProps {
    onComplete: (data: { placementMonth: string; targetCompanies: string[] }) => void;
    onSkip: () => void;
}

export function PlacementContextCard({ onComplete, onSkip }: PlacementContextCardProps) {
    const [placementMonth, setPlacementMonth] = useState('');
    const [targetCompanies, setTargetCompanies] = useState('');
    const [calendarMonth, setCalendarMonth] = useState(new Date());

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

    const generateMonths = () => {
        const months = [];
        const today = new Date();
        for (let i = 0; i < 18; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
            months.push(date);
        }
        return months;
    };

    const months = generateMonths();
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

    const handleMonthSelect = (date: Date) => {
        const value = [
            String(date.getFullYear()),
            String(date.getMonth() + 1).padStart(2, '0'),
            '01',
        ].join('-');
        setPlacementMonth(value);
    };

    const prevMonth = () => {
        const newMonth = new Date(calendarMonth);
        newMonth.setMonth(newMonth.getMonth() - 3);
        setCalendarMonth(newMonth);
    };

    const nextMonth = () => {
        const newMonth = new Date(calendarMonth);
        newMonth.setMonth(newMonth.getMonth() + 3);
        setCalendarMonth(newMonth);
    };

    const visibleMonths = months.filter(
        (m) =>
            m.getFullYear() === calendarMonth.getFullYear() &&
            (m.getMonth() >= calendarMonth.getMonth() && m.getMonth() <= calendarMonth.getMonth() + 2)
    );

    return (
        <section className="rounded-2xl border border-white/5 bg-[var(--surface-1)]/40 p-6 backdrop-blur-sm">
            <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight text-white">Let&apos;s personalize your prep</h2>
                <p className="text-sm font-medium text-zinc-400">Two quick questions - 30 seconds</p>
            </div>

            <div className="mt-6 space-y-6">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-100">When is your placement season?</p>
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                            Select Month & Year
                        </label>
                    </div>
                    <div className="space-y-3 rounded-xl border border-white/10 bg-[var(--surface-base)]/70 p-4">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={prevMonth}
                                className="rounded-lg p-2 hover:bg-white/5 transition"
                                aria-label="Previous months"
                            >
                                <ChevronLeft className="w-4 h-4 text-zinc-400" />
                            </button>
                            <span className="text-sm font-semibold text-zinc-200">
                                {calendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                            </span>
                            <button
                                onClick={nextMonth}
                                className="rounded-lg p-2 hover:bg-white/5 transition"
                                aria-label="Next months"
                            >
                                <ChevronRight className="w-4 h-4 text-zinc-400" />
                            </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {visibleMonths.map((date) => {
                                const isSelected =
                                    placementMonth ===
                                    [
                                        String(date.getFullYear()),
                                        String(date.getMonth() + 1).padStart(2, '0'),
                                        '01',
                                    ].join('-');
                                return (
                                    <button
                                        key={`${date.getFullYear()}-${date.getMonth()}`}
                                        onClick={() => handleMonthSelect(date)}
                                        className={`rounded-lg py-3 px-2 text-sm font-medium transition ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-[var(--surface-2)] text-zinc-300 hover:bg-[var(--surface-3)]'
                                        }`}
                                    >
                                        {date.toLocaleString('en-US', { month: 'short' })}
                                        <div className="text-xs text-opacity-75 mt-0.5">{date.getFullYear()}</div>
                                    </button>
                                );
                            })}
                        </div>
                        {!placementMonth && (
                            <div className="text-xs text-zinc-500 text-center">
                                Select a month to continue
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-100">Which companies are you targeting?</p>
                        <label htmlFor="target-companies" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                            Target Companies
                        </label>
                    </div>
                    <Input
                        id="target-companies"
                        value={targetCompanies}
                        onChange={(event) => setTargetCompanies(event.target.value)}
                        placeholder="e.g. Google, Microsoft, TCS, Infosys"
                        className="h-11 rounded-xl border-white/10 bg-[var(--surface-base)]/70 text-zinc-100 placeholder:text-zinc-500"
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
                    className="flex-1 rounded-xl border border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white"
                >
                    Skip for now
                </Button>
            </div>
        </section>
    );
}
