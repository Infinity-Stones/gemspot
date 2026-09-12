import { describe, expect, it } from 'vitest';
import {
  isRoadAddress,
  partitionByRoadAddress,
  toSpotCandidates,
} from './roadAddress';

/**
 * 명세(docs/user-flow.html STEP 2)와 이슈 #15가 든 예시를 그대로 굳힌다.
 *
 * 여기서 말하는 성공·실패는 **OCR이 읽어냈는가**이지 지도에 핀이 찍혔는가가
 * 아니다. 갈리는 기준은 화면에 도로명 주소가 찍혀 있는지 하나다.
 */

const 성공 = [
  '서울 용산구 한강대로 56-1, 2층',
  '서울 용산구 한강대로15길 23-6',
  '서울 노원구 화랑로 608',
];

const 실패 = ['한강동', '용산역', '용산구', '용산동2가'];

describe('isRoadAddress — 명세의 예시', () => {
  it.each(성공)('성공으로 본다: %s', address => {
    expect(isRoadAddress(address)).toBe(true);
  });

  it.each(실패)('실패로 본다: %s', address => {
    // 번지가 없어 가게 위치를 특정할 수 없다. 동 이름만으로 핀을 찍으면
    // 엉뚱한 곳에 꽂히므로 실패로 보내 직접 입력을 받는다.
    expect(isRoadAddress(address)).toBe(false);
  });
});

describe('isRoadAddress — 도로명의 모양', () => {
  it('이름 안에 숫자가 있어도 끝이 로·길이면 도로명이다', () => {
    expect(isRoadAddress('한강대로15길 23-6')).toBe(true);
    expect(isRoadAddress('종로 3길 12')).toBe(true);
  });

  it('건물번호가 붙어 있어도 본다', () => {
    expect(isRoadAddress('한강대로56')).toBe(true);
  });

  it('부번과 층수 꼬리표가 붙어도 본다', () => {
    expect(isRoadAddress('한강대로 56-1, 2층')).toBe(true);
  });

  it('시도·시군구가 없어도 도로명과 번호가 있으면 본다', () => {
    // 지오코딩이 풀 수 있는지는 다른 문제다. 여기 기준은 명세 그대로
    // "도로명 주소가 찍혀 있는가" 하나다.
    expect(isRoadAddress('화랑로 608')).toBe(true);
  });
});

describe('isRoadAddress — 도로명이 아닌 것', () => {
  it('건물번호가 없으면 도로명이 아니다', () => {
    expect(isRoadAddress('서울 용산구 한강대로')).toBe(false);
  });

  it('동 이름이 로·길로 끝나도 번호가 안 붙으면 아니다', () => {
    expect(isRoadAddress('종로구')).toBe(false);
  });

  it('숫자 뒤에 한글이 이어지면 건물번호가 아니다', () => {
    // `종로 3가`는 동 이름이고, `대로 5000원`은 가격이다.
    expect(isRoadAddress('종로 3가')).toBe(false);
    expect(isRoadAddress('대로 5000원')).toBe(false);
  });

  it('로·길이 낱말 안에 있을 뿐이면 아니다', () => {
    expect(isRoadAddress('시간대로 운영')).toBe(false);
    expect(isRoadAddress('주차 2대로 제한')).toBe(false);
  });

  it('빈 문자열은 아니다', () => {
    expect(isRoadAddress('')).toBe(false);
    expect(isRoadAddress('   ')).toBe(false);
  });
});

describe('toSpotCandidates', () => {
  it('도로명이면 그대로 싣고 아니면 null로 둔다', () => {
    expect(
      toSpotCandidates(
        [
          {
            name: '피롤츠 커피하우스',
            address: '서울 용산구 한강대로 56-1, 2층',
          },
          { name: '에그앤플라워', address: '용산동2가' },
        ],
        'img-1',
      ),
    ).toEqual([
      {
        id: 'img-1:0',
        name: '피롤츠 커피하우스',
        roadAddress: '서울 용산구 한강대로 56-1, 2층',
        origin: 'ocr',
      },
      { id: 'img-1:1', name: '에그앤플라워', roadAddress: null, origin: 'ocr' },
    ]);
  });

  it('id가 이미지와 순서로 결정된다 — 같은 입력이면 같은 id다', () => {
    // 난수로 만들면 다시 읽을 때마다 목록의 선택 상태가 풀린다.
    const once = toSpotCandidates([{ name: 'a', address: '' }], 'img-9');
    const twice = toSpotCandidates([{ name: 'a', address: '' }], 'img-9');

    expect(once[0]?.id).toBe(twice[0]?.id);
  });

  it('출처를 ocr로 남긴다 — 직접 입력과 구분해야 한다', () => {
    expect(toSpotCandidates([{ name: 'a', address: '' }], 'i')[0]?.origin).toBe(
      'ocr',
    );
  });
});

describe('partitionByRoadAddress', () => {
  it('성공 건과 실패 건을 가른다', () => {
    const { resolved, unresolved } = partitionByRoadAddress(
      toSpotCandidates(
        [
          { name: '피롤츠', address: '서울 용산구 한강대로 56-1' },
          { name: '에그앤플라워', address: '용산동2가' },
          { name: '이름만', address: '' },
        ],
        'img-1',
      ),
    );

    expect(resolved.map(c => c.name)).toEqual(['피롤츠']);
    expect(unresolved.map(c => c.name)).toEqual(['에그앤플라워', '이름만']);
  });

  it('버리지 않는다 — 둘을 합치면 넣은 수다', () => {
    const candidates = toSpotCandidates(
      [
        { name: 'a', address: '화랑로 608' },
        { name: 'b', address: '용산구' },
      ],
      'img-1',
    );
    const { resolved, unresolved } = partitionByRoadAddress(candidates);

    expect(resolved.length + unresolved.length).toBe(candidates.length);
  });

  it('입력 순서를 지킨다 — 앨범에서 고른 순서가 목록 순서다', () => {
    const { unresolved } = partitionByRoadAddress(
      toSpotCandidates(
        [
          { name: 'first', address: '용산구' },
          { name: 'second', address: '한강동' },
        ],
        'img-1',
      ),
    );

    expect(unresolved.map(c => c.name)).toEqual(['first', 'second']);
  });
});

describe('isRoadAddress — 길안내와 잡문', () => {
  it('숫자 뒤에 영문이 붙으면 건물번호가 아니다', () => {
    // `바로 200m 앞`의 `바로`가 도로명으로 읽히면 길안내 문구가 주소가 된다.
    expect(isRoadAddress('바로 200m 앞')).toBe(false);
  });

  it('호점·연차·분 같은 꼬리표를 건물번호로 보지 않는다', () => {
    expect(isRoadAddress('테헤란로 2호점')).toBe(false);
    expect(isRoadAddress('골목길 10년')).toBe(false);
    expect(isRoadAddress('도보 5분')).toBe(false);
  });

  it('길 이름이 별칭으로 쓰인 문장을 주소로 보지 않는다', () => {
    expect(isRoadAddress('신사동 가로수길 맛집 3곳')).toBe(false);
  });
});

describe('isRoadAddress — 갈래도로', () => {
  it('붙여 쓴 갈래도로를 읽는다', () => {
    expect(isRoadAddress('서울 용산구 한강대로15길 23-6')).toBe(true);
  });

  it('띄어 쓴 갈래도로도 읽는다', () => {
    // 공식 표기는 붙여 쓰지만 사람이 적으면 띄운다. 시드 데이터가 그 표기다.
    expect(isRoadAddress('서울 성동구 성수이로 7길 20')).toBe(true);
    expect(isRoadAddress('서울 성동구 성수일로 12길 31')).toBe(true);
  });

  it('번길을 읽는다', () => {
    expect(isRoadAddress('서울 강남구 봉은사로 68번길 10')).toBe(true);
  });
});

describe('isRoadAddress — 지번 주소는 실패다', () => {
  it('번지가 있어도 도로명이 아니면 실패로 보낸다', () => {
    // 명세가 기준을 "도로명 주소가 찍혀 있는지 하나"로 못 박았다.
    // 규칙의 부작용이 아니라 의도다.
    expect(isRoadAddress('서울 용산구 한강로2가 40-1')).toBe(false);
    expect(isRoadAddress('을지로2가 100')).toBe(false);
  });
});

describe('isRoadAddress — OCR 잡음', () => {
  it('하이픈이 다른 대시로 읽혀도 도로명으로 본다', () => {
    // 부번 표기가 깨져도 도로명과 본번은 남는다. 대시 정규화는 좌표로
    // 바꾸는 쪽(T20 · #29)의 일이다.
    expect(isRoadAddress('한강대로 56–1')).toBe(true);
  });

  it('건물번호 뒤에 다른 말이 이어져도 도로명으로 본다', () => {
    expect(isRoadAddress('세종대로 110 1층')).toBe(true);
  });
});
