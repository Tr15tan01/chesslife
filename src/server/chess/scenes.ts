import type { MomentKind, SceneQuality } from '@/lib/chess/types'

/**
 * Life scenes: each chess moment opens a short real-life situation with the
 * same shape as the move. Choices are reflective — they never change the
 * board — and their outcomes stay on the server until the player chooses.
 */

export type SceneOption = { key: string; label: string; outcome: string; quality: SceneQuality }
export type SceneDef = { key: string; kind: MomentKind; title: string; setting: string; body: string; lesson: string; options: SceneOption[] }

const o = (key: string, label: string, quality: SceneQuality, outcome: string): SceneOption => ({ key, label, quality, outcome })

export const SCENES: SceneDef[] = [
  // ── Opening ────────────────────────────────────────────────────────────────
  {
    key: 'first-day',
    kind: 'OPENING',
    title: 'First day at the new job',
    setting: 'Open-plan office · Monday, 9:02',
    body: 'Your manager hands you a laptop and a list of twelve people to meet. A colleague offers to show you "how things really work" over lunch.',
    lesson: 'Openings reward claiming the centre and getting pieces out, not grabbing early material. In a new job, relationships and context come before results.',
    options: [
      o('lunch', 'Say yes to lunch and ask questions', 'wise', 'You learn who decides what and which projects are quietly on fire. Your first month gets far easier.'),
      o('heads-down', 'Skip lunch and start on a task to impress', 'mixed', 'You ship something small, but you build it the old way nobody uses any more. Effort without context.'),
      o('wait', 'Wait for someone to tell you what to do', 'risky', 'Two weeks in, you are still waiting. Passivity in the opening hands the initiative to everyone else.'),
    ],
  },
  {
    key: 'new-city',
    kind: 'OPENING',
    title: 'Moving to a new city',
    setting: 'Half-unpacked flat · Saturday morning',
    body: 'Boxes everywhere, no friends nearby yet, and a long list of things to sort: bank, doctor, gym, the commute.',
    lesson: 'A good opening is about structure: put each piece on a useful square early. Small set-up moves now save many tempo later.',
    options: [
      o('basics', 'Set up the basics first: doctor, bank, commute', 'wise', 'Within a week your daily life runs smoothly, leaving energy for people and fun.'),
      o('explore', 'Explore the city and sort admin later', 'mixed', 'Great weekend, but a missed bill and a surprise fee follow. Fun first, structure second, costs a little.'),
      o('online', 'Stay in and order everything online', 'risky', 'Comfortable, but a month later you still know nobody. Your pieces never left the back rank.'),
    ],
  },
  // ── Development ────────────────────────────────────────────────────────────
  {
    key: 'evening-course',
    kind: 'DEVELOPMENT',
    title: 'The evening course',
    setting: 'Kitchen table · Tuesday, 21:30',
    body: 'A ten-week course would add a skill your industry is starting to demand. It costs two evenings a week and some of your savings.',
    lesson: 'Developing a piece rarely wins anything immediately; it makes every later move stronger. Skills compound the same way.',
    options: [
      o('enrol', 'Enrol, and protect those two evenings', 'wise', 'Three months later the skill shows up in a job listing you would not have qualified for.'),
      o('free', 'Try free videos first, then decide', 'mixed', 'You learn the basics cheaply, but without structure you stall at week three.'),
      o('later', 'Put it off until work is quieter', 'risky', 'Work is never quieter. A colleague who took the course gets the new project.'),
    ],
  },
  {
    key: 'mentor',
    kind: 'DEVELOPMENT',
    title: 'A possible mentor',
    setting: 'Conference coffee line',
    body: 'You end up next to someone whose career you admire. You have about ninety seconds before the next talk starts.',
    lesson: 'Knights are your relationships: they need a few moves to reach good squares, but once there they reach places nothing else can.',
    options: [
      o('specific', 'Ask one specific question and for a follow-up call', 'wise', 'They like the question and say yes to a call. One good piece, well placed.'),
      o('pitch', 'Pitch yourself and ask for a job', 'risky', 'Too much, too soon. They politely move on. Developing is not the same as attacking.'),
      o('card', 'Swap cards and hope to remember to write', 'mixed', 'The card sits in your bag for a month. The connection was possible; the follow-through was missing.'),
    ],
  },
  // ── Castling ───────────────────────────────────────────────────────────────
  {
    key: 'emergency-fund',
    kind: 'CASTLE',
    title: 'Building a safety net',
    setting: 'Banking app · payday',
    body: 'Your salary just landed. A friend is pitching an exciting investment, and you have no savings buffer yet.',
    lesson: 'Castling tucks your king away and connects your rooks. Safety first makes bold play possible later.',
    options: [
      o('buffer', 'Build three months of expenses first', 'wise', 'When your boiler breaks in winter, it is an annoyance, not a crisis.'),
      o('split', 'Split it: half safety, half investment', 'mixed', 'Reasonable, but the buffer takes twice as long to build and is not there yet when you need it.'),
      o('all-in', 'Put it all into the investment', 'risky', 'The investment dips 30% just as an unexpected bill arrives. You sell at the bottom.'),
    ],
  },
  {
    key: 'boundaries',
    kind: 'CASTLE',
    title: 'Setting a boundary',
    setting: 'Phone · 22:47',
    body: 'Your manager has started messaging you late at night. Nothing urgent, but you always reply within minutes.',
    lesson: 'A king left in the centre gets attacked from every side. Protecting your wellbeing is not passive; it is what lets you keep playing.',
    options: [
      o('talk', 'Agree response times with your manager', 'wise', 'They had not realised. You agree that anything after 20:00 waits unless it is marked urgent.'),
      o('silent', 'Quietly stop replying after hours', 'mixed', 'It mostly works, but one awkward misunderstanding happens before the new norm settles.'),
      o('always', 'Keep replying; it shows commitment', 'risky', 'Six months later you are exhausted and your sleep is broken. Your king never got castled.'),
    ],
  },
  // ── Capture (small gain) ───────────────────────────────────────────────────
  {
    key: 'refund',
    kind: 'CAPTURE',
    title: 'The overcharge',
    setting: 'Phone bill · end of month',
    body: 'You notice you were charged for a service you cancelled. Getting the money back means a call to customer service.',
    lesson: 'Picking up a free pawn is good chess, as long as it does not cost you development. Small wins matter when they are cheap.',
    options: [
      o('call', 'Call, calmly explain, and ask for a credit', 'wise', 'Ten minutes later you have a refund and a discount for the trouble.'),
      o('rant', 'Post an angry review first, then call', 'mixed', 'You get the refund, but the review follows you around the next time you need goodwill.'),
      o('ignore', 'Let it go; it is not worth the time', 'risky', 'It keeps happening every month. Small leaks add up.'),
    ],
  },
  {
    key: 'raise-ask',
    kind: 'CAPTURE',
    title: 'Small raise, big signal',
    setting: 'Performance review · Thursday',
    body: 'You just delivered a strong quarter. Your manager mentions there is "a little room" in the budget.',
    lesson: 'When the opponent leaves material en prise, take it, but check what it costs you first.',
    options: [
      o('evidence', 'Ask for a specific figure, backed by results', 'wise', 'You anchor with evidence and land close to your number.'),
      o('accept', 'Accept whatever they offer, gratefully', 'mixed', 'You get something, but less than the room that was there.'),
      o('threat', 'Hint that you are interviewing elsewhere', 'risky', 'The bluff makes them nervous instead of generous. The relationship cools.'),
    ],
  },
  // ── Big capture ────────────────────────────────────────────────────────────
  {
    key: 'big-contract',
    kind: 'BIG_CAPTURE',
    title: 'Landing the big contract',
    setting: 'Client boardroom · Friday, 16:00',
    body: 'The client signs. It is the biggest deal of your career, and your team is already talking about celebrating.',
    lesson: 'Winning major material changes the game, but players often blunder right after a big capture. Consolidate before you celebrate.',
    options: [
      o('consolidate', 'Celebrate briefly, then plan delivery on Monday', 'wise', 'Delivery starts smoothly and the client renews next year.'),
      o('overpromise', 'Promise the client extra features to seal the bond', 'risky', 'The extra scope swallows your margin. A win turned into a liability.'),
      o('coast', 'Take your foot off the gas for a while', 'mixed', 'The deal holds, but two smaller leads go cold while you rest.'),
    ],
  },
  {
    key: 'inheritance',
    kind: 'BIG_CAPTURE',
    title: 'An unexpected windfall',
    setting: 'Letter from a lawyer',
    body: 'A distant relative left you a significant sum. Friends are already suggesting what you should do with it.',
    lesson: 'Extra material is only an advantage if you convert it well. Simplify, avoid needless risk, and let the advantage work.',
    options: [
      o('plan', 'Park it safely and decide in three months', 'wise', 'With time to think, you pay off debt and invest the rest calmly.'),
      o('spend', 'Upgrade the car and the flat right away', 'risky', 'A year later the money is gone and your monthly costs are higher.'),
      o('lend', 'Lend a large share to a friend in need', 'mixed', 'Generous, but without terms. The friendship gets awkward when repayment stalls.'),
    ],
  },
  // ── Loss (small setback) ───────────────────────────────────────────────────
  {
    key: 'rejected',
    kind: 'LOSS',
    title: 'The rejection email',
    setting: 'Inbox · Wednesday, 18:15',
    body: 'You did not get the role you interviewed for. The email is polite and generic.',
    lesson: 'Losing a pawn is not losing the game. Strong players ask what the loss tells them and adjust.',
    options: [
      o('feedback', 'Thank them and ask for one piece of feedback', 'wise', 'They tell you exactly what was missing. You fix it before the next interview.'),
      o('vent', 'Vent to friends and move on', 'mixed', 'You feel better, but you repeat the same gap in the next interview.'),
      o('quit', 'Stop applying for a while', 'risky', 'The market moves on without you. One lost pawn became a lost tempo.'),
    ],
  },
  {
    key: 'parking-fine',
    kind: 'LOSS',
    title: 'The parking fine',
    setting: 'Windscreen · Saturday',
    body: 'A ticket for a sign you genuinely did not see. It is not a fortune, but it stings.',
    lesson: 'Some losses are just the cost of playing. Do not compound them with a worse move out of frustration.',
    options: [
      o('appeal', 'Photograph the sign and appeal calmly', 'wise', 'The sign was partly hidden. The fine is cancelled.'),
      o('pay', 'Pay it and forget it', 'mixed', 'Fine. You lose a little money and keep your weekend.'),
      o('argue', 'Argue with the warden on the spot', 'risky', 'Nothing changes, your day is ruined, and the warden remembers your car.'),
    ],
  },
  // ── Big loss ───────────────────────────────────────────────────────────────
  {
    key: 'layoff',
    kind: 'BIG_LOSS',
    title: 'The restructuring',
    setting: 'Video call · Tuesday, 10:00',
    body: 'Your role has been cut in a restructuring. You have four weeks of notice and a severance offer on the table.',
    lesson: 'Losing your queen is serious, not final. Many games are saved by players who stop, count what they still have, and fight with it.',
    options: [
      o('negotiate', 'Ask for time to review and negotiate the package', 'wise', 'You secure an extra month of pay and a reference letter. A setback, handled well.'),
      o('sign', 'Sign immediately to get it over with', 'mixed', 'It is done, but you left money and support on the table.'),
      o('burn', 'Tell them exactly what you think of the decision', 'risky', 'It feels good for an hour. The reference you will need is now complicated.'),
    ],
  },
  {
    key: 'bad-investment',
    kind: 'BIG_LOSS',
    title: 'The investment that fell through',
    setting: 'Portfolio app · Monday morning',
    body: 'A large share of your savings sat in one company. It just announced serious problems and the price has collapsed.',
    lesson: 'After losing a major piece, avoid desperate attacks. Stabilise, protect what is left, then rebuild.',
    options: [
      o('review', 'Pause, review the facts, rebalance calmly', 'wise', 'You keep what is salvageable and spread your risk. Slower, but solid.'),
      o('double', 'Buy more to "average down"', 'risky', 'It falls further. Chasing a loss is how one piece becomes two.'),
      o('panic', 'Sell everything you own, including safe holdings', 'mixed', 'You stop the bleeding but lock in losses you did not need to take.'),
    ],
  },
  // ── Trade ──────────────────────────────────────────────────────────────────
  {
    key: 'shift-swap',
    kind: 'TRADE',
    title: 'The shift swap',
    setting: 'Team chat · Thursday',
    body: 'A colleague asks to swap your free Friday for their free Monday. Neither day is clearly better.',
    lesson: 'An even trade is a negotiation: equal on paper, but one side usually benefits more from the resulting position.',
    options: [
      o('trade-up', 'Agree, and ask them to cover one early shift too', 'wise', 'They happily agree. Both of you leave better off: a trade that created value.'),
      o('just-swap', 'Swap without thinking about it', 'mixed', 'Fair enough, though you realise later Friday mattered more to you.'),
      o('refuse', 'Refuse on principle', 'risky', 'They remember it the next time you need a favour.'),
    ],
  },
  {
    key: 'car-trade-in',
    kind: 'TRADE',
    title: 'The trade-in',
    setting: 'Car dealership · Saturday',
    body: 'The dealer offers a fair trade-in value for your old car against a new one. Everything looks roughly even.',
    lesson: 'When trading, look at what remains on the board, not only at what was exchanged.',
    options: [
      o('separate', 'Negotiate the trade-in and the new price separately', 'wise', 'Splitting the issues reveals extra margin on both sides.'),
      o('bundle', 'Accept the bundled deal as offered', 'mixed', 'It is okay, but the bundle hid a high financing rate.'),
      o('walk', 'Walk away without countering', 'risky', 'You wanted the car. Walking away without exploring left value behind.'),
    ],
  },
  // ── Check given ────────────────────────────────────────────────────────────
  {
    key: 'deadline-you-set',
    kind: 'CHECK_GIVEN',
    title: 'Your deadline',
    setting: 'Email to a contractor',
    body: 'Your contractor has missed three dates. You are ready to set a firm deadline.',
    lesson: 'A check forces a response, but checks that lead nowhere just push the king to a safer square. Pressure needs a plan behind it.',
    options: [
      o('firm-fair', 'Set a firm date with a clear consequence and an offer to help', 'wise', 'They respond with a realistic plan and finally deliver.'),
      o('threat', 'Threaten to leave a public review', 'risky', 'They get defensive and the work slows down further.'),
      o('soft', 'Ask again, nicely, without a date', 'mixed', 'Pleasant, but nothing changes.'),
    ],
  },
  {
    key: 'counteroffer',
    kind: 'CHECK_GIVEN',
    title: 'The competing offer',
    setting: "Manager's office · Wednesday",
    body: 'You have a genuine offer from another company. You are about to tell your current manager.',
    lesson: 'Real threats are strong; empty ones are punished. Make the check only if the follow-up is real.',
    options: [
      o('honest', 'Share it honestly and say what would make you stay', 'wise', 'They match the key terms. You stay on better footing, and they trust you.'),
      o('inflate', 'Inflate the offer to push harder', 'risky', 'They ask to see it in writing. Credibility lost.'),
      o('ultimatum', 'Give them 24 hours to beat it', 'mixed', 'They scramble and match it, but the relationship feels transactional now.'),
    ],
  },
  // ── Check received ─────────────────────────────────────────────────────────
  {
    key: 'landlord-ultimatum',
    kind: 'CHECK_RECEIVED',
    title: "The landlord's ultimatum",
    setting: 'Letter on the doormat',
    body: 'Your landlord wants a 20% rent increase, and you have 48 hours to accept or start looking for a new place.',
    lesson: 'In check, you must respond, but you choose how: move away, block, or capture the threat. Look for the reply that improves your position.',
    options: [
      o('research', 'Check local rents and propose a counter with a longer lease', 'wise', 'Stability is worth more to them than the last few percent. You settle at 8% on a two-year lease.'),
      o('accept', 'Accept to avoid the hassle', 'mixed', 'Safe, but you are paying well above market from now on.'),
      o('ignore', 'Ignore it and hope it goes away', 'risky', 'The deadline passes. Now your options are worse.'),
    ],
  },
  {
    key: 'boss-friday',
    kind: 'CHECK_RECEIVED',
    title: 'The Friday 17:00 request',
    setting: 'Office · Friday, 16:58',
    body: 'Your boss asks for a full report by Monday morning. You had plans all weekend.',
    lesson: 'Checks are forcing moves. The best defence often changes the question: what does the other side actually need?',
    options: [
      o('clarify', 'Ask what decision the report is for and offer a one-page version', 'wise', 'A one-page summary is all they need. Your weekend survives.'),
      o('cancel', 'Cancel your plans and write the full report', 'mixed', 'They are pleased, and now they expect it every week.'),
      o('refuse', 'Say no, it is the weekend', 'risky', 'Fair in principle, but blunt. Monday starts tense.'),
    ],
  },
  // ── Blunder ────────────────────────────────────────────────────────────────
  {
    key: 'unread-contract',
    kind: 'BLUNDER',
    title: 'The contract you did not read',
    setting: 'Gym membership desk',
    body: 'You signed quickly to get started. Now you see a twelve-month lock-in and a cancellation fee.',
    lesson: 'Most blunders are not lack of skill; they are moving too fast. Before every move, ask what the other side can do next.',
    options: [
      o('cooling-off', 'Check the cooling-off period and ask politely to amend', 'wise', 'You are still inside the cooling-off window. Contract fixed.'),
      o('live-with', 'Accept it and use the gym a lot', 'mixed', 'It works out, but only because you happen to love the gym.'),
      o('complain', 'Leave a furious review and stop paying', 'risky', 'The debt goes to collections. One rushed move became three problems.'),
    ],
  },
  {
    key: 'reply-all',
    kind: 'BLUNDER',
    title: 'Reply all',
    setting: 'Inbox · Tuesday, 14:03',
    body: 'Your sarcastic comment about a project just went to the whole department, including the project lead.',
    lesson: 'After a blunder, the next move matters most. Stop the damage before trying to win anything back.',
    options: [
      o('apologise', 'Apologise directly to the project lead, in person', 'wise', 'It is awkward, but they appreciate the honesty. The story ends there.'),
      o('recall', 'Try to recall the email and say nothing', 'mixed', 'The recall fails, and your silence reads as indifference.'),
      o('double-down', 'Explain that you were only joking, to everyone', 'risky', 'A second email turns a slip into a thread.'),
    ],
  },
  // ── Promotion ──────────────────────────────────────────────────────────────
  {
    key: 'team-lead',
    kind: 'PROMOTION',
    title: 'The intern who became team lead',
    setting: 'All-hands meeting',
    body: 'Years of small steps, one at a time, and today you are announced as team lead. Your former peers now report to you.',
    lesson: 'A pawn that walks all the way becomes a queen. Habits, repeated patiently, turn into your most powerful asset.',
    options: [
      o('listen', 'Meet each person one-on-one and ask what they need', 'wise', 'Trust carries over. The team performs better in your first quarter than the last.'),
      o('assert', 'Set new rules on day one to establish authority', 'risky', 'Two good people start looking for other jobs.'),
      o('same', 'Act exactly as before and avoid hard calls', 'mixed', 'Everyone likes you, but decisions stall. A queen that never moves is a pawn.'),
    ],
  },
  {
    key: 'marathon',
    kind: 'PROMOTION',
    title: 'The finish line',
    setting: 'Mile 26.2',
    body: 'A year ago you could not run a mile. Today you finish your first marathon.',
    lesson: 'Promotion is the reward for many quiet moves nobody noticed. Protect the habits that got you here.',
    options: [
      o('next-goal', 'Rest, then set a new, smaller goal', 'wise', 'The habit stays. Six months on, you are still running.'),
      o('stop', 'Stop running; goal achieved', 'mixed', 'A great memory, but the fitness fades by spring.'),
      o('ultra', 'Sign up for an ultramarathon next month', 'risky', 'Too much, too soon. An injury keeps you out for months.'),
    ],
  },
  // ── Endgame ────────────────────────────────────────────────────────────────
  {
    key: 'long-term',
    kind: 'ENDGAME',
    title: 'The long game',
    setting: 'Kitchen table · Sunday evening',
    body: 'Fewer distractions now. The decisions left are the big, slow ones: where to live, what to build, who to build it with.',
    lesson: 'In the endgame the king becomes an active piece. Your own wellbeing is no longer something to hide; it is something to use.',
    options: [
      o('plan', 'Write down a three-year plan and share it with someone you trust', 'wise', 'Saying it out loud makes it real, and they help you keep it.'),
      o('drift', 'Take things as they come', 'mixed', 'Some things work out. Others drift past you.'),
      o('everything', 'Try to change everything at once', 'risky', 'Too many fronts. Nothing gets your full attention.'),
    ],
  },
  {
    key: 'parents',
    kind: 'ENDGAME',
    title: 'Caring for a parent',
    setting: 'Hospital corridor',
    body: 'Your parent needs more support now. You and your siblings have to agree who does what.',
    lesson: 'Endgames are won by coordination: every remaining piece needs a job.',
    options: [
      o('family-meeting', 'Call a family meeting and split tasks by strengths', 'wise', 'Everyone contributes in their own way, and nobody burns out.'),
      o('do-it-all', 'Take it all on yourself', 'mixed', 'You manage, but you are exhausted and quietly resentful.'),
      o('wait-and-see', 'Wait for someone else to step up', 'risky', 'Nobody does. The situation gets harder for everyone.'),
    ],
  },
  // ── Endings ────────────────────────────────────────────────────────────────
  {
    key: 'win-reflection',
    kind: 'WIN',
    title: 'Checkmate: the deal is done',
    setting: 'After the game',
    body: 'You won. Your opponent offers a handshake, and someone asks how you did it.',
    lesson: 'Winners review their games too. The moves you got away with are as instructive as the ones that worked.',
    options: [
      o('review', 'Shake hands and ask where they thought you were weak', 'wise', 'They point out a moment you were lucky. Next time you will not need the luck.'),
      o('gloat', 'Enjoy it loudly', 'risky', 'Fun for a minute, but nobody wants to play you again.'),
      o('move-on', 'Shake hands and move on', 'mixed', 'Gracious, but you miss the free lesson.'),
    ],
  },
  {
    key: 'win-promotion',
    kind: 'WIN',
    title: 'The offer letter',
    setting: 'Inbox · Friday',
    body: 'You won the game, and with it, the role you had been working towards.',
    lesson: 'Converting an advantage is a skill. Note what you did in the moments that decided the game.',
    options: [
      o('thank', 'Thank the people who helped you get here', 'wise', 'Relationships you will need again, strengthened.'),
      o('negotiate-more', 'Use the moment to negotiate one more term', 'mixed', 'You get it, but it slightly sours the welcome.'),
      o('relax', 'Relax completely; the work is done', 'risky', 'A new role is a new opening. You start it slowly.'),
    ],
  },
  {
    key: 'lose-reflection',
    kind: 'LOSE',
    title: 'Checkmated',
    setting: 'After the game',
    body: 'You lost this one. Your opponent offers a handshake and, if you want, a quick review.',
    lesson: 'Every strong player has lost thousands of games. The difference is what they did in the ten minutes afterwards.',
    options: [
      o('review', 'Accept the review and find the turning point', 'wise', 'You find the move where it went wrong, and it will not happen the same way again.'),
      o('rematch', 'Ask for an immediate rematch', 'mixed', 'Spirited, but without a review you make similar mistakes.'),
      o('blame', 'Blame bad luck', 'risky', 'Nothing learned. The same pattern will cost you again.'),
    ],
  },
  {
    key: 'lose-job-hunt',
    kind: 'LOSE',
    title: 'Not this time',
    setting: 'Coffee shop · Tuesday',
    body: 'The negotiation fell through and the deal went to someone else.',
    lesson: 'A loss tells you something about your preparation, your timing, or your choices under pressure. Pick one to improve.',
    options: [
      o('one-thing', 'Write down one thing to do differently', 'wise', 'Specific and actionable. Your next attempt is sharper.'),
      o('everything', 'Decide to change your entire approach', 'mixed', 'You throw out good habits along with the bad.'),
      o('avoid', 'Avoid similar situations for a while', 'risky', 'Safe, but the skill only grows by playing.'),
    ],
  },
  {
    key: 'draw-reflection',
    kind: 'DRAW',
    title: 'A fair split',
    setting: 'After the game',
    body: 'Neither side could break through. The game ends in a draw.',
    lesson: 'A draw is often a negotiated outcome: both sides protected what mattered most. Ask whether there was value nobody found.',
    options: [
      o('explore', 'Look for the move that could have broken the deadlock', 'wise', 'You find a quiet move that changes everything. Next time.'),
      o('content', 'Be content; a draw is fine', 'mixed', 'Fair enough, though you may have had more.'),
      o('frustrated', 'Feel the game was wasted', 'risky', 'A draw against a strong opponent is useful. Frustration hides that.'),
    ],
  },
  {
    key: 'draw-compromise',
    kind: 'DRAW',
    title: 'The compromise',
    setting: 'Family dinner',
    body: "Holiday plans: you wanted the coast, your partner wanted the mountains. You end up splitting the week.",
    lesson: 'Splitting the difference is the most common draw. Creative trades across priorities often beat it.',
    options: [
      o('priorities', 'Ask what each of you values most about your choice', 'wise', 'It turns out you wanted quiet and they wanted hiking. A lake town gives you both.'),
      o('split', 'Keep the split week', 'mixed', 'It works, with a lot of driving.'),
      o('give-in', 'Give in entirely to keep the peace', 'risky', 'Peaceful now, resentful later.'),
    ],
  },
]

export function scenesForKind(kind: MomentKind): SceneDef[] {
  return SCENES.filter((s) => s.kind === kind)
}

export function sceneByKey(key: string): SceneDef | undefined {
  return SCENES.find((s) => s.key === key)
}
