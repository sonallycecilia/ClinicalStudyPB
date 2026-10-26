FROM node:24.22.0-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start:dev"]
