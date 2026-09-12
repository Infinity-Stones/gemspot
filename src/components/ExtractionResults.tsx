'use client';

import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-system/css';
import type { SpotCandidate, SpotCategory } from '@/shared/spot';
import { SPOT_CATEGORIES, isSpotCategory } from '@/shared/spot';
import { labelOf } from '@/shared/spotCategory';
import type { FormEvent } from 'react';

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

export interface SuccessfulSpotCandidate extends SpotCandidate {
  readonly roadAddress: string;
  /**
   * 사용자가 이 화면에서 고른 카테고리.
   *
   * `SpotCandidate`에 없는 값이다 — 후보는 OCR이 읽어낸 것이고 분류는 읽어낼
   * 수 있는 것이 아니다. 저장을 확정하는 이 경계에서 붙는다.
   */
  readonly category: SpotCategory;
}

/**
 * STEP 3에서 사용자가 저장하기로 확정한 성공 후보를 STEP 4에 넘기는 경계.
 *
 * 이 컴포넌트는 좌표 변환이나 저장을 직접 하지 않는다. T23의 서버 동작이
 * 생기면 이 콜백 자리에 연결하고, 그 전까지는 화면의 선택 규칙만 독립적으로
 * 검증할 수 있다.
 */
export type ContinueWithCandidates = (
  candidates: readonly SuccessfulSpotCandidate[],
) => void;

interface Props {
  /**
   * STEP 2가 만든 확정 전 후보. 이 컴포넌트는 후보를 보여주기만 하며 저장소를
   * 열지 않는다 — 사용자가 저장을 고르는 T15 전에는 스팟이 생기지 않는다.
   */
  candidates: readonly ExtractionResultCandidate[];
  /** 생략하면 선택은 가능하지만 STEP 4로 넘기는 완료 버튼은 비활성화된다. */
  onContinue?: ContinueWithCandidates;
}

type ResultKind = 'success' | 'failure';

/**
 * 고르지 않고 넘어간 건이 받는 값. '기타'는 적합 시간대가 없는 카테고리라
 * 동선 가이드가 시간대로 거르지 않는다 — 모르는 것을 아는 척 분류해 엉뚱한
 * 시간대의 후보로 만드는 것보다 낫다.
 */
const DEFAULT_CATEGORY: SpotCategory = 'other';

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

const list = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
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
  boxShadow: 'sm',
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
  gap: '4',
  width: 'full',
  m: '0',
  p: '0',
  listStyle: 'none',
});

const manualForm = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  width: 'full',
});

const field = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  width: 'full',
});

const fieldLabel = css({
  textStyle: 'sm',
  fontWeight: 'semibold',
  color: 'slate.700',
  _dark: { color: 'slate.300' },
});

const input = css({
  width: 'full',
  minHeight: '11',
  px: '3',
  rounded: 'md',
  // 1px은 이 크기에서 묻혀 입력칸이 있는지조차 보이지 않는다.
  borderWidth: '[1.5px]',
  borderStyle: 'solid',
  borderColor: 'slate.300',
  bg: 'white',
  color: 'slate.900',
  textStyle: 'sm',
  _dark: {
    borderColor: 'slate.700',
    bg: 'slate.950',
    color: 'slate.100',
  },
});

const addButton = css({
  width: 'full',
  minHeight: '11',
  px: '4',
  rounded: 'md',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'violet.600',
  bg: 'violet.600',
  color: 'white',
  textStyle: 'sm',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { borderColor: 'violet.700', bg: 'violet.700' },
  _dark: {
    borderColor: 'violet.500',
    bg: 'violet.500',
    _hover: { borderColor: 'violet.400', bg: 'violet.400' },
  },
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

// 한 건이 어디서 시작해 어디서 끝나는지 카드가 말한다. 추출된 값과 그에
// 딸린 카테고리가 같은 면 위에 있어야 두 건이 섞여 읽히지 않는다.
const card = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  p: '5',
  rounded: 'xl',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'slate.200',
  bg: 'white',
  boxShadow: 'sm',
  _dark: {
    borderColor: 'slate.800',
    bg: 'slate.900',
  },
});

const sectionTitle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  mb: '3',
  textStyle: 'md',
  fontWeight: 'semibold',
  color: 'violet.700',
  _dark: { color: 'violet.300' },
});

// 건수는 색만으로 구분되지 않게 숫자를 그대로 읽힌다. 원은 그 숫자가
// 제목이 아니라 개수라는 것만 표시한다.
const countBadge = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '6',
  height: '6',
  px: '1',
  rounded: 'full',
  bg: 'violet.600',
  color: 'white',
  textStyle: 'xs',
  fontWeight: 'bold',
  _dark: { bg: 'violet.500' },
});

const decideRow = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
});

const decideSelect = css({ width: 'full' });

const completion = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  mt: '4',
});

const continueButton = css({
  minHeight: '11',
  px: '5',
  rounded: 'lg',
  bg: 'violet.600',
  color: 'white',
  textStyle: 'sm',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { bg: 'violet.700' },
  _disabled: {
    bg: 'slate.200',
    color: 'slate.500',
    cursor: 'not-allowed',
  },
  _dark: {
    bg: 'violet.500',
    _hover: { bg: 'violet.400' },
    _disabled: {
      bg: 'slate.800',
      color: 'slate.500',
    },
  },
});

// 추출해 온 값(상호명 · 주소)만 따로 담는다. 이 카드 안에서 사용자가 고르는
// 것(카테고리 · 저장/삭제)과 서버가 읽어 온 것이 같은 바탕에 섞이면, 무엇을
// 확인해야 하는지가 드러나지 않는다.
const extracted = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  px: '4',
  py: '3',
  rounded: 'lg',
  bg: 'violet.50',
  _dark: { bg: 'violet.950' },
});

const candidateName = css({
  textStyle: 'md',
  fontWeight: 'semibold',
  color: 'violet.900',
  _dark: { color: 'violet.100' },
});

const address = css({
  textStyle: 'sm',
  color: 'violet.700',
  _dark: { color: 'violet.300' },
});

const manualOrigin = css({
  textStyle: 'xs',
  color: 'violet.700',
  _dark: { color: 'violet.300' },
});

const failureHint = css({
  textStyle: 'sm',
  color: 'red.700',
  _dark: { color: 'red.300' },
});

// 안내와 이미지 삭제는 한 줄에 둔다. 삭제가 입력 아래에 있으면 어느 것을
// 지우는 버튼인지 — 이 장인지 이 후보인지 — 읽히지 않는다.
const failureTop = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  width: 'full',
});

function isSuccessfulCandidate(
  candidate: ExtractionResultCandidate,
): candidate is ExtractionResultCandidate & SuccessfulSpotCandidate {
  return candidate.roadAddress !== null;
}

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

interface ManualCandidateFormProps {
  readonly candidate: ExtractionResultCandidate;
  readonly onConfirm: (
    candidate: ExtractionResultCandidate,
    name: string,
    roadAddress: string,
  ) => void;
}

/**
 * 입력값은 이 폼 안의 초안으로만 둔다. 타이핑만으로 부모 후보를 바꾸면 주소의
 * 첫 글자를 적는 순간 실패 목록에서 사라져 버리고, 아직 확정하지 않은 값이
 * 저장 대상으로 섞인다.
 */
function ManualCandidateForm({
  candidate,
  onConfirm,
}: ManualCandidateFormProps) {
  const [name, setName] = useState(candidate.name);
  const [roadAddress, setRoadAddress] = useState('');

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const confirmedName = name.trim();
    const confirmedAddress = roadAddress.trim();
    if (confirmedName.length === 0 || confirmedAddress.length === 0) return;
    onConfirm(candidate, confirmedName, confirmedAddress);
  }

  return (
    <form className={manualForm} onSubmit={confirm}>
      <label className={field}>
        <span className={fieldLabel}>상호명</span>
        <input
          className={input}
          type="text"
          value={name}
          onChange={event => {
            setName(event.target.value);
          }}
          required
        />
      </label>
      <label className={field}>
        <span className={fieldLabel}>주소</span>
        <input
          className={input}
          type="text"
          value={roadAddress}
          onChange={event => {
            setRoadAddress(event.target.value);
          }}
          required
        />
      </label>
      <button className={addButton} type="submit">
        저장 대상에 추가
      </button>
    </form>
  );
}

function receiptKey(candidates: readonly ExtractionResultCandidate[]): string {
  return JSON.stringify(candidates);
}

function ExtractionResultsReceipt({ candidates, onContinue }: Props) {
  // OCR 후보와 사용자가 확정한 수동 입력 후보가 함께 사는 STEP 3의 목록 상태.
  // 서버 저장은 T15의 명시적인 저장 선택 뒤에만 일어나며 여기서는 호출하지 않는다.
  const [reviewCandidates, setReviewCandidates] = useState(candidates);
  const successes = reviewCandidates.filter(isSuccessfulCandidate);
  const initialFailureCount = candidatesOf(candidates, 'failure').length;
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [deletedFailureImageIds, setDeletedFailureImageIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const failures = candidatesOf(reviewCandidates, 'failure').filter(
    candidate => !deletedFailureImageIds.has(candidate.uploadImage.id),
  );
  const failureAlbum = failureAlbumOf(failures);
  // 고르지 않은 건은 여기 없다. 기본값을 상태로 미리 채우지 않는 이유는 그
  // 순간 "사용자가 기타를 골랐다"와 "아직 안 골랐다"가 같은 모양이 되기
  // 때문이다 — 읽는 자리에서 한 번만 'other'로 접는다.
  const [categories, setCategories] = useState<
    Readonly<Record<string, SpotCategory>>
  >({});
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isSummaryOpen) summaryButtonRef.current?.focus();
  }, [isSummaryOpen]);

  // 저장·삭제를 건마다 고르게 하지 않는다. 주소가 확인된 건은 그대로 저장
  // 대상이고, 빼고 싶으면 실패 쪽처럼 이미지를 지우면 된다.
  const savedCandidates = successes.map(
    ({ id, name, roadAddress, origin }) => ({
      id,
      name,
      roadAddress,
      origin,
      category: categories[id] ?? DEFAULT_CATEGORY,
    }),
  );
  const canContinue = successes.length > 0 && onContinue !== undefined;

  /**
   * `select`가 주는 값은 문자열이다. 좁히지 않고 넣으면 목록에 없는 값이
   * 카테고리인 척 저장까지 흘러가고, 그 스팟은 시간대 표의 어느 행에도
   * 걸리지 않아 동선 후보에서 조용히 사라진다.
   */
  function chooseCategory(candidateId: string, value: string) {
    if (!isSpotCategory(value)) return;
    setCategories(current => ({ ...current, [candidateId]: value }));
  }

  function confirmManualCandidate(
    candidate: ExtractionResultCandidate,
    name: string,
    roadAddress: string,
  ) {
    const confirmed: ExtractionResultCandidate = {
      ...candidate,
      name,
      roadAddress,
      origin: 'manual',
    };
    setReviewCandidates(current =>
      current.map(item => (item.id === candidate.id ? confirmed : item)),
    );
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
            성공 {successes.length}건 · 실패 {initialFailureCount}건
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
      {successes.length > 0 && (
        <section aria-label="주소가 확인된 결과">
          <h2 className={sectionTitle}>
            성공 데이터
            <span className={countBadge}>{successes.length}</span>
          </h2>
          <ul className={list}>
            {successes.map(candidate => (
              <li className={card} key={candidate.id}>
                <div className={decideRow}>
                  <span className={fieldLabel}>추출 정보</span>
                  <div className={extracted}>
                    <h3 className={candidateName}>{candidate.name}</h3>
                    <p className={address}>{candidate.roadAddress}</p>
                    {candidate.origin === 'manual' ? (
                      <p className={manualOrigin}>직접 입력</p>
                    ) : null}
                  </div>
                </div>
                <label className={decideRow}>
                  <span className={fieldLabel}>저장할 카테고리 선택</span>
                  <select
                    className={`${input} ${decideSelect}`}
                    // 카드마다 보이는 글자가 같아서 이름만으로는 어느 가게의
                    // 것인지 읽히지 않는다. 보이는 "카테고리"를 접근명에
                    // 그대로 품어 음성 제어도 같은 말로 집을 수 있게 둔다.
                    aria-label={`${candidate.name} 저장할 카테고리 선택`}
                    value={categories[candidate.id] ?? DEFAULT_CATEGORY}
                    onChange={event => {
                      chooseCategory(candidate.id, event.target.value);
                    }}
                  >
                    {SPOT_CATEGORIES.map(code => (
                      <option key={code} value={code}>
                        {labelOf(code)}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failureAlbum.length > 0 && (
        <section aria-label="주소 입력이 필요한 결과">
          <ul className={album}>
            {failureAlbum.map(({ image, candidates: failedCandidates }) => (
              <li className={albumCard} key={image.id}>
                <img className={failureImage} src={image.src} alt={image.alt} />
                <div className={albumDetails}>
                  <div className={failureTop}>
                    <p className={failureHint}>
                      도로명 주소를 찾지 못했습니다.
                    </p>
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
                  <ul className={failureNames}>
                    {failedCandidates.map(candidate => (
                      <li key={candidate.id}>
                        <ManualCandidateForm
                          candidate={candidate}
                          onConfirm={confirmManualCandidate}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {successes.length > 0 ? (
        <div className={completion}>
          <button
            className={continueButton}
            type="button"
            disabled={!canContinue}
            onClick={() => {
              onContinue?.(savedCandidates);
            }}
          >
            선택 완료
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function ExtractionResults({ candidates, onContinue }: Props) {
  return (
    <ExtractionResultsReceipt
      key={receiptKey(candidates)}
      candidates={candidates}
      {...(onContinue === undefined ? {} : { onContinue })}
    />
  );
}
