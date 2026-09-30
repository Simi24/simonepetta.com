export const site = {
  author: 'Simone Petta',
  lang: 'it',
  social: {
    github: 'https://github.com/Simi24',
    linkedin: 'https://www.linkedin.com/in/simone-paolo-petta/',
  },
  analytics: {
    /**
     * Cloudflare Web Analytics public site token (SPEC.md §12.4), committed here once the
     * author creates the site by hand in the dashboard. Empty for now, so the beacon never
     * renders. Overridable by env only so build-based tests can exercise the "token set" case
     * without a real one committed (SPEC.md #30); production never sets this env var.
     */
    cloudflareBeaconToken: process.env['CLOUDFLARE_BEACON_TOKEN'] ?? '',
  },
  appunti: {
    /**
     * Removal contact for third-party course material (SPEC.md §7.1, §7.2): empty until the
     * author provides one, shown on course pages as a placeholder meanwhile. Overridable by
     * env only so build-based tests can exercise the "contact set" case without a real one
     * committed, the same pattern as the analytics token above.
     */
    removalContact: process.env['APPUNTI_REMOVAL_CONTACT'] ?? '',
    // University and degree programme names (SPEC.md §7.2).
    university: 'Università degli Studi di Milano',
    degreeProgrammes: {
      triennale: 'Corso di Laurea in Informatica per la comunicazione digitale',
      magistrale: 'Corso di Laurea Magistrale in Informatica',
    },
  },
} as const;
