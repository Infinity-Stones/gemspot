'use client';

import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-system/css';
import type { SpotCandidate } from '@/shared/spot';
import type { KeyboardEvent } from 'react';

interface Props {
  /**
   * STEP 2가 만든 확정 전 후보. 이 컴포넌트는 후보를 보여주기만 하며 저장소를
   * 열지 않는다 — 사용자가 저장을 고르는 T15 전에는 스팟이 생기지 않는다.
   */
  candidates: readonly SpotCandidate[];
}

type ResultKind = 'success' | 'failure';

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
});

const alertBackdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: 'modal',
  display: 'grid',
  placeItems: 'center',
  p: '6',
  bg: 'slate.950',
});

const alertCard = css({
  width: 'full',
  maxWidth: 'md',
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  p: '6',
  rounded: '2xl',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  bg: 'white',
  color: 'slate.900',
  shadow: 'xl',
  _dark: {
    borderColor: 'slate.700',
    bg: 'slate.900',
    color: 'slate.100',
  },
});

const alertCopy = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

const alertTitle = css({
  textStyle: 'xl',
  fontWeight: 'bold',
});

const alertDescription = css({
  textStyle: 'sm',
  color: 'slate.600',
  _dark: { color: 'slate.300' },
});

const alertCounts = css({
  p: '4',
  rounded: 'xl',
  bg: 'violet.50',
  color: 'violet.800',
  textAlign: 'center',
  fontWeight: 'semibold',
  _dark: {
    bg: 'violet.950',
    color: 'violet.200',
  },
});

const alertButton = css({
  minHeight: '11',
  px: '5',
  rounded: 'lg',
  bg: 'violet.600',
  color: 'white',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { bg: 'violet.700' },
  _dark: {
    bg: 'violet.500',
    _hover: { bg: 'violet.400' },
  },
});

const tabList = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1',
  p: '1',
  rounded: 'xl',
  bg: 'slate.100',
  _dark: { bg: 'slate.800' },
});

const tab = css({
  minHeight: '11',
  px: '4',
  rounded: 'lg',
  color: 'slate.600',
  textStyle: 'sm',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { color: 'slate.900' },
  _selected: {
    bg: 'white',
    color: 'violet.700',
    shadow: 'sm',
  },
  _dark: {
    color: 'slate.300',
    _hover: { color: 'white' },
    _selected: {
      bg: 'slate.950',
      color: 'violet.300',
    },
  },
});

const summary = css({
  textStyle: 'sm',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

const list = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  m: '0',
  p: '0',
  listStyle: 'none',
});

const card = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  p: '5',
  rounded: 'xl',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  bg: 'white',
  _dark: {
    borderColor: 'slate.800',
    bg: 'slate.900',
  },
});

const candidateName = css({
  textStyle: 'md',
  fontWeight: 'semibold',
});

const address = css({
  textStyle: 'sm',
  color: 'slate.600',
  _dark: { color: 'slate.400' },
});

const failureHint = css({
  textStyle: 'sm',
  color: 'red.700',
  _dark: { color: 'red.300' },
});

const empty = css({
  py: '12',
  px: '5',
  textAlign: 'center',
  rounded: 'xl',
  borderWidth: 'hairline',
  borderStyle: 'dashed',
  borderColor: 'slate.300',
  color: 'slate.600',
  textStyle: 'sm',
  _dark: { borderColor: 'slate.700', color: 'slate.400' },
});

function candidatesOf(
  candidates: readonly SpotCandidate[],
  kind: ResultKind,
): readonly SpotCandidate[] {
  return candidates.filter(candidate =>
    kind === 'success'
      ? candidate.roadAddress !== null
      : candidate.roadAddress === null,
  );
}

function receiptKey(candidates: readonly SpotCandidate[]): string {
  return JSON.stringify(
    candidates.map(({ id, name, roadAddress, origin }) => ({
      id,
      name,
      roadAddress,
      origin,
    })),
  );
}

function ExtractionResultsReceipt({ candidates }: Props) {
  const successes = candidatesOf(candidates, 'success');
  const failures = candidatesOf(candidates, 'failure');
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  // 성공 확인이 기본 흐름이다. 성공이 하나도 없을 때만 실패 탭부터 열어 빈
  // 화면을 한 번 거치지 않게 한다.
  const [selected, setSelected] = useState<ResultKind>(() =>
    successes.length > 0 ? 'success' : 'failure',
  );
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  const successTabRef = useRef<HTMLButtonElement>(null);
  const failureTabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isSummaryOpen) {
      summaryButtonRef.current?.focus();
      return;
    }

    const selectedTab = selected === 'success' ? successTabRef : failureTabRef;
    selectedTab.current?.focus();
  }, [isSummaryOpen, selected]);

  const visible = selected === 'success' ? successes : failures;
  const panelId = `extraction-${selected}-panel`;

  function selectAndFocus(kind: ResultKind) {
    setSelected(kind);
    const tab = kind === 'success' ? successTabRef : failureTabRef;
    tab.current?.focus();
  }

  function moveTab(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;

    event.preventDefault();
    const next =
      event.key === 'Home'
        ? 'success'
        : event.key === 'End'
          ? 'failure'
          : selected === 'success'
            ? 'failure'
            : 'success';
    selectAndFocus(next);
  }

  if (isSummaryOpen) {
    return (
      <div className={alertBackdrop}>
        <section
          className={alertCard}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="extraction-summary-title"
          aria-describedby="extraction-summary-description extraction-summary-counts"
        >
          <div className={alertCopy}>
            <h2 className={alertTitle} id="extraction-summary-title">
              추출이 완료되었습니다
            </h2>
            <p className={alertDescription} id="extraction-summary-description">
              결과를 확인해 주세요.
            </p>
          </div>
          <p className={alertCounts} id="extraction-summary-counts">
            성공 {successes.length}건 · 실패 {failures.length}건
          </p>
          <button
            ref={summaryButtonRef}
            className={alertButton}
            type="button"
            onClick={() => {
              setIsSummaryOpen(false);
            }}
          >
            목록 보기
          </button>
        </section>
      </div>
    );
  }

  return (
    <section className={shell} aria-label="추출 결과">
      <p className={summary} aria-live="polite">
        주소 확인 {successes.length}건 · 주소 입력 필요 {failures.length}건
      </p>

      <div className={tabList} role="tablist" aria-label="추출 결과 구분">
        <button
          ref={successTabRef}
          className={tab}
          type="button"
          role="tab"
          id="extraction-success-tab"
          aria-controls="extraction-success-panel"
          aria-selected={selected === 'success'}
          tabIndex={selected === 'success' ? 0 : -1}
          onClick={() => {
            setSelected('success');
          }}
          onKeyDown={moveTab}
        >
          성공 {successes.length}
        </button>
        <button
          ref={failureTabRef}
          className={tab}
          type="button"
          role="tab"
          id="extraction-failure-tab"
          aria-controls="extraction-failure-panel"
          aria-selected={selected === 'failure'}
          tabIndex={selected === 'failure' ? 0 : -1}
          onClick={() => {
            setSelected('failure');
          }}
          onKeyDown={moveTab}
        >
          실패 {failures.length}
        </button>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`extraction-${selected}-tab`}
      >
        {visible.length === 0 ? (
          <p className={empty}>
            {selected === 'success'
              ? '주소가 확인된 결과가 없습니다.'
              : '주소 입력이 필요한 결과가 없습니다.'}
          </p>
        ) : (
          <ul className={list}>
            {visible.map(candidate => (
              <li className={card} key={candidate.id}>
                <h2 className={candidateName}>{candidate.name}</h2>
                {candidate.roadAddress === null ? (
                  <p className={failureHint}>도로명 주소를 찾지 못했습니다.</p>
                ) : (
                  <p className={address}>{candidate.roadAddress}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ExtractionResults({ candidates }: Props) {
  return (
    <ExtractionResultsReceipt
      key={receiptKey(candidates)}
      candidates={candidates}
    />
  );
}
