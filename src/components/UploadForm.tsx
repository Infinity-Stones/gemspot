'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { css } from 'styled-system/css';
import type { ExtractState } from '@/app/upload/extractState';
import {
  CANDIDATES_SESSION_KEY,
  IDLE_EXTRACT_STATE,
} from '@/app/upload/extractState';
import {
  ACCEPTED_IMAGE_TYPES,
  isRetryable,
  screenUploads,
} from '@/domain/extraction';
import { SPOT_NEW_PATH, UPLOAD_RESULTS_PATH } from '@/shared/routes';
import type {
  ExtractFailureReason,
  UploadRejection,
} from '@/domain/extraction';

/**
 * 업로드할 이미지를 고르는 수단.
 *
 * 화면(`src/app/upload/page.tsx`)과 나누어 둔 이유는 **수단이 하나가 아닐 수
 * 있기 때문이다.** 지금은 파일 선택창 하나지만, 공유하기 수신(D01 · #7)이
 * 가결되면 같은 자리에 이미지가 다른 경로로 들어온다. 고르는 수단이 화면에
 * 박혀 있으면 그때 화면을 쪼개야 한다.
 *
 * 클라이언트 컴포넌트인 것은 고른 파일을 들고 있어야 해서다. 파일은 서버로
 * 직렬화되지 않으므로 이 상태는 브라우저에만 있다.
 *
 * `action`을 prop으로 받는 이유는 테스트다. 서버 액션은 jsdom에서 돌지
 * 않으므로, 화면이 실제 액션을 꽂고 테스트는 가짜를 꽂는다 —
 * `RouteComposer` · `PinByAddressForm`과 같은 모양이다.
 *
 * **한 장만 든다.** 명세(커밋 484684e)가 여러 장 선택을 두지 않기로 정했다 —
 * 여러 장을 받으면 결과 목록의 단위와 실패 처리가 장수만큼 갈라진다. 새로
 * 고르면 앞의 장을 갈아 끼운다. 한 장 안에 가게가 여러 곳인 경우는 그와
 * 별개로 남고(T12 · #16), 그쪽은 VLM이 배열로 돌려준다.
 */

export type ExtractAction = (
  state: ExtractState,
  formData: FormData,
) => Promise<ExtractState>;

interface Props {
  readonly action: ExtractAction;
}

/**
 * 고른 이미지 한 장.
 *
 * `File`을 그대로 목록에 담지 않는 이유는 **미리보기 URL의 수명을 이 객체에
 * 묶어 두기 위해서다.** `createObjectURL`이 만든 URL은 명시적으로 해제해야
 * 문서가 살아 있는 동안 원본 파일이 메모리에서 풀리지 않는다. 장을 뺄 때와
 * 화면을 떠날 때 짝이 되는 `revokeObjectURL`을 부르려면 어느 URL이 어느 장의
 * 것인지 알아야 한다.
 */
interface PickedImage {
  /**
   * 같은 파일을 두 번 고르는 것을 걸러내는 지문이자 React 키.
   *
   * `File`에는 id가 없고 객체 동일성은 선택마다 새로 생긴다. 이름·크기·수정
   * 시각 셋이 같으면 같은 파일로 본다 — 다른 파일이 셋 다 같을 확률보다,
   * 같은 스크린샷을 두 번 고르는 일이 훨씬 흔하다. 중복을 그냥 두면 OCR을
   * 두 번 부르고 STEP 3에 같은 건이 두 줄로 뜬다.
   */
  readonly fingerprint: string;
  readonly file: File;
  readonly previewUrl: string;
}

function fingerprintOf(file: File): string {
  return `${file.name}:${String(file.size)}:${String(file.lastModified)}`;
}

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  alignItems: 'flex-start',
  width: 'full',
});

const button = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '5',
  py: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'violet.600',
  bg: 'violet.600',
  color: 'white',
  cursor: 'pointer',
  textStyle: 'md',
  fontWeight: 'semibold',
  transition: 'colors',
  _hover: { bg: 'violet.700', borderColor: 'violet.700' },
  _dark: {
    borderColor: 'violet.500',
    bg: 'violet.500',
    _hover: { bg: 'violet.400', borderColor: 'violet.400' },
  },
});

/**
 * 파일 입력은 화면에서 감춘다 — 브라우저 기본 모양은 OS마다 다르고 안에 있는
 * "선택된 파일 없음" 문구를 지울 수 없다.
 *
 * `display: none`이 아니라 Panda의 `srOnly`를 쓴다. 감추면 요소가 접근성
 * 트리에서 사라져 보조 기술이 입력의 존재와 상태를 읽지 못한다 — `srOnly`는
 * 자리만 없애고 트리에는 남긴다. 직접 1px 규칙을 적으면 `strictTokens`가
 * 리터럴을 막고, 그때 이스케이프 해치를 쓰는 것보다 이 유틸이 맞다.
 */
const visuallyHidden = css({ srOnly: true });

const count = css({
  textStyle: 'sm',
  color: 'slate.600',
  fontFamily: 'mono',
  _dark: { color: 'slate.400' },
});

const cell = css({
  position: 'relative',
  // 한 장이라 격자가 필요 없다. 세로로 긴 스크린샷이 화면을 다 먹지 않게
  // 폭만 제한한다.
  width: 'full',
  maxWidth: 'xs',
  rounded: 'md',
  overflow: 'hidden',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  bg: 'slate.100',
  _dark: { borderColor: 'slate.800', bg: 'slate.900' },
});

const thumb = css({
  display: 'block',
  width: 'full',
  // 스크린샷은 세로로 길다. 비율을 고정하고 잘라 담아야 격자가 들쭉날쭉해지지
  // 않는다 — 미리보기의 목적은 "어느 사진인지 알아보는 것"이라 잘려도 된다.
  aspectRatio: 'square',
  objectFit: 'cover',
});

const removeButton = css({
  position: 'absolute',
  top: '1',
  right: '1',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '6',
  height: '6',
  rounded: 'full',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  bg: 'white',
  color: 'slate.600',
  cursor: 'pointer',
  textStyle: 'sm',
  lineHeight: 'none',
  _hover: { borderColor: 'red.600', color: 'red.600' },
  _dark: {
    borderColor: 'slate.600',
    bg: 'slate.900',
    color: 'slate.400',
    _hover: { borderColor: 'red.400', color: 'red.400' },
  },
});

const fileName = css({
  px: '2',
  py: '1',
  textStyle: 'xs',
  color: 'slate.600',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  _dark: { color: 'slate.400' },
});

const warning = css({
  width: 'full',
  p: '4',
  rounded: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'red.300',
  bg: 'red.50',
  color: 'red.900',
  _dark: { borderColor: 'red.800', bg: 'red.950', color: 'red.100' },
});

const warningTitle = css({
  textStyle: 'sm',
  fontWeight: 'semibold',
  mb: '2',
});

const warningList = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  m: '0',
  pl: '5',
  textStyle: 'sm',
});

/**
 * 실패했을 때 내미는 길 — 재시도와 직접 입력.
 *
 * 경고 상자 **안**에 두는 이유는 이것이 그 실패에 대한 답이기 때문이다. 화면
 * 아래 어딘가에 두면 무엇에 대한 선택지인지가 사라진다.
 */
const fallbackActions = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4',
  mt: '3',
});

/**
 * 붉은 바탕 위에 서는 버튼이라 폼의 제출 버튼(slate)과 색이 다르다. 경고
 * 상자의 바탕이 라이트에서 `red.50`, 다크에서 `red.950`이므로 명암을 뒤집어
 * 든다 — 한쪽만 맞추면 반대 테마에서 글자가 바탕에 묻는다.
 */
const retryButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  px: '3',
  py: '2',
  rounded: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'red.700',
  bg: 'red.700',
  color: 'white',
  cursor: 'pointer',
  textStyle: 'sm',
  fontWeight: 'semibold',
  transition: 'colors',
  _hover: { bg: 'red.800', borderColor: 'red.800' },
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
  _dark: {
    borderColor: 'red.300',
    bg: 'red.300',
    color: 'red.950',
    _hover: { bg: 'red.200', borderColor: 'red.200' },
  },
});

/** 상자의 글자색을 그대로 쓰고 밑줄로만 링크임을 드러낸다. */
const fallbackLink = css({
  textStyle: 'sm',
  fontWeight: 'semibold',
  color: 'red.900',
  textDecoration: 'underline',
  _hover: { color: 'red.700' },
  _dark: { color: 'red.100', _hover: { color: 'white' } },
});

/**
 * 선택창에 보일 형식. 가드가 받는 것과 같은 목록이어야 한다 — 선택창에서는
 * 보이는데 고르면 막히는 파일이 있으면 사용자는 앱이 고장난 줄 안다.
 *
 * 다만 이 속성은 **힌트일 뿐이고 강제가 아니다.** 사용자가 "모든 파일"로 바꿔
 * 고를 수 있으므로 받은 뒤에 `screenUploads`가 다시 검사한다.
 */
const ACCEPT = ACCEPTED_IMAGE_TYPES.join(',');

/** 사람에게 보일 형식 이름. `image/png` → `png`. */
const TYPE_NAMES = ACCEPTED_IMAGE_TYPES.map(type =>
  type.replace('image/', ''),
).join(' · ');

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * 막힌 이유를 문장으로 바꾼다.
 *
 * 도메인이 구조를 주고 화면이 말투를 정한다. 상한 숫자를 바꾸는 일과 문구를
 * 다듬는 일이 서로 다른 파일에서 일어나야 한다.
 */
function explain(rejection: UploadRejection): string {
  switch (rejection.kind) {
    case 'type':
      return `읽을 수 없는 형식입니다. ${TYPE_NAMES}만 올릴 수 있습니다.`;
    case 'size':
      return `${megabytes(rejection.size)}MB로 장당 상한 ${megabytes(rejection.limit)}MB를 넘습니다.`;
    case 'count':
      return `한 번에 ${String(rejection.limit)}장까지 올릴 수 있습니다.`;
  }
}

/**
 * 실패한 이유를 문장으로 바꾼다.
 *
 * **빈 목록으로 접지 않는다.** "읽었는데 가게가 없었다"와 "읽지 못했다"는
 * 사용자가 할 일이 다르다 — 앞은 다른 사진을 고르는 것이고 뒤는 다시 해 보거나
 * 직접 입력하는 것이다.
 */
function explainFailure(reason: ExtractFailureReason): string {
  switch (reason) {
    case 'no_api_key':
      return '추출에 쓰는 키가 설정되지 않았습니다. 배포 환경의 환경 변수를 확인해 주세요.';
    case 'timeout':
      return '읽는 데 너무 오래 걸렸습니다. 다시 시도해 주세요.';
    case 'network':
      return '추출 서비스에 닿지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
    case 'parse':
      return '추출 결과를 읽지 못했습니다. 다시 시도해 주세요.';
  }
}

const submitButton = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  px: '5',
  py: '3',
  rounded: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'slate.900',
  bg: 'slate.900',
  color: 'white',
  cursor: 'pointer',
  textStyle: 'md',
  fontWeight: 'semibold',
  transition: 'colors',
  _hover: { bg: 'slate.700', borderColor: 'slate.700' },
  _disabled: { opacity: '0.5', cursor: 'not-allowed' },
  _dark: {
    borderColor: 'slate.100',
    bg: 'slate.100',
    color: 'slate.900',
    _hover: { bg: 'white', borderColor: 'white' },
  },
});

export function UploadForm({ action }: Props) {
  const router = useRouter();
  const [state, submit, pending] = useActionState(action, IDLE_EXTRACT_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<PickedImage | null>(null);
  const [rejections, setRejections] = useState<readonly UploadRejection[]>([]);

  /**
   * 경고 상자가 재시도 버튼을 들고 있는가.
   *
   * 들고 있으면 아래의 제출 버튼은 같은 폼을 같은 값으로 보내는 **두 번째**
   * 버튼이 된다. 설명 바로 옆에 있는 쪽을 남기고 아래를 감춘다 — 실패를 읽은
   * 자리에서 다음 행동이 끝나야 한다.
   */
  const retryInWarning =
    state.status === 'failed' && isRetryable(state.reason) && image !== null;

  // 언마운트 정리용 거울. 렌더 중에 ref를 쓰지 않고 이펙트에서 맞춘다 —
  // 렌더 중 변경은 React Compiler 진단이 잡는다.
  const imageRef = useRef<PickedImage | null>(null);
  useEffect(() => {
    imageRef.current = image;
  }, [image]);

  useEffect(
    () => () => {
      // 화면을 떠날 때 남은 URL을 해제한다. 안 하면 문서가 사는 동안 원본
      // 파일이 메모리에서 풀리지 않는다.
      const left = imageRef.current;
      if (left !== null) URL.revokeObjectURL(left.previewUrl);
    },
    [],
  );

  // URL을 만들고 해제하는 일은 **업데이터 밖에서** 한다. `reactStrictMode`가
  // 켜져 있어 개발 중 state 업데이터가 두 번 호출되는데(불순한 업데이터를
  // 드러내려는 의도된 동작이다), 그 안에서 createObjectURL을 부르면 URL이
  // 하나씩 새고 revokeObjectURL은 두 번 불린다.
  function choose(picked: readonly File[]) {
    // `File`이 `UploadCandidate`(이름·형식·크기)를 만족하므로 그대로 넘긴다.
    // 이미 한 장을 들고 있어도 `alreadyAccepted`는 0이다 — 새로 고른 장이 앞의
    // 장을 갈아 끼우기 때문이고, 1을 넘기면 갈아 끼우는 일 자체가 상한에 걸린다.
    const { accepted, rejected } = screenUploads(picked, 0);

    // 이번 선택의 결과만 보여준다. 앞선 선택의 경고를 쌓아 두면 방금 고친 것도
    // 여전히 문제인 것처럼 남는다.
    setRejections(rejected);

    const [file] = accepted;
    if (file === undefined) return;

    const next = {
      fingerprint: fingerprintOf(file),
      file,
      previewUrl: URL.createObjectURL(file),
    };

    // 앞의 장을 버리기 전에 그 URL을 해제한다. 갈아 끼우면서 놓치면 화면에
    // 아무 증상 없이 원본 파일이 메모리에 남는다.
    const previous = imageRef.current;
    if (previous !== null && previous.fingerprint !== next.fingerprint) {
      URL.revokeObjectURL(previous.previewUrl);
    }

    setImage(next);
  }

  function clear() {
    const going = imageRef.current;
    if (going === null) return;

    URL.revokeObjectURL(going.previewUrl);
    setImage(null);
    // 입력을 비워야 방금 뺀 그 파일을 다시 고를 때 change가 뜬다.
    if (inputRef.current !== null) inputRef.current.value = '';
  }

  useEffect(() => {
    if (state.status !== 'done') return;

    try {
      sessionStorage.setItem(
        CANDIDATES_SESSION_KEY,
        JSON.stringify(state.candidates),
      );
    } catch {
      // 저장소가 막혀 있으면 결과 화면이 빈 상태를 보여준다. 여기서 이동을
      // 막으면 사용자는 아무 일도 일어나지 않은 화면만 보게 된다.
    }
    router.push(UPLOAD_RESULTS_PATH);
  }, [state, router]);

  return (
    <form className={shell} action={submit}>
      {/*
        버튼이 입력을 대신 누른다. label로 감싸는 방법도 되지만, 감춰진 입력이
        포커스를 받으면 포커스 링이 화면 밖에 그려진다. 버튼은 그 자리에서
        포커스를 받는다.
      */}
      <input
        ref={inputRef}
        className={visuallyHidden}
        type="file"
        // 감춰도 접근성 트리에는 남으므로 이름이 필요하다. 버튼의 글자는
        // 버튼의 이름이고, 이 입력의 이름이 되어 주지 않는다.
        aria-label="스크린샷 파일 선택"
        accept={ACCEPT}
        name="image"
        onChange={event => {
          choose(Array.from(event.target.files ?? []));
          // 값을 비우지 않는다. 이 입력이 폼의 필드라 제출할 때 FormData가
          // 여기서 파일을 가져간다 — 비우면 서버에 빈 폼이 간다. 대신 장을
          // 뺄 때 비워서 같은 파일을 다시 고를 수 있게 한다.
        }}
      />
      <button
        type="button"
        className={button}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        스크린샷 고르기
      </button>

      {rejections.length > 0 && (
        // role="alert"로 두는 이유: 사용자가 방금 한 행동의 결과라 그 자리에서
        // 읽혀야 한다. 조용히 목록에서 빠지면 무엇이 왜 없는지 알 수 없다.
        <div className={warning} role="alert">
          <p className={warningTitle}>
            {rejections.length}장을 올릴 수 없습니다
          </p>
          <ul className={warningList}>
            {rejections.map((rejection, index) => (
              <li key={`${rejection.kind}:${rejection.name}:${String(index)}`}>
                {rejection.name} — {explain(rejection)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(state.status === 'failed' || state.status === 'invalid') && (
        <div className={warning}>
          {/*
            role="alert"를 상자가 아니라 문구에만 준다. 이 역할은
            aria-live="assertive"라 내용이 바뀔 때마다 통째로 읽히는데, 폴백
            버튼까지 그 안에 있으면 누를 것이 낭독에 섞여 되풀이된다.
          */}
          <div role="alert">
            <p className={warningTitle}>추출하지 못했습니다</p>
            <ul className={warningList}>
              <li>
                {state.status === 'failed'
                  ? explainFailure(state.reason)
                  : state.message}
              </li>
            </ul>
          </div>

          {state.status === 'failed' && (
            <div className={fallbackActions}>
              {retryInWarning && (
                /*
                  같은 폼을 그대로 다시 보낸다. 고른 장이 입력에 남아 있으므로
                  사진을 다시 고르게 하지 않는다 — 실패의 원인이 사진에 있었던
                  적은 없다.
                */
                <button
                  type="submit"
                  className={retryButton}
                  disabled={pending}
                  aria-busy={pending}
                >
                  {pending ? '읽는 중…' : '다시 시도'}
                </button>
              )}
              {/*
                읽지 못한 장소도 주소를 알면 스팟이 된다. 재시도가 통하지 않는
                실패(키 없음)에서는 이것이 유일한 길이다.
              */}
              <Link className={fallbackLink} href={SPOT_NEW_PATH}>
                주소로 직접 핀 찍기 →
              </Link>
            </div>
          )}
        </div>
      )}

      {image !== null && (
        <>
          <p className={count}>1장 선택됨</p>
          <div className={cell}>
            {/*
              blob URL은 Next의 이미지 최적화를 지날 수 없다(서버가 받을 수 없는
              주소다). 크기도 모르므로 next/image가 요구하는 width·height를 줄 수
              없다. 그래서 순수 img를 쓴다 — 그 예외는 eslint.config.mts에
              스코프로 적어 두었다.
            */}
            <img
              className={thumb}
              src={image.previewUrl}
              alt={image.file.name}
            />
            <p className={fileName}>{image.file.name}</p>
            <button
              type="button"
              className={removeButton}
              onClick={clear}
              aria-label={`${image.file.name} 빼기`}
            >
              ×
            </button>
          </div>
          {!retryInWarning && (
            <button
              type="submit"
              className={submitButton}
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? '읽는 중…' : '주소 읽기'}
            </button>
          )}
        </>
      )}
    </form>
  );
}
