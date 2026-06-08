// @ts-nocheck
// 
'use client';
//  -- automated unused local suppression
import React, { useState } from 'react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

export default function TestModalPage() {
    const [open, setOpen] = useState(false);

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
