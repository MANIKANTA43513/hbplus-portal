import { isAllowedEmailDomain, normalizeEmail, parseEmail } from '@/lib/domain';

describe('isAllowedEmailDomain (exact domain policy for hbplus.fit)', () => {
  it.each([
    ['user@hbplus.fit', 'plain company address'],
    ['USER@HBPLUS.FIT', 'upper case is normalized'],
    ['  first.last+tag@HbPlus.Fit  ', 'surrounding whitespace and mixed case are normalized'],
  ])('accepts %s (%s)', (email) => {
    expect(isAllowedEmailDomain(email)).toBe(true);
  });

  it.each([
    ['user@gmail.com', 'personal Gmail'],
    ['employee@anothercompany.com', 'another company'],
    ['user@not-hbplus.fit', 'look-alike prefix'],
    ['user@hbplus.fit.attacker.com', 'allowed domain used as a prefix'],
    ['user@sub.hbplus.fit', 'subdomain is not authorized'],
    ['user@evilhbplus.fit', 'suffix match without a dot boundary'],
    ['user@hbplus.fit.', 'trailing dot'],
    ['user@@hbplus.fit', 'double @'],
    ['attacker@evil.com@hbplus.fit', 'second @ smuggles a different domain'],
    ['hbplus.fit@evil.com', 'allowed domain in the local part'],
    ['user@hbplus.fit\u200b', 'zero-width character'],
    ['user@hbpIus.fit', 'homoglyph (capital I instead of l)'],
    ['user@hbplus.fit\n@evil.com', 'newline injection'],
    ['user name@hbplus.fit', 'whitespace in local part'],
    ['@hbplus.fit', 'empty local part'],
    ['user@', 'empty domain'],
    ['user', 'no @'],
    ['', 'empty string'],
    ['   ', 'whitespace only'],
  ])('rejects %j (%s)', (email) => {
    expect(isAllowedEmailDomain(email)).toBe(false);
  });

  it.each([[undefined], [null], [42], [{}], [['user@hbplus.fit']]])('rejects non-string %p', (value) => {
    expect(isAllowedEmailDomain(value)).toBe(false);
  });

  it('rejects over-long addresses', () => {
    expect(isAllowedEmailDomain(`${'a'.repeat(65)}@hbplus.fit`)).toBe(false);
  });

  it('compares against a custom domain exactly too', () => {
    expect(isAllowedEmailDomain('a@example.org', 'EXAMPLE.org')).toBe(true);
    expect(isAllowedEmailDomain('a@sub.example.org', 'example.org')).toBe(false);
    expect(isAllowedEmailDomain('a@example.org', '')).toBe(false);
  });
});

describe('normalizeEmail / parseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  A@B.Co ')).toBe('a@b.co');
  });

  it('returns null for empty and non-string values', () => {
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(5)).toBeNull();
  });

  it('splits local part and domain', () => {
    expect(parseEmail('Jane.Doe@HBPlus.fit')).toEqual({
      email: 'jane.doe@hbplus.fit',
      local: 'jane.doe',
      domain: 'hbplus.fit',
    });
  });

  it('rejects malformed domains', () => {
    expect(parseEmail('a@localhost')).toBeNull();
    expect(parseEmail('a@-bad.com')).toBeNull();
    expect(parseEmail('a@bad..com')).toBeNull();
  });
});
