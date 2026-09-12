import Link from 'next/link';
import { css } from 'styled-system/css';

interface Props {
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
  /** 닫고 돌아갈 곳. 결과 상태를 벗어나는 길이 화면에 보여야 한다. */
  closeHref: string;
}

const panel = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  px: '5',
  py: '5',
  bg: 'white',
  borderTopWidth: 'hairline',
  borderTopStyle: 'solid',
  borderTopColor: 'slate.200',
  roundedTop: '2xl',
  _dark: {
    bg: 'slate.900',
    borderTopColor: 'slate.800',
  },
});

// 닫기를 제목 줄에 둔다. 주소 줄에 함께 두면 긴 주소가 버튼을 화면 밖으로
// 밀어낸다 — 좁은 화면에서 먼저 사라지는 것이 나가는 길이어서는 안 된다.
const titleRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
});

const name = css({ textStyle: 'lg', fontWeight: 'semibold' });

const closeLink = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: '0',
  minWidth: '11',
  minHeight: '11',
  px: '4',
  rounded: 'full',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  color: 'slate.700',
  textStyle: 'sm',
  _dark: { borderColor: 'slate.700', color: 'slate.200' },
});

const addressRow = css({
  display: 'flex',
  gap: '2',
  textStyle: 'sm',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

// 라벨도 본문과 같은 대비를 지킨다. 한 단 흐리게 두면 흰 지면에서 4.5:1을
// 넘지 못해 밝은 화면에서 읽히지 않는다.
const addressLabel = css({
  flexShrink: '0',
  color: 'slate.500',
  _dark: { color: 'slate.400' },
});

export function SpotDetailPanel({
  placeName,
  roadAddress,
  jibunAddress,
  closeHref,
}: Props) {
  return (
    <section className={panel} aria-label="저장된 장소 정보">
      <div className={titleRow}>
        <h1 className={name}>{placeName}</h1>
        <Link className={closeLink} href={closeHref}>
          닫기
        </Link>
      </div>
      <p className={addressRow}>
        <span className={addressLabel}>도로명</span>
        <span>{roadAddress}</span>
      </p>
      <p className={addressRow}>
        <span className={addressLabel}>지번</span>
        <span>{jibunAddress}</span>
      </p>
    </section>
  );
}
