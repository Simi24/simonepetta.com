import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT_ENV = 'SIMONEPETTA_TEST_TMP';
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/**
 * The one temp root of a test run: `simonepetta-test-*` under the OS temp dir, removed when the
 * process exits, fails or is interrupted. Child processes that inherit the environment (Playwright
 * workers) reuse it, so the process that created it is the only one that removes it.
 */
function tempRoot(): string {
  const inherited = process.env[ROOT_ENV];
  if (inherited) {
    mkdirSync(inherited, { recursive: true });
    return inherited;
  }
  const root = mkdtempSync(join(tmpdir(), 'simonepetta-test-'));
  process.env[ROOT_ENV] = root;
  const remove = (): void => rmSync(root, { recursive: true, force: true });
  process.on('exit', remove);
  for (const signal of SIGNALS) {
    process.on(signal, () => {
      remove();
      // A runner that handles the signal itself (Playwright) shuts down and exits on its own.
      if (process.listenerCount(signal) === 1) process.exit(128 + (signal === 'SIGINT' ? 2 : signal === 'SIGTERM' ? 15 : 1));
    });
  }
  return root;
}

/** A fresh directory inside the process's temp root, deleted with it. */
export function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tempRoot(), prefix));
}
