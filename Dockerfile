FROM node:18-alpine@sha256:80338ff3fc4e989c1d5264a23223cec1c6014e812e584e825e78d1a98d893381
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
