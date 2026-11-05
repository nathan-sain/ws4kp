# ATV fork: build image used by compose.yaml (docker compose build)
#
# Stages
#   data     installs dependencies, regenerates the geographic JSON from custom/region.config.mjs
#            and verifies the Regional map, then builds the static site into dist/
#   export   just the generated JSON files (docker buildx build --target export --output ...)
#   runtime  the Node server in production mode (NODE_ENV=production, DIST=1), as upstream's
#            Dockerfile.server: serves dist/ and runs the caching proxy for weather.gov, radar,
#            SPC and the other data sources, so every screen shares one cache
#
# Build args
#   REFRESH_POINTS=1  ignore custom/data/points-cache.json and look every NWS grid point up again

FROM node:24-alpine AS data
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG REFRESH_POINTS=0
RUN if [ "$REFRESH_POINTS" = "1" ]; then echo '{}' > custom/data/points-cache.json; fi \
	# travelcities.json, regionalcities.json, stations.json, atv-region.mjs; fails if a grid point can't be found
	&& node custom/scripts/build-data.mjs \
	# fails if a community would be missing or duplicated on the Regional map
	&& node custom/scripts/check-regional.mjs \
	# compiles the theme and copies the JSON, fonts and images into dist/
	&& npm run build \
	&& rm dist/playlist.json

FROM scratch AS export
COPY --from=data /app/datagenerators/output/travelcities.json /app/datagenerators/output/regionalcities.json /app/datagenerators/output/stations.json /
COPY --from=data /app/custom/data/points-cache.json /

FROM node:24-alpine AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="ws4kp-atv" \
	org.opencontainers.image.description="WeatherStar 4000+ customized for ATV (Arkansas)" \
	org.opencontainers.image.source="https://github.com/nathan-sain/ws4kp"

# production server: pre-built files from dist/ plus the caching proxy (index.mjs)
ENV NODE_ENV=production \
	DIST=1

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# only what index.mjs reads in DIST mode
COPY index.mjs ./
COPY proxy ./proxy
COPY src ./src
COPY views ./views
COPY server/music ./server/music
COPY --from=data /app/datagenerators/output/travelcities.json /app/datagenerators/output/regionalcities.json /app/datagenerators/output/stations.json ./datagenerators/output/
COPY --from=data /app/dist ./dist

# the app only reads files, so the unprivileged user from the node image is enough
USER node

EXPOSE 8080
# -Y off: a local check must not go through an HTTP proxy the host may set for outbound requests
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
	CMD wget -q -Y off --spider "http://127.0.0.1:${WS4KP_PORT:-8080}/manifest.json" || exit 1

CMD ["node", "index.mjs"]
