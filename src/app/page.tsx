import { css } from 'styled-system/css';
import { SpotDetailPanel } from '@/components/SpotDetailPanel';
import { SpotMap } from '@/components/SpotMap';

/**
 * 초기 화면 — 저장된 스팟을 지도와 함께 본다.
 *
 * 저장 단계(STEP 4)가 아직 없어 값은 목이다. 실제 데이터가 붙으면 이 자리만
 * 도메인 호출로 바뀌고 아래 두 컴포넌트는 그대로 쓴다.
 */
const SAMPLE_SPOT = {
  placeName: '피롤츠 커피하우스',
  roadAddress: '서울 용산구 한강대로 56-1, 2층',
  jibunAddress: '서울 용산구 한강로3가 40-999',
  latitude: 37.5299,
  longitude: 126.9648,
};

const screen = css({
  display: 'grid',
  gridTemplateRows: '1fr auto',
  // 모바일 주소창이 접히고 펴져도 지도가 잘리지 않게 dvh를 쓴다 — 프리셋에
  // 대응 토큰이 없어 이스케이프한다.
  height: '[100dvh]',
});

export default function HomePage() {
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
      />
    </main>
  );
}
