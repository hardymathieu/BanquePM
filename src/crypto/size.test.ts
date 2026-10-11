// SPEC §4.4 size budget, amended: the family blob gets its own, larger limit (src/limits.ts).
import { describe, expect, it } from 'vitest';
import { projectForKid } from '../engine/project';
import { FAMILY_CT_BUDGET, FAMILY_CT_LIMIT, KID_CT_BUDGET, MAX_KIDS } from '../limits';
import { bigFamily } from './__fixtures__/bigFamily';
import { seal } from './box';
import { importBoxKey } from './keys';

const ID = 'h87_z6uLAE4aGqoBi0vXSw';
const size = async (value: unknown) => (await seal(await importBoxKey(new Uint8Array(32)), ID, value)).length;

describe('size budget', () => {
  it.each(['words', 'random'] as const)('3 kids × 10 years (%s notes): family blob within budget', async (style) => {
    expect(await size(bigFamily(style))).toBeLessThan(FAMILY_CT_BUDGET);
  });

  it.each(['words', 'random'] as const)('3 kids × 10 years (%s notes): each kid blob within budget', async (style) => {
    for (const k of bigFamily(style).kids) expect(await size(projectForKid(k.doc, '2026-01-01'))).toBeLessThan(KID_CT_BUDGET);
  });

  it(`${MAX_KIDS} heavy kids still fit under the family hard limit`, async () => {
    expect(await size(bigFamily('random', MAX_KIDS))).toBeLessThan(FAMILY_CT_LIMIT);
  });
});
