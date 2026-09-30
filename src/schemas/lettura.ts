import { z } from 'astro/zod';

/** The three states a book can be in (SPEC.md §6.1). One vocabulary, reused for grouping and presentation. */
export const STATI_LETTURA = ['in-corso', 'letto', 'abbandonato'] as const;
export type StatoLettura = (typeof STATI_LETTURA)[number];

/** Accepts a quoted ISO date string or the `Date` YAML parses an unquoted date into, and validates it's a real calendar date. */
const isoDate = z.preprocess(
  (value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value),
  z.iso.date(),
);

const letturaShape = z
  .object({
    titolo: z.string().min(1),
    autore: z.string().min(1),
    stato: z.enum(STATI_LETTURA),
    anno_opera: z.number().int().positive().optional(),
    iniziato: isoDate.optional(),
    finito: isoDate.optional(),
    voto: z.number().min(1).max(5).multipleOf(0.5).optional(),
    pagine: z.number().int().positive().optional(),
    nota: z.string().min(1).optional(),
  })
  .strict();

/**
 * Validates a book's frontmatter against SPEC.md §6.1: strict (unknown keys fail), plus the
 * per-`stato` rules `.strict()` alone can't express. The single source shared by the content
 * collection and the writing desk (SPEC.md §6.4).
 */
export const letturaSchema = letturaShape.superRefine((data, ctx) => {
  if (data.stato === 'letto' && data.finito === undefined) {
    ctx.addIssue({ code: 'custom', path: ['finito'], message: '"finito" è obbligatorio per stato "letto"' });
  }
  if (data.stato === 'in-corso' && data.finito !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['finito'], message: '"finito" non è ammesso per stato "in-corso"' });
  }
  if (data.stato === 'in-corso' && data.voto !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['voto'], message: '"voto" non è ammesso per stato "in-corso"' });
  }
});

export type Lettura = z.infer<typeof letturaSchema>;

/** Raised when a book's frontmatter breaks a rule above. */
export class LetturaSchemaError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join('; '));
    this.name = 'LetturaSchemaError';
    this.issues = issues;
  }
}

/** Framework-agnostic entry point for the writing desk and for tests: throws `LetturaSchemaError` on invalid input. */
export function parseLettura(input: unknown): Lettura {
  const result = letturaSchema.safeParse(input);
  if (!result.success) {
    throw new LetturaSchemaError(result.error.issues.map((issue) => issue.message));
  }
  return result.data;
}
