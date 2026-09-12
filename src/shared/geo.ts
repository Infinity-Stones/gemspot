/**
 * 좌표 계약.
 *
 * 스팟(저장)과 동선(추천) 두 도메인이 같은 좌표 모양을 봐야 하고, platform의
 * Geocoding · 경로 어댑터도 이 모양으로 돌려준다. 세 레이어가 전부 여는 자리는
 * shared뿐이다.
 *
 * `lat · lng` 이름을 고정하는 이유: 네이버 Geocoding은 `x`(경도) · `y`(위도)를
 * 문자열로, TMAP GeoJSON은 `[lng, lat]` 배열로 준다. 두 외부 모양이 서로 반대
 * 순서라 이름 없는 튜플로 두면 어댑터 경계에서 뒤집히는 사고가 조용히 난다.
 */
export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/** 위경도 범위 안의 유한수인지. NaN · Infinity · 범위 밖은 거른다. */
export function isGeoPoint(value: unknown): value is GeoPoint {
  if (typeof value !== 'object' || value === null) return false;
  const { lat, lng } = value as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}
