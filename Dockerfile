# Stage 1: build the static site
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# The Mapbox token is read at build time and baked into the client JavaScript.
# It is a public (pk.) token, so restrict it by URL in the Mapbox dashboard.
ARG NEXT_PUBLIC_MAPBOX_TOKEN
RUN test -n "$NEXT_PUBLIC_MAPBOX_TOKEN" || (echo "NEXT_PUBLIC_MAPBOX_TOKEN build arg is required" && exit 1)

# src/utils/api.js locates public/tiles via process.env.PWD
ENV PWD=/app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: serve the exported files with nginx
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80
