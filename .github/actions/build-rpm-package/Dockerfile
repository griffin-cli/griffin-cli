# Build the Node app.
FROM node:lts-alpine as builder

WORKDIR /app

COPY ./ /app/

RUN npm install && \
    npm run build

FROM fedora:latest

RUN yum install -y rpm-build rpmdevtools gcc rpm-sign pinentry && \
    sudo yum install https://rpm.nodesource.com/pub_20.x/nodistro/repo/nodesource-release-nodistro-1.noarch.rpm -y && \
    sudo yum install nodejs -y --setopt=nodesource-nodejs.module_hotfixes=1

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules

ENTRYPOINT [ "node", "/app/dist/index.js" ]
