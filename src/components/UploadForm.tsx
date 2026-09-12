'use client';

import { useRef, useState } from 'react';
import { css } from 'styled-system/css';

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
 */

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  alignItems: 'flex-start',
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

/**
 * 앨범에서 이미지만 보이게 한다. 확장자·용량·장수 가드는 T07(#10)이 붙인다 —
 * 이 속성은 선택창의 **힌트일 뿐이고 강제가 아니다.** 사용자가 "모든 파일"로
 * 바꿔 고를 수 있으므로 받은 뒤에 다시 검사해야 한다.
 */
const ACCEPT = 'image/*';

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<readonly File[]>([]);

  return (
    <div className={shell}>
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
        multiple
        onChange={event => {
          setFiles(Array.from(event.target.files ?? []));
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

      {files.length > 0 && <p className={count}>{files.length}장 선택됨</p>}
    </div>
  );
}
