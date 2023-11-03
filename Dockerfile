FROM node:18

RUN npm install -g griffin-cli@${GRIFFIN_CLI_VERSION}
