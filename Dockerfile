FROM node:18-alpine@sha256:c7620fdecfefb96813da62519897808775230386f4c8482e972e37b8b18cb460
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
