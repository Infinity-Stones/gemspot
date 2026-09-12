import type { Metadata } from 'next';
import { css } from 'styled-system/css';
import { PinSpotForm } from '@/components/spot/PinSpotForm';
import { pinSpotAction } from './actions';

/**
 * 상호명 검색 → 가게 선택 → 주소 확인 → 핀 저장.
 *
 * OCR을 거치지 않는 두 번째 입구다. 주소를 아는 장소, OCR이 못 읽은 장소는
 * 결국 이름 · 주소를 손으로 넣어 같은 저장 경로로 들어온다.
 *
 * 서버 컴포넌트로 남기고 폼 상태만 클라이언트에 둔다.
 */

export const metadata: Metadata = {
  title: '핀 찍기',
  description:
    '상호명으로 가게를 검색하고 주소와 위치를 확인해 지도에 저장합니다.',
};

const shell = css({
  maxWidth: '2xl',
  mx: 'auto',
  px: '6',
  pt: '12',
  // 플로팅 버튼이 덮는 만큼 아래를 비운다.
  pb: '28',
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
});

const title = css({
  textStyle: '3xl',
  fontWeight: 'bold',
  letterSpacing: 'tight',
});

const lede = css({
  textStyle: 'md',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

export default function NewSpotPage() {
  return (
    <main className={shell}>
      <div>
        <h1 className={title}>핀 찍기</h1>
      </div>
      <p className={lede}>
        상호명으로 검색하고 맞는 가게를 골라 주세요. 주소가 자동으로 채워지면
        지도에서 위치를 확인하고 핀을 저장할 수 있어요.
      </p>
      <PinSpotForm action={pinSpotAction} />
    </main>
  );
}
