FROM node:24.22.0-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
# Cypress roda no terminal do desenvolvedor; não é necessário baixar seu binário no container web.
RUN CYPRESS_INSTALL_BINARY=0 npm install --no-audit --no-fund
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
