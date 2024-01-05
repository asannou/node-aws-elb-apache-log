FROM node:18-alpine@sha256:0000000000000000000000000000000000000000000000000000000000000000
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
