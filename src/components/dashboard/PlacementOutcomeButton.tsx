/**
 * @codesage
 */
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export function PlacementOutcomeButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [placedAtCompany, setPlacedAtCompany] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user already has a placement outcome
  useEffect(() => {
    const fetchExistingOutcome = async () => {
      try {
        const res = await fetch('/api/user/placement-outcome');
        if (!res.ok) return;
        const data = await res.json();
        if (data.outcome?.companyName) {
          setPlacedAtCompany(data.outcome.companyName);
          setSubmitted(true);
        }
      } catch (error) {
        console.error('Failed to fetch placement outcome:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExistingOutcome();
  }, []);

  const handleSubmit = async () => {
    if (!companyName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/user/placement-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          role: role.trim() || null,
          placedAt: new Date().toISOString().split('T')[0],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to save placement outcome');
        return;
      }

      setPlacedAtCompany(companyName);
      setSubmitted(true);
      setIsOpen(false);
      toast.success('🎉 Congratulations! Your placement has been recorded.');
      setCompanyName('');
      setRole('');
    } catch (error) {
      toast.error('Failed to save placement outcome. Please try again.');
      console.error('Error saving placement outcome:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  if (submitted && placedAtCompany) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-300">✅ Placed at {placedAtCompany}</p>
            <p className="text-xs text-emerald-200 mt-1">Congratulations on your success! 🎊</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
      >
        <Sparkles className="w-5 h-5" />
        🎉 I Got Placed!
      </Button>

      {isOpen && (
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-1)]/60 p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Company Name *
            </label>
            <Input
              placeholder="e.g. Google, TCS, Infosys"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="bg-[var(--surface-2)] border-white/10 text-white placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2">
              Role
            </label>
            <Input
              placeholder="e.g. SDE-1, Software Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-[var(--surface-2)] border-white/10 text-white placeholder-zinc-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!companyName.trim() || isSubmitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
            <Button
              onClick={() => {
                setIsOpen(false);
                setCompanyName('');
                setRole('');
              }}
              variant="ghost"
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
