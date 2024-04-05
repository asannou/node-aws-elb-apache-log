FROM node:18-alpine@sha256:c0ec76209d4ac70d67aa611a85196999a8d71e01945c8657f48142369bb27e96
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
