import { Query, find as mingoFind, aggregate as mingoAggregate } from 'mingo'
import { update as mingoUpdate } from 'mingo/updater'
import type { Document } from 'mongodb'
import type { BaseDoc, Coll, FindOptions, IndexSpec, UpdateOptions } from './collection'
import { DuplicateKeyError } from './collection'

/**
 * In-memory collection used for unit/integration/e2e tests and for a
 * zero-configuration local demo (DATABASE_URL=memory://local).
 * It is refused in production by env().
 */

type Store = Map<string, Document[]>
const g = globalThis as unknown as { __dealcraftMemStore?: Store; __dealcraftMemIndexes?: Map<string, IndexSpec[]> }

function store(): Store {
  g.__dealcraftMemStore ??= new Map()
  return g.__dealcraftMemStore
}
function indexes(): Map<string, IndexSpec[]> {
  g.__dealcraftMemIndexes ??= new Map()
  return g.__dealcraftMemIndexes
}

export function resetMemoryStore() {
  store().clear()
}

export function registerMemoryIndexes(name: string, specs: IndexSpec[]) {
  indexes().set(name, specs)
}

const clone = <T>(v: T): T => structuredClone(v)

function getPath(doc: Document, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), doc)
}

function stripOperators(filter: Document): Document {
  const out: Document = {}
  for (const [k, v] of Object.entries(filter)) {
    if (k.startsWith('$')) continue
    if (v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).some((x) => x.startsWith('$'))) {
      if ('$eq' in v) out[k] = (v as Document).$eq
      continue
    }
    out[k] = v
  }
  return out
}

export class MemoryCollection<T extends BaseDoc> implements Coll<T> {
  constructor(public readonly name: string) {}

  private docs(): Document[] {
    const s = store()
    if (!s.has(this.name)) s.set(this.name, [])
    const docs = s.get(this.name)!
    // Lazy TTL purge
    for (const spec of indexes().get(this.name) ?? []) {
      if (spec.expireAfterSeconds === undefined) continue
      const field = Object.keys(spec.keys)[0]!
      const now = Date.now()
      for (let i = docs.length - 1; i >= 0; i--) {
        const v = getPath(docs[i]!, field)
        if (v instanceof Date && v.getTime() + spec.expireAfterSeconds * 1000 < now) docs.splice(i, 1)
      }
    }
    return docs
  }

  private checkUnique(candidate: Document, ignoreId?: string) {
    for (const spec of indexes().get(this.name) ?? []) {
      if (!spec.unique) continue
      if (spec.partial && !new Query(spec.partial as never).test(candidate)) continue
      const keys = Object.keys(spec.keys)
      const values = keys.map((k) => getPath(candidate, k))
      if (values.every((v) => v === undefined)) continue
      const clash = this.docs().some((d) => {
        if (d._id === ignoreId) return false
        if (spec.partial && !new Query(spec.partial as never).test(d)) return false
        return keys.every((k, i) => {
          const a = getPath(d, k)
          const b = values[i]
          return a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b
        })
      })
      if (clash) throw new DuplicateKeyError(this.name, keys)
    }
    if (ignoreId === undefined && this.docs().some((d) => d._id === candidate._id)) {
      throw new DuplicateKeyError(this.name, ['_id'])
    }
  }

  async findOne(filter: Document, opts?: Pick<FindOptions, 'projection' | 'sort'>): Promise<T | null> {
    const res = await this.find(filter, { ...opts, limit: 1 })
    return res[0] ?? null
  }

  async find(filter: Document, opts: FindOptions = {}): Promise<T[]> {
    let cursor = mingoFind(this.docs(), filter as never, opts.projection as never)
    if (opts.sort) cursor = cursor.sort(opts.sort as never)
    if (opts.skip) cursor = cursor.skip(opts.skip)
    if (opts.limit) cursor = cursor.limit(opts.limit)
    return clone(cursor.all() as unknown as T[])
  }

  async insertOne(doc: T): Promise<void> {
    const d = clone(doc)
    this.checkUnique(d)
    this.docs().push(d)
  }

  async insertMany(docs: T[]): Promise<void> {
    for (const d of docs) await this.insertOne(d)
  }

  private applyUpdate(target: Document, update: Document, inserting: boolean): Document {
    const next = clone(target)
    const { $setOnInsert, ...rest } = update as Document & { $setOnInsert?: Document }
    const mod: Document = { ...rest }
    if (inserting && $setOnInsert) {
      const { _id, ...onInsert } = $setOnInsert
      if (_id !== undefined) next._id = _id
      if (Object.keys(onInsert).length) mod.$set = { ...(mod.$set ?? {}), ...onInsert }
    }
    if (Object.keys(mod).length > 0) mingoUpdate(next, mod as never, undefined, undefined, { cloneMode: 'deep' })
    return next
  }

  async updateOne(filter: Document, update: Document, opts: UpdateOptions = {}) {
    const docs = this.docs()
    const q = new Query(filter as never)
    const idx = docs.findIndex((d) => q.test(d))
    if (idx === -1) {
      if (!opts.upsert) return { matched: 0, modified: 0, upserted: false }
      const base = { ...stripOperators(filter) }
      const created = this.applyUpdate(base, update, true)
      created._id ??= crypto.randomUUID()
      this.checkUnique(created)
      docs.push(created)
      return { matched: 0, modified: 0, upserted: true }
    }
    const next = this.applyUpdate(docs[idx]!, update, false)
    this.checkUnique(next, next._id as string)
    docs[idx] = next
    return { matched: 1, modified: 1, upserted: false }
  }

  async updateMany(filter: Document, update: Document) {
    const docs = this.docs()
    const q = new Query(filter as never)
    let matched = 0
    for (let i = 0; i < docs.length; i++) {
      if (!q.test(docs[i]!)) continue
      const next = this.applyUpdate(docs[i]!, update, false)
      this.checkUnique(next, next._id as string)
      docs[i] = next
      matched++
    }
    return { matched }
  }

  async findOneAndUpdate(filter: Document, update: Document, opts: UpdateOptions & { returnDocument?: 'before' | 'after' } = {}) {
    const docs = this.docs()
    const q = new Query(filter as never)
    const idx = docs.findIndex((d) => q.test(d))
    if (idx === -1) {
      if (!opts.upsert) return null
      const created = this.applyUpdate({ ...stripOperators(filter) }, update, true)
      created._id ??= crypto.randomUUID()
      this.checkUnique(created)
      docs.push(created)
      return opts.returnDocument === 'after' ? (clone(created) as T) : null
    }
    const before = docs[idx]!
    const next = this.applyUpdate(before, update, false)
    this.checkUnique(next, next._id as string)
    docs[idx] = next
    return clone((opts.returnDocument === 'after' ? next : before) as T)
  }

  async replaceOne(filter: Document, doc: T, opts: UpdateOptions = {}) {
    const docs = this.docs()
    const q = new Query(filter as never)
    const idx = docs.findIndex((d) => q.test(d))
    if (idx === -1) {
      if (opts.upsert) await this.insertOne(doc)
      return { matched: 0 }
    }
    const next = clone(doc)
    this.checkUnique(next, next._id)
    docs[idx] = next
    return { matched: 1 }
  }

  async deleteOne(filter: Document) {
    const docs = this.docs()
    const q = new Query(filter as never)
    const idx = docs.findIndex((d) => q.test(d))
    if (idx === -1) return 0
    docs.splice(idx, 1)
    return 1
  }

  async deleteMany(filter: Document) {
    const docs = this.docs()
    const q = new Query(filter as never)
    let n = 0
    for (let i = docs.length - 1; i >= 0; i--) {
      if (q.test(docs[i]!)) {
        docs.splice(i, 1)
        n++
      }
    }
    return n
  }

  async countDocuments(filter: Document = {}) {
    const q = new Query(filter as never)
    return this.docs().filter((d) => q.test(d)).length
  }

  async aggregate<R = Document>(pipeline: Document[]): Promise<R[]> {
    return clone(mingoAggregate(this.docs(), pipeline as never) as R[])
  }
}
