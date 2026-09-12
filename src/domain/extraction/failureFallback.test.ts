import { describe, expect, it } from 'vitest';
import { isRetryable } from './failureFallback';

/**
 * 이 규칙이 정하는 것은 화면이 재시도를 **내미는지**다. 되지 않을 일을 해
 * 보라고 말하면 사용자는 같은 실패를 몇 번 본 뒤에야 다른 길을 찾는다.
 */
describe('isRetryable', () => {
  it.each(['timeout', 'network', 'parse'] as const)(
    '호출 한 번이 어긋난 실패는 다시 보낼 값이 있다: %s',
    reason => {
      expect(isRetryable(reason)).toBe(true);
    },
  );

  it('키가 없으면 다시 보내도 같은 답이 온다', () => {
    // 배포 환경의 상태라 사용자가 고칠 수 없다. 여기서 재시도를 내밀면
    // 사용자는 자기가 무언가를 잘못한 줄 안다.
    expect(isRetryable('no_api_key')).toBe(false);
  });
});
