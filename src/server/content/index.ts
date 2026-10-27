import { careerBusiness } from './scenarios-career-business'
import { buyingPersonal } from './scenarios-buying-personal'
import { leadershipAdvanced } from './scenarios-leadership-advanced'
import type { BuiltScenario } from './kit'

export const SEED_SCENARIOS: BuiltScenario[] = [...careerBusiness, ...buyingPersonal, ...leadershipAdvanced]

export { validateScenario } from './validate'
