#!/bin/sh
# Runs inside the container (pipeline/Dockerfile), in the work directory, after BookML.
# In:  figures-rasters.txt   one "<src> <name>" per line: an image LaTeXML copied, and its WebP name
#      figures-tikz/N.tex     one standalone document per TikZ picture, N from 1 in document order
# Out: figures-out/<name>      the images, re-encoded to WebP, at most 1600 px wide
#      figures-out/rasters.txt "<name> <width> <height>" per image
#      figures-out/N.svg       the pictures: standalone[dvisvgm] -> DVI -> dvisvgm
set -eu
HTML=auxdir/html/main
OUT=figures-out
mkdir -p "$OUT"
: > "$OUT/rasters.txt"

while read -r src name; do
  convert "$HTML/$src[0]" -auto-orient -resize '1600x>' -strip -quality 82 -define webp:method=6 "$OUT/$name"
  echo "$name $(identify -format '%w %h' "$OUT/$name")" >> "$OUT/rasters.txt"
done < figures-rasters.txt

if [ -d figures-tikz ]; then
  for tex in figures-tikz/*.tex; do
    [ -e "$tex" ] || continue # no picture: the glob stays literal
    id=$(basename "$tex" .tex)
    (cd figures-tikz && latex -interaction=nonstopmode -halt-on-error "$id.tex" > "$id.out" 2>&1) \
      || { echo "TikZ picture $id does not compile:" >&2; tail -30 "figures-tikz/$id.out" >&2; exit 1; }
    dvisvgm --no-fonts --exact-bbox --verbosity=1 "figures-tikz/$id.dvi" -o "$OUT/$id.svg"
  done
fi
