import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="text-center max-w-md space-y-4">
                <p className="text-4xl">Session Missing</p>
                <h2 className="text-lg font-semibold">Session Not Found</h2>
                <p className="text-sm text-muted-foreground">
                    This interview session does not exist or you do not have access to it.
                </p>
                <Link
                    href="/dashboard?tab=history"
                    className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                >
                    View Interview History
                </Link>
            </div>
        </div>
    );
}
