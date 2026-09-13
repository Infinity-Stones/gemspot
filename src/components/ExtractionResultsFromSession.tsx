'use client';

import {
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import { css } from 'styled-system/css';
import { CANDIDATES_SESSION_KEY } from '@/app/(main)/upload/extractState';
import { registerSpotsAction } from '@/app/(main)/upload/results/actions';
import { previewSpotLocationAction } from '@/app/(main)/upload/results/previewAction';
import type { RegisterSpotsResult } from '@/app/(main)/upload/results/registerState';
import { UPLOAD_PATH } from '@/shared/routes';
import { isSpotCategory, type SpotCandidate } from '@/shared/spot';
import { ExtractionResults } from './ExtractionResults';
import type {
  ExtractionResultCandidate,
  SuccessfulSpotCandidate,
  UploadImage,
} from './ExtractionResults';
import { RegisterOutcome } from './RegisterOutcome';
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
  p: '4',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'dashed',
  borderColor: 'ui.border',
  color: 'ui.subtle',
  textStyle: 'body',
});

const savingNote = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

const link = css({
  color: 'ui.accentText',
  textDecoration: 'none',
  fontWeight: 'medium',
  _hover: { textDecoration: 'underline' },
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
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<RegisterSpotsResult | null>(null);
  // 저장이 도는 동안 같은 요청이 또 들어오는 것을 막는다. `saving`으로는
  // 못 막는다 — 그 값은 이 렌더의 것이고, 완료 버튼을 빠르게 두 번 누르면
  // 두 번째 호출이 같은 렌더의 클로저에서 아직 false를 본다. 그러면 같은
  // 스팟이 저장소에 둘 들어간다.
  const inFlight = useRef(false);

  /**
   * STEP 3이 고른 건을 STEP 4로 넘긴다 — T15가 비워 둔 자리다.
   *
   * 액션을 이 자리에서 부르는 이유는 `ExtractionResults`가 저장소를 몰라야
   * 하기 때문이다. 그쪽은 선택 규칙만 알고, 고른 결과를 어디로 보내는지는
   * 이 어댑터가 정한다.
   */
  function register(selected: readonly SuccessfulSpotCandidate[]) {
    if (inFlight.current) return;
    inFlight.current = true;

    startSaving(async () => {
      try {
        const outcome = await registerSpotsAction(
          selected.map(candidate => ({
            candidateId: candidate.id,
            name: candidate.name,
            address: candidate.roadAddress,
            category: candidate.category,
          })),
        );
        setResult(outcome);
      } finally {
        inFlight.current = false;
      }
    });
  }

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

  return (
    <>
      <ExtractionResults
        candidates={candidates}
        onContinue={register}
        locateAddress={previewSpotLocationAction}
      />
      {saving && <p className={savingNote}>지도에 등록하는 중…</p>}
      {result !== null && !saving && <RegisterOutcome result={result} />}
    </>
  );
}

/**
 * 세션에 담긴 문자열을 후보 목록으로 좁힌다.
 *
 * 바깥에서 온 값처럼 다룬다 — 사용자가 개발자 도구로 고칠 수 있고, 앞 버전이
 * 남긴 다른 모양일 수도 있다. 캐스팅으로 넘기면 화면이 렌더 도중에 터진다.
 */
function parseCandidates(
  raw: string | null,
): readonly ExtractionResultCandidate[] {
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(parsed)) return [];
  const uploadImage = parsed['uploadImage'];
  if (!isUploadImage(uploadImage)) return [];
  const candidates = parsed['candidates'];
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map(parseSpotCandidate)
    .filter((candidate): candidate is SpotCandidate => candidate !== null)
    .map(candidate => ({ ...candidate, uploadImage }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseSpotCandidate(value: unknown): SpotCandidate | null {
  if (!isRecord(value)) return null;
  const row = value;
  if (
    typeof row['id'] !== 'string' ||
    typeof row['name'] !== 'string' ||
    (row['roadAddress'] !== null && typeof row['roadAddress'] !== 'string') ||
    (row['origin'] !== 'ocr' && row['origin'] !== 'manual')
  ) {
    return null;
  }
  return {
    id: row['id'],
    name: row['name'],
    roadAddress: row['roadAddress'],
    origin: row['origin'],
    // 배포 전에 열린 탭에는 이 필드가 없다. 이전 세션을 버리지 않고, 특정
    // 카테고리를 지어내지도 않도록 가장 보수적인 '기타'로 올린다.
    suggestedCategory: isSpotCategory(row['suggestedCategory'])
      ? row['suggestedCategory']
      : 'other',
  };
}

function isUploadImage(value: unknown): value is UploadImage {
  if (!isRecord(value)) return false;
  return (
    typeof value['id'] === 'string' &&
    typeof value['src'] === 'string' &&
    typeof value['alt'] === 'string'
  );
}
