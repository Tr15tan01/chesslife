import type { OpponentPublic } from './types'

/** Life Chess opponents. Their level sets the bot's search depth; their persona flavours the commentary. */
export const OPPONENTS: OpponentPublic[] = [
  {
    key: 'sam',
    name: 'Sam Ortega',
    role: 'Your easygoing flatmate',
    bio: 'Plays for fun, talks about rent, chores and weekend plans, and forgives most mistakes.',
    level: 1,
    levelLabel: 'Relaxed',
    tone: 'sage',
  },
  {
    key: 'dana',
    name: 'Dana Whitfield',
    role: 'Hiring manager at a fast-growing startup',
    bio: 'Sharp and fair. Notices when you rush and rewards patience. Sees every move as a career decision.',
    level: 2,
    levelLabel: 'Competitive',
    tone: 'slate',
  },
  {
    key: 'victor',
    name: 'Victor Kade',
    role: 'Veteran deal-maker',
    bio: 'Calm, strategic and hard to rattle. Treats the board like a balance sheet and punishes loose pieces.',
    level: 3,
    levelLabel: 'Ruthless',
    tone: 'gold',
  },
]

export function opponentByKey(key: string): OpponentPublic | undefined {
  return OPPONENTS.find((o) => o.key === key)
}
