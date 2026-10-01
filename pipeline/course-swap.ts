import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Replaces several files and folders of a course together, so a conversion never leaves it
 * half-updated (`build/`, `<slug>.pdf` and `meta.json` must agree), even if the process dies
 * in the middle.
 *
 * Every new version is first written beside its target as `<name>.next`. A journal file then
 * records what existed, the old versions are renamed to `<name>.old`, the new ones renamed
 * into place, and the `.old` copies deleted. `recoverInterruptedSwap` (run at the start of
 * every swap, and by the conversion command) reads a leftover journal: if every `.next` was
 * installed the swap had succeeded and the `.old` copies are discarded, otherwise it is rolled
 * back to the old versions. Either way the course ends up entirely old or entirely new.
 */

export interface Staged {
  /** The target's name inside the course folder, e.g. `build` or `meta.json`. */
  name: string;
  /** Writes the new version at the given path (a file, or a folder it creates). */
  write: (path: string) => void;
}

export interface SwapOps {
  rename: (from: string, to: string) => void;
}

const JOURNAL = '.swap-journal.json';

interface Journal {
  targets: { name: string; hadOld: boolean }[];
}

const remove = (path: string): void => rmSync(path, { recursive: true, force: true });

export function recoverInterruptedSwap(dir: string): void {
  const journalPath = join(dir, JOURNAL);
  if (!existsSync(journalPath)) return;
  let journal: Journal | undefined;
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal;
  } catch {
    // The process died while writing the journal, before any rename: nothing to undo.
  }
  if (journal) {
    const installedAll = journal.targets.every(({ name }) => !existsSync(join(dir, `${name}.next`)));
    for (const { name, hadOld } of journal.targets) {
      const target = join(dir, name);
      const old = `${target}.old`;
      if (!installedAll) {
        if (existsSync(old)) {
          remove(target);
          renameSync(old, target);
        } else if (!hadOld) {
          remove(target);
        }
        remove(`${target}.next`);
      } else {
        remove(old);
      }
    }
  }
  remove(journalPath);
}

export function swapIn(dir: string, entries: readonly Staged[], ops: SwapOps = { rename: renameSync }): void {
  recoverInterruptedSwap(dir);

  const targets = entries.map(({ name }) => ({ name, hadOld: existsSync(join(dir, name)) }));
  try {
    for (const entry of entries) {
      remove(join(dir, `${entry.name}.next`));
      entry.write(join(dir, `${entry.name}.next`));
    }
  } catch (error) {
    for (const entry of entries) remove(join(dir, `${entry.name}.next`));
    throw error;
  }

  writeFileSync(join(dir, JOURNAL), JSON.stringify({ targets } satisfies Journal));
  for (const { name, hadOld } of targets) {
    if (hadOld) ops.rename(join(dir, name), join(dir, `${name}.old`));
  }
  for (const { name } of targets) ops.rename(join(dir, `${name}.next`), join(dir, name));
  for (const { name } of targets) remove(join(dir, `${name}.old`));
  remove(join(dir, JOURNAL));
}
