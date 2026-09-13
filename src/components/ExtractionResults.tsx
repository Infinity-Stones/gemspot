'use client';

import { useEffect, useRef, useState } from 'react';
import { css } from 'styled-system/css';
import { FloatingActionBar } from './FloatingActionBar';
import { Toast } from './Toast';
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
   * VLM 제안으로 시작하되 사용자가 바꿀 수 있다. 저장을 확정하는 이 경계에서
   * 제안과 사용자 수정을 최종 카테고리로 붙인다.
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
  bg: 'design.ink/30',
});

const alertCard = css({
  width: 'full',
  maxWidth: 'md',
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  p: '6',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
  color: 'ui.ink',
  boxShadow: 'floating',
});

const alertCopy = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
});

const alertTitle = css({
  textStyle: 'subheading',
  fontWeight: 'bold',
});

const alertDescription = css({
  textStyle: 'bodySm',
  color: 'ui.subtle',
});

const alertCounts = css({
  p: '4',
  rounded: 'panel',
  bg: 'ui.tag',
  color: 'ui.onTag',
  textAlign: 'center',
  fontWeight: 'semibold',
});

const alertButton = css({
  minHeight: '11',
  px: '5',
  rounded: 'control',
  bg: 'ui.action',
  color: 'ui.onAction',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { bg: 'ui.actionHover' },
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
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
  m: '0',
  p: '0',
  listStyle: 'none',
});

const albumCard = css({
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
  boxShadow: 'floating',
});

// 원본은 주소를 옮겨 적을 때만 필요하다. 카드마다 큰 사진을 펼쳐 두면
// 정작 채워야 할 입력칸이 화면 밖으로 밀린다.
const previewButton = css({
  minHeight: '11',
  px: '3',
  rounded: 'control',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  color: 'ui.ink',
  textStyle: 'bodySm',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { borderColor: 'ui.accent', bg: 'ui.muted' },
});

const previewDialog = css({
  // 네이티브 dialog는 inset과 margin으로 자리를 잡는다. auto 마진이 양축을
  // 모두 가운데로 민다.
  inset: '0',
  m: 'auto',
  width: 'full',
  maxWidth: 'lg',
  p: '0',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
  overflow: 'hidden',
  // 딤은 뒤를 가리는 게 아니라 앞을 띄우는 장치다. 꽉 채우면 원본이 어느
  // 화면 위에 떠 있는지 사라진다.
  '&::backdrop': { bg: 'design.ink/30' },
});

const previewImage = css({
  display: 'block',
  width: 'full',
  height: 'auto',
  maxHeight: '[70dvh]',
  objectFit: 'contain',
  bg: 'ui.muted',
});

const previewFooter = css({
  display: 'flex',
  justifyContent: 'flex-end',
  p: '3',
});

const previewClose = css({
  minHeight: '11',
  px: '4',
  rounded: 'control',
  bg: 'ui.action',
  color: 'ui.onAction',
  textStyle: 'bodySm',
  fontWeight: 'semibold',
  cursor: 'pointer',
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
  p: '4',
  rounded: 'nav',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.muted',
});

const field = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  width: 'full',
});

const fieldLabel = css({
  textStyle: 'bodySm',
  fontWeight: 'semibold',
  color: 'ui.ink',
});

const input = css({
  width: 'full',
  minHeight: '11',
  px: '3',
  rounded: 'input',
  // 1px은 이 크기에서 묻혀 입력칸이 있는지조차 보이지 않는다.
  borderWidth: '[1.5px]',
  borderStyle: 'solid',
  borderColor: 'ui.border',
  bg: 'ui.surface',
  color: 'ui.ink',
  textStyle: 'body',
});

const addButton = css({
  width: 'full',
  minHeight: '11',
  px: '4',
  rounded: 'control',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.action',
  bg: 'ui.action',
  color: 'ui.onAction',
  textStyle: 'button',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { borderColor: 'ui.action', bg: 'ui.actionHover' },
});

// 아이콘은 작지만 누를 자리는 44px을 지킨다. 그 여백이 카드 안에서 빈칸처럼
// 보이지 않도록, 남는 만큼을 음수 마진으로 되돌린다.
const deleteButton = css({
  alignSelf: 'flex-end',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '11',
  height: '11',
  mt: '-2',
  mb: '-3',
  mr: '-2',
  rounded: 'control',
  color: 'ui.accentText',
  cursor: 'pointer',
  _hover: { color: 'ui.accentText', bg: 'ui.tag' },
});

// 한 건이 어디서 시작해 어디서 끝나는지 카드가 말한다. 추출된 값과 그에
// 딸린 카테고리가 같은 면 위에 있어야 두 건이 섞여 읽히지 않는다.
const card = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  p: '6',
  rounded: 'panel',
  borderWidth: 'hairline',
  borderStyle: 'solid',
  borderColor: 'ui.line',
  bg: 'ui.surface',
  boxShadow: 'floating',
});

const sectionTitle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  mb: '3',
  textStyle: 'body',
  fontWeight: 'semibold',
  color: 'ui.accentText',
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
  bg: 'ui.action',
  color: 'ui.onAction',
  textStyle: 'caption',
  fontWeight: 'bold',
});

const failureSectionTitle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  mb: '3',
  textStyle: 'body',
  fontWeight: 'semibold',
  color: 'ui.accentText',
});

const failureCountBadge = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '6',
  height: '6',
  px: '1',
  rounded: 'full',
  bg: 'ui.action',
  color: 'ui.onAction',
  textStyle: 'caption',
  fontWeight: 'bold',
});

const decideRow = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
});

const decideSelect = css({ width: 'full' });

const continueButton = css({
  width: 'full',
  minHeight: '11',
  px: '5',
  rounded: 'control',
  bg: 'ui.action',
  color: 'ui.onAction',
  textStyle: 'button',
  fontWeight: 'semibold',
  cursor: 'pointer',
  _hover: { bg: 'ui.actionHover' },
  _disabled: {
    bg: 'ui.muted',
    color: 'ui.subtle',
    cursor: 'not-allowed',
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
  rounded: 'nav',
  bg: 'ui.tag',
});

const candidateName = css({
  textStyle: 'body',
  fontWeight: 'semibold',
  color: 'ui.onTag',
});

const address = css({
  textStyle: 'bodySm',
  color: 'ui.accentText',
});

const manualOrigin = css({
  textStyle: 'caption',
  color: 'ui.accentText',
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

interface ImagePreviewProps {
  readonly image: UploadImage;
  readonly onClose: () => void;
}

/**
 * 원본 보기. 네이티브 `dialog`를 쓰는 이유는 포커스 가둠과 Esc 닫기를 브라우저가
 * 이미 들고 있어서다 — 직접 만들면 그 둘을 다시 구현하게 된다.
 */
function ImagePreview({ image, onClose }: ImagePreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      className={previewDialog}
      ref={dialogRef}
      aria-label={`${image.alt} 원본`}
      onClose={onClose}
    >
      <img className={previewImage} src={image.src} alt={image.alt} />
      <div className={previewFooter}>
        <button
          className={previewClose}
          type="button"
          onClick={() => {
            dialogRef.current?.close();
          }}
        >
          닫기
        </button>
      </div>
    </dialog>
  );
}

interface ManualCandidateFormProps {
  readonly candidate: ExtractionResultCandidate;
  readonly onConfirm: (
    candidate: ExtractionResultCandidate,
    name: string,
    roadAddress: string,
  ) => void;
  readonly onDelete: (candidate: ExtractionResultCandidate) => void;
}

/**
 * 입력값은 이 폼 안의 초안으로만 둔다. 타이핑만으로 부모 후보를 바꾸면 주소의
 * 첫 글자를 적는 순간 실패 목록에서 사라져 버리고, 아직 확정하지 않은 값이
 * 저장 대상으로 섞인다.
 */
function ManualCandidateForm({
  candidate,
  onConfirm,
  onDelete,
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
      <button
        className={deleteButton}
        type="button"
        onClick={() => {
          onDelete(candidate);
        }}
        aria-label={`${candidate.name} 삭제`}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l10 10M14 4L4 14" />
        </svg>
      </button>
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
        성공 데이터로 추가
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
  // 한 장에서 가게가 둘 나올 수 있다. 이미지 단위로 지우면 지우려던 것 옆의
  // 멀쩡한 후보까지 함께 사라진다.
  const [deletedFailureCandidateIds, setDeletedFailureCandidateIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const failures = candidatesOf(reviewCandidates, 'failure').filter(
    candidate => !deletedFailureCandidateIds.has(candidate.id),
  );
  const failureAlbum = failureAlbumOf(failures);
  // 건수는 이미지가 아니라 후보로 센다. 한 장에서 두 가게가 나올 수 있어,
  // 앨범 장수로 세면 사용자가 채워야 할 칸 수와 어긋난다.
  const failureCount = failures.length;
  const [previewImage, setPreviewImage] = useState<UploadImage | null>(null);
  // 실패 안내는 카드마다 되뇌지 않는다. 같은 말이 카드 수만큼 쌓이면 정작
  // 채워야 할 입력칸을 가린다 — 한 번 지나가고 끝낸다.
  const [isFailureNoticeVisible, setIsFailureNoticeVisible] = useState(false);
  // 사용자가 바꾼 건만 여기 둔다. 기본값을 상태로 미리 채우지 않아야 VLM
  // 제안과 사용자의 명시적 수정을 구분할 수 있다.
  const [categories, setCategories] = useState<
    Readonly<Record<string, SpotCategory>>
  >({});
  const summaryButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (isSummaryOpen) summaryButtonRef.current?.focus();
  }, [isSummaryOpen]);

  // 저장·삭제를 건마다 고르게 하지 않는다. 주소가 확인된 건은 그대로 저장
  // 대상이고, 빼고 싶으면 실패 쪽처럼 그 건을 지우면 된다.
  const savedCandidates = successes.map(
    ({ id, name, roadAddress, suggestedCategory, origin }) => ({
      id,
      name,
      roadAddress,
      suggestedCategory,
      origin,
      category: categories[id] ?? suggestedCategory,
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

  function deleteFailureCandidate(candidate: ExtractionResultCandidate) {
    setDeletedFailureCandidateIds(
      current => new Set([...current, candidate.id]),
    );
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
              setIsFailureNoticeVisible(failureCount > 0);
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
      {isFailureNoticeVisible && (
        <Toast
          message="도로명 주소를 찾지 못했습니다."
          onDismiss={() => {
            setIsFailureNoticeVisible(false);
          }}
        />
      )}

      {previewImage !== null && (
        <ImagePreview
          image={previewImage}
          onClose={() => {
            setPreviewImage(null);
          }}
        />
      )}

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
                    value={
                      categories[candidate.id] ?? candidate.suggestedCategory
                    }
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

      {failureCount > 0 && (
        <section aria-label="주소 입력이 필요한 결과">
          <h2 className={failureSectionTitle}>
            실패 데이터
            <span className={failureCountBadge}>{failureCount}</span>
          </h2>
          <ul className={album}>
            {failureAlbum.map(({ image, candidates: failedCandidates }) => (
              <li className={albumCard} key={image.id}>
                <div className={albumDetails}>
                  <button
                    className={previewButton}
                    type="button"
                    onClick={() => {
                      setPreviewImage(image);
                    }}
                    aria-label={`${image.alt} 이미지 보기`}
                  >
                    이미지 보기
                  </button>
                  <ul className={failureNames}>
                    {failedCandidates.map(candidate => (
                      <li key={candidate.id}>
                        <ManualCandidateForm
                          candidate={candidate}
                          onConfirm={confirmManualCandidate}
                          onDelete={deleteFailureCandidate}
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
        <FloatingActionBar>
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
        </FloatingActionBar>
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
