'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { css } from 'styled-system/css';
import { CANDIDATES_SESSION_KEY } from '@/app/upload/extractState';
import { UPLOAD_PATH } from '@/shared/routes';
import type { SpotCandidate } from '@/shared/spot';
import { ExtractionResults } from './ExtractionResults';
import Link from 'next/link';

/**
 * 업로드 화면이 넘긴 후보를 읽어 결과에 붙인다.
 *
 * 왜 `sessionStorage`인지는 `src/app/upload/extractState.ts`에 적었다 —
 * 확정 전 후보의 수명이 "이 탭이 열려 있는 동안"이고, 사용자가 저장을 고르기
 * 전까지 이 데이터는 서버 어디에도 남지 않아야 한다.
 *
 * `useState` + `useEffect`가 아니라 `useSyncExternalStore`인 이유는 `useTheme`과
 * 같다. 서버 렌더에는 `sessionStorage`가 없어 첫 렌더에서 읽으면 하이드레이션이
 * 깨지는데, 이펙트에서 setState로 미루면 렌더를 한 번 더 태우고 React Compiler가
 * `set-state-in-effect`로 막는다. 이 훅이 보는 대상이 애초에 React 밖의
 * 저장소이므로 그것을 구독하는 모양이 맞다.
 *
 * 스냅샷으로 **파싱 전 문자열**을 돌려주는 것이 중요하다. `getSnapshot`은 값이
 * 같으면 같은 것을 돌려줘야 하는데, 매번 새 배열을 만들면 React가 무한히 다시
 * 렌더한다. 문자열은 그 조건을 그냥 만족한다.
 */

const empty = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  alignItems: 'flex-start',
  p: '6',
  rounded: 'md',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'slate.300',
  color: 'slate.600',
  textStyle: 'sm',
  _dark: { borderColor: 'slate.700', color: 'slate.400' },
});

const link = css({
  color: 'violet.600',
  textDecoration: 'none',
  fontWeight: 'semibold',
  _hover: { textDecoration: 'underline' },
  _dark: { color: 'violet.400' },
});

/** 세션은 이 화면이 사는 동안 바뀌지 않는다. 구독할 것이 없다. */
function subscribe(): () => void {
  return () => undefined;
}

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(CANDIDATES_SESSION_KEY);
  } catch {
    // 프라이빗 모드 등에서 접근 자체가 던진다. 후보가 없는 것과 같이 다룬다.
    return null;
  }
}

/** 서버에는 sessionStorage가 없다. 하이드레이션 전까지는 없는 것으로 본다. */
function getServerSnapshot(): string | null {
  return null;
}

export function ExtractionResultsFromSession() {
  const raw = useSyncExternalStore(subscribe, readRaw, getServerSnapshot);
  const candidates = useMemo(() => parseCandidates(raw), [raw]);

  if (candidates.length === 0) {
    return (
      <div className={empty}>
        <p>보여줄 추출 결과가 없습니다. 스크린샷을 먼저 올려 주세요.</p>
        <Link href={UPLOAD_PATH} className={link}>
          스크린샷 올리러 가기
        </Link>
      </div>
    );
  }

  return <ExtractionResults candidates={candidates} />;
}

/**
 * 세션에 담긴 문자열을 후보 목록으로 좁힌다.
 *
 * 바깥에서 온 값처럼 다룬다 — 사용자가 개발자 도구로 고칠 수 있고, 앞 버전이
 * 남긴 다른 모양일 수도 있다. 캐스팅으로 넘기면 화면이 렌더 도중에 터진다.
 */
function parseCandidates(raw: string | null): readonly SpotCandidate[] {
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed.filter(isSpotCandidate);
}

function isSpotCandidate(value: unknown): value is SpotCandidate {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row['id'] === 'string' &&
    typeof row['name'] === 'string' &&
    (row['roadAddress'] === null || typeof row['roadAddress'] === 'string') &&
    (row['origin'] === 'ocr' || row['origin'] === 'manual')
  );
}
