FROM node:22-alpine
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev
COPY *.mjs ./
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
CMD ["node", "server.mjs"]
