import type { CounterpartStyle } from '@/lib/negotiation/types'

type LineSet = {
  counter: string[]
  hold: string[]
  limits: string[]
  rejectNoCounter: string[]
  concessionYes: string[]
  concessionNo: string[]
  repeatQuestion: string[]
  pressureReply: string[]
  noted: string[]
}

/** Deterministic phrasing per negotiation style. `{offer}` is substituted. */
export const LINES: Record<CounterpartStyle, LineSet> = {
  cooperative: {
    counter: ['I think we can get close. How does {offer} sound?', 'Let me meet you partway: {offer}.', 'That helps. I could do {offer}.'],
    hold: ['I hear you, but I need to stay at {offer} for now.', "I'm not able to move further yet. {offer} is where I am."],
    limits: ["That's past what I can do, honestly. Let's find something workable.", "I can't make that work on my side. Can we look at it differently?"],
    rejectNoCounter: ["Okay — what would work for you? Give me something to react to.", 'Fair enough. What would you propose instead?'],
    concessionYes: ['I can give a little there. {offer}.', "Let's adjust that: {offer}."],
    concessionNo: ["I've already gone as far as I can on that point.", "That one's fixed for me, but there may be room elsewhere."],
    repeatQuestion: ['Like I said earlier, nothing has changed on that front.'],
    pressureReply: ["I'd rather we keep this constructive.", "Pressure doesn't really help me say yes."],
    noted: ['Noted. Go on.', 'Okay, I follow.'],
  },
  assertive: {
    counter: ['My number is {offer}.', "Here's what I can do: {offer}. That's a strong offer.", 'Counter: {offer}.'],
    hold: ['{offer}. That stands.', "I'm not moving off {offer} without a reason."],
    limits: ["That's not a serious number.", "No. That doesn't work for me at all."],
    rejectNoCounter: ["If you don't like it, put a number on the table.", "Saying no isn't a proposal. What's yours?"],
    concessionYes: ['Fine — {offer}. Now show me some movement too.', "I'll move once: {offer}."],
    concessionNo: ["No more movement there. You'll need to give me something.", "That's already my limit on that point."],
    repeatQuestion: ['You asked that already.'],
    pressureReply: ["Threats don't work on me.", "Let's stick to the deal."],
    noted: ['Okay.', 'Understood.'],
  },
  skeptical: {
    counter: ['Show me why this works for both of us. Meanwhile: {offer}.', "I'm cautious here, so {offer}.", 'Possibly. {offer} is the most I can justify.'],
    hold: ["Nothing you've said changes my view. {offer}.", 'I need more than that before I move from {offer}.'],
    limits: ['That number has no basis I can see.', "I'd need hard evidence to even consider that."],
    rejectNoCounter: ["Then tell me what you'd accept, and why.", 'On what basis? Give me a proposal.'],
    concessionYes: ['If that reasoning holds, {offer}.', 'Alright, a careful step: {offer}.'],
    concessionNo: ["I don't see the case for moving on that.", 'Not on that point.'],
    repeatQuestion: ["We've covered that."],
    pressureReply: ['That makes me less inclined, not more.', 'Interesting tactic. It hurts your credibility.'],
    noted: ['Hm. Noted.', 'Go on.'],
  },
  impatient: {
    counter: ["Let's wrap this up. {offer}.", '{offer}. Can we close on that?', 'Quick counter: {offer}.'],
    hold: ["I don't have time to go back and forth. {offer}.", 'Still {offer}.'],
    limits: ["That's a non-starter. Next.", "No. Let's be realistic."],
    rejectNoCounter: ["Then what? I need a number, now.", "Don't just say no. Propose."],
    concessionYes: ['Fine, {offer}. Let\'s finish.', 'Okay — {offer}. Decide.'],
    concessionNo: ['No time to renegotiate that.', 'That part is done.'],
    repeatQuestion: ['Already answered.'],
    pressureReply: ["I'm not playing games.", 'Careful — I can just leave.'],
    noted: ['Sure. And?', 'Right.'],
  },
  cautious: {
    counter: ['I want to be careful here. Perhaps {offer}?', 'Would {offer} be acceptable to you?', 'Let me suggest {offer}.'],
    hold: ["I'm not comfortable going beyond {offer} yet.", "I'd like to stay at {offer} for now."],
    limits: ["I'm afraid that's beyond what I can agree to.", "That isn't something I can commit to."],
    rejectNoCounter: ['I understand. What would make you comfortable?', 'Could you suggest an alternative?'],
    concessionYes: ['I can adjust slightly: {offer}.', 'Perhaps {offer} would help.'],
    concessionNo: ["I'd rather not move on that.", "I'm not able to change that."],
    repeatQuestion: ['As I mentioned before, my answer is the same.'],
    pressureReply: ['That makes me uneasy.', "I'd prefer not to be rushed."],
    noted: ['I see.', 'Thank you for explaining.'],
  },
  strategic: {
    counter: ['Interesting. My proposal: {offer}.', "Let's structure it like this: {offer}.", 'Consider {offer}. It reflects the value on both sides.'],
    hold: ["I think {offer} is already fair. What can you offer in return?", '{offer}. If you want movement, trade for it.'],
    limits: ["That isn't anchored in anything. Let's be serious.", "We're far apart. Let's understand why before trading numbers."],
    rejectNoCounter: ['A rejection without a proposal tells me nothing. Counter?', 'Then make me an offer that solves your problem and mine.'],
    concessionYes: ["I'll move there if you move elsewhere: {offer}.", 'In exchange for flexibility, {offer}.'],
    concessionNo: ["That's my priority. I won't trade it cheaply.", "Not that one. Pick another lever."],
    repeatQuestion: ['You already have that answer.'],
    pressureReply: ['Bluster is information too. Noted.', 'Pressure tells me you need this more than I do.'],
    noted: ['Noted.', 'Understood. Continue.'],
  },
}

export function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length]!
}

export function fill(template: string, offer: string): string {
  return template.replace('{offer}', offer)
}
