// Blob size limits, shared by the client and the Worker. Part of the frozen v1 contract:
// raising them later is safe, lowering them is not.
//
// The family blob holds every kid's full ledger (up to MAX_KIDS), so it gets a larger
// limit than a kid blob. Sizes are ciphertext bytes (SPEC §4.4, amended).

const KiB = 1024;

export const MAX_KIDS = 10;
export const FAMILY_CT_LIMIT = 256 * KiB;
export const KID_CT_LIMIT = 64 * KiB;

/** Design budgets: a heavy realistic family must stay well under the hard limits. */
export const FAMILY_CT_BUDGET = FAMILY_CT_LIMIT / 4;
export const KID_CT_BUDGET = KID_CT_LIMIT / 2;
