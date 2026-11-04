# ATV fork: build image used by compose.yaml (docker compose build)
#
# Stages
#   data     installs dependencies, regenerates the geographic JSON from custom/region.config.mjs
#            and verifies the Regional map, then builds the static site into dist/
#   export   just the generated JSON files (docker buildx build --target export --output ...)
#   runtime  nginx serving dist/ (same as upstream's Dockerfile)
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

FROM nginx:alpine AS runtime

LABEL org.opencontainers.image.title="ws4kp-atv" \
	org.opencontainers.image.description="WeatherStar 4000+ customized for ATV (Arkansas)" \
	org.opencontainers.image.source="https://github.com/nathan-sain/ws4kp"

COPY static-env-handler.sh /docker-entrypoint.d/01-static-env-handler.sh
RUN chmod +x /docker-entrypoint.d/01-static-env-handler.sh

COPY --from=data /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s --start-period=15s --retries=3 \
	CMD wget -q --spider "http://127.0.0.1:8080/manifest.json" || exit 1

CMD ["nginx", "-g", "daemon off;"]
