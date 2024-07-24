FROM node:18-alpine@sha256:17514b20acef0e79691285e7a59f3ae561f7a1702a9adc72a515aef23f326729
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
