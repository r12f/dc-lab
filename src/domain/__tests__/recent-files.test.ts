import { describe, expect, it } from 'vitest';
import { MAX_RECENT, mergeRecent, type RecentFile } from '../../io/recent-files';

const h = (name: string) => ({ name }) as unknown as FileSystemFileHandle;
const same = async (a: FileSystemFileHandle, b: FileSystemFileHandle) => a.name === b.name;
const entry = (name: string, usedAt: number): RecentFile => ({ name, handle: h(name), usedAt });

describe('recent files list', () => {
  it('newest first, a reopened file moves to the top once', async () => {
    let l: RecentFile[] = [];
    l = await mergeRecent(l, entry('a', 1), same);
    l = await mergeRecent(l, entry('b', 2), same);
    l = await mergeRecent(l, entry('a', 3), same);
    expect(l.map((x) => [x.name, x.usedAt])).toEqual([['a', 3], ['b', 2]]);
  });
  it(`keeps at most ${MAX_RECENT}`, async () => {
    let l: RecentFile[] = [];
    for (let i = 0; i < MAX_RECENT + 5; i++) l = await mergeRecent(l, entry(`f${i}`, i), same);
    expect(l).toHaveLength(MAX_RECENT);
    expect(l[0].name).toBe(`f${MAX_RECENT + 4}`);
  });
});
