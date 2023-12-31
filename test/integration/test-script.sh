#!/bin/bash

# This is a simple, but purposefully overcomplicated script to verify functionality of the
# exec command.  This allows us to test passing in arguments/flags to the target command.

FLAG="--name="
OUTPUT_FILE=test-script-output.txt

touch $OUTPUT_FILE

for var in "$@"; do
  ENV_VAR_NAME=$var

  if [[ $var =~ "$FLAG"* ]]; then
    ENV_VAR_NAME=${var#"$FLAG"}
  fi

  printenv $ENV_VAR_NAME | tee -a $OUTPUT_FILE > /dev/null
done