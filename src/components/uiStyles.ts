import { css } from 'styled-system/css';

/**
 * 화면 공통 프리미티브 — DESIGN.md의 Ant Design 체계를 코드로 옮긴 자리.
 *
 * 같은 역할에 같은 모양을 쓰려고 둔다. 버튼 하나를 화면마다 다시 그리면
 * 테두리 굵기와 모서리와 높이가 조금씩 어긋나고, 그 차이가 쌓이면 사용자는
 * 무엇이 주 동작인지 화면마다 다시 읽어야 한다.
 *
 * 위계는 셋뿐이다. **primary**(채움) 하나, **default**(1px 테두리) 여럿,
 * **text**(테두리 없음)는 취소·삭제처럼 물러나 있어야 하는 것.
 */

const control = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  minHeight: 'control',
  px: '4',
  rounded: 'control',
  textStyle: 'button',
  cursor: 'pointer',
  transition: 'colors',
  _disabled: { cursor: 'not-allowed' },
} as const;

/** 화면에 하나뿐인 주 동작. */
export const primaryButton = css({
  ...control,
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.accent',
  bg: 'ui.accent',
  color: 'ui.onAccent',
  _hover: { borderColor: 'ui.accentHover', bg: 'ui.accentHover' },
  _active: { borderColor: 'ui.accentActive', bg: 'ui.accentActive' },
  // hover는 못 누르는 버튼에도 걸린다. 끈 상태 안에서 다시 덮지 않으면 커서를
  // 올린 동안만 살아 있는 것처럼 보인다.
  _disabled: {
    borderColor: 'ui.border',
    bg: 'ui.disabled',
    color: 'ui.onDisabled',
    cursor: 'not-allowed',
    _hover: {
      borderColor: 'ui.border',
      bg: 'ui.disabled',
      color: 'ui.onDisabled',
    },
  },
});

/** 나란히 여럿 둘 수 있는 보통 동작. */
export const defaultButton = css({
  ...control,
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  bg: 'ui.surface',
  color: 'ui.ink',
  _hover: { borderColor: 'ui.accentHover', color: 'ui.accentText' },
  _active: { borderColor: 'ui.accentActive', color: 'ui.accentActive' },
  _disabled: {
    borderColor: 'ui.border',
    bg: 'ui.disabled',
    color: 'ui.onDisabled',
    cursor: 'not-allowed',
    _hover: {
      borderColor: 'ui.border',
      bg: 'ui.disabled',
      color: 'ui.onDisabled',
    },
  },
});

/** 테두리 없이 물러나 있는 동작. 취소·닫기·부가 이동. */
export const textButton = css({
  ...control,
  px: '2',
  bg: 'transparent',
  color: 'ui.subtle',
  _hover: { bg: 'ui.muted', color: 'ui.ink' },
  _disabled: {
    color: 'ui.onDisabled',
    cursor: 'not-allowed',
    _hover: { bg: 'transparent', color: 'ui.onDisabled' },
  },
});

/** 되돌릴 수 없는 동작. 테두리 없이 색으로만 구분한다. */
export const dangerTextButton = css({
  ...control,
  px: '2',
  bg: 'transparent',
  color: 'ui.danger',
  _hover: { bg: 'ui.dangerWash' },
  _disabled: {
    color: 'ui.onDisabled',
    cursor: 'not-allowed',
    _hover: { bg: 'transparent', color: 'ui.onDisabled' },
  },
});

/** 한 건을 담는 면. Ant의 카드는 그림자가 아니라 1px 선으로 경계를 만든다. */
export const card = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  p: '4',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
});

export const input = css({
  width: 'full',
  minHeight: 'control',
  px: '3',
  rounded: 'input',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  bg: 'ui.input',
  color: 'ui.ink',
  textStyle: 'body',
  transition: 'colors',
  _hover: { borderColor: 'ui.accentHover' },
  _focus: { borderColor: 'ui.accent' },
  _disabled: {
    bg: 'ui.disabled',
    color: 'ui.onDisabled',
    cursor: 'not-allowed',
  },
});

/** 라벨과 입력을 묶는 한 칸. */
export const field = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  width: 'full',
});

export const fieldLabel = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

/**
 * 화면의 제목. 모든 화면이 같은 크기·굵기로 시작해야 페이지를 옮겨 다닐 때
 * 어디가 제목인지 다시 찾지 않는다. 크기만 올리면 아래 문단과 굵기가 같아
 * 한 덩어리로 읽히므로 굵기도 함께 올린다.
 */
export const pageTitle = css({
  textStyle: { base: 'heading', md: 'headingLg' },
  fontWeight: 'bold',
  textWrap: 'balance',
});

/**
 * 제목 바로 아래 한 문장. 보조 안내(`mutedText`)와 같은 회색으로 두면 크기만
 * 다른 한 덩어리가 되어 무엇을 먼저 읽을지가 사라진다.
 */
export const pageDescription = css({ textStyle: 'bodyLg', color: 'ui.ink' });

export const sectionTitle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  textStyle: 'subheading',
  color: 'ui.ink',
});

/** 읽는 값. 누르는 것으로 보이지 않게 테두리도 배경도 두지 않는다. */
export const mutedText = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});
