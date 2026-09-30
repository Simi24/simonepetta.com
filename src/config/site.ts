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
} as const;
