export interface Project {
  name: string;
  href: string;
}

const github = (name: string): Project => ({ name, href: `https://github.com/Simi24/${name}` });

/** Quits links to the live app, not to its repository (Quits SPEC.md §13). */
const quits: Project = { name: 'Quits', href: 'https://quits.simonepetta.com/' };

/** Open source projects listed on the about page (SPEC.md §8): name and link are facts, all public repos, except Quits which is a live app. */
export const projects: readonly Project[] = [
  quits,
  ...['dynantic', 'ralph-gh', 'rideIt', 'SaltinoInterpreter', 'kafka-secure-ha-cluster'].map(github),
];
