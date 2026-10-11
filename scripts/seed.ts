// npm run seed [base URL]: creates the demo bank on a local server and prints its links.
import { readFileSync } from 'node:fs';
import { localToday } from '../src/ui/shared/today';
import { createDemoBank } from './demo';

const base = process.argv[2] ?? 'http://localhost:5173';
const token = process.env.ADMIN_TOKEN ?? /^ADMIN_TOKEN=(.*)$/m.exec(readFileSync('.dev.vars', 'utf8'))?.[1]?.trim();
if (!token) throw new Error('Set ADMIN_TOKEN in .dev.vars');

const bank = await createDemoBank(base, token, localToday());
process.stdout.write(`Kid link:    ${bank.kidLink}\nParent link: ${bank.parentLink}\n`);
