import Link from 'next/link';
import { css } from 'styled-system/css';

/**
 * 하위 화면에서 돌아가는 길(T54 · #126).
 *
 * `AppHeader`는 홈에만 붙어 있어서, 홈에서 들어간 화면에는 앱 안으로 돌아올
 * 수단이 없다. 그 자리를 채운다.
 *
 * 목적지를 `href`로 받는다 — `router.back()`이 아닌 이유는 history가 앱 바깥까지
 * 세기 때문이다. 공유 링크나 북마크로 바로 들어온 탭에는 앞선 앱 항목이 없어서
 * 되감기는 아무 일도 안 하거나 사용자를 앱 밖으로 내보낸다. `SpotDetailPanel`이
 * `closeHref`를 받아 링크 하나로 닫는 것과 같은 모양이다(T28 · #39).
 *
 * 그래서 이 컴포넌트는 진입 경로가 하나로 확정된 화면에만 쓴다. 여러 곳에서
 * 들어오는 화면의 목적지를 무엇으로 둘지는 #126에 열어 두었다.
 */
interface Props {
  /** 돌아갈 곳. `@/shared/routes`의 상수를 넘긴다. */
  href: string;
  /** 링크 문구. "뒤로"가 아니라 목적지를 말한다 — 누르면 어디에 닿는지가 이름이다. */
  label: string;
}

const backLink = css({
  // 부모가 flex column이라 지정하지 않으면 링크가 줄 전체로 늘어난다. 44px
  // 터치 영역이 글자 없는 자리까지 먹으면 누를 곳을 눈으로 가늠할 수 없다.
  alignSelf: 'flex-start',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '2',
  minHeight: '11',
  textStyle: 'sm',
  color: 'violet.700',
  textDecoration: 'none',
  _hover: { textDecoration: 'underline' },
  _dark: { color: 'violet.300' },
});

// 화살표는 장식이라 접근 가능한 이름에서 뺀다 — 스크린리더가 "왼쪽 화살표"를
// 읽어 봐야 목적지를 알려 주지 않는다.
const arrow = css({ lineHeight: 'none' });

export function BackLink({ href, label }: Props) {
  return (
    <Link className={backLink} href={href}>
      <span className={arrow} aria-hidden="true">
        ←
      </span>
      {label}
    </Link>
  );
}
