import { describe, expect, it } from 'vitest';
import { missingFieldFor, resolveIntent } from './intent';
import type { PinDraft } from './pinState';

const draft = (name: string, address: string): PinDraft => ({ name, address, category: 'other' });

describe('resolveIntent', () => {
  it('후보를 고른 것은 주소든 업체든 좌표 확인이다', () => {
    expect(resolveIntent({ rawIntent: 'search', hasPickedAddress: true, hasPickedPlace: false })).toBe('locate');
    expect(resolveIntent({ rawIntent: 'search_place', hasPickedAddress: false, hasPickedPlace: true })).toBe('locate');
  });

  it('버튼이 보낸 값을 그대로 읽고, 모르는 값은 주소 검색으로 본다', () => {
    const base = { hasPickedAddress: false, hasPickedPlace: false };
    expect(resolveIntent({ ...base, rawIntent: 'search_place' })).toBe('search_place');
    expect(resolveIntent({ ...base, rawIntent: 'save' })).toBe('save');
    expect(resolveIntent({ ...base, rawIntent: 'locate' })).toBe('locate');
    expect(resolveIntent({ ...base, rawIntent: '' })).toBe('search');
  });
});

describe('missingFieldFor', () => {
  it('이름으로 찾을 때 주소를 요구하지 않는다 — 요구하면 그 길이 통째로 막힌다', () => {
    expect(missingFieldFor('search_place', draft('피롤츠', ''))).toBeNull();
    expect(missingFieldFor('search_place', draft('', ''))).toBe('name');
  });

  it('주소로 찾고 좌표를 확인할 때 이름을 요구하지 않는다 — 주소부터 찾고 이름을 붙일 수 있어야 한다', () => {
    expect(missingFieldFor('search', draft('', '서울 용산구 한강대로 56-1'))).toBeNull();
    expect(missingFieldFor('locate', draft('', '서울 용산구 한강대로 56-1'))).toBeNull();
    expect(missingFieldFor('search', draft('피롤츠', ''))).toBe('address');
  });

  it('저장할 때만 둘 다 요구한다', () => {
    expect(missingFieldFor('save', draft('피롤츠', '서울 용산구 한강대로 56-1'))).toBeNull();
    expect(missingFieldFor('save', draft('', '서울 용산구 한강대로 56-1'))).toBe('name');
    expect(missingFieldFor('save', draft('피롤츠', ''))).toBe('address');
  });
});
