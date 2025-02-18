import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as Badge from '../../lexicon/types/app/bsky/badge'
import { DbRecordPlugin, Notification } from '../types'
import * as schemas from '../schemas'

const type = schemas.ids.AppBskyBadge
const tableName = 'app_bsky_badge'

export interface AppBskyBadge {
  uri: string
  cid: string
  creator: string
  assertionType: string
  assertionTag: string | null
  createdAt: string
  indexedAt: string
}

export type PartialDB = { [tableName]: AppBskyBadge }

const validator = schemas.records.createRecordValidator(type)
const matchesSchema = (obj: unknown): obj is Badge.Record => {
  return validator.isValid(obj)
}
const validateSchema = (obj: unknown) => validator.validate(obj)

const translateDbObj = (dbObj: AppBskyBadge): Badge.Record => {
  return {
    assertion: {
      type: dbObj.assertionType,
      tag: dbObj.assertionTag || undefined,
    },
    createdAt: dbObj.createdAt,
  }
}

const getFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<Badge.Record | null> => {
    const found = await db
      .selectFrom('app_bsky_badge')
      .selectAll()
      .where('uri', '=', uri.toString())
      .executeTakeFirst()
    return !found ? null : translateDbObj(found)
  }

const insertFn =
  (db: Kysely<PartialDB>) =>
  async (
    uri: AtUri,
    cid: CID,
    obj: unknown,
    timestamp?: string,
  ): Promise<void> => {
    if (!matchesSchema(obj)) {
      throw new Error(`Record does not match schema: ${type}`)
    }
    const val = {
      uri: uri.toString(),
      cid: cid.toString(),
      creator: uri.host,
      assertionType: obj.assertion.type,
      assertionTag: (obj.assertion as Badge.TagAssertion).tag || null,
      createdAt: obj.createdAt,
      indexedAt: timestamp || new Date().toISOString(),
    }
    await db.insertInto('app_bsky_badge').values(val).execute()
  }

const deleteFn =
  (db: Kysely<PartialDB>) =>
  async (uri: AtUri): Promise<void> => {
    await db
      .deleteFrom('app_bsky_badge')
      .where('uri', '=', uri.toString())
      .execute()
  }

const notifsForRecord = (
  _uri: AtUri,
  _cid: CID,
  _obj: unknown,
): Notification[] => {
  return []
}

export const makePlugin = (
  db: Kysely<PartialDB>,
): DbRecordPlugin<Badge.Record, AppBskyBadge> => {
  return {
    collection: type,
    tableName,
    validateSchema,
    matchesSchema,
    translateDbObj,
    get: getFn(db),
    insert: insertFn(db),
    delete: deleteFn(db),
    notifsForRecord,
  }
}

export default makePlugin
