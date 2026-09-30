export interface Project {
  name: string;
  href: string;
}

/** Open source projects listed on the about page (SPEC.md §8): name and link are facts. */
export const projects: readonly Project[] = [{ name: 'dynantic', href: 'https://github.com/Simi24/dynantic' }];
