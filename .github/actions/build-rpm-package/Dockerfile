# Build the Node app.
FROM node:lts-alpine as builder

WORKDIR /app

COPY ./ /app/

RUN npm install && \
    npm run build

FROM fedora:latest

RUN yum install -y rpm-build rpmdevtools gcc rpm-sign pinentry && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash && \
    export NVM_DIR="$HOME/.nvm" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    nvm install 20.9.0

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules

ENTRYPOINT [ "/bin/bash", "-c", "$HOME/.nvm/versions/node/v20.9.0/bin/node /app/dist/index.js" ]
