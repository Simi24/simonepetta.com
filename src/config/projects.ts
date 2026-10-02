export interface Project {
  name: string;
  href: string;
}

const github = (name: string): Project => ({ name, href: `https://github.com/Simi24/${name}` });

/** Open source projects listed on the about page (SPEC.md §8): name and link are facts, all public repos. */
export const projects: readonly Project[] = [
  'dynantic',
  'ralph-gh',
  'rideIt',
  'SaltinoInterpreter',
  'kafka-secure-ha-cluster',
].map(github);
