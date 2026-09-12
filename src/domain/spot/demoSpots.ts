import type { SavedSpot } from '@/shared/spot';

/**
 * 지도 시연용 스팟 — T51(#91) 마커 렌더, T52(#92) 보이는 영역 필터.
 *
 * `seed.ts`와 따로 두는 이유는 두 시드가 보여 주려는 것이 다르기 때문이다.
 * 그쪽은 동선 가이드가 시간대와 반경으로 후보를 거르는 것을 보여 주려고
 * 성수동 2 km 안에 모아 두었고, 여기는 반대로 **흩어져 있어야** 한다 —
 * 지도를 옮기고 확대·축소할 때 보이는 핀이 바뀌는 것이 T52의 확인 지점이다.
 *
 * 그래서 서울 안에서 서로 5 km 이상 떨어진 지점을 골랐고, 한 화면에 두세
 * 개씩만 들어오도록 배치했다. 이름은 가명이고 좌표는 실제 도로 위다.
 *
 * 저장소에서 목록이 들어오면(T29 · #41) 이 파일은 지운다.
 */
export const DEMO_SPOTS: readonly SavedSpot[] = [
  {
    id: 'demo-yongsan-cafe',
    name: '피롤츠 커피하우스',
    roadAddress: '서울 용산구 한강대로 56-1',
    jibunAddress: '서울 용산구 한강로3가 40-999',
    coordinates: { latitude: 37.5299, longitude: 126.9648 },
    region: { sido: '서울특별시', sigugun: '용산구' },
    category: 'cafe',
    origin: 'ocr',
  },
  {
    id: 'demo-yongsan-pasta',
    name: '파브리키친',
    roadAddress: '서울 용산구 한강대로15길 23-6',
    jibunAddress: null,
    coordinates: { latitude: 37.5273, longitude: 126.9662 },
    region: { sido: '서울특별시', sigugun: '용산구' },
    category: 'restaurant',
    origin: 'ocr',
  },
  {
    id: 'demo-itaewon-bar',
    name: '녹사평 와인바',
    roadAddress: '서울 용산구 녹사평대로 168',
    jibunAddress: null,
    coordinates: { latitude: 37.5345, longitude: 126.9878 },
    region: { sido: '서울특별시', sigugun: '용산구' },
    category: 'bar',
    origin: 'manual',
  },
  {
    id: 'demo-seongsu-shop',
    name: '연무장길 편집숍',
    roadAddress: '서울 성동구 연무장길 41',
    jibunAddress: null,
    coordinates: { latitude: 37.5424, longitude: 127.056 },
    region: { sido: '서울특별시', sigugun: '성동구' },
    category: 'shop',
    origin: 'ocr',
  },
  {
    id: 'demo-seongsu-dessert',
    name: '성수 디저트바',
    roadAddress: '서울 성동구 성수일로12길 31',
    jibunAddress: null,
    coordinates: { latitude: 37.5462, longitude: 127.059 },
    region: { sido: '서울특별시', sigugun: '성동구' },
    category: 'cafe',
    origin: 'ocr',
  },
  {
    id: 'demo-mapo-brunch',
    name: '연남동 브런치',
    roadAddress: '서울 마포구 성미산로 161',
    jibunAddress: null,
    coordinates: { latitude: 37.5622, longitude: 126.9253 },
    region: { sido: '서울특별시', sigugun: '마포구' },
    category: 'restaurant',
    origin: 'ocr',
  },
  {
    id: 'demo-jongno-teahouse',
    name: '익선동 찻집',
    roadAddress: '서울 종로구 수표로28길 33',
    jibunAddress: null,
    coordinates: { latitude: 37.5723, longitude: 126.9909 },
    region: { sido: '서울특별시', sigugun: '종로구' },
    category: 'cafe',
    origin: 'manual',
  },
  {
    id: 'demo-gangnam-omakase',
    name: '신사동 오마카세',
    roadAddress: '서울 강남구 도산대로 108',
    jibunAddress: null,
    coordinates: { latitude: 37.5197, longitude: 127.0228 },
    region: { sido: '서울특별시', sigugun: '강남구' },
    category: 'restaurant',
    origin: 'ocr',
  },
  {
    id: 'demo-yeouido-view',
    name: '여의도 전망 카페',
    roadAddress: '서울 영등포구 여의대로 108',
    jibunAddress: null,
    coordinates: { latitude: 37.5254, longitude: 126.9271 },
    region: { sido: '서울특별시', sigugun: '영등포구' },
    category: 'cafe',
    origin: 'manual',
  },
  {
    id: 'demo-nowon-restaurant',
    name: '익스프레스노원바이미라쥬',
    roadAddress: '서울 노원구 화랑로 608',
    jibunAddress: null,
    coordinates: { latitude: 37.6222, longitude: 127.0755 },
    region: { sido: '서울특별시', sigugun: '노원구' },
    category: 'restaurant',
    origin: 'ocr',
  },
];
