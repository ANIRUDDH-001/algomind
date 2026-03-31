import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="text-center max-w-md space-y-4">
                <p className="text-4xl">Replay Missing</p>
                <h2 className="text-lg font-semibold">Replay Not Found</h2>
                <p className="text-sm text-muted-foreground">
                    This replay link is invalid or the session is no longer available.
                </p>
                <Link
                    href="/"
                    className="inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
                >
                    Go Home
                </Link>
            </div>
        </div>
    );
}
