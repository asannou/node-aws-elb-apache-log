FROM node:18-alpine@sha256:02376a266c84acbf45bd19440e08e48b1c8b98037417334046029ab585de03e2
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
