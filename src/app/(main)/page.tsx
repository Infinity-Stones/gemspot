import { css } from 'styled-system/css';
import { pageDescription, pageTitle } from '@/components/uiStyles';
import { SpotDetailPanel } from '@/components/SpotDetailPanel';
import { HomeMap } from '@/components/HomeMap';
import { BrandLink } from '@/components/BrandLink';
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
interface ResolvedSpot {
  readonly placeName: string;
  readonly roadAddress: string;
  readonly jibunAddress: string;
  readonly latitude: number;
  readonly longitude: number;
}

const screen = css({
  width: 'full',
  maxWidth: 'page',
  mx: 'auto',
  px: { base: '5', md: '8' },
  pt: { base: '5', md: '8' },
  pb: '[calc(104px + env(safe-area-inset-bottom))]',
  display: 'grid',
  gridTemplateRows: 'auto minmax(320px, 1fr) auto',
  gap: '5',
  minHeight: '[100dvh]',
});
const intro = css({ display: 'flex', flexDirection: 'column' });
const title = `${pageTitle} ${css({ mt: '2' })}`;
const description = `${pageDescription} ${css({ mt: '1' })}`;
// 건수는 읽는 값이지 누르는 것이 아니다. 알약 배경과 여백을 두면 버튼으로
// 보여서, 눌러도 아무 일이 없다는 걸 눌러 보고 알게 된다.
// 건수는 지도 위에 띄운다. 제목 줄에 두면 좁은 화면에서 설명과 겹치고, 넓은
// 화면에서는 반대쪽 끝으로 밀려 무엇에 대한 숫자인지 멀어진다.
const count = css({
  position: 'absolute',
  top: '3',
  left: '0',
  right: '0',
  width: 'fit',
  mx: 'auto',
  zIndex: 'docked',
  px: '4',
  py: '2',
  // 지도 위에 얹히는 것은 지면 위 컨트롤이 아니라 떠 있는 표식이라, 이 자리만
  // 캡슐로 둔다. 지도 UI의 관습이기도 하다.
  rounded: 'full',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
  color: 'ui.ink',
  textStyle: 'bodySm',
  fontWeight: 'medium',
  whiteSpace: 'nowrap',
  boxShadow: 'floating',
});

// 문장에서 바뀌는 건 숫자뿐이다. 그 자리만 프라이머리로 짚어 주면 몇 곳인지가
// 문장을 읽지 않아도 먼저 눈에 든다.
const countValue = css({
  color: 'ui.accentText',
  fontWeight: 'bold',
  fontVariantNumeric: 'tabular-nums',
});
const mapArea = css({
  position: 'relative',
  minHeight: '0',
  overflow: 'hidden',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
});
const dataNotice = css({
  position: 'absolute',
  top: '4',
  left: '4',
  right: '4',
  width: 'fit',
  mx: 'auto',
  zIndex: 'docked',
  px: '4',
  py: '2',
  rounded: 'control',
  bg: 'ui.surface',
  color: 'ui.subtle',
  boxShadow: 'floating',
  textAlign: 'center',
  textStyle: 'bodySm',
});

interface Props {
  // 이 화면이 읽는 것은 `result` · `spot` 둘이지만, 파라미터는 앞으로 더 늘어난다
  // (필터 · 목록 선택 등). 그래서 모양을 좁히지 않고 Next가 주는 그대로 받는다.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function resolveSavedSpot(id: string): Promise<ResolvedSpot | null> {
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

  // 결과 id로 저장된 스팟을 읽는다(T51). 없는 id면 패널 없는 홈으로 — 지도를
  // 빈 핀으로 채우지 않는다.
  const spotPromise =
    result !== undefined
      ? resolveSavedSpot(result)
      : selected !== undefined
        ? resolveSavedSpot(selected)
        : Promise.resolve(null);

  const [{ spots, error }, spot] = await Promise.all([
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
      <header className={intro}>
        <div>
          <BrandLink />
          <h1 className={title}>다음 산책은 어디로?</h1>
          <p className={description}>
            저장한 장소를 둘러보고, 나만의 동선을 만들어 보세요.
          </p>
        </div>
      </header>
      <div className={mapArea}>
        <HomeMap spot={spot} markers={markers} />
        <p className={count}>
          저장한 장소 <span className={countValue}>{spots.length}</span>곳
        </p>
        {error !== null && (
          <p className={dataNotice} role="alert">
            저장한 스팟을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}
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
