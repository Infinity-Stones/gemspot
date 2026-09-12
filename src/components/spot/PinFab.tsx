import Link from 'next/link';
import { css } from 'styled-system/css';
import { SPOT_NEW_PATH } from '@/shared/routes';

/**
 * 지도 위 플로팅 버튼 — 주소로 핀 찍기(T51 #108)로 들어가는 문.
 *
 * 헤더가 아니라 지도 위에 두는 이유: 이 행동의 결과가 지도에 핀으로 나타나므로,
 * 버튼도 그 결과가 생길 자리에 있어야 한다. 헤더에 세 버튼을 나란히 두면
 * 360px에서 줄이 바뀌고 어느 것이 주 행동인지 흐려진다.
 *
 * 지도 래퍼(position: relative) 안에 절대 배치한다. 결과 패널이 아래에서 올라와도
 * 지도 영역의 오른쪽 아래에 그대로 남는다 — 화면 전체 기준으로 고정하면 패널이
 * 버튼을 덮는다.
 */
const fab = css({
  position: 'absolute',
  right: '5',
  bottom: '5',
  zIndex: 'docked',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  minHeight: '12',
  pl: '4',
  pr: '5',
  rounded: 'full',
  bg: 'violet.600',
  color: 'white',
  textStyle: 'md',
  fontWeight: 'semibold',
  shadow: 'lg',
  _hover: { bg: 'violet.700' },
  _dark: { bg: 'violet.500', color: 'slate.950', _hover: { bg: 'violet.400' } },
});

const plus = css({ textStyle: 'xl', lineHeight: 'none' });

export function PinFab() {
  return (
    <Link className={fab} href={SPOT_NEW_PATH}>
      <span className={plus} aria-hidden="true">
        +
      </span>
      핀 찍기
    </Link>
  );
}
