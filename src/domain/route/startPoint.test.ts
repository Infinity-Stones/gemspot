import { describe, expect, it } from 'vitest';
import type { GeocodeFn } from './startPoint';
import { resolveArea } from './startPoint';

const hit = {
  coord: { lat: 37.5447, lng: 127.0557 },
  roadAddress: '서울특별시 성동구 성수동1가',
  jibunAddress: '',
  region: { sido: '서울특별시', sigugun: '성동구' },
};

describe('resolveArea', () => {
  it('1건이면 found + 정규화 주소 라벨', async () => {
    const geocode: GeocodeFn = () => Promise.resolve({ ok: true, data: { totalCount: 1, hits: [hit] } });
    await expect(resolveArea('성수동', geocode)).resolves.toEqual({
      kind: 'found',
      center: hit.coord,
      label: '서울특별시 성동구 성수동1가',
    });
  });

  it('totalCount 0은 not_found — 사용자가 고칠 수 있는 실패', async () => {
    const geocode: GeocodeFn = () => Promise.resolve({ ok: true, data: { totalCount: 0, hits: [] } });
    await expect(resolveArea('없는동', geocode)).resolves.toEqual({ kind: 'not_found' });
  });

  it('키 없음 · 네트워크는 failed — 사용자가 고칠 수 없는 실패', async () => {
    const geocode: GeocodeFn = () => Promise.resolve({ ok: false, error: { kind: 'no_api_key' } });
    await expect(resolveArea('성수동', geocode)).resolves.toMatchObject({ kind: 'failed' });
  });
});
