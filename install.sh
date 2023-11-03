#!/bin/bash

GRIFFIN_DIR_PATH=${GRIFFIN_DIR_PATH:-"$HOME/.griffin"}
UNKNOWN_ARCH_MSG="unknown or unsupported CPU arch, try installing manually or using npm install -g griffin-cli"

fail() {
  echo $1 >&2
  exit 1
}

if ! [ -x "$(command -v jq)" ]; then
  fail "jq is required, but not installed"
fi

if ! [ -x "$(command -v wget)" ]; then
  fail "wget is required, but not installed"
fi

CURRENT_VERSION=$(wget -q -O - https://api.github.com/repos/griffin-cli/griffin-cli/releases/latest | jq .tag_name -r)

if [[ "$OSTYPE" == "darwin"* ]]; then
  OS="darwin"

  RAW_ARCH=$(uname -m)
  if [[ "$RAW_ARCH" == "arm64" ]]; then
    ARCH="arm64"
  elif [[ "$RAW_ARCH" == "x86_64" || "$RAW_ARCH" == "x64" ]]; then
    ARCH="x64"
  else
    fail $UNKNOWN_ARCH_MSG
  fi
elif [[ "$OSTYPE" == "linux"* ]]; then
  OS="linux"

  RAW_ARCH=$(uname -m)
  if [[ "$RAW_ARCH" == "arm" || "$RAW_ARCH" == "armv8b" || "$RAW_ARCH" == "armv8l" ]]; then
    ARCH="arm"
  elif [[ "$RAW_ARCH" == "arm64" || "$RAW_ARCH" == "aarch64_be" || "$RAW_ARCH" == "aarch64" ]]; then
    ARCH="arm64"
  elif [[ "$RAW_ARCH" == "x86_64" || "$RAW_ARCH" == "x64" ]]; then
    ARCH="x64"
  else
    fail $UNKNOWN_ARCH_MSG
  fi
else
  fail "unknown or unsupported OS, try installing manually or using npm install -g griffin-cli"
fi

TAR_FILE_NAME=griffin-$CURRENT_VERSION-$OS-$ARCH.tar.gz

echo "Downloading tarball..."
wget -q https://github.com/griffin-cli/griffin-cli/releases/download/$CURRENT_VERSION/$TAR_FILE_NAME

echo "Extracting tarball..."
mkdir -p $GRIFFIN_DIR_PATH
tar -xf $TAR_FILE_NAME -C $GRIFFIN_DIR_PATH --strip-components 1

echo "Installing..."
sudo ln -sf $GRIFFIN_DIR_PATH/bin/griffin /usr/local/bin

echo "Cleaning up..."
rm -f $TAR_FILE_NAME
