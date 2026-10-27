import type { Dimension } from './negotiation/types'

/** Short, practical coaching tips keyed by skill dimension. */
export const TIPS: Record<Dimension, string[]> = {
  outcome: [
    'Judge every offer against your alternative, not against their last number.',
    'Before you accept, ask yourself: is there one more thing worth requesting?',
    'Write your target down before you start. People who do tend to aim higher.',
  ],
  preparation: [
    'Set three numbers before any negotiation: your target, your limit and your alternative.',
    'List what the other side might need. You will hear it faster when they say it.',
    'Decide your walk-away point while you are calm, not during the conversation.',
  ],
  information: [
    'Ask two open questions before your first offer. “What is driving the timeline?” beats “Is Friday fixed?”',
    'A deflection usually means the answer matters. Build rapport and come back to it.',
    'Ask “What matters most to you here?” in any deal with more than one issue.',
  ],
  offers: [
    'Make each concession smaller than the last. Shrinking steps signal you are near your limit.',
    'Never concede for free: “I can do that if you can…”',
    'Pair every number with a reason. Reasoned anchors stick; arbitrary ones get ignored.',
  ],
  communication: [
    'Acknowledge their constraint before restating yours. It costs nothing and lowers defences.',
    'Summarise progress every few turns. It shows you are listening and resets tension.',
    'Speak about impact (“When this happens, I can’t focus”) rather than character.',
  ],
  value: [
    'Find the issue that is cheap for you and valuable to them, then trade it.',
    'If one term is fixed, look for a different budget, timeline or form of value.',
    'Package issues together instead of settling them one by one.',
  ],
  composure: [
    'When you feel stuck, ask a question instead of making a threat.',
    'Silence is a tool. You do not need to fill every pause with a concession.',
    'Ultimatums cost rapport even when they work.',
  ],
  relationship: [
    'Exaggerated claims are easy to test. Credibility is hard to rebuild.',
    'Leave every negotiation in a state where you could negotiate again tomorrow.',
    'Walking away politely keeps the door open if circumstances change.',
  ],
}

export function tipFor(dim: Dimension, seed: number): string {
  const list = TIPS[dim]
  return list[Math.abs(seed) % list.length]!
}
