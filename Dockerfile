FROM asannou/library-node:alpine
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY index.js .
ENTRYPOINT ["npm", "start", "-s"]
