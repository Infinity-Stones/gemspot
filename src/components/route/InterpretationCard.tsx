'use client';

import { useState } from 'react';
import { css } from 'styled-system/css';
import type { InterpretationDraft } from '@/domain/route';
import type {
  RouteCandidate,
  RouteConditions,
  RouteRequest,
} from '@/shared/routeRequest';
import { isValidTimeWindow } from '@/shared/routeRequest';
import { SPOT_CATEGORIES } from '@/shared/spot';
import { labelOf } from '@/shared/spotCategory';
import { formatSeoulIso, parseIso } from '@/shared/time';
import { actionButton, field, muted, panel, row, stack } from './routeStyles';

interface Props {
  readonly request?: RouteRequest;
  readonly draft?: InterpretationDraft;
  readonly spots: readonly RouteCandidate[];
  readonly pending: boolean;
  readonly onSubmit?: (conditions: RouteConditions) => void;
}

function localDateTime(value: string): string {
  const ms = parseIso(value);
  return ms === null ? '' : formatSeoulIso(ms).slice(0, 16);
}

export function InterpretationCard({
  request,
  draft,
  spots,
  pending,
  onSubmit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const window = request?.window ?? draft?.window;
  const areaName = request?.area.name ?? draft?.areaName;
  const categories =
    request?.preferredCategories ?? draft?.preferredCategories ?? [];
  const names =
    request === undefined
      ? (draft?.requiredSpotNames ?? [])
      : request.requiredSpotIds.map(
          id => spots.find(spot => spot.id === id)?.name ?? id,
        );
  return (
    <section className={panel} aria-label="해석한 조건">
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '3',
        })}
      >
        <h2 className={css({ fontWeight: 'semibold' })}>이렇게 이해했어요</h2>
        {request !== undefined && onSubmit !== undefined && (
          <button
            type="button"
            className={actionButton}
            disabled={pending}
            aria-expanded={editing}
            onClick={() => setEditing(value => !value)}
          >
            {editing ? '수정 닫기' : '조건 수정'}
          </button>
        )}
      </div>
      <dl className={stack}>
        <div>
          <dt className={muted}>날짜·시간</dt>
          <dd>
            {window === undefined || window === null
              ? '걷고 싶은 시간을 알려 주세요'
              : `${localDateTime(window.start).replace('T', ' ')} ~ ${localDateTime(window.end).replace('T', ' ')}`}
          </dd>
        </div>
        <div>
          <dt className={muted}>동네·출발점</dt>
          <dd>{areaName ?? '걷고 싶은 동네를 알려 주세요'}</dd>
          {request !== undefined && (
            <dd className={muted}>
              동네의 대표 좌표에서 출발해요
              {request.area.label ? ` · ${request.area.label}` : ''}
            </dd>
          )}
        </div>
        <div>
          <dt className={muted}>선호</dt>
          <dd>
            {categories.length
              ? categories.map(labelOf).join(' · ')
              : '선호 없음'}
          </dd>
        </div>
        <div>
          <dt className={muted}>꼭 갈 곳</dt>
          <dd>{names.length ? names.join(' · ') : '지정하지 않았어요'}</dd>
        </div>
      </dl>
      {editing && request !== undefined && onSubmit !== undefined && (
        <ConditionsEditor
          request={request}
          spots={spots}
          pending={pending}
          onSubmit={onSubmit}
        />
      )}
    </section>
  );
}

function ConditionsEditor({
  request,
  spots,
  pending,
  onSubmit,
}: {
  readonly request: RouteRequest;
  readonly spots: readonly RouteCandidate[];
  readonly pending: boolean;
  readonly onSubmit: (conditions: RouteConditions) => void;
}) {
  const initial: RouteConditions = {
    window: request.window,
    areaName: request.area.name,
    preferredCategories: request.preferredCategories,
    requiredSpotIds: request.requiredSpotIds,
  };
  const [conditions, setConditions] = useState(initial);
  const validTime = isValidTimeWindow(conditions.window);
  const signature = (value: RouteConditions) =>
    JSON.stringify({
      ...value,
      preferredCategories: [...value.preferredCategories].sort(),
      requiredSpotIds: [...value.requiredSpotIds].sort(),
    });
  const unchanged = signature(conditions) === signature(initial);
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        if (validTime && conditions.areaName.trim() && !unchanged && !pending)
          onSubmit(conditions);
      }}
    >
      <fieldset disabled={pending} className={stack}>
        <legend className={css({ srOnly: true })}>동선 조건 수정</legend>
        <label className={stack}>
          출발 일시
          <input
            aria-label="출발 날짜와 시간"
            type="datetime-local"
            className={field}
            value={localDateTime(conditions.window.start)}
            onChange={event =>
              setConditions({
                ...conditions,
                window: {
                  ...conditions.window,
                  start: `${event.target.value}:00+09:00`,
                },
              })
            }
          />
        </label>
        <label className={stack}>
          종료 일시
          <input
            aria-label="종료 날짜와 시간"
            type="datetime-local"
            className={field}
            value={localDateTime(conditions.window.end)}
            onChange={event =>
              setConditions({
                ...conditions,
                window: {
                  ...conditions.window,
                  end: `${event.target.value}:00+09:00`,
                },
              })
            }
          />
        </label>
        {!validTime && (
          <p role="alert">
            종료는 출발보다 늦어야 하며, 산책은 12시간 이내로 정해 주세요.
          </p>
        )}
        <label className={stack}>
          동네
          <input
            className={field}
            value={conditions.areaName}
            maxLength={200}
            required
            onChange={event =>
              setConditions({ ...conditions, areaName: event.target.value })
            }
          />
        </label>
        <fieldset className={stack}>
          <legend>선호 카테고리</legend>
          <div className={row}>
            {SPOT_CATEGORIES.map(category => (
              <button
                type="button"
                key={category}
                className={actionButton}
                aria-pressed={conditions.preferredCategories.includes(category)}
                onClick={() =>
                  setConditions({
                    ...conditions,
                    preferredCategories:
                      conditions.preferredCategories.includes(category)
                        ? conditions.preferredCategories.filter(
                            value => value !== category,
                          )
                        : [...conditions.preferredCategories, category],
                  })
                }
              >
                {labelOf(category)}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={stack}>
          <legend>꼭 갈 곳</legend>
          {spots.map(spot => (
            <label key={spot.id} className={row}>
              <input
                type="checkbox"
                checked={conditions.requiredSpotIds.includes(spot.id)}
                onChange={event =>
                  setConditions({
                    ...conditions,
                    requiredSpotIds: event.target.checked
                      ? [...conditions.requiredSpotIds, spot.id]
                      : conditions.requiredSpotIds.filter(id => id !== spot.id),
                  })
                }
              />
              {spot.name}
            </label>
          ))}
        </fieldset>
        <button
          type="submit"
          className={actionButton}
          disabled={
            pending || unchanged || !validTime || !conditions.areaName.trim()
          }
        >
          {pending ? '다시 제안하는 중…' : '다시 제안'}
        </button>
      </fieldset>
    </form>
  );
}
