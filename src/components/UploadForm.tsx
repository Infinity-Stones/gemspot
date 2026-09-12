'use client';

import { useEffect, useRef, useState } from 'react';
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

const grid = css({
  display: 'grid',
  gridTemplateColumns: '[repeat(auto-fill, minmax(7rem, 1fr))]',
  gap: '3',
  width: 'full',
  listStyle: 'none',
  p: '0',
  m: '0',
});

const cell = css({
  position: 'relative',
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

/**
 * 앨범에서 이미지만 보이게 한다. 확장자·용량·장수 가드는 T07(#10)이 붙인다 —
 * 이 속성은 선택창의 **힌트일 뿐이고 강제가 아니다.** 사용자가 "모든 파일"로
 * 바꿔 고를 수 있으므로 받은 뒤에 다시 검사해야 한다.
 */
const ACCEPT = 'image/*';

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<readonly PickedImage[]>([]);

  // 언마운트 정리용 거울. 렌더 중에 ref를 쓰지 않고 이펙트에서 맞춘다 —
  // 렌더 중 변경은 React Compiler 진단이 잡는다.
  const imagesRef = useRef<readonly PickedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      // 화면을 떠날 때 남은 URL을 전부 해제한다. 안 하면 문서가 사는 동안
      // 원본 파일이 메모리에서 풀리지 않는다 — 스크린샷 수십 장이면 눈에 띈다.
      for (const image of imagesRef.current)
        URL.revokeObjectURL(image.previewUrl);
    },
    [],
  );

  // URL을 만들고 해제하는 일은 **업데이터 밖에서** 한다. `reactStrictMode`가
  // 켜져 있어 개발 중 state 업데이터가 두 번 호출되는데(불순한 업데이터를
  // 드러내려는 의도된 동작이다), 그 안에서 createObjectURL을 부르면 장마다
  // URL이 하나씩 새고 revokeObjectURL은 두 번 불린다. 업데이터는 앞의 배열에서
  // 뒤의 배열을 계산하는 일만 한다.
  function add(picked: readonly File[]) {
    const seen = new Set(images.map(image => image.fingerprint));
    const added: PickedImage[] = [];

    for (const file of picked) {
      const fingerprint = fingerprintOf(file);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      added.push({ fingerprint, file, previewUrl: URL.createObjectURL(file) });
    }

    if (added.length === 0) return;
    setImages(previous => [...previous, ...added]);
  }

  function remove(fingerprint: string) {
    const going = images.find(image => image.fingerprint === fingerprint);
    if (going === undefined) return;

    URL.revokeObjectURL(going.previewUrl);
    setImages(previous =>
      previous.filter(image => image.fingerprint !== fingerprint),
    );
  }

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
          add(Array.from(event.target.files ?? []));
          // 값을 비워야 같은 파일을 다시 고를 때 change가 또 뜬다. 안 비우면
          // 실수로 뺀 장을 되돌릴 방법이 "다른 파일을 하나 고르기"가 된다.
          event.target.value = '';
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

      {images.length > 0 && (
        <>
          <p className={count}>{images.length}장 선택됨</p>
          <ul className={grid}>
            {images.map(image => (
              <li key={image.fingerprint} className={cell}>
                {/*
                  blob URL은 Next의 이미지 최적화를 지날 수 없다(서버가 받을 수
                  없는 주소다). 크기도 모르므로 next/image가 요구하는 width·
                  height를 줄 수 없다. 그래서 순수 img를 쓴다 — 그 예외는
                  eslint.config.mts에 스코프로 적어 두었다.
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
                  onClick={() => {
                    remove(image.fingerprint);
                  }}
                  aria-label={`${image.file.name} 빼기`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
