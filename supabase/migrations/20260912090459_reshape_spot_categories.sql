-- 카테고리 체계 확정 — D07(#27). 옛 여섯 행(cafe·restaurant·bar·shop·sight·other)을
-- meal·cafe·movie·amusement·sports·other로 바꾼다.
--
-- 목록의 단일 소스는 src/shared/spot.ts의 SPOT_CATEGORIES이고, 이 체크 제약은
-- 그 집합의 DB 쪽 사본이다. 둘이 갈라지면 앱이 쓰려는 값을 DB가 거부하거나
-- 반대로 표에 행이 없는 값이 들어온다 — 그래서 목록을 고치는 커밋이 이 제약도
-- 함께 고친다.
--
-- 옮길 곳이 없는 값은 'other'로 보낸다. 새 목록에 상점·구경거리에 대응하는
-- 행이 없고, 억지로 가까운 행에 밀어 넣으면 그 스팟이 엉뚱한 시간대의 후보가
-- 된다. 술집은 먹고 마시는 곳이라 'meal'이 가장 가깝다.

-- 제약을 먼저 떼야 옛 값 → 새 값 이행 중간 상태가 막히지 않는다.
alter table public.spots drop constraint if exists spots_category_check;

update public.spots
set category = case category
  when 'restaurant' then 'meal'
  when 'bar' then 'meal'
  when 'shop' then 'other'
  when 'sight' then 'other'
  else category
end;

alter table public.spots
  add constraint spots_category_check
  check (category in ('meal', 'cafe', 'movie', 'amusement', 'sports', 'other'));

comment on column public.spots.category is 'src/shared/spot.ts의 SPOT_CATEGORIES와 같은 집합. 사용자가 값을 더하지 못한다(D07).';
