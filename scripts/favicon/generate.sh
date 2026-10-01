#!/bin/sh
# Regenerates the favicon files in public/ from the self-hosted Host Grotesk (SPEC.md §5.1):
# favicon.svg (glyph as a path), favicon.ico (16 + 32 px) and apple-touch-icon.png (180 px).
# Needs python3 (fontTools and brotli are installed in a throwaway venv) and Docker: the
# rasters come from rsvg-convert and ImageMagick in the `simonepetta-appunti` pipeline image.
set -eu
cd "$(dirname "$0")/../.."

venv="$(mktemp -d)"
trap 'rm -rf "$venv"' EXIT
${PYTHON:-python3} -m venv "$venv"
"$venv/bin/pip" install -q fonttools brotli
"$venv/bin/python" scripts/favicon/build-svg.py public/fonts/host-grotesk-latin.woff2 public/favicon.svg

docker image inspect simonepetta-appunti >/dev/null 2>&1 || docker build -t simonepetta-appunti pipeline
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD/public:/work" simonepetta-appunti sh -c '
  cd /work
  rsvg-convert -w 16 -h 16 favicon.svg -o /tmp/16.png
  rsvg-convert -w 32 -h 32 favicon.svg -o /tmp/32.png
  rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
  magick /tmp/16.png /tmp/32.png favicon.ico
'
