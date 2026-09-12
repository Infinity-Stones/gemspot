import { describe, expect, it } from 'vitest';
import { distanceTable } from './distance';
import { orderByNearest } from './fallbackOrder';
import { START_ID } from './types';

const start = { latitude: 37.5, longitude: 127.0 };
// 위도 0.001° ≈ 111 m. A 300 m, B 900 m, C는 A에서 200 m(출발점에서 500 m).
const A = { id: 'a', name: 'A', category: 'cafe' as const, coord: { latitude: 37.5027, longitude: 127.0 } };
const B = { id: 'b', name: 'B', category: 'cafe' as const, coord: { latitude: 37.5081, longitude: 127.0 } };
const C = { id: 'c', name: 'C', category: 'cafe' as const, coord: { latitude: 37.5045, longitude: 127.0 } };

describe('orderByNearest', () => {
  const table = distanceTable([{ id: START_ID, coord: start }, A, B, C]);

  it('출발점에서 가까운 곳부터, 다음은 현재 위치에서 가까운 곳', () => {
    expect(orderByNearest([B, A, C], table).map((c) => c.id)).toEqual(['a', 'c', 'b']);
  });

  it('동률이면 입력 순서가 앞선 것', () => {
    const A2 = { ...A, id: 'a2', coord: { latitude: 37.4973, longitude: 127.0 } }; // 남쪽으로 같은 거리
    const t = distanceTable([{ id: START_ID, coord: start }, A, A2]);
    expect(orderByNearest([A2, A], t).map((c) => c.id)).toEqual(['a2', 'a']);
  });

  it('후보 0이면 빈 배열', () => {
    expect(orderByNearest([], table)).toEqual([]);
  });
});
