import React, { Suspense } from 'react';
import { AssessmentCompleteContent } from './content';

export default function AssessmentCompletePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="animate-pulse text-slate-500">Loading...</div>
            </div>
        }>
            <AssessmentCompleteContent />
        </Suspense>
    );
}
