import type { ChallengeDoc, LessonCard, LessonQuiz } from '../db/models'

type LessonIn = {
  slug: string
  title: string
  minutes: number
  cards: LessonCard[]
  example: { setup: string; weak: string; strong: string; why: string }
  quiz: LessonQuiz
  practice: string | null
}

type ProgramIn = { slug: string; title: string; summary: string; skill: string; lessons: LessonIn[] }

export const PROGRAMS: ProgramIn[] = [
  {
    slug: 'fundamentals',
    title: 'Negotiation fundamentals',
    summary: 'Interests, positions and the shape of every negotiation.',
    skill: 'preparation',
    lessons: [
      {
        slug: 'positions-vs-interests',
        title: 'Positions versus interests',
        minutes: 4,
        cards: [
          { heading: 'A position is what someone asks for', body: '“I need $90,000.” “Ten features in seven weeks.” Positions are easy to state and easy to clash over.' },
          { heading: 'An interest is why they ask for it', body: 'Security, recognition, a trade-show date, fear of another outage. Interests often have more than one solution.' },
          { heading: 'Negotiate on interests', body: 'Two incompatible positions can still hide compatible interests. Your job is to find them.' },
        ],
        example: {
          setup: 'Your flatmate says: “I can’t do more chores right now.”',
          weak: '“Well, I can’t either. We split it fifty-fifty.”',
          strong: '“What’s making it hard right now? Are there chores you don’t mind?”',
          why: 'The strong reply asks for the interest behind the position, which in this case reveals a trade.',
        },
        quiz: { question: 'Which of these is an interest?', options: ['“Rent must be $1,600.”', '“I need a tenant who pays on time.”', '“Eight weeks’ deposit.”'], answer: 1, explain: 'Reliability is the need; the others are positions that could satisfy it.' },
        practice: 'household-chores',
      },
      {
        slug: 'three-numbers',
        title: 'Target, limit and alternative',
        minutes: 4,
        cards: [
          { heading: 'Your target', body: 'An ambitious outcome you can justify. It shapes your first offer.' },
          { heading: 'Your limit', body: 'The worst terms you will accept. Decide it before you start, not under pressure.' },
          { heading: 'Your alternative', body: 'What happens if there is no deal. A good alternative is the source of real confidence.' },
        ],
        example: {
          setup: 'You are buying a car with a $10,200 budget.',
          weak: 'Walking in with only “as cheap as possible” in mind.',
          strong: 'Target $8,600, limit $10,200, alternative: a $10,400 dealer car with warranty.',
          why: 'Three clear numbers stop you anchoring on the seller’s price or overpaying in the moment.',
        },
        quiz: { question: 'When should you set your walk-away limit?', options: ['When they make their final offer', 'Before the negotiation starts', 'After your first counteroffer'], answer: 1, explain: 'Limits set in the moment drift toward whatever is on the table.' },
        practice: 'buy-used-car',
      },
    ],
  },
  {
    slug: 'better-questions',
    title: 'Asking better questions',
    summary: 'Open questions that surface constraints and priorities.',
    skill: 'information',
    lessons: [
      {
        slug: 'open-questions',
        title: 'Open questions first',
        minutes: 3,
        cards: [
          { heading: 'Closed questions confirm', body: '“Is $9,000 okay?” invites a yes or no and reveals little.' },
          { heading: 'Open questions discover', body: '“What’s driving the timeline?” invites a story, and stories contain constraints.' },
          { heading: 'Ask before you anchor', body: 'Two good questions before your first offer usually change what that offer should be.' },
        ],
        example: {
          setup: 'A client demands delivery by Friday.',
          weak: '“Could we do Wednesday instead?”',
          strong: '“What will the report be used for first?”',
          why: 'The open question revealed that only one slide was needed by Tuesday.',
        },
        quiz: { question: 'Which question is most likely to reveal a hidden constraint?', options: ['“Can you do $500 less?”', '“Is that your best price?”', '“How long has the flat been available?”'], answer: 2, explain: 'It asks about their situation, not their position.' },
        practice: 'negotiate-deadline',
      },
      {
        slug: 'return-to-deflections',
        title: 'Coming back to a deflection',
        minutes: 3,
        cards: [
          { heading: 'A deflection is information', body: '“I’d rather not say” usually means the answer matters.' },
          { heading: 'Build rapport, then return', body: 'People share more once they feel understood. Acknowledge, then ask again later.' },
        ],
        example: {
          setup: 'A recruiter says “everything is fairly standard” when asked about flexibility.',
          weak: 'Dropping the topic and haggling on salary.',
          strong: 'Acknowledging their constraints, then later asking which budget is separate from salary.',
          why: 'Trust earned in between turns a deflection into an answer.',
        },
        quiz: { question: 'They deflected your question. What is a good next move?', options: ['Ask it again immediately, louder', 'Acknowledge their position and return to it later', 'Assume the answer is unfavourable'], answer: 1, explain: 'Repeating it at once costs rapport; returning later often works.' },
        practice: 'negotiate-job-offer',
      },
    ],
  },
  {
    slug: 'listening',
    title: 'Listening and discovering interests',
    summary: 'Acknowledge, summarise and hear what is not said.',
    skill: 'communication',
    lessons: [
      {
        slug: 'acknowledge-first',
        title: 'Acknowledge before you argue',
        minutes: 3,
        cards: [
          { heading: 'Acknowledging is not agreeing', body: '“I understand you have bands to respect” costs you nothing and lowers defences.' },
          { heading: 'Summarise progress', body: 'A short summary shows you listened and resets a heated conversation.' },
        ],
        example: {
          setup: 'Your partner says, “You just want to cut everything I enjoy.”',
          weak: '“That’s not true, you always overspend.”',
          strong: '“It sounds like you feel you have to justify every coffee. Is that it?”',
          why: 'Naming their concern opens space to discuss savings without a fight.',
        },
        quiz: { question: 'Which response acknowledges without conceding?', options: ['“Fine, you win.”', '“I hear that budgets are tight for you.”', '“That’s your problem.”'], answer: 1, explain: 'It recognises their constraint while keeping your position intact.' },
        practice: 'spending-disagreement',
      },
    ],
  },
  {
    slug: 'offers',
    title: 'Making and responding to offers',
    summary: 'Open well, concede deliberately, and ask for something back.',
    skill: 'offers',
    lessons: [
      {
        slug: 'shrinking-concessions',
        title: 'Shrinking concessions',
        minutes: 4,
        cards: [
          { heading: 'Concession size is a signal', body: 'A big move tells the other side there is plenty more room.' },
          { heading: 'Make each step smaller', body: 'Decreasing concessions signal you are approaching your limit.' },
          { heading: 'Trade, do not give', body: '“I can move on price if you can move on payment terms.”' },
        ],
        example: {
          setup: 'You opened at $55,000 for a project.',
          weak: 'Dropping straight to $45,000 after the first push-back.',
          strong: '$55,000 → $52,000 → $50,500, each paired with a request.',
          why: 'Small, conditional steps protect value and invite reciprocity.',
        },
        quiz: { question: 'Which concession pattern best signals you are near your limit?', options: ['$1,000, $1,000, $1,000', '$2,000, $800, $300', '$300, $800, $2,000'], answer: 1, explain: 'Shrinking steps tell the other side you are running out of room.' },
        practice: 'project-scope',
      },
    ],
  },
  {
    slug: 'anchoring',
    title: 'Anchoring and counteroffers',
    summary: 'Use first numbers wisely and neutralise theirs.',
    skill: 'offers',
    lessons: [
      {
        slug: 'credible-anchors',
        title: 'Ambitious but credible anchors',
        minutes: 3,
        cards: [
          { heading: 'First numbers stick', body: 'The opening offer pulls the final result toward it.' },
          { heading: 'Credibility caps ambition', body: 'An anchor with no justification damages trust and gets ignored.' },
          { heading: 'Re-anchor with reasons', body: 'When they open extreme, respond with your own reasoned number, not a split.' },
        ],
        example: {
          setup: 'The seller asks $11,200 for a car worth around $9,500.',
          weak: '“How about $11,000?”',
          strong: '“Similar cars are around $9,000, and the tyres need $600. I can do $8,600.”',
          why: 'The strong reply replaces their anchor with yours, backed by facts.',
        },
        quiz: { question: 'They open with an extreme number. What should you avoid?', options: ['Counter with a reasoned number', 'Ask how they arrived at it', 'Split the difference with it immediately'], answer: 2, explain: 'Splitting legitimises their anchor.' },
        practice: 'buy-used-car',
      },
    ],
  },
  {
    slug: 'batna',
    title: 'BATNA and reservation points',
    summary: 'Your alternative is your power. Test theirs.',
    skill: 'preparation',
    lessons: [
      {
        slug: 'test-their-alternative',
        title: 'Test their alternative',
        minutes: 3,
        cards: [
          { heading: 'Claims are not alternatives', body: '“We can do it in-house” may be true, or not before Q3.' },
          { heading: 'Ask about timing and cost', body: 'Questions about when and how expose weak alternatives without confrontation.' },
        ],
        example: {
          setup: 'Procurement says their internal team can handle the work.',
          weak: 'Cutting your rate by 20% straight away.',
          strong: '“When could your internal team start?”',
          why: 'If their team is booked, your leverage rises without any concession.',
        },
        quiz: { question: 'BATNA stands for…', options: ['Best Alternative To a Negotiated Agreement', 'Basic Agreement Terms and Negotiation Approach', 'Bargaining Advantage Through Numerical Anchors'], answer: 0, explain: 'It is what you do if this negotiation fails.' },
        practice: 'strong-alternative',
      },
    ],
  },
  {
    slug: 'integrative',
    title: 'Distributive versus integrative negotiation',
    summary: 'Split the pie when you must; grow it when you can.',
    skill: 'value',
    lessons: [
      {
        slug: 'log-rolling',
        title: 'Log-rolling across issues',
        minutes: 4,
        cards: [
          { heading: 'Different issues, different values', body: 'Contract length may be cheap for you and valuable for them. Price may be the reverse.' },
          { heading: 'Ask about priorities', body: '“What matters most to you here?” is one of the most valuable questions in a multi-issue deal.' },
          { heading: 'Trade low-cost for high-value', body: 'Give what is cheap for you, get what is valuable to you. Both sides end up better off.' },
        ],
        example: {
          setup: 'A supplier wants a long contract; you want a lower price.',
          weak: 'Fighting both issues separately to the middle.',
          strong: '“We could sign for 24 months if the price reflects it.”',
          why: 'Packaging issues creates value a split cannot.',
        },
        quiz: { question: 'Integrative negotiation is mainly about…', options: ['Winning every issue', 'Trading across issues so both sides gain', 'Splitting the difference fairly'], answer: 1, explain: 'It creates value by exploiting different priorities.' },
        practice: 'supplier-contract',
      },
    ],
  },
  {
    slug: 'conflict',
    title: 'Conflict resolution',
    summary: 'Turn opposing positions into a shared problem.',
    skill: 'relationship',
    lessons: [
      {
        slug: 'shared-problem',
        title: 'Make it a shared problem',
        minutes: 3,
        cards: [
          { heading: 'From me-vs-you to us-vs-problem', body: 'Frame the issue as something you both want solved.' },
          { heading: 'Find the hidden worry', body: 'In mediation, the loudest objection often covers a quieter concern.' },
        ],
        example: {
          setup: 'An engineering lead refuses to launch before eleven weeks.',
          weak: '“Sales needs it in six weeks. Make it happen.”',
          strong: '“What specifically would break if we launched earlier?”',
          why: 'It surfaced a payment bug that could be fixed first.',
        },
        quiz: { question: 'In a conflict, a good first move is to…', options: ['State the rules', 'Ask what the other side is worried about', 'Escalate quickly'], answer: 1, explain: 'Concerns, once named, can be addressed.' },
        practice: 'mediate-colleagues',
      },
    ],
  },
  {
    slug: 'difficult-conversations',
    title: 'Difficult conversations',
    summary: 'Clear boundaries, delivered with warmth.',
    skill: 'composure',
    lessons: [
      {
        slug: 'i-statements',
        title: 'Speak from your experience',
        minutes: 3,
        cards: [
          { heading: 'Describe impact, not character', body: '“When visits come without notice, I can’t focus” beats “You’re inconsiderate.”' },
          { heading: 'Pressure backfires', body: 'Ultimatums and blame reduce trust and make concessions harder for the other side.' },
        ],
        example: {
          setup: 'A sibling keeps dropping by unannounced.',
          weak: '“You always barge in. It needs to stop.”',
          strong: '“I love seeing you. When visits are unannounced, I can’t focus. Could we plan them?”',
          why: 'Warmth plus a clear request protects the relationship and the boundary.',
        },
        quiz: { question: 'Which phrasing is most likely to keep the conversation productive?', options: ['“You never think about me.”', '“When this happens, I feel stressed and can’t work.”', '“Take it or leave it.”'], answer: 1, explain: 'It describes impact without blame.' },
        practice: 'respect-a-boundary',
      },
    ],
  },
  {
    slug: 'walking-away',
    title: 'Knowing when to walk away',
    summary: 'No deal beats a bad deal.',
    skill: 'outcome',
    lessons: [
      {
        slug: 'compare-to-alternative',
        title: 'Compare with your alternative',
        minutes: 3,
        cards: [
          { heading: 'The question is not “is this good?”', body: 'It is “is this better than my alternative?”' },
          { heading: 'Leave well', body: 'Walking away politely keeps the door open if circumstances change.' },
        ],
        example: {
          setup: 'A dealer guaranteed $3,200. A buyer’s ceiling is $3,000.',
          weak: 'Accepting $3,000 because the buyer is charming and persistent.',
          strong: '“Thanks — I’ll go with my other option. Let me know if anything changes.”',
          why: 'Any deal with this buyer leaves you worse off than your alternative.',
        },
        quiz: { question: 'Your best offer is $2,950; your alternative is a guaranteed $3,200. You should…', options: ['Accept: a deal is a deal', 'Walk away politely', 'Ask for $2,975'], answer: 1, explain: 'No offer here beats your alternative.' },
        practice: 'know-when-to-walk',
      },
    ],
  },
]

export const CHALLENGES: Omit<ChallengeDoc, '_id'>[] = [
  {
    slug: 'five-turn-raise',
    title: 'The five-turn raise',
    summary: 'Secure a raise in five turns or fewer.',
    scenarioSlug: 'ask-for-a-raise',
    order: 1,
    criteria: { requireAgreement: true, maxTurns: 5, minOutcome: 60 },
    criteriaText: ['Reach an agreement', 'Finish within five turns', 'Outcome score of at least 60'],
    published: true,
  },
  {
    slug: 'budget-car',
    title: 'Under budget',
    summary: 'Buy the car for $9,300 or less.',
    scenarioSlug: 'buy-used-car',
    order: 2,
    criteria: { requireAgreement: true, limitIssue: { key: 'price', max: 9300 } },
    criteriaText: ['Reach an agreement', 'Pay at most $9,300'],
    published: true,
  },
  {
    slug: 'trust-intact',
    title: 'Better deal, trust intact',
    summary: 'Win good rental terms without damaging the relationship.',
    scenarioSlug: 'rental-agreement',
    order: 3,
    criteria: { requireAgreement: true, minOutcome: 55, minRelationship: 60 },
    criteriaText: ['Reach an agreement', 'Outcome score of at least 55', 'Relationship score of at least 60'],
    published: true,
  },
  {
    slug: 'find-the-constraint',
    title: 'Find the constraint',
    summary: 'Discover why the client cannot really go in-house, then close.',
    scenarioSlug: 'strong-alternative',
    order: 4,
    criteria: { requireAgreement: true, mustDiscover: ['booked'] },
    criteriaText: ['Reach an agreement', 'Discover the hidden constraint'],
    published: true,
  },
  {
    slug: 'domain-under-six',
    title: 'Ask before you anchor',
    summary: 'Buy the domain for $6,000 or less.',
    scenarioSlug: 'domain-purchase',
    order: 5,
    criteria: { requireAgreement: true, limitIssue: { key: 'price', max: 6000 } },
    criteriaText: ['Reach an agreement', 'Pay at most $6,000'],
    published: true,
  },
  {
    slug: 'no-deal-is-a-deal',
    title: 'No deal is a deal',
    summary: 'Recognise when no agreement beats a bad one.',
    scenarioSlug: 'know-when-to-walk',
    order: 6,
    criteria: { requireWalkAway: true },
    criteriaText: ['Walk away deliberately'],
    published: true,
  },
  {
    slug: 'package-deal',
    title: 'The package deal',
    summary: 'Sell your company with an outcome score of 70 or more.',
    scenarioSlug: 'acquisition-offer',
    order: 7,
    criteria: { requireAgreement: true, minOutcome: 70 },
    criteriaText: ['Reach an agreement', 'Outcome score of at least 70'],
    published: true,
  },
]
