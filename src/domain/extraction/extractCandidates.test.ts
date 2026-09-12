import { describe, expect, it } from 'vitest';
import { extractCandidates } from './extractCandidates';

/**
 * 실제 OCR이 무엇을 줄지는 D02(#12)가 정해져야 안다. 그래서 여기 픽스처는
 * 명세(docs/user-flow.html STEP 2)에 적힌 문자열을 그대로 쓰고, 줄 나눔만
 * OCR이 흔히 내는 두 모양(줄바꿈 · 가운뎃점)으로 바꿔 가며 넣는다.
 */

describe('extractCandidates — 한 건', () => {
  it('가운뎃점으로 이어진 가게명과 주소를 가른다', () => {
    expect(
      extractCandidates('피롤츠 커피하우스 · 서울 용산구 한강대로 56-1, 2층'),
    ).toEqual([
      {
        name: '피롤츠 커피하우스',
        addressLine: '서울 용산구 한강대로 56-1, 2층',
      },
    ]);
  });

  it('줄바꿈으로 나뉜 가게명과 주소를 가른다', () => {
    expect(
      extractCandidates('파브리키친\n서울 용산구 한강대로15길 23-6'),
    ).toEqual([
      { name: '파브리키친', addressLine: '서울 용산구 한강대로15길 23-6' },
    ]);
  });

  it('이름 안에 숫자가 있는 도로명을 주소로 본다', () => {
    // `한강대로15길`은 끝이 길이라 도로명이다. 가운데 숫자에 속으면 안 된다.
    const [only] = extractCandidates('서울 용산구 한강대로15길 23-6');

    expect(only?.addressLine).toBe('서울 용산구 한강대로15길 23-6');
  });

  it('건물번호와 층수만 있는 줄은 주소로 시작하지 않는다', () => {
    // 숫자로 시작하는 토큰을 위치로 치면 가격표·영업시간이 전부 주소가 된다.
    expect(extractCandidates('익스프레스노원바이미라쥬\n1,000원\n2층')).toEqual(
      [{ name: '익스프레스노원바이미라쥬', addressLine: '' }],
    );
  });
});

describe('extractCandidates — 주소가 없을 때', () => {
  it('이름만 있어도 후보를 낸다 — 실패 목록에 올라 직접 입력을 받아야 한다', () => {
    expect(extractCandidates('에그앤플라워')).toEqual([
      { name: '에그앤플라워', addressLine: '' },
    ]);
  });

  it('이름 줄이 여럿이면 첫 줄을 가게명으로 본다', () => {
    // 주소가 없는 텍스트에서 가게명일 가능성이 높은 것은 마지막 줄이 아니라
    // 게시물 위쪽이다.
    expect(extractCandidates('에그앤플라워\n팔로우\n좋아요 32개')).toEqual([
      { name: '에그앤플라워', addressLine: '' },
    ]);
  });

  it('빈 텍스트에서는 후보가 없다', () => {
    expect(extractCandidates('')).toEqual([]);
    expect(extractCandidates('   \n\n  ')).toEqual([]);
  });
});

describe('extractCandidates — 이름이 없을 때', () => {
  it('주소만 있으면 이름을 비운 채로 낸다', () => {
    expect(extractCandidates('서울 노원구 화랑로 608')).toEqual([
      { name: '', addressLine: '서울 노원구 화랑로 608' },
    ]);
  });

  it('지역명만 있는 줄도 주소 줄로 본다 — 도로명인지는 T11이 가른다', () => {
    // `용산동2가`는 끝이 가라 위치 토큰이다. 여기서 거르지 않는 이유는
    // 뽑는 규칙과 가르는 규칙을 나눠 두었기 때문이다.
    const [only] = extractCandidates('에그앤플라워 · 용산동2가');

    expect(only).toEqual({ name: '에그앤플라워', addressLine: '용산동2가' });
  });
});

describe('extractCandidates — 짝짓기', () => {
  it('주소 바로 앞의 이름을 붙인다', () => {
    const [only] = extractCandidates(
      '오래된 가게\n피롤츠 커피하우스\n서울 용산구 한강대로 56-1',
    );

    expect(only?.name).toBe('피롤츠 커피하우스');
  });

  it('가게 이름처럼 생긴 줄을 주소로 오인하지 않는다', () => {
    for (const name of [
      '피롤츠 커피하우스',
      '파브리키친',
      '에그앤플라워',
      '익스프레스노원바이미라쥬',
    ]) {
      expect(
        extractCandidates(`${name}\n서울 용산구 한강대로 56-1`)[0]?.name,
      ).toBe(name);
    }
  });
});

describe('extractCandidates — 한 장에 여러 가게', () => {
  /** 명세의 그 게시물. 피롤츠와 파브리키친이 한 화면에 들어온다. */
  const 두_가게 = [
    '피롤츠 커피하우스',
    '서울 용산구 한강대로 56-1, 2층',
    '파브리키친',
    '서울 용산구 한강대로15길 23-6',
  ].join('\n');

  it('2건으로 나온다', () => {
    expect(extractCandidates(두_가게)).toHaveLength(2);
  });

  it('가게명과 주소가 뒤섞이지 않는다', () => {
    expect(extractCandidates(두_가게)).toEqual([
      {
        name: '피롤츠 커피하우스',
        addressLine: '서울 용산구 한강대로 56-1, 2층',
      },
      { name: '파브리키친', addressLine: '서울 용산구 한강대로15길 23-6' },
    ]);
  });

  it('가운뎃점으로 이어 붙인 같은 게시물도 2건이다', () => {
    expect(
      extractCandidates(
        '피롤츠 커피하우스 · 서울 용산구 한강대로 56-1, 2층 · 파브리키친 · 서울 용산구 한강대로15길 23-6',
      ),
    ).toHaveLength(2);
  });

  it('한 이름이 두 후보에 붙지 않는다', () => {
    // 붙으면 두 가게가 같은 상호로 저장된다.
    const [first, second] = extractCandidates(
      '피롤츠 커피하우스\n서울 용산구 한강대로 56-1\n서울 노원구 화랑로 608',
    );

    expect(first?.name).toBe('피롤츠 커피하우스');
    expect(second?.name).toBe('');
  });

  it('세 가게도 셋으로 나온다', () => {
    expect(
      extractCandidates(
        [
          '피롤츠 커피하우스',
          '서울 용산구 한강대로 56-1, 2층',
          '파브리키친',
          '서울 용산구 한강대로15길 23-6',
          '익스프레스노원바이미라쥬',
          '서울 노원구 화랑로 608',
        ].join('\n'),
      ).map(c => c.name),
    ).toEqual(['피롤츠 커피하우스', '파브리키친', '익스프레스노원바이미라쥬']);
  });
});

describe('extractCandidates — 줄바꿈으로 끊긴 주소', () => {
  it('건물번호가 아직 없는 주소 줄은 다음 줄과 이어 붙인다', () => {
    // OCR은 긴 주소를 자주 끊는다. 끊긴 조각을 따로 세면 한 가게가 두 건이 된다.
    expect(
      extractCandidates('피롤츠 커피하우스\n서울 용산구\n한강대로 56-1, 2층'),
    ).toEqual([
      {
        name: '피롤츠 커피하우스',
        addressLine: '서울 용산구 한강대로 56-1, 2층',
      },
    ]);
  });

  it('세 조각으로 끊겨도 하나로 모은다', () => {
    const [only] = extractCandidates(
      '파브리키친\n서울\n용산구\n한강대로15길 23-6',
    );

    expect(only).toEqual({
      name: '파브리키친',
      addressLine: '서울 용산구 한강대로15길 23-6',
    });
  });

  it('완성된 주소 뒤의 주소 줄은 이어 붙이지 않는다', () => {
    // 건물번호가 이미 붙었으면 그 주소는 끝났다. 다음 줄은 다음 가게다.
    expect(
      extractCandidates('서울 용산구 한강대로 56-1\n서울 노원구 화랑로 608'),
    ).toHaveLength(2);
  });

  it('이어 붙여도 이름은 앞 후보의 것을 지킨다', () => {
    const [only] = extractCandidates('에그앤플라워\n서울 용산구\n용산동2가');

    expect(only?.name).toBe('에그앤플라워');
  });
});
