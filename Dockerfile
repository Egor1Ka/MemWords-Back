FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
# Port is provided at runtime via .env.api (PORT=9000); EXPOSE is documentation.
EXPOSE 9000

CMD ["node", "src/app.js"]
