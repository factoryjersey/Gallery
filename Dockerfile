# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.19.3
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# poppler-utils supplies `pdfimages` (and `pdftoppm`) — used at runtime
# by the PDF-ingest pipeline to pull embedded photos out of archived
# print editions. Small install (~5MB), no Node dependency required.
# Installed in the base layer so both build and final stages have it.
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y poppler-utils && \
    rm -rf /var/lib/apt/lists/*


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Client-side env vars (Vite inlines anything prefixed VITE_* at build
# time). Railway passes service variables as Docker build args
# automatically, but they only become readable to the `npm run build`
# step if we promote them to ENV here. Add a new ARG/ENV pair for any
# future VITE_* var you want baked into the bundle.
ARG VITE_GA4_MEASUREMENT_ID
ENV VITE_GA4_MEASUREMENT_ID=$VITE_GA4_MEASUREMENT_ID

# Build application
RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
