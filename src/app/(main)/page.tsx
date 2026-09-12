import { css } from 'styled-system/css';
import { SpotDetailPanel } from '@/components/SpotDetailPanel';
import { HomeMap } from '@/components/HomeMap';
import { PinFab } from '@/components/spot/PinFab';
import { findSpot, loadSpots } from '@/domain/spot';
import { HOME_PATH } from '@/shared/routes';

/**
 * 홈 — 초기 화면이 곧 지도다.
 *
 * 들어오면 저장한 장소를 지도로 본다. 저장 결과도 같은 지도이므로 라우트를
 * 나누지 않고 `?result`로 가른다 — 나누면 같은 지도를 두 번 만들게 된다.
 *
 * 저장 결과는 앱을 다시 열거나 뒤로 가면 사라져야 하는 한 순간의 상태이면서도,
 * 뒤로가기로 빠져나올 수 있어야 한다. 컴포넌트 상태로 들면 뒤로가기가 앱을
 * 벗어나고, 별도 라우트로 빼면 업로드와 결과가 다른 화면이 된다. 쿼리
 * 파라미터가 그 둘을 함께 만족하는 유일한 자리다 — 닫기는 `/`로 돌아가는
 * 링크 하나로 끝난다(T28).
 */
const SAMPLE_SPOT = {
  placeName: '피롤츠 커피하우스',
  roadAddress: '서울 용산구 한강대로 56-1, 2층',
  jibunAddress: '서울 용산구 한강로3가 40-999',
  latitude: 37.5299,
  longitude: 126.9648,
};

const screen = css({
  position: 'relative',
  display: 'grid',
  gridTemplateRows: '1fr auto',
  // 모바일 주소창이 접히고 펴져도 지도가 잘리지 않게 dvh를 쓴다 — 프리셋에
  // 대응 토큰이 없어 이스케이프한다.
  // 헤더가 레이아웃으로 올라갔으므로 그 높이를 뺀다.
  height: '[calc(100dvh - 64px)]',
});

// 지도와 그 위에 뜨는 것(플로팅 버튼)의 기준 상자. minHeight 0은 grid 자식이
// 내용 높이만큼 늘어나 지도가 화면을 넘치는 것을 막는다.
const mapArea = css({ position: 'relative', minHeight: '0' });

const dataNotice = css({
  position: 'absolute',
  top: '3',
  left: '[50%]',
  zIndex: 'overlay',
  maxWidth: '[calc(100% - token(spacing.6))]',
  transform: 'translateX(-50%)',
  px: '4',
  py: '2',
  rounded: 'full',
  bg: 'white',
  color: 'slate.700',
  boxShadow: 'md',
  textAlign: 'center',
  textStyle: 'sm',
  _dark: { bg: 'slate.800', color: 'slate.200' },
});

interface Props {
  // 이 화면이 읽는 것은 `result` · `spot` 둘이지만, 파라미터는 앞으로 더 늘어난다
  // (필터 · 목록 선택 등). 그래서 모양을 좁히지 않고 Next가 주는 그대로 받는다.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function resolveSavedSpot(
  id: string,
): Promise<typeof SAMPLE_SPOT | null> {
  const saved = await findSpot(id);
  if (saved === null) return null;
  return {
    placeName: saved.name,
    roadAddress: saved.roadAddress ?? '',
    jibunAddress: saved.jibunAddress ?? '',
    latitude: saved.coordinates.latitude,
    longitude: saved.coordinates.longitude,
  };
}

/** 파라미터가 배열로 오면 없는 것으로 본다 — 임의로 첫 값을 고르면 주소를 고친
 * 사람이 무엇을 보게 될지 알 수 없다. */
function readOne(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export default async function HomePage({ searchParams }: Props) {
  // 목록과 URL 해석은 서로 독립이다. 검색 파라미터를 기다리는 동안 저장소
  // 조회를 먼저 시작해 홈 진입 시간을 직렬로 늘리지 않는다.
  const spotsPromise = loadSpots();
  const params = await searchParams;
  const result = readOne(params['result']);
  // 핀을 골라서 보는 상태다. 저장 직후(`result`)와 나누는 이유는 같은 화면이
  // 아니기 때문이다 — 하나는 방금 만든 것을 확인하는 자리이고, 다른 하나는
  // 이미 저장된 것을 들여다보는 자리다(D10 · #40).
  const selected = readOne(params['spot']);

  // 결과 id로 저장된 스팟을 읽는다(T51). `sample`은 저장소 없이 화면을 볼 수
  // 있게 남긴 데모 값이다. 없는 id면 패널 없는 홈으로 — 지도를 빈 핀으로 채우지 않는다.
  const spotPromise =
    result === 'sample'
      ? Promise.resolve(SAMPLE_SPOT)
      : result !== undefined
        ? resolveSavedSpot(result)
        : selected !== undefined
          ? resolveSavedSpot(selected)
          : Promise.resolve(null);

  const [{ spots, source, storeError }, spot] = await Promise.all([
    spotsPromise,
    spotPromise,
  ]);
  // 지도는 저장소나 도메인 모양을 알지 않는다. 필요한 식별자·이름·좌표만
  // 서버에서 직렬화해 클라이언트 경계로 넘긴다.
  const markers = spots.map(saved => ({
    id: saved.id,
    name: saved.name,
    latitude: saved.coordinates.latitude,
    longitude: saved.coordinates.longitude,
  }));

  return (
    <main className={screen}>
      <div className={mapArea}>
        <HomeMap spot={spot} markers={markers} />
        {source === 'seed' && (
          <p
            className={dataNotice}
            role={storeError === null ? 'status' : 'alert'}
          >
            {storeError === null
              ? '예시 스팟을 표시하고 있습니다.'
              : '저장한 스팟을 불러오지 못해 예시 스팟을 표시합니다.'}
          </p>
        )}
        <PinFab />
      </div>
      {spot !== null && (
        <SpotDetailPanel
          placeName={spot.placeName}
          roadAddress={spot.roadAddress}
          jibunAddress={spot.jibunAddress}
          closeHref={HOME_PATH}
        />
      )}
    </main>
  );
}
