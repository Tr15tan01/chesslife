import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { getSessionUser } from '@/server/auth/session'

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  )
}
