# Build the Node app.
FROM node:lts-alpine as builder

WORKDIR /app

COPY ./ /app/

RUN npm install && \
    npm run build

FROM fedora:latest

RUN yum install -y rpm-build rpmdevtools gcc rpm-sign pinentry && \
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && \
    yum install -y nodejs

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules

ENTRYPOINT [ "node", "/app/dist/index.js" ]
