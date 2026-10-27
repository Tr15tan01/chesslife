import type { Filter, UpdateFilter, Sort, Document } from 'mongodb'

/**
 * The narrow collection contract the application uses. Two implementations:
 *  - MongoCollection: MongoDB Atlas via the official driver (production).
 *  - MemoryCollection: in-process store powered by mingo (tests / local demo).
 *
 * Keeping the surface small means both behave the same way for every query
 * the app actually issues.
 */
export type BaseDoc = { _id: string } & Document

export type FindOptions = {
  sort?: Sort
  limit?: number
  skip?: number
  projection?: Record<string, 0 | 1>
}

export type UpdateOptions = { upsert?: boolean }

export interface Coll<T extends BaseDoc> {
  readonly name: string
  findOne(filter: Filter<T>, opts?: Pick<FindOptions, 'projection' | 'sort'>): Promise<T | null>
  find(filter: Filter<T>, opts?: FindOptions): Promise<T[]>
  insertOne(doc: T): Promise<void>
  insertMany(docs: T[]): Promise<void>
  updateOne(filter: Filter<T>, update: UpdateFilter<T>, opts?: UpdateOptions): Promise<{ matched: number; modified: number; upserted: boolean }>
  updateMany(filter: Filter<T>, update: UpdateFilter<T>): Promise<{ matched: number }>
  findOneAndUpdate(
    filter: Filter<T>,
    update: UpdateFilter<T>,
    opts?: UpdateOptions & { returnDocument?: 'before' | 'after' },
  ): Promise<T | null>
  replaceOne(filter: Filter<T>, doc: T, opts?: UpdateOptions): Promise<{ matched: number }>
  deleteOne(filter: Filter<T>): Promise<number>
  deleteMany(filter: Filter<T>): Promise<number>
  countDocuments(filter?: Filter<T>): Promise<number>
  aggregate<R = Document>(pipeline: Document[]): Promise<R[]>
}

export type IndexSpec = {
  keys: Record<string, 1 | -1>
  unique?: boolean
  expireAfterSeconds?: number
  name?: string
  partial?: Document
}

export class DuplicateKeyError extends Error {
  code = 11000
  constructor(public readonly collection: string, public readonly keys: string[]) {
    super(`Duplicate key on ${collection}: ${keys.join(',')}`)
    this.name = 'DuplicateKeyError'
  }
}

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000
}
