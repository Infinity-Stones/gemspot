'use server';

import { planRoute } from '@/domain/route';
import { loadSpots, toRouteCandidate } from '@/domain/spot';
import { formatSeoulIso } from '@/shared/time';
import type { RoutePlanState } from './planState';
import { MAX_SENTENCE_LENGTH } from './planState';

/**
 * 동선 만들기 서버 액션 — T44(#59). 조립은 T48의 `planRoute`가 하고, 여기는
 * 폼 데이터를 읽어 넘기고 결과를 화면 상태로 접는 것만 한다.
 *
 * 서버에서 도는 이유: LLM · TMAP · Geocoding 키가 전부 서버 전용이다.
 * 스팟 목록도 여기서 읽는다 — 클라이언트가 스팟을 들고 다니지 않는다.
 *
 * `history`는 되묻기(T36)의 답을 이어 붙이기 위한 것이다. 사용자는 답을 폼
 * 칸에 채우는 게 아니라 **다시 말한다.** 원문과 답을 합쳐 다시 해석해야
 * "성수동 걷고 싶어" + "2시부터 4시"가 한 요청이 된다.
 */
export async function planRouteAction(
  _previous: RoutePlanState,
  formData: FormData,
): Promise<RoutePlanState> {
  const sentence = readText(formData, 'sentence');
  if (sentence.length === 0) {
    return {
      status: 'invalid',
      message:
        '어디서 몇 시부터 몇 시까지 걷고 싶은지 한 문장으로 적어 주세요.',
    };
  }

  const history = readText(formData, 'history');
  // 최신 정정이 길이 제한 뒤로 밀려 사라지면 같은 되묻기가 무한 반복된다.
  const latest = sentence.slice(0, MAX_SENTENCE_LENGTH);
  const historyBudget = MAX_SENTENCE_LENGTH - latest.length - 1;
  const recentHistory = historyBudget > 0 ? history.slice(-historyBudget) : '';
  const combined =
    recentHistory.length > 0 ? `${recentHistory}\n${latest}` : latest;

  const { spots, error } = await loadSpots();
  if (error !== null) return { status: 'load_failed' };

  const outcome = await planRoute({
    sentence: combined,
    now: formatSeoulIso(Date.now()),
    spots: spots.map(toRouteCandidate),
  });

  return { status: 'done', sentence: combined, outcome };
}

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}
