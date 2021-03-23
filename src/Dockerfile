FROM node:15.11

WORKDIR /src
COPY package.json ./package.json
COPY yarn.lock ./yarn.lock
COPY node_modules/ ./node_modules/

RUN yarn install

COPY dist/ /src/dist
WORKDIR /src/dist

CMD ["node", "index.js"]
