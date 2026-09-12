import type {
  DeleteStoredSpotResult,
  ReadStoredSpotResult,
  ReadStoredSpotsResult,
  StoredSpotInput,
  WriteStoredSpotResult,
} from '@/lib/platform/spotStorage';
import {
  readStoredSpot,
  readStoredSpots,
  softDeleteStoredSpot,
  writeStoredSpot,
} from '@/lib/platform/spotStorage';
import type { SavedSpot } from '@/shared/spot';
import { SEED_SPOTS } from './seed';

/**
 * 스팟 저장소 유스케이스. Supabase의 테이블·열·쿠키는 platform 어댑터가 맡고,
 * 도메인은 저장소 종류와 사용자 구분 방식을 모른다(T21 #30).
 */

export type SpotSource = 'seed' | 'store';

export interface LoadSpotsResult {
  readonly spots: readonly SavedSpot[];
  readonly source: SpotSource;
  /** 저장소 읽기가 실패해 시드로 떨어졌으면 그 이유. 설정 자체가 없으면 null. */
  readonly storeError: string | null;
}

export interface LoadSpotsOptions {
  /** 테스트용 저장 포트. */
  readonly read?: () => Promise<ReadStoredSpotsResult>;
}

export async function loadSpots(
  options: LoadSpotsOptions = {},
): Promise<LoadSpotsResult> {
  const result = await (options.read ?? readStoredSpots)();
  if (!result.ok) {
    return {
      spots: SEED_SPOTS,
      source: 'seed',
      storeError:
        result.error.kind === 'unconfigured' ? null : result.error.message,
    };
  }
  return { spots: result.spots, source: 'store', storeError: null };
}

/** 저장 전 스팟 — id · created_at은 DB가 채운다. */
export type NewSpot = StoredSpotInput;

export type InsertSpotResult = WriteStoredSpotResult;

export interface InsertSpotOptions {
  /** 테스트용 저장 포트. */
  readonly write?: (spot: NewSpot) => Promise<WriteStoredSpotResult>;
}

export function insertSpot(
  spot: NewSpot,
  options: InsertSpotOptions = {},
): Promise<InsertSpotResult> {
  return (options.write ?? writeStoredSpot)(spot);
}

export interface FindSpotOptions {
  /** 테스트용 저장 포트. */
  readonly read?: (id: string) => Promise<ReadStoredSpotResult>;
}

/**
 * id로 스팟 하나. 저장소가 없으면 시드에서 찾는다 — 시드 결과 화면이
 * 저장소 없이도 돌아야 한다. 저장소에 행이 없거나 읽기 오류면 `null`.
 */
export async function findSpot(
  id: string,
  options: FindSpotOptions = {},
): Promise<SavedSpot | null> {
  const result = await (options.read ?? readStoredSpot)(id);
  if (!result.ok) {
    return result.error.kind === 'unconfigured'
      ? (SEED_SPOTS.find(spot => spot.id === id) ?? null)
      : null;
  }
  return result.spot;
}

export type DeleteSpotResult = DeleteStoredSpotResult;

export interface DeleteSpotOptions {
  /** 테스트용 삭제 포트. */
  readonly remove?: (id: string) => Promise<DeleteStoredSpotResult>;
}

export function deleteSpot(
  id: string,
  options: DeleteSpotOptions = {},
): Promise<DeleteSpotResult> {
  return (options.remove ?? softDeleteStoredSpot)(id);
}
