FROM node:alpine
WORKDIR /usr/src/app
COPY package.json .
COPY index.js .
RUN npm install
ENTRYPOINT ["npm", "start", "-s"]
