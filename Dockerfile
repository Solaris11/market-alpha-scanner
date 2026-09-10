FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip && \
    python -m pip install -r /app/requirements.txt

COPY . /app

# Build provenance. `.git` is in .dockerignore, so the image cannot work out
# which commit produced it -- it has to be told at build time. Without this the
# only evidence of staleness is the image's creation timestamp, which is a
# proxy: two builds minutes apart from different commits look identical.
#
# tools/ops/scanner-image-freshness.sh reads this file from OUTSIDE the image
# and compares it to the checkout. It deliberately does not live in here: a
# guard that ships inside the artifact it validates cannot detect a stale
# artifact, which is exactly how SNDK went missing for 35 days
# (docs/ops/rca-sndk-missing-from-scanner-20260910.md).
#
# Unset args leave "unknown", which the freshness check reports rather than
# treating as a pass.
ARG SCANNER_BUILD_COMMIT=unknown
ARG SCANNER_BUILD_TIME=unknown
RUN printf 'commit=%s\nbuilt_at=%s\n' "$SCANNER_BUILD_COMMIT" "$SCANNER_BUILD_TIME" > /app/.build-stamp

RUN mkdir -p /app/scanner_output /app/logs

CMD ["streamlit", "run", "dashboard.py", "--server.address=0.0.0.0", "--server.port=8501"]
