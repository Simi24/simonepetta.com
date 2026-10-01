import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeTempDir } from '../../support/temp-root.ts';

// A run that is interrupted while it still holds a temp dir: prints "ready" once it does.
writeFileSync(join(makeTempDir('hang-'), 'file'), 'x');
console.log('ready');
setInterval(() => {}, 1000);
