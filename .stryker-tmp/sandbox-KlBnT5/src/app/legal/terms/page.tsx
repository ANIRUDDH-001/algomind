/**
 * @codesage
 * @file      src/app/legal/terms/page.tsx
 * @purpose   Static page displaying the application's terms of service.
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
  title: 'Terms of Service | AlgoMind',
};

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-3xl font-black text-white mb-2">Terms of Service</h1>
      <p className="text-zinc-500 text-sm mb-8">Last updated: January 2025</p>

      <div className="space-y-8 text-zinc-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using AlgoMind ("the Service"), you agree to be bound by these Terms of Service.
            If you do not agree to these terms, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">2. Use of the Service</h2>
          <p>
            AlgoMind provides an AI-powered technical interview preparation platform. You may use the Service
            for personal, non-commercial interview preparation purposes. You agree not to misuse the Service,
            attempt to reverse-engineer the AI systems, or use the Service to train competing AI models.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You are
            responsible for all activity that occurs under your account. Notify us immediately of any
            unauthorized use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">4. Intellectual Property</h2>
          <p>
            The Service, including its AI models, problem sets, and interface design, is owned by AlgoMind.
            Your interview transcripts and performance data belong to you. We may use anonymized, aggregated
            data to improve the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">5. Subscription and Payments</h2>
          <p>
            Free tier access is provided without payment. Premium features require a paid subscription.
            Payments are processed securely via Razorpay. Subscription fees are non-refundable except
            where required by applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">6. Disclaimer of Warranties</h2>
          <p>
            The Service is provided "as is" without warranties of any kind. AlgoMind does not guarantee
            that use of the Service will result in job placement or interview success.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">7. Limitation of Liability</h2>
          <p>
            AlgoMind shall not be liable for any indirect, incidental, or consequential damages arising
            from your use of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">8. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the Service after changes constitutes
            acceptance of the new terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-white mb-3">9. Contact</h2>
          <p>
            For questions about these terms, contact us at support@algomind.app.
          </p>
        </section>
      </div>
    </article>
  );
}