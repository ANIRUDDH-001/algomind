import { SettingsPanel } from '@/components/settings/SettingsPanel';

export default function SettingsPage() {
    return (
        <>

            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
                <div className="max-w-2xl mx-auto">
                    <SettingsPanel />
                </div>
            </div>
        </>
    );
}
