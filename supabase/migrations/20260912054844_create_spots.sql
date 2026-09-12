-- 저장된 스팟 — D06(#26)의 결정: Supabase(Postgres).
--
-- 열은 src/shared/spot.ts의 SavedSpot 계약과 1:1이다. 계약이 바뀌면 여기와
-- src/domain/spot/repository.ts의 parseSpotRow를 함께 고친다 — 그 둘이 바깥
-- 모양(snake_case 열)과 도메인 모양(camelCase 필드)을 맞추는 유일한 자리다.
--
-- 좌표는 숫자다(double precision). 네이버 Geocoding이 문자열로 주는 x·y는
-- 어댑터에서 이미 숫자로 바뀌어 들어온다. 문자열로 저장하면 정렬·범위 검색이
-- 사전순이 된다.
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  -- Geocoding이 둘 다 주지만 어느 쪽이든 빈 응답이 있어 nullable. 저장의
  -- 필요조건은 주소가 아니라 좌표다(T22).
  road_address text,
  jibun_address text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- 지역 필터(B01)용. addressElements의 SIDO·SIGUGUN.
  sido text,
  sigugun text,
  -- src/shared/spot.ts의 SPOT_CATEGORIES와 같은 집합. 값이 늘면 이 제약도 늘린다.
  category text not null check (category in ('cafe', 'restaurant', 'bar', 'shop', 'sight', 'other')),
  origin text not null check (origin in ('ocr', 'manual')),
  created_at timestamptz not null default now()
);

comment on table public.spots is '사용자가 스크린샷에서 뽑아 확정한 장소. 좌표 검증을 지난 것만 들어온다.';

-- 목록은 최근 저장 순으로 읽는다(T29).
create index spots_created_at_idx on public.spots (created_at desc);

-- 접근은 서버(secret key)만 한다. 기본 1인 사용이라 아직 사용자 구분이 없고,
-- 브라우저가 직접 붙지 않으므로 anon·authenticated에는 정책을 하나도 두지
-- 않는다 — RLS를 켜 두면 정책 없는 역할은 0행을 본다. 공유(B05)가 생겨 사용자
-- 열이 붙을 때 그 열 기준의 정책을 여기 더한다.
alter table public.spots enable row level security;

-- Data API가 이 테이블을 노출하더라도 공개 역할이 닿지 못하게 권한을 뗀다.
-- RLS는 "어느 행"을 가르고, 이것은 "테이블에 닿는가"를 가른다.
revoke all on table public.spots from anon, authenticated;
