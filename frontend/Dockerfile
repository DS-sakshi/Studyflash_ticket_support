FROM node:20-alpine

# Install yarn
RUN apk add --no-cache yarn

WORKDIR /app

COPY package.json ./
# Generate fresh lockfile (avoids private registry issues)
RUN yarn install

COPY . .

EXPOSE 3000

CMD ["yarn", "start"]
