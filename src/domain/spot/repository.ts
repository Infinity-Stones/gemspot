import type { InsertRowResult, SelectAllResult, SelectByIdResult } from '@/lib/platform/supabase';
import { insertRow, selectAllRows, selectRowById } from '@/lib/platform/supabase';
import type { SavedSpot } from '@/shared/spot';
import { isSpotCategory, isSpotCoordinates } from '@/shared/spot';
import { SEED_SPOTS } from './seed';

/**
 * 스팟 저장소 접근 — D06(#26) Supabase, T29(#41) 목록 조회, T50(#74) 시드 폴백.
 *
 * 이 파일이 `spots` 테이블의 열 이름(snake_case)을 아는 유일한 곳이다. 여기서
 * 도메인 모양(`SavedSpot`)으로 옮기지 않으면 열 이름 변경이 화면까지 번진다.
 *
 * 저장소가 설정되지 않았거나 읽기에 실패하면 시드로 떨어지되 `source`와
 * `storeError`로 그 사실을 위에 올린다 — 조용히 대체하면 저장소가 죽은 것을
 * 아무도 모른다(example 도메인의 seed 배지와 같은 원칙).
 */

export type SpotSource = 'seed' | 'store';

export interface LoadSpotsResult {
  readonly spots: readonly SavedSpot[];
  readonly source: SpotSource;
  /** 저장소 읽기가 실패해 시드로 떨어졌으면 그 이유. 설정 자체가 없으면 null. */
  readonly storeError: string | null;
}

export const SPOTS_TABLE = 'spots';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * 행 하나를 계약으로 좁힌다. 통과하지 못하면 `null` — 던지지 않는다. 한 행이
 * 깨졌다고 목록 전체를 버리면 저장소의 데이터 한 줄이 화면을 통째로 비운다.
 */
export function parseSpotRow(raw: unknown): SavedSpot | null {
  if (!isRecord(raw)) return null;
  const { id, name, road_address, jibun_address, latitude, longitude, sido, sigugun, category, origin } = raw;

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

export interface LoadSpotsOptions {
  /** 테스트용. 기본은 Supabase `spots` 테이블. */
  readonly readRows?: () => Promise<SelectAllResult>;
}

export async function loadSpots(options: LoadSpotsOptions = {}): Promise<LoadSpotsResult> {
  const readRows =
    options.readRows ?? (() => selectAllRows(SPOTS_TABLE, { orderBy: 'created_at', ascending: false }));

  const result = await readRows();
  if (!result.ok) {
    return {
      spots: SEED_SPOTS,
      source: 'seed',
      storeError: result.error.kind === 'unconfigured' ? null : result.error.message,
    };
  }

  const spots = result.rows.map(parseSpotRow).filter((s): s is SavedSpot => s !== null);
  return { spots, source: 'store', storeError: null };
}

/** 저장 전 스팟 — id · created_at은 DB가 채운다. */
export type NewSpot = Omit<SavedSpot, 'id'>;

/** 도메인 모양 → 열. parseSpotRow의 역방향이고, 열 이름을 아는 두 번째이자 마지막 자리다. */
export function toSpotRow(spot: NewSpot): Record<string, unknown> {
  return {
    name: spot.name,
    road_address: spot.roadAddress,
    jibun_address: spot.jibunAddress,
    latitude: spot.coordinates.latitude,
    longitude: spot.coordinates.longitude,
    sido: spot.region.sido,
    sigugun: spot.region.sigugun,
    category: spot.category,
    origin: spot.origin,
  };
}

export type InsertSpotResult =
  | { readonly ok: true; readonly spot: SavedSpot }
  | {
      readonly ok: false;
      readonly error:
        | { readonly kind: 'unconfigured' }
        | { readonly kind: 'query'; readonly message: string }
        /** DB가 돌려준 행이 계약을 통과하지 못했다 — 스키마와 계약이 어긋난 신호다. */
        | { readonly kind: 'invalid_row' };
    };

export interface InsertSpotOptions {
  /** 테스트용. 기본은 Supabase `spots` 테이블. */
  readonly insert?: (row: Record<string, unknown>) => Promise<InsertRowResult>;
}

/**
 * 스팟을 저장한다(T21 #30). 좌표 검증은 여기서 하지 않는다 — `NewSpot`은
 * 좌표가 필수라 검증을 지난 값만 이 함수에 닿는다(T22 #31은 save.ts).
 *
 * 저장소가 없으면 `unconfigured`로 **실패**한다. 시드에 끼워 넣지 않는다 —
 * 새로 고치면 사라지는 저장을 성공처럼 보이면 안 된다.
 */
export async function insertSpot(spot: NewSpot, options: InsertSpotOptions = {}): Promise<InsertSpotResult> {
  const insert = options.insert ?? ((row: Record<string, unknown>) => insertRow(SPOTS_TABLE, row));
  const result = await insert(toSpotRow(spot));
  if (!result.ok) return { ok: false, error: result.error };
  const saved = parseSpotRow(result.row);
  if (saved === null) return { ok: false, error: { kind: 'invalid_row' } };
  return { ok: true, spot: saved };
}

export interface FindSpotOptions {
  /** 테스트용. 기본은 Supabase `spots` 테이블. */
  readonly readRow?: (id: string) => Promise<SelectByIdResult>;
}

/**
 * id로 스팟 하나. 저장소가 없으면 시드에서 찾는다 — 시드 id로 열린 결과
 * 화면이 저장소 없이도 돌아야 한다. 없으면 `null`.
 */
export async function findSpot(id: string, options: FindSpotOptions = {}): Promise<SavedSpot | null> {
  const readRow = options.readRow ?? ((spotId: string) => selectRowById(SPOTS_TABLE, spotId));
  const result = await readRow(id);
  if (!result.ok) {
    if (result.error.kind === 'unconfigured') return SEED_SPOTS.find((s) => s.id === id) ?? null;
    return null;
  }
  return result.row === null ? null : parseSpotRow(result.row);
}
