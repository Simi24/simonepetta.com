import { makeTempDir } from '../../support/temp-root.ts';

makeTempDir('fail-');
throw new Error('a run that fails with a temp dir in hand');
