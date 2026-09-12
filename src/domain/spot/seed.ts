import type { SavedSpot } from '@/shared/spot';

/**
 * 번들에 함께 실리는 시드 스팟 — T50(#74).
 *
 * 스팟 저장소(D06)가 정해지기 전에 동선 가이드를 끝까지 돌리기 위한 것이다.
 * 명세의 성수동 예시(편집숍 A · 카페 B · 서점 C · 밥집 D)를 실제 좌표로
 * 만들었다. 이름은 가명이지만 좌표는 성수동 도로 위라 TMAP 실측이 붙는다.
 *
 * D07(#27)이 카테고리 목록을 다시 짜면서 편집숍 · 서점 · 공원은 대응하는
 * 행이 없어져 '기타'가 됐다. 이름은 명세 예시 그대로 둔다.
 *
 * 각 건이 무엇을 시연하는지:
 * - 밥집 D — 14~16시 요청에서 시간대 밖(`outside_window`)으로 빠진다
 * - 디저트 E — 반경 안. 시간이 부족할 때 뒤에서 빠지는 것(`over_time`)을 보여 준다
 * - 공원 F — 서울숲 안쪽, 출발점에서 2 km 넘게 떨어져 반경 밖(`outside_area`)
 *
 * 저장소가 붙으면 이 파일과 repository의 폴백 분기를 함께 지울 것.
 */
const SEONGDONG = { sido: '서울특별시', sigugun: '성동구' } as const;

export const SEED_SPOTS: readonly SavedSpot[] = [
  {
    id: 'seed-shop-a',
    name: '편집숍 A',
    roadAddress: '서울 성동구 연무장길 41',
    jibunAddress: null,
    coordinates: { latitude: 37.5424, longitude: 127.056 },
    region: SEONGDONG,
    category: 'other',
    origin: 'manual',
  },
  {
    id: 'seed-cafe-b',
    name: '카페 B',
    roadAddress: '서울 성동구 성수이로 7길 20',
    jibunAddress: null,
    coordinates: { latitude: 37.5448, longitude: 127.053 },
    region: SEONGDONG,
    category: 'cafe',
    origin: 'manual',
  },
  {
    id: 'seed-book-c',
    name: '서점 C',
    roadAddress: '서울 성동구 왕십리로 83',
    jibunAddress: null,
    coordinates: { latitude: 37.547, longitude: 127.05 },
    region: SEONGDONG,
    category: 'other',
    origin: 'manual',
  },
  {
    id: 'seed-food-d',
    name: '밥집 D',
    roadAddress: '서울 성동구 아차산로 104',
    jibunAddress: null,
    coordinates: { latitude: 37.5435, longitude: 127.0575 },
    region: SEONGDONG,
    category: 'meal',
    origin: 'manual',
  },
  {
    id: 'seed-dessert-e',
    name: '디저트 E',
    roadAddress: '서울 성동구 성수일로 12길 31',
    jibunAddress: null,
    coordinates: { latitude: 37.5462, longitude: 127.059 },
    region: SEONGDONG,
    category: 'cafe',
    origin: 'manual',
  },
  {
    id: 'seed-park-f',
    name: '공원 F',
    roadAddress: '서울 성동구 뚝섬로 273',
    jibunAddress: null,
    coordinates: { latitude: 37.5443, longitude: 127.033 },
    region: SEONGDONG,
    category: 'other',
    origin: 'manual',
  },
];
