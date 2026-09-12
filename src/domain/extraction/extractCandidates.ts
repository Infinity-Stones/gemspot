/**
 * OCR이 뱉은 덩어리 텍스트에서 가게명과 주소 후보를 뽑는 규칙 — 순수 함수만.
 *
 * 네트워크도 시간도 읽지 않는다. OCR 제공자(D02 · #12)가 정해지지 않아도 이
 * 규칙은 돌고, 제공자가 바뀌어도 이 파일은 바뀌지 않는다 — 어댑터(T09)가
 * 무엇을 쓰든 결국 넘겨주는 것은 문자열 한 덩어리다.
 *
 * **여기서는 도로명 주소인지 판단하지 않는다.** 그 판정으로 성공과 실패를
 * 가르는 것은 T11(#15)의 일이다. 이 단계가 하는 일은 "어느 줄이 주소처럼
 * 생겼고, 그 주소는 어느 가게의 것인가"까지다. 둘을 나눠 둔 이유는 뽑는 규칙과
 * 가르는 규칙이 서로 다른 이유로 바뀌기 때문이다 — 뽑는 쪽은 OCR이 주는 줄의
 * 생김새를 따라가고, 가르는 쪽은 지오코딩에 넣을 수 있는지를 따라간다.
 */

/**
 * 뽑아낸 후보 한 건.
 *
 * 아직 `SpotCandidate`(shared)가 아니다. id도 없고 도로명 여부도 정해지지
 * 않았다 — 그 둘을 붙이는 것이 T11이다.
 */
export interface ExtractedCandidate {
  /** 상호명. 못 찾았으면 빈 문자열이다. */
  readonly name: string;
  /** 주소처럼 생긴 줄 전체. 못 찾았으면 빈 문자열이다. */
  readonly addressLine: string;
}

/**
 * 광역자치단체 이름. 축약형(`서울`)과 정식형(`서울특별시`)이 함께 온다 —
 * 인스타그램 위치 태그는 축약형이고 사업자 정보는 정식형인 경우가 많다.
 */
const SIDO = new Set([
  '서울',
  '부산',
  '대구',
  '인천',
  '광주',
  '대전',
  '울산',
  '세종',
  '경기',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
  '서울특별시',
  '부산광역시',
  '대구광역시',
  '인천광역시',
  '광주광역시',
  '대전광역시',
  '울산광역시',
  '세종특별자치시',
  '경기도',
  '강원특별자치도',
  '충청북도',
  '충청남도',
  '전북특별자치도',
  '전라남도',
  '경상북도',
  '경상남도',
  '제주특별자치도',
]);

/**
 * 행정구역 꼬리표. `용산동2가`처럼 이름 안에 숫자가 섞여도 **끝 글자**로 잡는다.
 */
const ADMIN_TAIL = /[시군구읍면동리가]$/u;

/**
 * 도로명 꼬리표. `한강대로15길`처럼 이름 안에 숫자가 있어도 끝이 로·길이면
 * 도로다.
 */
const ROAD_TAIL = /[로길]$/u;

/**
 * 이 토큰이 위치를 가리키는가.
 *
 * 숫자로 시작하는 토큰(`56-1,` · `2층`)은 그 자체로 위치가 아니다 — 앞 토큰이
 * 도로명일 때만 의미가 있고, 세그먼트 안에 도로명 토큰이 이미 하나라도 있으면
 * 그 세그먼트는 어차피 주소로 잡힌다. 여기서 숫자를 위치로 치면 가격표나
 * 영업시간 줄이 전부 주소가 된다.
 */
function isLocationToken(token: string): boolean {
  if (token.length === 0) return false;
  if (SIDO.has(token)) return true;
  if (/^\d/u.test(token)) return false;
  return ADMIN_TAIL.test(token) || ROAD_TAIL.test(token);
}

/**
 * 이 세그먼트가 주소 줄인가 — 위치 토큰이 하나라도 있으면 그렇다.
 *
 * 느슨한 기준인 것이 의도다. 여기서 놓치면 그 주소는 후보에 아예 오르지
 * 못하고 사용자가 손으로 다시 쳐야 한다. 반대로 넉넉히 잡아 실패로 떨어지는
 * 건은 STEP 3에서 직접 입력으로 구제된다(T17 · #24) — 두 오류의 비용이
 * 다르므로 놓치는 쪽을 더 피한다.
 */
function isAddressSegment(segment: string): boolean {
  return segment.split(/\s+/u).some(isLocationToken);
}

/**
 * 가운뎃점 계열 구분자. 인스타그램 위치 줄과 명세의 예시가 이 문자로
 * 가게명과 주소를 잇는다. **쉼표는 나누지 않는다** —
 * `한강대로 56-1, 2층`의 쉼표는 주소 안쪽이다.
 */
const SEPARATORS = /[·•∙・｜|]/u;

function segmentsOf(text: string): readonly string[] {
  return text
    .split(/\r?\n/u)
    .flatMap(line => line.split(SEPARATORS))
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);
}

/**
 * 텍스트 한 덩어리에서 후보 목록을 만든다.
 *
 * 짝짓는 규칙은 **주소 바로 앞의 이름**이다. 인스타그램 게시물에서 가게명은
 * 위치 줄 바로 위에 오고, 그 사이에 다른 가게 이름이 끼어들 수 없다. 더
 * 똑똑한 규칙(거리 가중치, 글자 크기)은 OCR이 무엇을 주는지 정해진 뒤에
 * 얹는 게 맞다 — 지금 지어내면 실제 입력을 본 적 없는 규칙이 된다.
 *
 * 주소를 끝내 못 찾아도 이름만으로 후보 하나를 낸다. 그래야 그 건이 STEP 3의
 * 실패 목록에 올라 사용자가 주소를 직접 칠 수 있다(T17 · #24) — 여기서
 * 떨어뜨리면 그 사진은 아무 데도 나타나지 않고 사라진다.
 */
export function extractCandidates(text: string): readonly ExtractedCandidate[] {
  const segments = segmentsOf(text);
  const candidates: ExtractedCandidate[] = [];

  let pendingName: string | null = null;
  let firstName: string | null = null;

  for (const segment of segments) {
    if (isAddressSegment(segment)) {
      candidates.push({ name: pendingName ?? '', addressLine: segment });
      pendingName = null;
      continue;
    }

    pendingName = segment;
    firstName ??= segment;
  }

  // 주소를 못 만난 이름이 남았다면 그것도 후보다(주소 없는 실패 건).
  if (pendingName !== null) {
    candidates.push({ name: pendingName, addressLine: '' });
  }

  // 이름만 있고 주소가 하나도 없던 경우, 짝짓기 루프는 **마지막** 이름을
  // 들고 끝난다. 그런데 주소가 없는 텍스트에서 가게명일 가능성이 높은 것은
  // 마지막 줄이 아니라 첫 줄이다(게시물 제목·계정명이 위에 온다).
  if (
    candidates.length === 1 &&
    candidates[0]?.addressLine === '' &&
    firstName !== null
  ) {
    return [{ name: firstName, addressLine: '' }];
  }

  return candidates;
}
