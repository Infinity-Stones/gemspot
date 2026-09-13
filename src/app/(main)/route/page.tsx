import type { Metadata } from 'next';
import { WorkflowPage } from '@/components/WorkflowPage';
import { RouteComposer } from '@/components/route/RouteComposer';
import { loadSpots } from '@/domain/spot';
import { planRouteAction } from './actions';

/**
 * 동선 만들기 — M7의 화면(T44 · #59).
 *
 * "스크랩만 쌓이고 안 가게 되는 문제를 폼이 아니라 한 문장으로 풀려는 것"이다.
 * 시간 · 동네 · 취향을 칸에 나눠 받는 순간 "그냥 안 가는" 쪽이 다시 편해진다.
 *
 * 서버 컴포넌트로 남긴다. 클라이언트에 필요한 것은 문장 입력과 제출 상태
 * 뿐이고(`RouteComposer`), 스팟 목록은 여기서 개수와 오류 상태만 읽어 넘긴다 —
 * 스팟이 하나도 없으면 문장을 받을 이유가 없다.
 */

export const metadata: Metadata = {
  title: '동선 만들기',
  description: '한 문장으로 저장한 스팟을 오늘의 산책 동선으로 엮습니다.',
};

export default async function RoutePage() {
  const { spots, error } = await loadSpots();

  return (
    <WorkflowPage
      title="동선 만들기"
      description="모아 둔 장소를 오늘의 산책으로. 언제, 어디서, 어떻게 걷고 싶은지 한 문장으로 들려주세요."
      guidance="가고 싶은 동네와 시간을 알려주면, 저장한 장소를 걷기 좋은 순서로 이어 드려요."
    >
      <RouteComposer
        action={planRouteAction}
        spotCount={spots.length}
        loadFailed={error !== null}
      />
    </WorkflowPage>
  );
}
