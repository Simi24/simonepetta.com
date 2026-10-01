import { parseCorso, type Corso } from '../src/schemas/corso.ts';

/**
 * Reads a course's `corso.yaml` through the same schema the site uses (`parseCorso`), so the
 * checks and the site never disagree about what a manifest says. The manifests are flat
 * (scalars and one list of strings), so this reads just that and refuses any other line:
 * no YAML dependency (AGENTS.md). Scalars are typed as YAML does (`true`, numbers, quoted
 * strings), so a `"true"` in quotes stays a string and the schema rejects it.
 */

function scalar(raw: string): unknown {
  const value = raw.replace(/\s+#.*$/, '').trim();
  const quoted = /^"(.*)"$|^'(.*)'$/.exec(value);
  if (quoted) return quoted[1] ?? quoted[2];
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

export function readCorsoManifest(text: string): Corso {
  const data: Record<string, unknown> = {};
  let list: unknown[] | undefined;
  for (const [index, line] of text.split('\n').entries()) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && list) {
      list.push(scalar(item[1]!));
      continue;
    }
    const pair = /^([A-Za-z][\w-]*):(?:\s+(.*))?$/.exec(line);
    if (!pair) throw new Error(`corso.yaml line ${index + 1} is not a "key: value" line: ${line}`);
    list = undefined;
    if (pair[2] === undefined || pair[2].trim() === '') {
      list = [];
      data[pair[1]!] = list;
    } else {
      data[pair[1]!] = scalar(pair[2]);
    }
  }
  return parseCorso(data);
}
