import type { SaveSpotFailure } from '@/domain/spot';

/**
 * 저장 실패를 사람이 읽을 문장으로.
 *
 * 도메인이 구조(`SaveSpotFailure`)를 주고 화면이 말투를 정한다. 저장을 부르는
 * 화면이 둘이 된 시점(주소로 핀 찍기 · 추출 결과에서 등록)에 문구를 각자
 * 들면, 같은 실패가 화면에 따라 다른 말로 나온다 — 사용자는 그것을 다른
 * 문제로 읽는다.
 *
 * 핀 찍기에만 있는 실패(이름으로 찾기)는 여기 없다. 이 파일이 다루는 것은
 * **저장 경로가 내는 실패**이고, 그 앞단에서 갈리는 실패는 그 화면의 것이다.
 *
 * 컴포넌트가 아니라 `.ts`인 것은 이 파일이 마크업을 만들지 않기 때문이다.
 * 문장을 어디에 어떤 역할로 그릴지는 부르는 화면이 정한다.
 */
export function saveFailureMessage(failure: SaveSpotFailure): string {
  switch (failure.kind) {
    case 'invalid_input':
      return failure.field === 'name'
        ? '장소 이름을 적어 주세요.'
        : '주소를 적어 주세요.';
    case 'address_not_found':
      return '이 주소로는 위치를 찾지 못했어요. 도로명 주소나 번지까지 적어 다시 시도해 주세요.';
    case 'geocoding_unavailable':
      return '지금은 주소를 좌표로 바꿀 수 없어요. 잠시 후 다시 시도해 주세요.';
    case 'store_unconfigured':
      return '저장소가 연결되지 않아 저장할 수 없어요. 환경 변수(SUPABASE_URL · SUPABASE_SECRET_KEY)를 확인해 주세요.';
    case 'store_error':
      return `저장하지 못했어요: ${failure.message}`;
  }
}
