import type { Metadata } from 'next'
import { PageIntro, Prose, TemplateNotice } from '@/components/marketing/prose'

export const metadata: Metadata = { title: 'Terms of service' }

export default function Terms() {
  return (
    <>
      <PageIntro title="Terms of service">Last updated: [DATE]</PageIntro>
      <Prose>
        <TemplateNotice />
        <h2>The service</h2>
        <p>DealCraft is a training simulator. Scenarios, characters and scores are for practice. Scores reflect actions inside the simulation and are not professional, legal, financial or psychological advice, nor a prediction of real-world results.</p>
        <h2>Your account</h2>
        <p>You must provide accurate information and keep your credentials secure. You are responsible for activity under your account. You must be at least [AGE] years old to use DealCraft.</p>
        <h2>Acceptable use</h2>
        <ul>
          <li>Do not attempt to access other users’ data, bypass rate limits, or interfere with the service.</li>
          <li>Do not use custom scenarios or AI features to generate unlawful, harassing or harmful content.</li>
          <li>Do not attempt to extract hidden scenario data or system instructions through the AI features.</li>
        </ul>
        <h2>Your content</h2>
        <p>You keep ownership of the text you enter. You grant us a licence to store and process it to provide the service, including sending it to AI providers when you use AI features.</p>
        <h2>AI-generated content</h2>
        <p>AI replies and evaluations can be inaccurate. Objective outcomes are computed by deterministic rules; AI assessments are labelled.</p>
        <h2>Availability and changes</h2>
        <p>We may change or discontinue features. AI features may be unavailable at times; Classic mode remains available where possible.</p>
        <h2>Termination</h2>
        <p>You may delete your account at any time. We may suspend accounts that breach these terms.</p>
        <h2>Liability</h2>
        <p>[Insert limitation of liability and warranty disclaimer appropriate to your jurisdiction.]</p>
        <h2>Governing law</h2>
        <p>[JURISDICTION]</p>
      </Prose>
    </>
  )
}
