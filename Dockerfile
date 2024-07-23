FROM node:18-alpine@sha256:1b32fb34435dc694e244b84fcfdf2642b004014170462d69c5c3ac9833617754
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
