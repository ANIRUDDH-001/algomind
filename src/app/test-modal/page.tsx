'use client';
import { useState } from 'react';
import { notFound } from 'next/navigation';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

// Internal E2E harness for modal/swipe tests (mobile-modals, swipe-gestures specs).
// Not exposed in production builds.
export default function TestModalPage() {
    const [open, setOpen] = useState(false);
    if (process.env.NODE_ENV === 'production') notFound();

    return (
        <div className="p-10">
            <button id="open-modal" onClick={() => setOpen(true)} className="bg-blue-500 p-2 text-white">
                Open Modal
            </button>
            <ResponsiveModal
                open={open}
                onOpenChange={setOpen}
                title="Test Modal"
                description="This is a test modal"
            >
                <div id="modal-content" className="h-[200vh] bg-red-200">
                    Scrollable content top
                    <div className="mt-[150vh]">Scrollable content bottom</div>
                </div>
            </ResponsiveModal>
            <div id="modal-status">
                {open ? 'Modal is OPEN' : 'Modal is CLOSED'}
            </div>
        </div>
    );
}
