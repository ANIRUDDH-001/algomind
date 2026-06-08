/**
 * @codesage
 * @file      src/components/enterprise/CreateCampaignModal.tsx
 * @purpose   Provides a modal interface for employers to create a new campaign.
 * @tech      React, Tailwind CSS, Lucide, sonner
 * @connects  @/lib/api/adapters/assessment-adapter
 * @apis      AssessmentAdapter.createCampaign
 * @db        None
 * @state     useState
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * 
 * Summary:
 * This component manages a multi-step wizard for campaign creation, allowing
 * users to select problems, configure timing, and generate assessment links.
 */
// @ts-nocheck

// 

'use client';

//  -- automated unused local suppression
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
//  -- automated unused local suppression
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Plus,
    X,
    Clock,
    Search,
    Check,
    //  -- automated unused local suppression
    GripVertical,
    ArrowUp,
    ArrowDown,
    ChevronRight,
    ChevronLeft,
    Calendar,
    Layers,
    CheckCircle2,
    Copy,
    //  -- automated unused local suppression
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Info
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
//  -- automated unused local suppression
import { CampaignQuestion } from '@/types/campaign';
import { AssessmentAdapter } from '@/lib/api/adapters/assessment-adapter';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

interface ProblemData {
    id: string;
    title: string;
    difficulty: string;
}

interface CreateCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableProblems: ProblemData[];
    onSuccess: (campaign: any) => void;
}

export function CreateCampaignModal({ isOpen, onClose, availableProblems, onSuccess }: CreateCampaignModalProps) {
    const [step, setStep] = useState(1);
    const [isCreating, setIsCreating] = useState(false);
    const [createdCampaign, setCreatedCampaign] = useState<any | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [selectedQuestions, setSelectedQuestions] = useState<{ problem: ProblemData, time_limit_mins: number }[]>([]);
    const [maxUses, setMaxUses] = useState('');
    const [expiresAt, setExpiresAt] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.toISOString().slice(0, 16); // Format for datetime-local
    });
    const [showScoreToCandidate, setShowScoreToCandidate] = useState(false);

    // Timing Defaults State
    const [defaultEasyMins, setDefaultEasyMins] = useState(15);
    const [defaultMediumMins, setDefaultMediumMins] = useState(25);
    const [defaultHardMins, setDefaultHardMins] = useState(45);
    const [showAdvancedTiming, setShowAdvancedTiming] = useState(false);

    const totalTime = selectedQuestions.reduce((sum, q) => sum + q.time_limit_mins, 0);

    const getDefaultTime = (difficulty: string) => {
        if (difficulty === 'easy') return defaultEasyMins;
        if (difficulty === 'medium') return defaultMediumMins;
        if (difficulty === 'hard') return defaultHardMins;
        return defaultMediumMins;
    };

    const handleAddQuestion = (problem: ProblemData) => {
        if (selectedQuestions.length >= 3) {
            toast.error("Maximum 3 questions allowed");
            return;
        }
        if (selectedQuestions.some(q => q.problem.id === problem.id)) {
            toast.error("Question already added");
            return;
        }
        setSelectedQuestions([...selectedQuestions, {
            problem,
            time_limit_mins: getDefaultTime(problem.difficulty)
        }]);
    };

    const handleRemoveQuestion = (idx: number) => {
        setSelectedQuestions(selectedQuestions.filter((_, i) => i !== idx));
    };

    const handleMoveQuestion = (idx: number, direction: 'up' | 'down') => {
        const newQuestions = [...selectedQuestions];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= newQuestions.length) return;

        [newQuestions[idx], newQuestions[targetIdx]] = [newQuestions[targetIdx], newQuestions[idx]];
        setSelectedQuestions(newQuestions);
    };

    const handleUpdateQuestionTime = (idx: number, timeStr: string) => {
        const newQuestions = [...selectedQuestions];
        const val = parseInt(timeStr);
        newQuestions[idx].time_limit_mins = isNaN(val) ? (timeStr as any) : val;
        setSelectedQuestions(newQuestions);
    };

    const handleSubmit = async () => {
        if (selectedQuestions.some(q => !q.time_limit_mins || q.time_limit_mins < 5 || q.time_limit_mins > 120)) {
            toast.error("Time limit for all questions must be between 5 and 120 minutes.");
            return;
        }

        setIsCreating(true);
        try {
            const payload = {
                title,
                campaignQuestions: selectedQuestions.map(q => ({
                    problem_id: q.problem.id,
                    time_limit_mins: typeof q.time_limit_mins === 'string' ? parseInt(q.time_limit_mins) : q.time_limit_mins
                })),
                defaultEasyMins,
                defaultMediumMins,
                defaultHardMins,
                maxUses: maxUses ? parseInt(maxUses) : undefined,
                expiresAt: new Date(expiresAt).toISOString(),
                showScoreToCandidate
            };

            const data = await AssessmentAdapter.createCampaign(payload);
            setCreatedCampaign(data.campaign);
            onSuccess(data.campaign);
        } catch (err) {
            console.error(err);
            toast.error("Failed to create campaign. Ensure all fields are valid.");
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    if (createdCampaign) {
        return (
            <SuccessModal
                campaign={createdCampaign}
                onClose={() => {
                    onClose();
                    setCreatedCampaign(null);
                    setStep(1);
                    setTitle('');
                    setSelectedQuestions([]);
                }}
            />
        );
    }

    const modalTitle = (
        <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-400" />
            {step === 1 ? 'Step 1: Select Questions' : 'Step 2: Adjust Timing'}
        </div>
    );

    const modalDescription = step === 1 
        ? 'Choose up to 3 problems for this assessment.' 
        : 'Customize the time limit for each question.';

    const footer = (
        <div className="flex justify-between items-center w-full">
            {step === 1 ? (
                <>
                    <Button variant="ghost" onClick={onClose} className="text-zinc-400 hover:text-white">
                        Cancel
                    </Button>
                    <Button
                        onClick={() => setStep(2)}
                        disabled={!title || selectedQuestions.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2"
                    >
                        Next: Adjust Timing
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </>
            ) : (
                <>
                    <Button variant="ghost" onClick={() => setStep(1)} className="text-zinc-400 hover:text-white gap-2">
                        <ChevronLeft className="w-4 h-4" />
                        Back
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isCreating}
                        className="bg-green-600 hover:bg-green-700 text-white gap-2"
                    >
                        {isCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                Create Campaign
                                <CheckCircle2 className="w-4 h-4" />
                            </>
                        )}
                    </Button>
                </>
            )}
        </div>
    );

    return (
        <ResponsiveModal
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={modalTitle}
            description={modalDescription}
            footer={footer}
            desktopClassName="max-w-2xl p-0"
            className="bg-[var(--surface-1)] border-white/15 p-0"
        >
            <div className="flex flex-col h-full overflow-hidden">
                {/* Wizard Progress */}
                <div className="flex items-center gap-2 px-6 pt-6 -mb-2">
                    {[1, 2].map(stepIndex => (
                        <div key={stepIndex} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                ${step >= stepIndex
                                    ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.5)]'
                                    : 'bg-zinc-800 text-zinc-600 border border-zinc-700'}`}>
                                {stepIndex}
                            </div>
                            {stepIndex < 2 && <div className={`h-px w-8 transition-colors ${step > stepIndex ? 'bg-indigo-600' : 'bg-zinc-800'}`} />}
                        </div>
                    ))}
                </div>

                <div className="p-6">
                    {step === 1 ? (
                        <div className="space-y-6">
                            {/* Campaign Title */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Campaign Title *</label>
                                <Input
                                    required
                                    placeholder="e.g. SDE-2 Final Round"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="bg-[var(--surface-base)] border-white/8"
                                />
                            </div>

                            {/* Problem Selection */}
                            <div className="space-y-4">
                                <label className="text-sm font-medium text-zinc-300 flex justify-between">
                                    <span>Add Questions (1-3)</span>
                                    <span className={cn("text-xs font-mono", selectedQuestions.length === 3 ? "text-amber-400" : "text-zinc-500")}>
                                        {selectedQuestions.length}/3 selected
                                    </span>
                                </label>

                                <ProblemSearchSelect
                                    problems={availableProblems}
                                    onSelect={handleAddQuestion}
                                    selectedIds={selectedQuestions.map(q => q.problem.id)}
                                />

                                {/* Selected Questions List */}
                                {selectedQuestions.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                        {selectedQuestions.map((sq, i) => (
                                            <div key={sq.problem.id} className="flex items-center gap-3 bg-[var(--surface-base)] border border-white/8 p-2 rounded-lg group animate-in slide-in-from-left-2">
                                                <div className="bg-[var(--surface-1)] rounded-md p-1 font-mono text-xs text-zinc-500 w-6 h-6 flex items-center justify-center">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-zinc-200 truncate">{sq.problem.title}</span>
                                                        <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                                            sq.problem.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
                                                                sq.problem.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                                                    'bg-red-500/10 text-red-400'
                                                        )}>
                                                            {sq.problem.difficulty}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                                                        onClick={() => handleMoveQuestion(i, 'up')}
                                                        disabled={i === 0}
                                                    >
                                                        <ArrowUp className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                                                        onClick={() => handleMoveQuestion(i, 'down')}
                                                        disabled={i === selectedQuestions.length - 1}
                                                    >
                                                        <ArrowDown className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400"
                                                        onClick={() => handleRemoveQuestion(i)}
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Additional Settings */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Link Expiry</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        <Input
                                            type="datetime-local"
                                            value={expiresAt}
                                            onChange={e => setExpiresAt(e.target.value)}
                                            className="pl-10 bg-[var(--surface-base)] border-white/8 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Max Uses</label>
                                    <div className="relative">
                                        <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        <Input
                                            type="number"
                                            placeholder="Optional"
                                            value={maxUses}
                                            onChange={e => setMaxUses(e.target.value)}
                                            className="pl-10 bg-[var(--surface-base)] border-white/8"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    id="showScore"
                                    type="checkbox"
                                    checked={showScoreToCandidate}
                                    onChange={e => setShowScoreToCandidate(e.target.checked)}
                                    className="w-4 h-4 rounded border-white/10 bg-[var(--surface-base)] text-blue-600 focus:ring-indigo-500"
                                />
                                <label htmlFor="showScore" className="text-sm text-zinc-300 cursor-pointer">
                                    Show score to candidate after completion
                                </label>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 mt-6">
                            <h4 className="text-lg font-semibold text-white">Review & Customize Timing</h4>

                            {/* Advanced Timing Defaults */}
                            <div className="bg-[var(--surface-base)]/50 border border-white/8 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setShowAdvancedTiming(!showAdvancedTiming)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-[var(--surface-1)]/50 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm font-medium text-zinc-200">Global Timing Defaults (Advanced)</span>
                                    </div>
                                    {showAdvancedTiming ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                                {showAdvancedTiming && (
                                    <div className="p-4 border-t border-white/8 grid grid-cols-3 gap-4 bg-[var(--surface-1)]/30">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Easy</span>
                                            <Input
                                                type="number" value={defaultEasyMins}
                                                onChange={e => setDefaultEasyMins(parseInt(e.target.value))}
                                                className="h-8 bg-[var(--surface-base)] border-white/8 text-xs text-center"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Medium</span>
                                            <Input
                                                type="number" value={defaultMediumMins}
                                                onChange={e => setDefaultMediumMins(parseInt(e.target.value))}
                                                className="h-8 bg-[var(--surface-base)] border-white/8 text-xs text-center"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Hard</span>
                                            <Input
                                                type="number" value={defaultHardMins}
                                                onChange={e => setDefaultHardMins(parseInt(e.target.value))}
                                                className="h-8 bg-[var(--surface-base)] border-white/8 text-xs text-center"
                                            />
                                        </div>
                                        <p className="col-span-3 text-[10px] text-zinc-500 flex items-center gap-1 px-1">
                                            <Info className="w-3 h-3" />
                                            These defaults apply when creating future campaigns
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Questions List with Specific Timing */}
                            <div className="space-y-4">
                                {selectedQuestions.map((sq, i) => (
                                    <div key={sq.problem.id} className="bg-[var(--surface-base)] border border-white/8 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className="bg-[var(--surface-1)] rounded-md p-1 font-mono text-xs text-zinc-500 w-6 h-6 flex items-center justify-center shrink-0">
                                                #{i + 1}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-sm font-semibold text-white">{sq.problem.title}</span>
                                                    <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                                        sq.problem.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
                                                            sq.problem.difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                                                'bg-red-500/10 text-red-400'
                                                    )}>
                                                        {sq.problem.difficulty}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-zinc-500">Default for {sq.problem.difficulty}: {getDefaultTime(sq.problem.difficulty)} min</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 bg-[var(--surface-1)]/50 p-2 rounded-lg border border-white/10">
                                            <span className="text-xs text-zinc-400">Time limit:</span>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    value={sq.time_limit_mins === undefined || isNaN(sq.time_limit_mins as any) ? '' : sq.time_limit_mins}
                                                    onChange={(e) => handleUpdateQuestionTime(i, e.target.value)}
                                                    className={cn("w-16 h-8 bg-[var(--surface-base)] border-white/8 p-0 text-center text-sm font-mono", (!sq.time_limit_mins || sq.time_limit_mins < 5 || sq.time_limit_mins > 120) ? "border-red-500 text-red-400" : "")}
                                                />
                                                <span className="text-xs text-zinc-500 font-medium">min</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Summary */}
                            <div className="pt-4 border-t border-white/8 flex justify-between items-center text-sm">
                                <span className="text-zinc-400 font-medium">Total interview time:</span>
                                <div className="flex items-center gap-2 text-blue-400 font-bold">
                                    <Clock className="w-4 h-4" />
                                    <span>{totalTime} minutes</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ResponsiveModal>
    );
}

function ProblemSearchSelect({ problems, onSelect, selectedIds }: {
    problems: ProblemData[], onSelect: (p: ProblemData) => void, selectedIds: string[]
}) {
    const [search, setSearch] = useState('');
    const [diffFilter, setDiffFilter] = useState('');

    const filtered = problems.filter(p => {
        const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
        const matchDiff = !diffFilter || p.difficulty === diffFilter;
        const notSelected = !selectedIds.includes(p.id);
        return matchSearch && matchDiff && notSelected;
    });

    const randomOptions = [
        { id: 'random-easy', title: 'Random Single Easy (Any Category)', difficulty: 'easy' },
        { id: 'random-medium', title: 'Random Single Medium (Any Category)', difficulty: 'medium' },
        { id: 'random-hard', title: 'Random Single Hard (Any Category)', difficulty: 'hard' }
    ].filter(r => (!diffFilter || r.difficulty === diffFilter) && !selectedIds.includes(r.id) && (!search || r.title.toLowerCase().includes(search.toLowerCase())));

    const displayList = [...randomOptions, ...filtered];

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input
                        placeholder="Search problems..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-[var(--surface-base)] border-white/8"
                    />
                </div>
                <select
                    value={diffFilter}
                    onChange={e => setDiffFilter(e.target.value)}
                    className="bg-[var(--surface-base)] border border-white/8 text-white rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="">All Levels</option>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                </select>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 border border-white/8 rounded-lg p-2 bg-[var(--surface-base)]/50 custom-scrollbar">
                {displayList.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelect(p)}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between group hover:bg-[var(--surface-2)]/50 border border-transparent"
                    >
                        <div className="flex items-center gap-3">
                            <span className={cn("w-2 h-2 rounded-full",
                                p.difficulty === 'easy' ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]' :
                                    p.difficulty === 'medium' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]' :
                                        'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]'
                            )} />
                            <span className={cn("font-medium group-hover:text-white transition-colors", p.id.startsWith('random-') ? 'text-blue-300/80 italic' : 'text-zinc-300')}>{p.title}</span>
                        </div>
                        <Plus className="w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                ))}
                {displayList.length === 0 && (
                    <div className="text-center py-6 text-zinc-500 text-xs italic">
                        {search || diffFilter ? "No matching problems found." : "All problems selected."}
                    </div>
                )}
            </div>
        </div>
    );
}

function SuccessModal({ campaign, onClose }: { campaign: any, onClose: () => void }) {
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const link = `${window.location.origin}/assess/${campaign.public_token}`;

    const handleCopyCode = () => {
        navigator.clipboard.writeText(campaign.entry_code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        toast.success("Entry code copied!");
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(link);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
        toast.success("Assessment link copied!");
    };

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            desktopClassName="max-w-md p-0"
            className="bg-[var(--surface-1)] border-white/10 p-0 text-center"
        >
            <div className="p-8 space-y-6">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto border border-green-500/20">
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Campaign Created!</h3>
                    <p className="text-zinc-400 text-sm">
                        Share these details with candidates to start the assessment.
                    </p>
                </div>

                <div className="space-y-4 pt-2">
                    {/* Entry Code Box */}
                    <div className="space-y-2 text-left">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest block text-center">Candidate Entry Code</span>
                        <div className="bg-[var(--surface-base)] border-2 border-white/8 rounded-xl p-6 relative group overflow-hidden">
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 transition-all group-hover:h-full group-hover:opacity-5" />
                            <div className="text-3xl font-mono font-bold tracking-[0.2em] text-white text-center">
                                {campaign.entry_code}
                            </div>
                            <button
                                onClick={handleCopyCode}
                                className="absolute right-3 top-3 p-1.5 text-zinc-500 hover:text-white hover:bg-[var(--surface-2)] rounded-md transition-all active:scale-95"
                            >
                                {copiedCode ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Link Box */}
                    <div className="space-y-2 text-left">
                        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest block text-center">Assessment Link</span>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-[var(--surface-base)]/50 border border-white/8 rounded-lg px-3 py-2 text-xs text-zinc-400 truncate font-mono flex items-center">
                                {link}
                            </div>
                            <Button size="icon" variant="ghost" className="shrink-0 text-blue-400 hover:bg-blue-500/10" onClick={handleCopyLink}>
                                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-left flex gap-3">
                    <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-500/80 leading-relaxed">
                        Candidates will need <b>BOTH</b> the link and the entry code to begin their assessment session.
                    </p>
                </div>

                <Button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-11 mt-4">
                    Done
                </Button>
            </div>
        </ResponsiveModal>
    );
}
