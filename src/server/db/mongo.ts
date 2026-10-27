import { MongoClient, type Collection, type Document, type Filter, type UpdateFilter } from 'mongodb'
import type { BaseDoc, Coll, FindOptions, UpdateOptions } from './collection'

const g = globalThis as unknown as { __dealcraftMongo?: Promise<MongoClient> }

/** One pooled client per process (survives dev hot reloads). */
export function mongoClient(url: string): Promise<MongoClient> {
  g.__dealcraftMongo ??= new MongoClient(url, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000,
    appName: 'dealcraft',
    retryWrites: true,
  }).connect()
  return g.__dealcraftMongo
}

export class MongoCollection<T extends BaseDoc> implements Coll<T> {
  constructor(private readonly col: Collection<T>) {}

  get name() {
    return this.col.collectionName
  }

  findOne(filter: Filter<T>, opts?: Pick<FindOptions, 'projection' | 'sort'>) {
    return this.col.findOne(filter, { projection: opts?.projection, sort: opts?.sort }) as Promise<T | null>
  }

  find(filter: Filter<T>, opts: FindOptions = {}) {
    let c = this.col.find(filter, { projection: opts.projection })
    if (opts.sort) c = c.sort(opts.sort)
    if (opts.skip) c = c.skip(opts.skip)
    if (opts.limit) c = c.limit(opts.limit)
    return c.toArray() as Promise<T[]>
  }

  async insertOne(doc: T) {
    await this.col.insertOne(doc as never)
  }

  async insertMany(docs: T[]) {
    if (docs.length) await this.col.insertMany(docs as never[])
  }

  async updateOne(filter: Filter<T>, update: UpdateFilter<T>, opts: UpdateOptions = {}) {
    const r = await this.col.updateOne(filter, update, { upsert: opts.upsert })
    return { matched: r.matchedCount, modified: r.modifiedCount, upserted: r.upsertedCount > 0 }
  }

  async updateMany(filter: Filter<T>, update: UpdateFilter<T>) {
    const r = await this.col.updateMany(filter, update)
    return { matched: r.matchedCount }
  }

  async findOneAndUpdate(filter: Filter<T>, update: UpdateFilter<T>, opts: UpdateOptions & { returnDocument?: 'before' | 'after' } = {}) {
    const r = await this.col.findOneAndUpdate(filter, update, {
      upsert: opts.upsert,
      returnDocument: opts.returnDocument ?? 'before',
    })
    return r as T | null
  }

  async replaceOne(filter: Filter<T>, doc: T, opts: UpdateOptions = {}) {
    const r = await this.col.replaceOne(filter, doc as never, { upsert: opts.upsert })
    return { matched: r.matchedCount }
  }

  async deleteOne(filter: Filter<T>) {
    return (await this.col.deleteOne(filter)).deletedCount
  }

  async deleteMany(filter: Filter<T>) {
    return (await this.col.deleteMany(filter)).deletedCount
  }

  countDocuments(filter: Filter<T> = {}) {
    return this.col.countDocuments(filter)
  }

  aggregate<R = Document>(pipeline: Document[]) {
    return this.col.aggregate(pipeline).toArray() as Promise<R[]>
  }
}
