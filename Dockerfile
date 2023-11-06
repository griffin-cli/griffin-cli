FROM node:18

ARG GRIFFIN_CLI_VERSION

RUN npm install -g griffin-cli@${GRIFFIN_CLI_VERSION}
