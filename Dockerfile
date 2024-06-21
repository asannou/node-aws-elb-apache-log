FROM node:18-alpine@sha256:c2cb18b69a407b3479e7e6b56e16077f5363aea94384bd23fc332b6a74ae2126
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
