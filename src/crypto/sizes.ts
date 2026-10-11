// Byte sizes of secrets and ids (SPEC §7). Kept apart so pages that only parse
// links don't pull in the BIP39 wordlists.
export const ROOT_BYTES = 16;
export const ID_BYTES = 16;
export const KEY_BYTES = 32;
