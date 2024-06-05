FROM node:18-alpine@sha256:cf350f8bb497d82471f1f735df5d6d3321138be3b9f7f84ad10a4b86a438bbc3
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
