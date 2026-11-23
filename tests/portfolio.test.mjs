import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);

test('page IDs are unique and local anchors resolve', () => {
  assert.equal(new Set(ids).size, ids.length, 'Duplicate element IDs');
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(ids.includes(id), `Missing anchor: ${id}`);
  }
});

test('every local linked asset exists', () => {
  for (const [, value] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(value)) continue;
    assert.ok(existsSync(resolve(root, value.split(/[?#]/)[0].replace(/^\//, ''))), `Missing asset: ${value}`);
  }
});

test('new-tab links isolate their opener', () => {
  for (const [tag] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    assert.match(tag, /rel="[^"]*noopener/);
  }
});

test('both current projects have categories and details controls', () => {
  assert.equal([...html.matchAll(/data-category="/g)].length, 2);
  const script = readFileSync(resolve(root, 'script.js'), 'utf8');
  for (const [, key] of html.matchAll(/data-project="([^"]+)"/g)) {
    assert.match(script, new RegExp(`\\b${key}:\\s*\\{`));
  }
});

test('social card is a 1200 by 630 PNG', () => {
  const png = readFileSync(resolve(root, 'assets/og-card.png'));
  assert.equal(png.toString('ascii', 1, 4), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('structured profile and résumé download are present', () => {
  const profile = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(profile.name, 'Sidharth Ghai');
  assert.equal(profile['@type'], 'Person');
  assert.match(html, /href="assets\/Sidharth-Ghai-Resume\.pdf" download/);
});
