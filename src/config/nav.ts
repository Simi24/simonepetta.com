export interface Section {
  href: string;
  label: string;
  labelEn: string;
}

/**
 * Nav sections. A section is added here in the same change that adds its page,
 * so the shell never links to a 404 (SPEC.md §5.1). `labelEn` is the label shown
 * on `/en/`, whose own nav must carry no Italian labels (SPEC.md §8).
 */
export const sections: readonly Section[] = [{ href: '/letture/', label: 'Letture', labelEn: 'Readings' }];
