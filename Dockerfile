FROM node:18-alpine@sha256:e37da457874383fa9217067867ec85fe8fe59f0bfa351ec9752a95438680056e
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
