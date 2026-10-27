import type { Metadata } from 'next'
import { PageIntro } from '@/components/marketing/prose'
import { ContactForm } from '@/components/marketing/contact-form'

export const metadata: Metadata = { title: 'Contact' }

export default function Contact() {
  return (
    <>
      <PageIntro title="Contact us">Questions, feedback, privacy requests or team training. Messages are stored securely and read by the DealCraft team.</PageIntro>
      <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
        <ContactForm />
      </div>
    </>
  )
}
