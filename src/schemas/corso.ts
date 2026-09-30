import { z } from 'astro/zod';

export const TIPI_CORSO = ['corso', 'tesi'] as const;
export type TipoCorso = (typeof TIPI_CORSO)[number];

export const LIVELLI = ['triennale', 'magistrale'] as const;
export type Livello = (typeof LIVELLI)[number];

export const FONTI_MANIFESTO = ['overleaf', 'github', 'locale', 'scansione'] as const;
export type FonteManifesto = (typeof FONTI_MANIFESTO)[number];

/** `anno` bounds per level (SPEC.md §7.2): 1 to 3 for triennale, 1 to 2 for magistrale. */
const ANNO_MAX: Record<Livello, number> = { triennale: 3, magistrale: 2 };

const corsoShape = z
  .object({
    titolo: z.string().min(1),
    tipo: z.enum(TIPI_CORSO),
    livello: z.enum(LIVELLI),
    anno: z.number().int().positive().optional(),
    // Academic year ("2019/20") for a corso; for a tesi this field holds the defense year instead
    // (SPEC.md §7.2), a single four-digit year.
    aa: z.string().min(1),
    fonte: z.enum(FONTI_MANIFESTO),
    pubblicato: z.boolean(),
    motivo: z.string().min(1).optional(),
    fonti: z.array(z.string().min(1)).optional(),
  })
  .strict();

/**
 * Validates a course (or thesis) manifest against SPEC.md §7.2: strict (unknown keys fail),
 * plus the per-`tipo`/`livello` rules `.strict()` alone can't express. State is derived
 * elsewhere (`src/lib/corso-stato.ts`), never declared here.
 */
export const corsoSchema = corsoShape.superRefine((data, ctx) => {
  if (data.tipo === 'corso') {
    if (data.anno === undefined) {
      ctx.addIssue({ code: 'custom', path: ['anno'], message: 'obbligatorio per il tipo "corso"' });
    } else {
      const max = ANNO_MAX[data.livello];
      if (data.anno > max) {
        ctx.addIssue({ code: 'custom', path: ['anno'], message: `per il livello "${data.livello}" deve essere tra 1 e ${max}` });
      }
    }
    if (!/^\d{4}\/\d{2}$/.test(data.aa)) {
      ctx.addIssue({ code: 'custom', path: ['aa'], message: 'per un corso deve essere un anno accademico nel formato "2019/20"' });
    }
  } else {
    if (!/^\d{4}$/.test(data.aa)) {
      ctx.addIssue({ code: 'custom', path: ['aa'], message: "per una tesi deve essere l'anno di discussione, a quattro cifre" });
    }
  }

  if (!data.pubblicato && data.motivo === undefined) {
    ctx.addIssue({ code: 'custom', path: ['motivo'], message: 'obbligatorio quando "pubblicato" è false' });
  }
});

export type Corso = z.infer<typeof corsoSchema>;

/** Raised when a course's manifest breaks a rule above. */
export class CorsoSchemaError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join('; '));
    this.name = 'CorsoSchemaError';
    this.issues = issues;
  }
}

/** Framework-agnostic entry point for tests and the content collection: throws `CorsoSchemaError` on invalid input. */
export function parseCorso(input: unknown): Corso {
  const result = corsoSchema.safeParse(input);
  if (!result.success) {
    throw new CorsoSchemaError(
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
