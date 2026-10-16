FROM rust:1.87-bookworm AS build
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY .cargo .cargo
COPY src ./src
RUN cargo build --release --locked
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/* && useradd -u 10001 -m atlas
WORKDIR /app
COPY --from=build /build/target/release/starlink-atlas /usr/local/bin/starlink-atlas
COPY static ./static
RUN mkdir /app/data && chown atlas:atlas /app/data
USER atlas
ENV BIND=0.0.0.0:3000
EXPOSE 3000
VOLUME /app/data
CMD ["starlink-atlas"]
