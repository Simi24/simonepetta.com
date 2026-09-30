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
    // Just "optional integer" per SPEC.md §6.1: ancient works can predate year 0.
    anno_opera: z.number().int().optional(),
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
    ctx.addIssue({ code: 'custom', path: ['finito'], message: 'obbligatorio per lo stato "letto"' });
  }
  if (data.stato === 'in-corso' && data.finito !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['finito'], message: 'non ammesso per lo stato "in-corso"' });
  }
  if (data.stato === 'in-corso' && data.voto !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['voto'], message: 'non ammesso per lo stato "in-corso"' });
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
    throw new LetturaSchemaError(
      result.error.issues.map((issue) =>
        issue.code === 'unrecognized_keys'
          ? `campo sconosciuto: "${issue.keys.join('", "')}"`
          : issue.path.length > 0
            ? `il campo "${issue.path.join('.')}": ${issue.message}`
            : issue.message,
      ),
    );
  }
  return result.data;
}
