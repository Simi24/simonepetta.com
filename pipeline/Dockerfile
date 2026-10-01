# Conversion image for appunti (SPEC.md §7.4): TeX Live + LaTeXML + BookML.
# Built on demand by `pipeline/appunti-convert.ts`; never part of the site build.
# Pinned by digest (the multi-arch index of `latest` on 2026-10-01, TeX Live 2026): a TeX Live bump
# can break LaTeXML 0.8.8 (see bindings/tcolorbox.sty.ltxml), so it is upgraded on purpose.
FROM texlive/texlive@sha256:16c556aeb4095b47245fcd05db47061529e5df8fc8c04d97fb0f049055244526

ARG BOOKML_VERSION=0.31.11
ARG BOOKML_SHA256=4fbc791999578bec11ab5ddf034c1604568c093842d1dfa0a4238cf37c75f8c9

RUN apt-get update -qq \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    latexml libimage-magick-perl imagemagick librsvg2-bin make zip unzip curl ca-certificates poppler-utils webp \
  && rm -rf /var/lib/apt/lists/*

# BookML drives LaTeXML and latexmk from a `bookml/` directory next to the .tex files.
# The release is unpacked into /opt/bookml-release and copied into the work dir at run time.
RUN mkdir /opt/bookml-release \
  && curl -fsSL "https://github.com/vlmantova/bookml/releases/download/v${BOOKML_VERSION}/release.zip" -o /tmp/release.zip \
  && echo "${BOOKML_SHA256}  /tmp/release.zip" | sha256sum -c - \
  && unzip -q /tmp/release.zip -d /opt/bookml-release \
  && rm /tmp/release.zip

WORKDIR /work
