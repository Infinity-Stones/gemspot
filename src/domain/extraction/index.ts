/**
 * 이미지에서 가게명·주소 후보를 뽑는 도메인의 공개 API.
 *
 * app 레이어가 여는 유일한 문이다. 이 파일에는 모듈 최상위 부수효과를 두지
 * 않는다 — 배럴 한 줄의 호출이 거기 매달린 모듈 전부를 모든 페이지 청크에
 * 싣는다. 그 규칙도 lint(no-restricted-syntax)가 잡는다.
 */

export { extractFromImage } from './extractFromImage';
export type {
  ExtractFailureReason,
  ExtractFromImageInput,
  ExtractOutcome,
} from './extractFromImage';
export {
  isRoadAddress,
  partitionByRoadAddress,
  toSpotCandidates,
} from './roadAddress';
export type { ReadSpot, RoadAddressPartition } from './roadAddress';
export {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  screenUploads,
} from './uploadGuard';
export type {
  UploadCandidate,
  UploadRejection,
  UploadScreening,
} from './uploadGuard';
