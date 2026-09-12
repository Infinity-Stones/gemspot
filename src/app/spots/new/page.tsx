import type { Metadata } from 'next';
import { css } from 'styled-system/css';
import { PinByAddressForm } from '@/components/spot/PinByAddressForm';
import { pinSpotAction } from './actions';

/**
 * 주소로 핀 찍기 — T51(#108).
 *
 * OCR을 거치지 않는 두 번째 입구다. 주소를 아는 장소, OCR이 못 읽은 장소는
 * 결국 이름 · 주소를 손으로 넣어 같은 저장 경로로 들어온다.
 *
 * 서버 컴포넌트로 남기고 폼 상태만 클라이언트에 둔다.
 */

export const metadata: Metadata = {
  title: '핀 찍기',
  description: '장소 이름과 주소를 넣어 지도에 저장합니다.',
};

const shell = css({
  maxWidth: '2xl',
  mx: 'auto',
  px: '6',
  py: '12',
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
});

const title = css({ textStyle: '3xl', fontWeight: 'bold', letterSpacing: 'tight' });

const lede = css({ textStyle: 'md', color: 'slate.600', _dark: { color: 'slate.400' } });

export default function NewSpotPage() {
  return (
    <main className={shell}>
      <div>
        <h1 className={title}>핀 찍기</h1>
      </div>
      <p className={lede}>
        장소 이름과 주소를 적으면 위치를 찾아 지도에 미리 보여 드립니다. 맞으면 저장하세요.
        도로명 주소가 가장 정확합니다.
      </p>
      <PinByAddressForm action={pinSpotAction} />
    </main>
  );
}
