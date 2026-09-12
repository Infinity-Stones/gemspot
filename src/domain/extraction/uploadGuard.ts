/**
 * 올리기 전에 막는 규칙 — 순수 함수만.
 *
 * OCR 비용과 실패가 여기서 갈린다. 못 읽을 파일을 보내면 돈은 나가고 결과는
 * 실패로 돌아온다. 사용자에게는 "왜 실패했는지 모르는 건"이 하나 늘 뿐이다.
 *
 * 이 모듈이 `File`을 모르는 이유는 두 가지다. 브라우저에서 고른 파일만 검사
 * 대상이 아니고(공유하기 수신이 가결되면 서버가 받는다), `File`을 알면 도메인
 * 규칙을 노드 환경에서 테스트하려고 가짜 `File`을 만들어야 한다. 필요한 것은
 * 이름·형식·크기 셋이다.
 */

/**
 * 받는 형식.
 *
 * HEIC를 뺐다. 아이폰 **스크린샷**은 PNG이고 인스타그램에서 저장한 이미지는
 * JPEG다 — HEIC는 카메라 사진의 형식이라 이 동선에 거의 오지 않는다. 반면
 * OCR 제공자(D02 · #12) 중 HEIC를 받는 곳은 드물어서, 받아 두면 통과시킨 뒤
 * OCR 단계에서 실패한다. 막을 수 있는 실패를 뒤로 미루지 않는다.
 *
 * 제공자가 정해지고 HEIC를 받는다면 여기 한 줄을 더한다.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** 확장자 폴백용. 위 MIME 타입과 짝이다 — 한쪽을 고치면 함께 고친다. */
const ACCEPTED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const;

/**
 * 장당 용량 상한.
 *
 * 아이폰 스크린샷은 보통 1~3MB다. 10MB는 그보다 넉넉하되, 실수로 고른 원본
 * 사진이나 동영상 썸네일이 아닌 무언가를 걸러 내기에는 충분하다. OCR 제공자가
 * 정해지면 그쪽 상한과 맞추어 다시 본다.
 */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** 검사에 필요한 최소한의 모양. `File`이 이 구조를 만족한다. */
export interface UploadCandidate {
  readonly name: string;
  /** MIME 타입. 브라우저가 모르면 빈 문자열일 수 있다. */
  readonly type: string;
  readonly size: number;
}

/**
 * 막은 이유. 문장이 아니라 **구조**로 돌려준다 — 화면 문구를 여기서 만들면
 * "10MB"를 바꾸는 일과 "몇 MB까지입니다"라는 말투를 바꾸는 일이 한 파일에서
 * 섞인다. 숫자는 규칙이고 말투는 화면이다.
 */
export type UploadRejection =
  | { readonly kind: 'type'; readonly name: string }
  | {
      readonly kind: 'size';
      readonly name: string;
      readonly size: number;
      readonly limit: number;
    };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

/**
 * 형식이 맞는지.
 *
 * MIME 타입을 먼저 보고, 브라우저가 모른다고 할 때만 확장자로 떨어진다.
 * 확장자를 먼저 보지 않는 이유: 확장자는 사용자가 바꿀 수 있고 내용과 무관하다.
 * MIME이 있는데 맞지 않으면 확장자로 구제하지 않는다 — 그건 `.png`로 이름만
 * 바꾼 파일을 통과시키는 길이다.
 */
function isAcceptedImage(candidate: UploadCandidate): boolean {
  if (candidate.type.length > 0) {
    return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(candidate.type);
  }
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(
    extensionOf(candidate.name),
  );
}

/**
 * 올릴 수 있는지. 막을 이유가 없으면 `null`이다.
 *
 * **한 장만 받는다.** 여러 장을 검사하던 시절에는 이 함수가 목록을 통과한
 * 것과 막은 것으로 갈랐고 장수 상한도 함께 봤다. 멀티 업로드를 지원하지
 * 않기로 하면서 그 축이 사라졌다 — 상한이 한 장인데 목록을 받는 함수는,
 * 읽는 사람에게 "여러 장을 받을 수도 있다"고 계속 말한다.
 *
 * 막은 이유를 **던지지 않고 돌려주는** 것은 그대로다. 화면이 무엇이 왜
 * 막혔는지 보여줄 수 있어야 한다.
 */
export function screenUpload(
  candidate: UploadCandidate,
): UploadRejection | null {
  if (!isAcceptedImage(candidate)) {
    return { kind: 'type', name: candidate.name };
  }

  if (candidate.size > MAX_IMAGE_BYTES) {
    return {
      kind: 'size',
      name: candidate.name,
      size: candidate.size,
      limit: MAX_IMAGE_BYTES,
    };
  }

  return null;
}
