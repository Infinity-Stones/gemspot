import Link from 'next/link';
import { css } from 'styled-system/css';
import { SpotDetailPanel } from '@/components/SpotDetailPanel';
import { SpotMap } from '@/components/SpotMap';

/**
 * 홈 — 화면을 라우트가 아니라 `?result`로 가른다.
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
  height: '[100dvh]',
});

const placeholder = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4',
  height: '[100dvh]',
  px: '6',
  textAlign: 'center',
});

const lede = css({
  textStyle: 'md',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

const action = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '[44px]',
  px: '5',
  rounded: 'full',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  textStyle: 'sm',
  _dark: { borderColor: 'slate.700' },
});

interface Props {
  // 이 화면이 읽는 것은 `result` 하나지만, 파라미터는 앞으로 늘어난다
  // (필터 · 목록 선택 등). 그래서 모양을 좁히지 않고 Next가 주는 그대로 받는다.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: Props) {
  // `?result=a&result=b`면 배열로 온다. 결과는 하나뿐이므로 그때는 없는 것으로
  // 본다 — 임의로 첫 값을 고르면 주소를 고친 사람이 무엇을 보게 될지 알 수 없다.
  const raw = (await searchParams)['result'];
  const result = typeof raw === 'string' ? raw : undefined;

  // 업로드 화면은 다른 담당의 자리다. 여기서는 결과 화면으로 들어가는 문만
  // 둔다 — 지도를 확인할 길이 없으면 이 화면을 검증할 수 없다.
  if (result === undefined) {
    return (
      <main className={placeholder}>
        <p className={lede}>캡처를 올리면 저장한 장소가 지도에 찍힙니다.</p>
        <Link className={action} href="/?result=sample">
          저장 결과 화면 보기
        </Link>
      </main>
    );
  }

  return (
    <main className={screen}>
      <SpotMap
        latitude={SAMPLE_SPOT.latitude}
        longitude={SAMPLE_SPOT.longitude}
        placeName={SAMPLE_SPOT.placeName}
      />
      <SpotDetailPanel
        placeName={SAMPLE_SPOT.placeName}
        roadAddress={SAMPLE_SPOT.roadAddress}
        jibunAddress={SAMPLE_SPOT.jibunAddress}
        closeHref="/"
      />
    </main>
  );
}
