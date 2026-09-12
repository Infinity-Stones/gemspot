import type { ExtractFailureReason } from './extractFromImage';

/**
 * 추출이 실패한 뒤 무엇을 내밀 수 있는지 가르는 규칙 — 순수 함수만.
 *
 * `uploadGuard`가 막은 이유를 구조로 돌려준 것과 같은 갈래다. **어떤 실패가
 * 다시 해서 풀리는가는 규칙이고, 그것을 어떤 버튼으로 말하는가는 화면이다.**
 * 화면이 `reason`을 직접 훑어 분기하면 그 판단이 문구를 다듬는 자리에 섞이고,
 * 실패 이유가 하나 늘 때 고칠 곳이 화면마다 흩어진다.
 */

/**
 * 같은 이미지를 다시 보내면 달라질 수 있는 실패인가.
 *
 * `no_api_key`만 아니다. 키가 없는 것은 배포 환경의 상태이지 이 호출이 어긋난
 * 것이 아니라서, 사용자가 몇 번을 눌러도 같은 답이 온다 — 그 자리에 재시도를
 * 내미는 것은 되지 않을 일을 해 보라고 말하는 것이다. 남은 셋은 호출 한 번이
 * 어긋난 경우이므로 다시 보낼 값이 있다.
 *
 * switch를 남겨 두는 것이 이 함수의 절반이다. 실패 이유가 늘면 여기서 타입
 * 검사가 걸리고, 새 이유가 재시도로 풀리는지 그때 한 번 정하게 된다.
 */
export function isRetryable(reason: ExtractFailureReason): boolean {
  switch (reason) {
    case 'timeout':
    case 'network':
    case 'parse':
      return true;
    case 'no_api_key':
      return false;
  }
}
