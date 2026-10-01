# Conversion image for appunti (SPEC.md §7.4): TeX Live + LaTeXML + BookML.
# Built on demand by `pipeline/appunti-convert.ts`; never part of the site build.
FROM texlive/texlive:latest

ARG BOOKML_VERSION=0.31.11

RUN apt-get update -qq \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    latexml libimage-magick-perl imagemagick librsvg2-bin make zip unzip curl ca-certificates poppler-utils webp \
  && rm -rf /var/lib/apt/lists/*

# BookML drives LaTeXML and latexmk from a `bookml/` directory next to the .tex files.
# The release is unpacked into /opt/bookml-release and copied into the work dir at run time.
RUN mkdir /opt/bookml-release \
  && curl -fsSL "https://github.com/vlmantova/bookml/releases/download/v${BOOKML_VERSION}/release.zip" -o /tmp/release.zip \
  && unzip -q /tmp/release.zip -d /opt/bookml-release \
  && rm /tmp/release.zip

WORKDIR /work
