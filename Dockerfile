FROM node:18-alpine@sha256:40b5a09847e38ed37419c348797cbb5401ee523a0333a4f6dcdc202b02a53553
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
RUN npm config set update-notifier false
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
