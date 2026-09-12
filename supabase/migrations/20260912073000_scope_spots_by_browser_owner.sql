-- D06 후속 결정(#122, T21 #30): 로그인 대신 브라우저 UUID로 스팟을 구분한다.
-- 기존 행은 어느 브라우저의 것인지 알 수 없으므로 예약 UUID에 보존한다. 임의의
-- 새 브라우저에 넘기면 데이터 경계가 깨지므로 자동 귀속하지 않는다.
alter table public.spots
  add column owner_id uuid,
  add column canonical_address text not null default '',
  add column saved_at timestamptz,
  add column deleted_at timestamptz;

update public.spots
set
  -- nil UUID는 쿠키 검증(UUID v4)을 통과하지 않아 어떤 브라우저에도 배정되지 않는다.
  owner_id = '00000000-0000-0000-0000-000000000000',
  canonical_address = coalesce(nullif(btrim(road_address), ''), nullif(btrim(jibun_address), ''), ''),
  saved_at = created_at;

alter table public.spots
  alter column owner_id set not null,
  alter column canonical_address drop default,
  alter column saved_at set default now(),
  alter column saved_at set not null;

-- 같은 브라우저에서는 대표 주소(도로명 우선, 없으면 지번)와 상호명이 같은 행을
-- 하나만 둔다. 삭제된 행도 이 키를 유지하므로 재저장은 새 행을 만들지 않고
-- deleted_at을 null로 되돌려 같은 id를 복구한다.
alter table public.spots
  add constraint spots_owner_name_address_key
  unique (owner_id, name, canonical_address);

drop index spots_created_at_idx;
create index spots_owner_saved_at_idx
  on public.spots (owner_id, saved_at desc)
  where deleted_at is null;

comment on column public.spots.owner_id is '로그인 대신 브라우저 쿠키에 보관한 UUID. 인증 증명이 아닌 프로토타입용 구분자.';
comment on column public.spots.canonical_address is '중복 판정용 대표 주소. road_address 우선, 없으면 jibun_address.';
comment on column public.spots.saved_at is '최초 저장 또는 소프트 삭제 뒤 복구한 최근 시각. 목록 정렬 기준.';
comment on column public.spots.deleted_at is 'null이면 활성, 값이 있으면 소프트 삭제된 시각.';
