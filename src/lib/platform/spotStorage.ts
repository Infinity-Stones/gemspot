import { readBrowserOwnerId } from './browserOwner';
import type {
  InsertRowResult,
  SelectAllResult,
  SelectByIdResult,
  UpdateRowResult,
} from './supabase';
import { selectAllRows, selectRowById, updateRow, upsertRow } from './supabase';
import type { SavedSpot } from '@/shared/spot';
import { isSpotCategory, isSpotCoordinates } from '@/shared/spot';

/** Supabase의 테이블·열·쿼리 모양을 아는 유일한 스팟 저장 어댑터. */
const SPOTS_TABLE = 'spots';
const SPOT_UNIQUE_COLUMNS = 'owner_id,name,canonical_address';

export type StoredSpotInput = Omit<SavedSpot, 'id'>;

export type SpotStorageError =
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'query'; readonly message: string }
  | { readonly kind: 'invalid_row' };

type SpotStorageConnectionError = Exclude<
  SpotStorageError,
  { kind: 'invalid_row' }
>;

export type ReadStoredSpotsResult =
  | { readonly ok: true; readonly spots: readonly SavedSpot[] }
  | {
      readonly ok: false;
      readonly error: SpotStorageConnectionError;
    };

export type ReadStoredSpotResult =
  | { readonly ok: true; readonly spot: SavedSpot | null }
  | { readonly ok: false; readonly error: SpotStorageError };

export type WriteStoredSpotResult =
  | { readonly ok: true; readonly spot: SavedSpot }
  | { readonly ok: false; readonly error: SpotStorageError };

export type DeleteStoredSpotResult =
  | { readonly ok: true; readonly deleted: boolean }
  | {
      readonly ok: false;
      readonly error: SpotStorageConnectionError;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** 저장 행을 공용 스팟 계약으로 좁힌다. provider 전용 열은 밖으로 내보내지 않는다. */
export function parseStoredSpot(raw: unknown): SavedSpot | null {
  if (!isRecord(raw)) return null;
  const {
    id,
    name,
    road_address,
    jibun_address,
    latitude,
    longitude,
    sido,
    sigugun,
    category,
    origin,
  } = raw;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  const coordinates = { latitude, longitude };
  if (!isSpotCoordinates(coordinates)) return null;
  if (!isSpotCategory(category)) return null;
  if (origin !== 'ocr' && origin !== 'manual') return null;

  return {
    id,
    name,
    roadAddress: optionalText(road_address),
    jibunAddress: optionalText(jibun_address),
    coordinates,
    region: { sido: optionalText(sido), sigugun: optionalText(sigugun) },
    category,
    origin,
  };
}

/** 도로명 주소를 우선하고 없으면 지번 주소를 대표 주소로 삼는다. */
export function canonicalSpotAddress(spot: StoredSpotInput): string {
  return spot.roadAddress ?? spot.jibunAddress ?? '';
}

export function toStoredSpotRow(
  spot: StoredSpotInput,
  ownerId: string,
  savedAt: string,
): Record<string, unknown> {
  return {
    owner_id: ownerId,
    name: spot.name,
    canonical_address: canonicalSpotAddress(spot),
    road_address: spot.roadAddress,
    jibun_address: spot.jibunAddress,
    latitude: spot.coordinates.latitude,
    longitude: spot.coordinates.longitude,
    sido: spot.region.sido,
    sigugun: spot.region.sigugun,
    category: spot.category,
    origin: spot.origin,
    saved_at: savedAt,
    deleted_at: null,
  };
}

interface OwnerOptions {
  readonly ownerId?: () => Promise<string>;
}

async function resolveOwnerId(
  option: OwnerOptions,
): Promise<string | SpotStorageConnectionError> {
  try {
    return await (option.ownerId ?? readBrowserOwnerId)();
  } catch (cause) {
    return {
      kind: 'query',
      message:
        cause instanceof Error
          ? cause.message
          : '브라우저 소유자를 읽지 못했습니다.',
    };
  }
}

export interface ReadStoredSpotsOptions extends OwnerOptions {
  readonly select?: (ownerId: string) => Promise<SelectAllResult>;
}

export async function readStoredSpots(
  options: ReadStoredSpotsOptions = {},
): Promise<ReadStoredSpotsResult> {
  const owner = await resolveOwnerId(options);
  if (typeof owner !== 'string') return { ok: false, error: owner };
  const select =
    options.select ??
    ((ownerId: string) =>
      selectAllRows(SPOTS_TABLE, {
        orderBy: 'saved_at',
        ascending: false,
        equals: { owner_id: ownerId },
        nullColumns: ['deleted_at'],
      }));
  const result = await select(owner);
  if (!result.ok) return result;
  return {
    ok: true,
    spots: result.rows
      .map(parseStoredSpot)
      .filter((spot): spot is SavedSpot => spot !== null),
  };
}

export interface ReadStoredSpotOptions extends OwnerOptions {
  readonly select?: (id: string, ownerId: string) => Promise<SelectByIdResult>;
}

export async function readStoredSpot(
  id: string,
  options: ReadStoredSpotOptions = {},
): Promise<ReadStoredSpotResult> {
  const owner = await resolveOwnerId(options);
  if (typeof owner !== 'string') return { ok: false, error: owner };
  const select =
    options.select ??
    ((spotId: string, ownerId: string) =>
      selectRowById(SPOTS_TABLE, spotId, {
        equals: { owner_id: ownerId },
        nullColumns: ['deleted_at'],
      }));
  const result = await select(id, owner);
  if (!result.ok) return result;
  if (result.row === null) return { ok: true, spot: null };
  const spot = parseStoredSpot(result.row);
  return spot === null
    ? { ok: false, error: { kind: 'invalid_row' } }
    : { ok: true, spot };
}

export interface WriteStoredSpotOptions extends OwnerOptions {
  readonly upsert?: (
    row: Readonly<Record<string, unknown>>,
    uniqueColumns: string,
  ) => Promise<InsertRowResult>;
  readonly now?: () => Date;
}

/** 같은 사용자·상호명·대표 주소가 있으면 삭제 여부를 풀고 기존 id로 복구한다. */
export async function writeStoredSpot(
  spot: StoredSpotInput,
  options: WriteStoredSpotOptions = {},
): Promise<WriteStoredSpotResult> {
  const owner = await resolveOwnerId(options);
  if (typeof owner !== 'string') return { ok: false, error: owner };
  const write =
    options.upsert ??
    ((row: Readonly<Record<string, unknown>>, uniqueColumns: string) =>
      upsertRow(SPOTS_TABLE, row, uniqueColumns));
  const result = await write(
    toStoredSpotRow(
      spot,
      owner,
      (options.now ?? (() => new Date()))().toISOString(),
    ),
    SPOT_UNIQUE_COLUMNS,
  );
  if (!result.ok) return result;
  const saved = parseStoredSpot(result.row);
  return saved === null
    ? { ok: false, error: { kind: 'invalid_row' } }
    : { ok: true, spot: saved };
}

export interface DeleteStoredSpotOptions extends OwnerOptions {
  readonly update?: (
    id: string,
    ownerId: string,
    deletedAt: string,
  ) => Promise<UpdateRowResult>;
  readonly now?: () => Date;
}

export async function softDeleteStoredSpot(
  id: string,
  options: DeleteStoredSpotOptions = {},
): Promise<DeleteStoredSpotResult> {
  const owner = await resolveOwnerId(options);
  if (typeof owner !== 'string') return { ok: false, error: owner };
  const update =
    options.update ??
    ((spotId: string, ownerId: string, deletedAt: string) =>
      updateRow(
        SPOTS_TABLE,
        { deleted_at: deletedAt },
        { id: spotId, owner_id: ownerId },
        { nullColumns: ['deleted_at'] },
      ));
  const result = await update(
    id,
    owner,
    (options.now ?? (() => new Date()))().toISOString(),
  );
  if (!result.ok) return result;
  return { ok: true, deleted: result.row !== null };
}
