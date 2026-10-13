import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * vercel.json pins the inline theme script in index.html by hash. Editing that
 * script without updating the hash would make the CSP block it in production.
 */
describe('Content-Security-Policy', () => {
  it('allows exactly the inline scripts in index.html', () => {
    const html = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
    const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`,
    );
    const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const csp: string = vercel.headers
      .flatMap((h: { headers: { key: string; value: string }[] }) => h.headers)
      .find((h: { key: string }) => h.key === 'Content-Security-Policy').value;
    for (const h of hashes) expect(csp).toContain(h);
    expect(csp).toContain('https://services.swpc.noaa.gov');
    expect(csp).toContain('https://ccmc.gsfc.nasa.gov');
  });
});
