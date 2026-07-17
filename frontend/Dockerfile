FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Non-root user for security
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "dev"]
