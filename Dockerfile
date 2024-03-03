FROM node:lts-alpine

ARG GRIFFIN_CLI_VERSION

RUN npm install -g griffin-cli@${GRIFFIN_CLI_VERSION}
