/** A `lstlisting` of `lines` lines holding `characters` visible characters in all, the size the detector measures. */
const listing = (lines: number, characters: number): string => {
  const rows = Array.from({ length: lines }, (_, i) => 'x'.repeat(Math.floor(characters / lines) + (i < characters % lines ? 1 : 0)));
  return `\\begin{lstlisting}\n${rows.join('\n')}\n\\end{lstlisting}\n`;
};

/** LaTeX source matching the fixture `gpu-Ch1.html`: one figure and three code listings (3, 1 and 9 lines; 61, 48 and 126 characters). */
export const gpuCh1Source = (figure: string): string =>
  `\\chapter{Introduzione}\n\\includegraphics{${figure}}\n${listing(3, 61)}${listing(1, 48)}${listing(9, 126)}`;
