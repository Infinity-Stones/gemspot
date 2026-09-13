import type { Metadata } from 'next';
import { WorkflowPage } from '@/components/WorkflowPage';
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

export default function NewSpotPage() {
  return (
    <WorkflowPage
      title="핀 찍기"
      description="기억해 두고 싶은 곳이 있나요? 가게를 찾고, 지도에서 위치를 확인한 뒤 나만의 장소로 저장하세요."
      guidance="가게 이름으로 검색하거나, 알고 있는 주소를 직접 입력할 수 있어요."
    >
      <PinSpotForm action={pinSpotAction} />
    </WorkflowPage>
  );
}
