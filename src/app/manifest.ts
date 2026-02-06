import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'AlgoMind - AI DSA Interview Practice',
        short_name: 'AlgoMind',
        description: 'Master Data Structures and Algorithms with AI-powered voice interviews and cognitive assessment.',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#6366f1',
        orientation: 'portrait-primary',
        icons: [
            {
                src: '/icon-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/icon-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
        categories: ['education', 'productivity', 'utilities'],
        lang: 'en',
        dir: 'ltr',
    };
}
