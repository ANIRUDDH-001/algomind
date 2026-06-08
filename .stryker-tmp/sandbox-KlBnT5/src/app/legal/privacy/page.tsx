/**
 * @codesage
 * @file      src/app/legal/privacy/page.tsx
 * @purpose   Static page displaying the application's privacy policy.
 * @tech      Next.js, Tailwind Typography
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | AlgoMind',
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-black text-white mb-2">Privacy Policy</h1>
      <p className="text-zinc-500 text-sm mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-zinc-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">1. Data We Collect</h2>
          <p>
            We collect: your email address (via OAuth), interview transcripts and session recordings,
            performance scores and cognitive skill assessments, device and browser information for
            compatibility purposes.
          </p>
          <p className="mt-2">
            We do NOT collect payment card data — payments are handled entirely by Razorpay.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Data</h2>
          <p>
            Your data is used to: provide and improve the interview preparation service, generate
            personalized recommendations and cognitive assessments, maintain your session history
            and progress tracking, operate the spaced repetition review system.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">3. Data Storage</h2>
          <p>
            Your data is stored on Supabase (PostgreSQL database hosted on AWS). Interview audio
            is processed in real-time via Groq and AWS Polly — audio is not permanently stored.
            Transcripts are stored in your session history.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">4. Data Sharing</h2>
          <p>
            We do not sell your data. We share data only with: AI providers (Groq, Google Gemini,
            AWS Bedrock) for generating interview responses and assessments — these providers do not
            retain your data for training purposes under our agreements.
          </p>
          <p className="mt-2">
            Employer accounts can view assessment results for candidates who accepted their assessment
            invitations. Candidates control this via the assessment token flow.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">5. Your Rights</h2>
          <p>
            You may request deletion of your account and data at any time via Settings → Delete Account.
            You may export your performance data via the dashboard export feature.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">6. Cookies</h2>
          <p>
            We use cookies for authentication (Supabase session tokens) and local preferences.
            We do not use advertising or tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">7. Contact</h2>
          <p>
            For privacy inquiries or data deletion requests: support@algomind.app
          </p>
        </section>
      </div>
    </article>
  );
}