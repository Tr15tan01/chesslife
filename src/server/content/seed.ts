import { createHash } from 'node:crypto'
import type { Db } from '../db'
import type { ScenarioDoc } from '../db/models'
import { SEED_SCENARIOS } from './index'
import { validateScenario } from './validate'
import { CHALLENGES, PROGRAMS } from './academy'
import type { BuiltScenario } from './kit'

const id = () => crypto.randomUUID()

export function scenarioIndexFields(s: BuiltScenario): Omit<ScenarioDoc, '_id' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'ownerId' | 'visibility' | 'published'> {
  return {
    slug: s.pub.slug,
    title: s.pub.title,
    summary: s.pub.summary,
    category: s.pub.category,
    difficulty: s.pub.difficulty,
    tags: s.pub.tags,
    quick: s.pub.quick,
    estMinutes: s.pub.estMinutes,
    learningObjective: s.pub.learningObjective,
    counterpartName: s.pub.counterpart.name,
    counterpartRole: s.pub.counterpart.role,
    counterpartStyle: s.pub.counterpart.style,
    issueLabels: s.pub.issues.map((i) => i.label),
    focus: s.focus,
  }
}

/**
 * Idempotent content seed. Scenario changes create a new version so finished
 * games keep replaying against the exact version they were played on.
 */
export async function seedContent(db: Db, log: (m: string) => void = () => {}) {
  const now = new Date()
  let created = 0
  let versioned = 0
  for (const s of SEED_SCENARIOS) {
    const errors = validateScenario(s)
    if (errors.length) throw new Error(`Scenario ${s.pub.slug} is invalid: ${errors.join('; ')}`)
    const hash = createHash('sha256').update(JSON.stringify({ pub: s.pub, priv: s.priv })).digest('hex')
    const existing = await db.scenarios.findOne({ slug: s.pub.slug })
    if (!existing) {
      const scenarioId = id()
      await db.scenarios.insertOne({
        _id: scenarioId,
        ...scenarioIndexFields(s),
        published: true,
        visibility: 'PUBLIC',
        ownerId: null,
        currentVersion: 1,
        seedHash: hash,
        createdAt: now,
        updatedAt: now,
      })
      await db.scenarioVersions.insertOne({ _id: id(), scenarioId, version: 1, public: s.pub, private: s.priv, createdAt: now, createdBy: null })
      created++
      continue
    }
    if (existing.seedHash === hash) continue
    if (existing.ownerId) continue
    const version = existing.currentVersion + 1
    await db.scenarioVersions.insertOne({ _id: id(), scenarioId: existing._id, version, public: s.pub, private: s.priv, createdAt: now, createdBy: null })
    await db.scenarios.updateOne({ _id: existing._id }, { $set: { ...scenarioIndexFields(s), currentVersion: version, seedHash: hash, updatedAt: now } })
    versioned++
  }
  log(`Scenarios: ${created} created, ${versioned} updated to a new version, ${SEED_SCENARIOS.length} total in seed.`)

  for (const [pi, p] of PROGRAMS.entries()) {
    const existing = await db.programs.findOne({ slug: p.slug })
    const programId = existing?._id ?? id()
    await db.programs.updateOne(
      { slug: p.slug },
      { $set: { title: p.title, summary: p.summary, order: pi + 1, skill: p.skill, updatedAt: now }, $setOnInsert: { _id: programId, slug: p.slug, published: true } },
      { upsert: true },
    )
    for (const [li, l] of p.lessons.entries()) {
      await db.lessons.updateOne(
        { slug: l.slug },
        {
          $set: { programId, title: l.title, order: li + 1, minutes: l.minutes, cards: l.cards, example: l.example, quiz: l.quiz, practiceScenario: l.practice, updatedAt: now },
          $setOnInsert: { _id: id(), slug: l.slug, published: true },
        },
        { upsert: true },
      )
    }
  }
  log(`Academy: ${PROGRAMS.length} programmes, ${PROGRAMS.reduce((n, p) => n + p.lessons.length, 0)} lessons.`)

  for (const c of CHALLENGES) {
    await db.challenges.updateOne(
      { slug: c.slug },
      { $set: { title: c.title, summary: c.summary, scenarioSlug: c.scenarioSlug, order: c.order, criteria: c.criteria, criteriaText: c.criteriaText }, $setOnInsert: { _id: id(), slug: c.slug, published: c.published } },
      { upsert: true },
    )
  }
  log(`Challenges: ${CHALLENGES.length}.`)
}
