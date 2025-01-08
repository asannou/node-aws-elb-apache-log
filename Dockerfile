FROM node:18-alpine@sha256:93d56eb78836f8faaf1cdc14b5bc1127fb54fd2a1c6c2790aafbef8d45528ae9
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
