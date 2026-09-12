import { css } from 'styled-system/css';

interface Props {
  placeName: string;
  roadAddress: string;
  jibunAddress: string;
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

const name = css({ textStyle: 'lg', fontWeight: 'semibold' });

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

export function SpotDetailPanel({ placeName, roadAddress, jibunAddress }: Props) {
  return (
    <section className={panel} aria-label="저장된 장소 정보">
      <h1 className={name}>{placeName}</h1>
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
