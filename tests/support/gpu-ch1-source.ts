const listing = (lines: number): string => `\\begin{lstlisting}\n${Array.from({ length: lines }, (_, i) => `riga ${i + 1}`).join('\n')}\n\\end{lstlisting}\n`;

/** LaTeX source matching the fixture `gpu-Ch1.html`: one figure and three code listings (3, 1 and 9 lines). */
export const gpuCh1Source = (figure: string): string =>
  `\\chapter{Introduzione}\n\\includegraphics{${figure}}\n${listing(3)}${listing(1)}${listing(9)}`;
