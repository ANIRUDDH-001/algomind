import { redirect } from 'next/navigation';

export default function FeaturesPage() {
    redirect('/owner?tab=flags');
}