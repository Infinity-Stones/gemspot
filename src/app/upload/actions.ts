'use server';

import { extractFromImage } from '@/domain/extraction';
import type { ExtractState } from './extractState';

/**
 * 추출 서버 액션 — T53(#110). 조립은 도메인의 `extractFromImage`가 하고,
 * 여기는 폼 데이터를 읽어 넘기고 결과를 화면 상태로 접는 것만 한다.
 * `src/app/route/actions.ts`와 같은 모양이다.
 *
 * 서버에서 도는 이유: VLM 키가 서버 전용이다. 클라이언트에서 부르면 키가
 * 번들에 실린다.
 */
export async function extractAction(
  _previous: ExtractState,
  formData: FormData,
): Promise<ExtractState> {
  const file = formData.get('image');

  if (!(file instanceof File) || file.size === 0) {
    return { status: 'invalid', message: '스크린샷을 먼저 골라 주세요.' };
  }

  const outcome = await extractFromImage({
    bytes: new Uint8Array(await file.arrayBuffer()),
    mimeType: file.type,
    // 클라이언트가 미리보기를 잇는 데 쓰는 지문과 같은 모양이다. 같은 사진이
    // 같은 후보 id를 내야 목록을 다시 그릴 때 선택 상태가 풀리지 않는다.
    imageId: `${file.name}:${String(file.size)}:${String(file.lastModified)}`,
  });

  if (!outcome.ok) return { status: 'failed', reason: outcome.reason };

  return { status: 'done', candidates: outcome.candidates };
}
