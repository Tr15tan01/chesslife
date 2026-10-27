import type { Metadata } from 'next'
import { PageIntro, Prose, TemplateNotice } from '@/components/marketing/prose'

export const metadata: Metadata = { title: 'Privacy policy' }

export default function Privacy() {
  return (
    <>
      <PageIntro title="Privacy policy">Last updated: [DATE]</PageIntro>
      <Prose>
        <TemplateNotice />
        <h2>Who we are</h2>
        <p>[COMPANY NAME] (“we”) operates DealCraft. Contact: [CONTACT EMAIL], [POSTAL ADDRESS].</p>
        <h2>What we collect</h2>
        <ul>
          <li>Account data: name, email address, password hash (Argon2id; we never store your password), and Google account identifier if you sign in with Google.</li>
          <li>Training data: negotiations you play, including messages, offers, preparation notes, scores and evaluations; lesson completions; preferences.</li>
          <li>Security and usage data: session records, rate-limit counters, AI usage counts and token totals, audit records of administrative actions.</li>
          <li>Contact form submissions.</li>
        </ul>
        <h2>How we use it</h2>
        <ul>
          <li>To run the service: authenticate you, save and score your negotiations, and show your progress.</li>
          <li>To protect the service: rate limiting, abuse prevention and error diagnosis.</li>
          <li>We do not sell personal data and do not use it for advertising.</li>
        </ul>
        <h2>AI processing</h2>
        <p>When you play in AI mode, use AI evaluation, or ask AI to write custom scenario details, the relevant conversation or scenario text is sent to our configured AI provider ([PROVIDER NAME]) to generate a response. Hidden scenario data that you have not discovered is not sent. Classic mode never sends your data to an AI provider. [Describe the provider’s data retention terms.]</p>
        <h2>Retention</h2>
        <p>Your account and training data are kept until you delete them. Sessions expire after 30 days of inactivity. Password-reset and verification tokens expire within 24 hours. Server error logs are deleted after 30 days. [Adjust to your policy.]</p>
        <h2>Your rights</h2>
        <p>From Settings you can export all your data as JSON and permanently delete your account. You may also contact us at [CONTACT EMAIL]. [Add jurisdiction-specific rights, e.g. GDPR/UK GDPR/CCPA.]</p>
        <h2>Cookies</h2>
        <p>We use a strictly necessary session cookie, a short-lived cookie during Google sign-in, and a theme preference cookie. We do not use advertising or analytics cookies. [Update if you add analytics.]</p>
        <h2>Security</h2>
        <p>Data is stored in MongoDB Atlas with encryption at rest and in transit. Access to production data is restricted. Administrators cannot view negotiation transcripts.</p>
      </Prose>
    </>
  )
}
