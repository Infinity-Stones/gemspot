'use client';

import { useRef, useState } from 'react';
import { css } from 'styled-system/css';
import type { SpotCandidate } from '@/shared/spot';
import type { KeyboardEvent } from 'react';

export interface UploadImage {
  /** 업로드 한 장의 식별자. 후보 id와 달리 한 이미지에서 나온 후보들이 공유한다. */
  readonly id: string;
  /** 브라우저가 표시할 수 있는 원본 이미지 주소. blob URL도 받을 수 있다. */
  readonly src: string;
  readonly alt: string;
}

export interface ExtractionResultCandidate extends SpotCandidate {
  /** 후보를 만든 업로드 이미지. 저장되는 스팟 계약에는 포함되지 않는다. */
  readonly uploadImage: UploadImage;
}

interface Props {
  /**
   * STEP 2가 만든 확정 전 후보. 이 컴포넌트는 후보를 보여주기만 하며 저장소를
   * 열지 않는다 — 사용자가 저장을 고르는 T15 전에는 스팟이 생기지 않는다.
   */
  candidates: readonly ExtractionResultCandidate[];
}

type ResultKind = 'success' | 'failure';

const shell = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
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

const album = css({
  display: 'grid',
  gridTemplateColumns: { base: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
  gap: '4',
  m: '0',
  p: '0',
  listStyle: 'none',
});

const albumCard = css({
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
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

const failureImage = css({
  display: 'block',
  width: 'full',
  aspectRatio: 'square',
  objectFit: 'cover',
  bg: 'slate.100',
  _dark: { bg: 'slate.950' },
});

const albumDetails = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: '3',
  p: '4',
});

const failureNames = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  m: '0',
  p: '0',
  listStyle: 'none',
});

const deleteButton = css({
  px: '3',
  py: '2',
  rounded: 'md',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'red.300',
  color: 'red.700',
  textStyle: 'sm',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { borderColor: 'red.600', bg: 'red.50' },
  _dark: {
    borderColor: 'red.800',
    color: 'red.300',
    _hover: { borderColor: 'red.400', bg: 'red.950' },
  },
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
  candidates: readonly ExtractionResultCandidate[],
  kind: ResultKind,
): readonly ExtractionResultCandidate[] {
  return candidates.filter(candidate =>
    kind === 'success'
      ? candidate.roadAddress !== null
      : candidate.roadAddress === null,
  );
}

interface FailureAlbumItem {
  readonly image: UploadImage;
  readonly candidates: readonly ExtractionResultCandidate[];
}

/** 같은 업로드 한 장에서 여러 후보가 나와도 앨범에는 한 번만 놓는다. */
function failureAlbumOf(
  candidates: readonly ExtractionResultCandidate[],
): readonly FailureAlbumItem[] {
  const byImage = new Map<string, FailureAlbumItem>();

  for (const candidate of candidates) {
    const imageId = candidate.uploadImage.id;
    const current = byImage.get(imageId);
    byImage.set(imageId, {
      image: current?.image ?? candidate.uploadImage,
      candidates: [...(current?.candidates ?? []), candidate],
    });
  }

  return [...byImage.values()];
}

export function ExtractionResults({ candidates }: Props) {
  const successes = candidatesOf(candidates, 'success');
  const [deletedFailureImageIds, setDeletedFailureImageIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const failures = candidatesOf(candidates, 'failure').filter(
    candidate => !deletedFailureImageIds.has(candidate.uploadImage.id),
  );
  const failureAlbum = failureAlbumOf(failures);
  // 성공 확인이 기본 흐름이다. 성공이 하나도 없을 때만 실패 탭부터 열어 빈
  // 화면을 한 번 거치지 않게 한다.
  const [selected, setSelected] = useState<ResultKind>(() =>
    successes.length > 0 ? 'success' : 'failure',
  );
  const successTabRef = useRef<HTMLButtonElement>(null);
  const failureTabRef = useRef<HTMLButtonElement>(null);

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
        {(selected === 'success' ? successes.length : failureAlbum.length) ===
        0 ? (
          <p className={empty}>
            {selected === 'success'
              ? '주소가 확인된 결과가 없습니다.'
              : '주소 입력이 필요한 결과가 없습니다.'}
          </p>
        ) : selected === 'success' ? (
          <ul className={list}>
            {successes.map(candidate => (
              <li className={card} key={candidate.id}>
                <h2 className={candidateName}>{candidate.name}</h2>
                <p className={address}>{candidate.roadAddress}</p>
              </li>
            ))}
          </ul>
        ) : (
          <ul className={album}>
            {failureAlbum.map(({ image, candidates: failedCandidates }) => (
              <li className={albumCard} key={image.id}>
                <img className={failureImage} src={image.src} alt={image.alt} />
                <div className={albumDetails}>
                  <ul className={failureNames}>
                    {failedCandidates.map(candidate => (
                      <li key={candidate.id}>
                        <h2 className={candidateName}>{candidate.name}</h2>
                      </li>
                    ))}
                  </ul>
                  <p className={failureHint}>도로명 주소를 찾지 못했습니다.</p>
                  <button
                    type="button"
                    className={deleteButton}
                    onClick={() => {
                      setDeletedFailureImageIds(
                        current => new Set([...current, image.id]),
                      );
                    }}
                    aria-label={`${image.alt} 삭제`}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
