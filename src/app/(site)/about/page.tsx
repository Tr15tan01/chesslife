import type { Metadata } from 'next'
import { PageIntro, Prose } from '@/components/marketing/prose'

export const metadata: Metadata = { title: 'About' }

export default function About() {
  return (
    <>
      <PageIntro title="Learn to negotiate through practice, not by reading about it." />
      <Prose>
        <p>Most people negotiate rarely and under pressure: a salary, a lease, a supplier contract, a difficult conversation at home. There is little chance to practise, and feedback usually arrives as a result you cannot rewind.</p>
        <p>DealCraft is a practice room. Each scenario puts you opposite someone with their own interests, limits and information. You can ask, propose, trade, hold firm or walk away, then see exactly what was hidden and what a different move would have changed.</p>
        <h2>What we believe</h2>
        <ul>
          <li>Skill comes from repetition with feedback, not from memorising tactics.</li>
          <li>Good negotiators create value as well as claim it, and keep relationships intact.</li>
          <li>Walking away is sometimes the best outcome.</li>
          <li>Scores should reflect observable actions, not guess at personality.</li>
        </ul>
        <h2>What we do not claim</h2>
        <p>A DealCraft score measures what you did inside a simulation. It does not diagnose your personality and does not guarantee results in real negotiations. It is a training signal.</p>
      </Prose>
    </>
  )
}
