import type { GeoPoint } from './geo';
import { isGeoPoint } from './geo';
import type { SpotCategory } from './spotCategory';
import { isSpotCategory } from './spotCategory';

/**
 * 저장된 스팟의 계약 — T03(#5).
 *
 * 화면 · 스팟 도메인 · 동선 도메인이 전부 같은 모양을 봐야 하므로 최하단에 둔다.
 * 이 모양은 **저장이 끝난 스팟**이다. OCR 직후의 후보(주소만 있고 좌표가 없는
 * 상태)는 여기 들어올 수 없다 — `coord`가 필수라 타입이 그것을 막는다.
 */
export interface Spot {
  readonly id: string;
  readonly name: string;
  readonly roadAddress: string;
  readonly jibunAddress: string | null;
  readonly coord: GeoPoint;
  /** 지역 필터용. Geocoding의 SIDO · SIGUGUN. 없으면 null. */
  readonly region: { readonly sido: string; readonly sigugun: string } | null;
  /** OCR로 뽑았는지 사람이 직접 넣었는지. */
  readonly origin: 'ocr' | 'manual';
  /** 동선 가이드가 시간대로 후보를 거르는 열. 분류 전이면 'other'. */
  readonly category: SpotCategory;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 바깥에서 온 값을 `Spot`으로 좁힌다. 통과하지 못하면 `null` — 던지지 않는다.
 * 한 줄이 깨졌다고 목록 전체를 버리지 않기 위한 것이다.
 */
export function parseSpot(raw: unknown): Spot | null {
  if (!isRecord(raw)) return null;
  const { id, name, roadAddress, jibunAddress, coord, region, origin, category } = raw;

  if (typeof id !== 'string' || id.length === 0) return null;
  if (typeof name !== 'string' || name.length === 0) return null;
  if (typeof roadAddress !== 'string') return null;
  if (jibunAddress !== null && typeof jibunAddress !== 'string') return null;
  if (!isGeoPoint(coord)) return null;
  if (origin !== 'ocr' && origin !== 'manual') return null;
  if (!isSpotCategory(category)) return null;

  let parsedRegion: Spot['region'] = null;
  if (region !== null && region !== undefined) {
    if (!isRecord(region)) return null;
    const { sido, sigugun } = region;
    if (typeof sido !== 'string' || typeof sigugun !== 'string') return null;
    parsedRegion = { sido, sigugun };
  }

  return {
    id,
    name,
    roadAddress,
    jibunAddress: jibunAddress ?? null,
    coord: { lat: coord.lat, lng: coord.lng },
    region: parsedRegion,
    origin,
    category,
  };
}
