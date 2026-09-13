import Link from 'next/link';
import { css } from 'styled-system/css';
import { defaultButton } from './uiStyles';

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
  p: '4',
  bg: 'ui.surface',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
});

// 닫기를 제목 줄에 둔다. 주소 줄에 함께 두면 긴 주소가 버튼을 화면 밖으로
// 밀어낸다 — 좁은 화면에서 먼저 사라지는 것이 나가는 길이어서는 안 된다.
const titleRow = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
});

const name = css({ textStyle: 'subheading' });

const closeLink = defaultButton;

const addressRow = css({
  display: 'flex',
  gap: '2',
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

// 라벨도 본문과 같은 대비를 지킨다. 한 단 흐리게 두면 흰 지면에서 4.5:1을
// 넘지 못해 밝은 화면에서 읽히지 않는다.
const addressLabel = css({
  flexShrink: '0',
  color: 'ui.subtle',
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
        <h2 className={name}>{placeName}</h2>
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
