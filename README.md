griffin-cli
=================

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![GitHub license](https://img.shields.io/github/license/c1moore/griffin)](https://github.com/c1moore/griffin/blob/main/LICENSE)

- [griffin-cli](#griffin-cli)
- [Installation](#installation)
  - [Mac](#mac)
  - [Linux](#linux)
  - [Windows](#windows)
- [AWS Configuration](#aws-configuration)
- [Migrating to griffin](#migrating-to-griffin)
  - [Chamber](#chamber)
  - [Dotenv](#dotenv)
- [Usage](#usage)

Griffin is a tool for managing all of your config.  Unlike other tools, such as chamber, that just pull the latest version of parameters from a secret service, Griffin allows you to lock a specific version of your config to a specific version of your code.  This effectively decouples your deployments from your config, allowing you to fully automate

- Canary deployments
- Ring deployments
- Rollbacks

without having to coordinate updating your config.

# Installation

If you have Node installed, you can install using `npm`:

```sh
npm install --global griffin-cli
```

or just use npx

```sh
npx griffin-cli
```

Alternatively, you can install using one of the following methods.

## Mac

## Linux

## Windows

# AWS Configuration

Griffin uses the official [AWS SDK](https://github.com/aws/aws-sdk-js-v3) to access AWS.  To use AWS-backed stores, you must [configure both your credentials and region](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html).

# Migrating to griffin

## Chamber

Chamber is an awesome tool, but it's limited by not locking versions.  This makes rollbacks and canary/ring deployments difficult to manage.  The good news is griffin supports migrating off of chamber easy.  Just run

```sh
griffin ssm import -c chamber-service-1 -c chamber-service-2
```

If you want griffin to behave the same as chamber and always pull the latest value without locking the version and ignoring missing values, use this command instead

```sh
griffin ssm import --always-use-latest --allow-missing-value -c chamber-service-1 -c chamber-service-2
```

## Dotenv

Dotenv is another great tool, but you'll likely need a separate tool to manage secrets.  Griffin makes it easy to manage both in the same place.  To move a dotenv file to griffin, just run

```sh
griffin ssm import -d ./path/to/.env
```

# Usage
<!-- usage -->
```sh-session
$ npm install -g griffin-cli
$ griffin COMMAND
running command...
$ griffin (--version)
griffin-cli/0.1.0 linux-x64 node-v18.17.0
$ griffin --help [COMMAND]
USAGE
  $ griffin COMMAND
...
```
<!-- usagestop -->
