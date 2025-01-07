FROM node:18-alpine@sha256:06f7bbbcec00dd10c21a3a0962609600159601b5004d84aff142977b449168e9
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
