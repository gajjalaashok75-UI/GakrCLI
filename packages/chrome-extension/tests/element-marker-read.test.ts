/**
 * Integration test for the element-marker read path retained for
 * chrome_read_page. The marker management UI was removed, but
 * listMarkersForUrl still surfaces previously saved markers. Exercises the
 * real storage module against fake-indexeddb (no mocks of the module).
 */

import { beforeEach, describe, expect, test } from 'vitest';
import { listMarkersForUrl } from '@/entrypoints/background/element-marker/element-marker-storage';
import { IndexedDbClient } from '@/utils/indexeddb-client';
import type { ElementMarker } from '@/common/element-marker-types';

// Seed helper: the storage module owns its own IndexedDbClient instance, so we
// write through the same object store using a separate client to the same DB.
const seeder = new IndexedDbClient('element_marker_storage', 1, (db, oldVersion) => {
  if (oldVersion === 0) {
    const store = db.createObjectStore('markers', { keyPath: 'id' });
    store.createIndex('by_host', 'host', { unique: false });
    store.createIndex('by_origin', 'origin', { unique: false });
    store.createIndex('by_path', 'path', { unique: false });
  }
});

function marker(overrides: Partial<ElementMarker> & Pick<ElementMarker, 'id'>): ElementMarker {
  return {
    url: 'https://example.com/app/page',
    origin: 'https://example.com',
    host: 'example.com',
    path: '/app/page',
    matchType: 'prefix',
    name: 'Login Button',
    selector: '#login',
    selectorType: 'css',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(async () => {
  const existing = await seeder.getAll<ElementMarker>('markers');
  await Promise.all(existing.map((m) => seeder.delete('markers', m.id)));
});

describe('listMarkersForUrl (chrome_read_page dependency)', () => {
  test('returns markers whose prefix matches the current URL', async () => {
    await seeder.put('markers', marker({ id: 'prefix', matchType: 'prefix', path: '/app' }));

    const result = await listMarkersForUrl('https://example.com/app/page');
    expect(result.map((m) => m.id)).toEqual(['prefix']);
    expect(result[0].name).toBe('Login Button');
    expect(result[0].selector).toBe('#login');
  });

  test('honours exact, prefix, and host match modes', async () => {
    await seeder.put('markers', marker({ id: 'exact', matchType: 'exact', path: '/app/page' }));
    await seeder.put('markers', marker({ id: 'prefix', matchType: 'prefix', path: '/app' }));
    await seeder.put('markers', marker({ id: 'host', matchType: 'host', path: '/other' }));
    await seeder.put('markers', marker({ id: 'miss', matchType: 'exact', path: '/nope' }));

    const ids = (await listMarkersForUrl('https://example.com/app/page')).map((m) => m.id).sort();
    expect(ids).toEqual(['exact', 'host', 'prefix']);
  });

  test('returns nothing when no markers match the URL', async () => {
    await seeder.put(
      'markers',
      marker({
        id: 'other-host',
        matchType: 'host',
        host: 'other.test',
        origin: 'https://other.test',
      }),
    );

    expect(await listMarkersForUrl('https://example.com/app/page')).toEqual([]);
  });
});
