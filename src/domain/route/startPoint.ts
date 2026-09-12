import type { GeocodeFailure, GeocodeOutcome } from '@/lib/platform/naverGeocoding';
import { geocodeAddress as defaultGeocode } from '@/lib/platform/naverGeocoding';
import type { SpotCoordinates } from '@/shared/spot';

/**
 * 출발점 — T43(#58). 문장에서 해석한 동네 이름을 Geocoding으로 좌표로 바꾼다.
 *
 * 사용자가 고칠 수 있는 실패(`not_found`: 그런 동네가 없다)와 고칠 수 없는
 * 실패(`failed`: 키 없음 · 네트워크)를 섞지 않는다. 화면 문구가 갈린다(T47).
 */

export type GeocodeFn = (query: string) => Promise<GeocodeOutcome>;

export type ResolveAreaResult =
  | { readonly kind: 'found'; readonly center: SpotCoordinates; readonly label: string }
  | { readonly kind: 'not_found' }
  | { readonly kind: 'failed'; readonly error: GeocodeFailure };

export async function resolveArea(name: string, geocode: GeocodeFn = defaultGeocode): Promise<ResolveAreaResult> {
  const outcome = await geocode(name);
  if (!outcome.ok) return { kind: 'failed', error: outcome.error };

  const first = outcome.data.hits[0];
  if (outcome.data.totalCount === 0 || first === undefined) return { kind: 'not_found' };

  // 정규화 주소를 함께 돌려준다. 사용자가 쓴 이름 옆에 보여 "성수동"을 다른
  // 성수동으로 읽었는지 알아채게 한다(T37).
  const label = first.roadAddress.length > 0 ? first.roadAddress : first.jibunAddress;
  return { kind: 'found', center: first.coord, label: label.length > 0 ? label : name };
}
