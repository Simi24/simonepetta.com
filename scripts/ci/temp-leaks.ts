import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Caches Node and Playwright keep in `TMPDIR` on purpose: not a test's leftovers.
const TOOL_CACHES = /^(node-compile-cache|playwright-transform-cache)/;

/**
 * Runs a command with its own empty `TMPDIR` and returns what it left in there, so a leak can
 * fail a check without touching (or counting) any other process's temp dirs.
 * With `signalWhenOutput`, the command gets `signal` as soon as it prints that text (an interrupted run).
 */
export async function runAndListLeftovers(
  command: string,
  args: readonly string[],
  options: { signal?: NodeJS.Signals; signalWhenOutput?: string } = {},
): Promise<{ leftovers: string[]; exitCode: number | null }> {
  const sandbox = mkdtempSync(join(tmpdir(), 'temp-leaks-'));
  try {
    // NODE_TEST_CONTEXT would make a nested `node --test` believe it is a test subprocess and run nothing.
    const { NODE_TEST_CONTEXT: _context, ...env } = process.env;
    const child = spawn(command, args, { env: { ...env, TMPDIR: sandbox }, stdio: ['ignore', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (options.signal && options.signalWhenOutput && output.includes(options.signalWhenOutput)) {
        child.kill(options.signal);
      }
    });
    const exitCode = await new Promise<number | null>((resolve) => child.on('close', resolve));
    return { leftovers: readdirSync(sandbox).filter((entry) => !TOOL_CACHES.test(entry)), exitCode };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error('usage: node scripts/ci/temp-leaks.ts <command> [args...]');
  const { leftovers, exitCode } = await runAndListLeftovers(command, args);
  if (leftovers.length > 0) {
    console.error(`${command} left ${leftovers.length} temp entr${leftovers.length === 1 ? 'y' : 'ies'}: ${leftovers.join(', ')}`);
    process.exit(1);
  }
  console.log(`no temp leftovers (exit code ${exitCode})`);
}
