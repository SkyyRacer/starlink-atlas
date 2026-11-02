FROM rust:1.87-bookworm AS build
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY .cargo .cargo
COPY src ./src
COPY resources/*.json ./resources/
RUN cargo build --release --locked
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv && rm -rf /var/lib/apt/lists/* && useradd -u 10001 -m atlas
WORKDIR /app
COPY scripts/history-requirements.txt ./scripts/history-requirements.txt
RUN python3 -m venv /opt/atlas-python && /opt/atlas-python/bin/pip install --no-cache-dir -r scripts/history-requirements.txt
COPY --from=build /build/target/release/starlink-atlas /usr/local/bin/starlink-atlas
COPY --from=build /build/resources ./resources
COPY static ./static
COPY scripts ./scripts
COPY deploy ./deploy
COPY data-seed ./data-seed
RUN mkdir -p /app/target/release && ln -s /usr/local/bin/starlink-atlas /app/target/release/starlink-atlas
RUN mkdir -p /app/data /app/backups && chown -R atlas:atlas /app/data /app/backups /app/static/ephemerides && cp /app/static/crew-archive.json /app/crew-archive-seed.json && rm /app/static/crew-archive.json && ln -s /app/data/generated/crew-archive.json /app/static/crew-archive.json
USER atlas
ENV PATH="/opt/atlas-python/bin:$PATH"
ENV BIND=0.0.0.0:3000
ENV DATA_DIR=/app/data HISTORY_DIR=/app/data/history
EXPOSE 3000
VOLUME /app/data
ENTRYPOINT ["sh", "/app/deploy/oracle/entrypoint.sh"]
CMD ["starlink-atlas"]
