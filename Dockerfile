FROM node:18-alpine@sha256:5069da655539e2e986ce3fd1757f24a41b846958566c89ff4a48874434d73749
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
