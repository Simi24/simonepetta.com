export interface Section {
  href: string;
  label: string;
  lang?: 'it' | 'en';
}

/**
 * Nav sections. A section is added here in the same change that adds its page,
 * so the shell never links to a 404 (SPEC.md §5.1).
 */
export const sections: readonly Section[] = [{ href: '/letture/', label: 'Letture' }];
