FROM node:18-alpine@sha256:291dbe40243c47dc85fdc3690bc8edf17891dd02eaba36c577fbe73a45b97334
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
