import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { FUNKY_ANIMALS, extractAnimalSuffix } from '../extension/shared/animal-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function extractSupabaseAnimalCatalog() {
  const src = fs.readFileSync(
    path.join(root, 'supabase/functions/_shared/animals.ts'),
    'utf8'
  );
  const match = src.match(/export const FUNKY_ANIMALS:[\s\S]*?=\s*\[([\s\S]*?)\]\s*as const/);
  assert.ok(match, 'Supabase animal catalog not found');
  return [...match[1].matchAll(/'([^']+)'/g)].map(([, animal]) => animal);
}

describe('funky animal names', () => {
  test('extracts the longest matching animal suffix', () => {
    assert.equal(extractAnimalSuffix('AdaCosmicPolarBear'), 'PolarBear');
    assert.equal(extractAnimalSuffix('AdaCosmicBear'), 'Bear');
    assert.equal(extractAnimalSuffix('AdaCosmicBaldEagle'), 'BaldEagle');
  });

  test('rejects non-string and unknown suffix values', () => {
    assert.equal(extractAnimalSuffix(null), null);
    assert.equal(extractAnimalSuffix({ name: 'AdaCosmicBear' }), null);
    assert.equal(extractAnimalSuffix('AdaCosmicUnknownAnimal'), null);
  });

  test('keeps extension and Supabase animal catalogs in sync', () => {
    const supabaseAnimals = extractSupabaseAnimalCatalog();

    assert.deepEqual(
      [...FUNKY_ANIMALS].sort(),
      [...supabaseAnimals].sort(),
      'animal catalogs must match across extension and Supabase'
    );
    assert.equal(new Set(FUNKY_ANIMALS).size, FUNKY_ANIMALS.length, 'extension catalog has duplicates');
    assert.equal(new Set(supabaseAnimals).size, supabaseAnimals.length, 'Supabase catalog has duplicates');
  });
});
