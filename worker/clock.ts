// The server's only notion of time: a UTC calendar day and its month.
import { addDays } from '../src/engine/dates';

export const today = (): string => new Date().toISOString().slice(0, 10);
export const thisMonth = (): string => today().slice(0, 7);
export { addDays };
