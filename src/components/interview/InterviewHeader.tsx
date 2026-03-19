import { Badge } from '@/components/ui/badge';

type InterviewMode = 'warm-up' | 'practice' | 'crunch' | 'sprint' | 'employer';

interface InterviewHeaderProps {
  problemTitle: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mode: InterviewMode;
  conceptTags?: string[];
}

const MODE_BADGE: Record<InterviewMode, { label: string; color: string }> = {
  'warm-up': { label: 'Warm Up', color: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/20' },
  'practice': { label: 'Practice', color: 'bg-blue-950/60 text-blue-400 border-blue-500/20' },
  'crunch': { label: 'Crunch', color: 'bg-amber-950/60 text-amber-400 border-amber-500/20' },
  'sprint': { label: 'Sprint', color: 'bg-red-950/60 text-red-400 border-red-500/20' },
  'employer': { label: 'Assessment', color: 'bg-purple-950/60 text-purple-400 border-purple-500/20' },
};

const DIFFICULTY_STYLES: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  hard: 'bg-red-500/15 text-red-400 border-red-500/25',
};

function normalizeTag(tag: string): string {
  return tag.replace(/-/g, ' ');
}

export function InterviewHeader({ problemTitle, difficulty, mode, conceptTags }: InterviewHeaderProps) {
  const badge = MODE_BADGE[mode] || MODE_BADGE['warm-up'];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-sm font-bold text-white whitespace-normal break-words flex-1">
          {problemTitle}
        </h1>
        <Badge className={`text-[10px] px-2 py-0 h-5 shrink-0 border mt-0.5 ${DIFFICULTY_STYLES[difficulty] || DIFFICULTY_STYLES.easy}`}>
          {difficulty}
        </Badge>
      </div>
      <div className="flex items-center gap-2 flex-wrap" data-testid="interview-header-meta">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.color}`} data-testid="mode-badge">
          {badge.label}
        </span>
        {conceptTags?.map((tag) => (
          <span
            key={tag}
            className="text-xs text-zinc-500 bg-zinc-900/40 px-2 py-0.5 rounded-full border border-zinc-700/20"
            data-testid="concept-tag"
          >
            {normalizeTag(tag)}
          </span>
        ))}
      </div>
    </div>
  );
}
