import type { VerseListAsset, VerseListItem } from '@/utils/verseAssignment';
import {
  UNASSIGNED_SEPARATOR_KEY,
  assignGroupFrom,
  buildVerseList,
  labelRanges,
  lastSequenceInVerse,
  lastUnassignedOrderIndex,
  maxToForNewLabel,
  openRangeAt,
  orderIndexFor,
  planReorder,
  unlabeledVerses
} from '@/utils/verseAssignment';

function asset(
  id: string,
  verse?: [number, number],
  order_index?: number,
  extra: Record<string, unknown> = {}
): VerseListAsset {
  return {
    id,
    order_index: order_index ?? 0,
    metadata: verse
      ? { ...extra, verse: { from: verse[0], to: verse[1] } }
      : extra
  };
}

function keys(list: VerseListItem[]) {
  return list.map((item) => item.key);
}

function indexOf(list: VerseListItem[], key: string) {
  const index = list.findIndex((item) => item.key === key);
  if (index === -1) throw new Error(`missing ${key}`);
  return index;
}

// [sep-1-1, a, sep-2-2, b, sep-3-3, c]
const threeVerses = buildVerseList(
  [
    asset('a', [1, 1], orderIndexFor(1, 1)),
    asset('b', [2, 2], orderIndexFor(2, 1)),
    asset('c', [3, 3], orderIndexFor(3, 1))
  ],
  []
);

describe('buildVerseList', () => {
  it('groups assets under labels in verse order, then unassigned', () => {
    const list = buildVerseList(
      [
        asset('u1', undefined, 5),
        asset('b', [2, 3], orderIndexFor(2, 1)),
        asset('a2', [1, 1], orderIndexFor(1, 2)),
        asset('a1', [1, 1], orderIndexFor(1, 1))
      ],
      []
    );
    expect(keys(list)).toEqual([
      'sep-1-1',
      'a1',
      'a2',
      'sep-2-3',
      'b',
      UNASSIGNED_SEPARATOR_KEY,
      'u1'
    ]);
  });

  it('keeps groups that share a start verse contiguous', () => {
    const list = buildVerseList(
      [
        asset('x', [3, 3], orderIndexFor(3, 1)),
        asset('y', [3, 5], orderIndexFor(3, 2)),
        asset('z', [3, 3], orderIndexFor(3, 3))
      ],
      []
    );
    expect(keys(list)).toEqual(['sep-3-3', 'x', 'z', 'sep-3-5', 'y']);
  });

  it('reads verse metadata stored as a JSON string', () => {
    const list = buildVerseList(
      [{ id: 'a', order_index: 0, metadata: '{"verse":{"from":4,"to":4}}' }],
      []
    );
    expect(keys(list)).toEqual(['sep-4-4', 'a']);
  });

  it('places manual labels above their asset or by verse order', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('b', [5, 5], orderIndexFor(5, 1)),
        asset('u', undefined, 1)
      ],
      [
        { from: 3, to: 3, key: 'manual-3' },
        { from: 7, to: 7, key: 'manual-7', assetId: 'u' }
      ]
    );
    expect(keys(list)).toEqual([
      'sep-1-1',
      'a',
      'manual-3',
      'sep-5-5',
      'b',
      'manual-7',
      UNASSIGNED_SEPARATOR_KEY,
      'u'
    ]);
  });

  it('prefers a manual label over the derived label for the same range', () => {
    const list = buildVerseList(
      [asset('a', [2, 2], orderIndexFor(2, 1))],
      [{ from: 2, to: 2, key: 'manual-2', assetId: 'a' }]
    );
    expect(keys(list)).toEqual(['manual-2', 'a']);
  });
});

describe('order index helpers', () => {
  it('finds the last sequence in a verse, ignoring excluded assets', () => {
    const assets = [
      asset('a', [7, 7], orderIndexFor(7, 1)),
      asset('b', [7, 7], orderIndexFor(7, 4)),
      asset('c', [8, 8], orderIndexFor(8, 9))
    ];
    expect(lastSequenceInVerse(assets, 7)).toBe(4);
    expect(lastSequenceInVerse(assets, 7, new Set(['b']))).toBe(1);
    expect(lastSequenceInVerse(assets, 6)).toBe(0);
  });

  it('reports the highest order index among unassigned assets', () => {
    expect(
      lastUnassignedOrderIndex([
        asset('a', [1, 1], 99_999_999),
        asset('u1', undefined, 10),
        asset('u2', undefined, 30)
      ])
    ).toBe(30);
    expect(lastUnassignedOrderIndex([asset('a', [1, 1], 1)])).toBeUndefined();
  });
});

describe('label range helpers', () => {
  const list = buildVerseList(
    [
      asset('a', [1, 2], orderIndexFor(1, 1)),
      asset('b', [5, 5], orderIndexFor(5, 1)),
      asset('u', undefined, 1)
    ],
    []
  );

  it('lists label ranges and unlabeled verses', () => {
    expect(labelRanges(list)).toEqual([
      { from: 1, to: 2 },
      { from: 5, to: 5 }
    ]);
    expect(unlabeledVerses(list, 6)).toEqual([3, 4, 6]);
  });

  it('limits a new label to the gap before the next label', () => {
    expect(maxToForNewLabel(list, 3, 6)).toBe(4);
    expect(maxToForNewLabel(list, 6, 6)).toBe(6);
    expect(maxToForNewLabel(list, 5, 6)).toBe(5);
  });

  it('finds the open range around an asset or separator', () => {
    expect(openRangeAt(list, indexOf(list, 'a'), 6)).toEqual({
      from: 3,
      to: 4,
      availableVerses: [3, 4]
    });
    expect(openRangeAt(list, indexOf(list, 'sep-5-5'), 6)).toEqual({
      from: 3,
      to: 6,
      availableVerses: [3, 4, 5, 6]
    });
    expect(openRangeAt(list, indexOf(list, 'u'), 6)).toEqual({
      from: 6,
      to: 6,
      availableVerses: [6]
    });
  });

  it('reports no room when labels are adjacent', () => {
    const tight = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('a2', [1, 1], orderIndexFor(1, 2)),
        asset('b', [2, 2], orderIndexFor(2, 1))
      ],
      []
    );
    expect(openRangeAt(tight, indexOf(tight, 'a2'), 5).availableVerses).toEqual(
      []
    );
  });
});

describe('assignGroupFrom', () => {
  it('labels the asset and the rest of its group, keeping other metadata', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('b', [1, 1], orderIndexFor(1, 2), { recordingSessionId: 's1' }),
        asset('c', [1, 1], orderIndexFor(1, 3)),
        asset('d', [4, 4], orderIndexFor(4, 1))
      ],
      []
    );
    expect(
      assignGroupFrom(list, indexOf(list, 'b'), { from: 2, to: 3 })
    ).toEqual([
      {
        assetId: 'b',
        metadata: { recordingSessionId: 's1', verse: { from: 2, to: 3 } },
        order_index: orderIndexFor(2, 1)
      },
      {
        assetId: 'c',
        metadata: { verse: { from: 2, to: 3 } },
        order_index: orderIndexFor(2, 2)
      }
    ]);
  });

  it('labels unassigned assets from the target down', () => {
    const list = buildVerseList(
      [asset('u1', undefined, 1), asset('u2', undefined, 2)],
      []
    );
    expect(
      assignGroupFrom(list, indexOf(list, 'u2'), { from: 1, to: 1 }).map(
        (update) => update.assetId
      )
    ).toEqual(['u2']);
  });
});

describe('planReorder', () => {
  it('moves an asset into another verse and renumbers both groups', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('b', [2, 2], orderIndexFor(2, 1)),
        asset('b2', [2, 2], orderIndexFor(2, 2))
      ],
      []
    );
    // Drop b2 directly under a.
    const plan = planReorder(list, indexOf(list, 'b2'), indexOf(list, 'a') + 1);
    expect(plan).toEqual({
      ok: true,
      updates: [
        {
          assetId: 'b2',
          metadata: { verse: { from: 1, to: 1 } },
          order_index: orderIndexFor(1, 2)
        }
      ]
    });
  });

  it('reorders within a verse without touching metadata', () => {
    const list = buildVerseList(
      [
        asset('a1', [1, 1], orderIndexFor(1, 1)),
        asset('a2', [1, 1], orderIndexFor(1, 2))
      ],
      []
    );
    expect(planReorder(list, 2, 1)).toEqual({
      ok: true,
      updates: [
        { assetId: 'a2', order_index: orderIndexFor(1, 1) },
        { assetId: 'a1', order_index: orderIndexFor(1, 2) }
      ]
    });
  });

  it('clears the verse when an asset is dropped into the unassigned section', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('a2', [1, 1], orderIndexFor(1, 2)),
        asset('u', undefined, 0)
      ],
      []
    );
    const plan = planReorder(list, indexOf(list, 'a2'), list.length - 1);
    expect(plan.ok && plan.updates).toEqual([
      { assetId: 'u', order_index: orderIndexFor(999, 1) },
      {
        assetId: 'a2',
        metadata: { verse: undefined },
        order_index: orderIndexFor(999, 2)
      }
    ]);
  });

  it('moves a label boundary to take over the next recording', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('a2', [1, 1], orderIndexFor(1, 2)),
        asset('b', [2, 2], orderIndexFor(2, 1))
      ],
      []
    );
    // Drag the verse 2 label up above a2.
    const plan = planReorder(
      list,
      indexOf(list, 'sep-2-2'),
      indexOf(list, 'a2')
    );
    expect(plan.ok && plan.updates).toEqual([
      {
        assetId: 'a2',
        metadata: { verse: { from: 2, to: 2 } },
        order_index: orderIndexFor(2, 1)
      },
      { assetId: 'b', order_index: orderIndexFor(2, 2) }
    ]);
  });

  it('rejects dropping an asset above the first section', () => {
    expect(planReorder(threeVerses, indexOf(threeVerses, 'b'), 0)).toEqual({
      ok: false,
      reason: 'above-first-section'
    });
  });

  it('rejects dragging a label past another label', () => {
    expect(
      planReorder(threeVerses, indexOf(threeVerses, 'sep-3-3'), 1)
    ).toEqual({ ok: false, reason: 'out-of-order' });
  });

  it('rejects dragging a label into the unassigned section', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('b', [2, 2], orderIndexFor(2, 1)),
        asset('b2', [2, 2], orderIndexFor(2, 2)),
        asset('u', undefined, 0)
      ],
      []
    );
    expect(
      planReorder(list, indexOf(list, 'sep-2-2'), list.length - 1)
    ).toEqual({ ok: false, reason: 'out-of-order' });
  });

  it('rejects a label drag that would leave a label with no recordings', () => {
    // Dragging verse 3 directly under verse 2 empties verse 2.
    expect(
      planReorder(
        threeVerses,
        indexOf(threeVerses, 'sep-3-3'),
        indexOf(threeVerses, 'sep-2-2') + 1
      )
    ).toEqual({ ok: false, reason: 'empties-label' });
  });

  it('allows moving the last recording out of a verse', () => {
    const plan = planReorder(
      threeVerses,
      indexOf(threeVerses, 'b'),
      indexOf(threeVerses, 'a') + 1
    );
    expect(plan.ok).toBe(true);
  });

  it('allows moving an empty manual label into place', () => {
    const list = buildVerseList(
      [
        asset('a', [1, 1], orderIndexFor(1, 1)),
        asset('a2', [1, 1], orderIndexFor(1, 2)),
        asset('c', [5, 5], orderIndexFor(5, 1))
      ],
      [{ from: 3, to: 3, key: 'manual-3' }]
    );
    // [sep-1-1, a, a2, manual-3, sep-5-5, c] -> put manual-3 above a2.
    const plan = planReorder(
      list,
      indexOf(list, 'manual-3'),
      indexOf(list, 'a2')
    );
    expect(plan.ok && plan.updates).toEqual([
      {
        assetId: 'a2',
        metadata: { verse: { from: 3, to: 3 } },
        order_index: orderIndexFor(3, 1)
      }
    ]);
  });
});
