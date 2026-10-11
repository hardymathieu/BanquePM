import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('splits rows and fields, CRLF or LF', () => {
    expect(parseCsv('a,b\r\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('handles quotes, commas inside quotes and doubled quotes', () => {
    expect(parseCsv('"95,87","dit ""merci""",x')).toEqual([['95,87', 'dit "merci"', 'x']]);
  });

  it('keeps newlines inside quotes', () => {
    expect(parseCsv('"a\nb",c')).toEqual([['a\nb', 'c']]);
  });

  it('detects a semicolon separator and strips a BOM', () => {
    expect(parseCsv('﻿Date;Ajouté / Sorti\n05/01/2025;95,87')).toEqual([['Date', 'Ajouté / Sorti'], ['05/01/2025', '95,87']]);
  });

  it('keeps empty fields and ignores a trailing empty line', () => {
    expect(parseCsv('a,,c\n,,\n')).toEqual([['a', '', 'c'], ['', '', '']]);
  });
});
