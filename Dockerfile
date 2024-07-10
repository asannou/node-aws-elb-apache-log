FROM node:18-alpine@sha256:1edb14175eeb14a14a3abe059339cbd97a0bbb76b6a210d2bb395d63fa4bc4ef
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
