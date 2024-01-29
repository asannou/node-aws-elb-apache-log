FROM node:18-alpine@sha256:0085670310d2879621f96a4216c893f92e2ded827e9e6ef8437672e1bd72f437
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
