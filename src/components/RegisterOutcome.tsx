'use client';

import Link from 'next/link';
import { css } from 'styled-system/css';
import type { RegisterSpotsResult } from '@/app/upload/results/registerState';
import { spotResultPath } from '@/shared/routes';
import { saveFailureMessage } from './spot/saveFailureMessage';

/**
 * 저장 결과 — T23(#32)의 "부분 실패가 응답에서 구분된다"를 화면에서 지킨다.
 *
 * 들어간 건과 막힌 건을 **나눠서** 보여준다. 사용자가 할 일이 다르기 때문이다.
 * 들어간 건은 지도에서 확인하면 끝이고, 막힌 건은 주소를 고쳐 다시 넣거나
 * 직접 핀을 찍어야 한다.
 *
 * 화면을 지도로 넘기지 않는다(T24). 실패한 건이 있으면 그것을 보여줄 자리가
 * 사라지고, 전부 성공했더라도 여러 건을 한 번에 띄울 방법이 아직 없다 —
 * 홈 지도는 `?result=`로 한 건만 연다(저장된 핀 전체 렌더는 T29 · #41).
 * 건마다 링크를 주는 편이 "무엇이 어디에 들어갔나"를 잃지 않는다.
 */

interface Props {
  readonly result: RegisterSpotsResult;
}

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  p: '5',
  rounded: 'xl',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  bg: 'white',
  _dark: { borderColor: 'slate.800', bg: 'slate.900' },
});

const groupTitle = css({
  textStyle: 'sm',
  fontWeight: 'semibold',
});

const list = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  m: '0',
  mt: '2',
  p: '0',
  listStyle: 'none',
});

const row = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: '2',
  textStyle: 'sm',
});

const registeredName = css({
  fontWeight: 'medium',
});

const mapLink = css({
  color: 'violet.700',
  textDecoration: 'underline',
  fontWeight: 'semibold',
  _dark: { color: 'violet.300' },
});

const rejectedGroup = css({
  pt: '4',
  borderTopWidth: 'hairline',
  borderTopStyle: 'solid',
  borderTopColor: 'slate.200',
  _dark: { borderTopColor: 'slate.800' },
});

const rejectedName = css({
  fontWeight: 'medium',
  color: 'red.700',
  _dark: { color: 'red.300' },
});

const reason = css({
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

export function RegisterOutcome({ result }: Props) {
  const { registered, rejected } = result;

  return (
    <section className={shell} aria-label="저장 결과" aria-live="polite">
      {registered.length > 0 && (
        <div>
          <h2 className={groupTitle}>
            {registered.length}건을 지도에 등록했습니다
          </h2>
          <ul className={list}>
            {registered.map(spot => (
              <li className={row} key={spot.candidateId}>
                <span className={registeredName}>{spot.name}</span>
                <Link className={mapLink} href={spotResultPath(spot.spotId)}>
                  지도에서 보기
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rejected.length > 0 && (
        <div className={registered.length > 0 ? rejectedGroup : undefined}>
          <h2 className={groupTitle}>
            {rejected.length}건은 등록하지 못했습니다
          </h2>
          <ul className={list}>
            {rejected.map(item => (
              <li className={row} key={item.candidateId}>
                <span className={rejectedName}>{item.name}</span>
                <span className={reason}>
                  {saveFailureMessage(item.failure)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
