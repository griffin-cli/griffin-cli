<!-- omit from toc -->
griffin-cli
=================

[![NPM Version](https://img.shields.io/npm/v/griffin-cli)](https://www.npmjs.com/package/griffin-cli)
[![codecov](https://codecov.io/github/griffin-cli/griffin-cli/graph/badge.svg?token=6L9NEI261E)](https://codecov.io/github/griffin-cli/griffin-cli)
![Release Workflow](https://github.com/griffin-cli/griffin-cli/actions/workflows/release.yml/badge.svg?event=release)
[![GitHub license](https://img.shields.io/github/license/griffin-cli/griffin-cli)](https://github.com/griffin-cli/griffin-cli/blob/main/LICENSE)
[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)

<img src="https://raw.githubusercontent.com/griffin-cli/griffin-cli/main/assets/logo.svg" alt="griffin" align="right" width="350" />

Griffin is a tool for managing all of your config and supports using the underlying service store's versioning capabilities.  Unlike other tools that just pull the latest version of parameters from a secret service, Griffin allows you to lock a specific version of your config to a specific version of your code and tracks these versions as part of your source control.  This has several key benefits:

- 🕵 Changes to config become part of the normal code review process
- 🔒 Config changes are locked to the code changes they're dependent on
- 🌄 Follows best practices of [The Twelve-Factor App](https://12factor.net/config) methodology by storing config in the environment separate from the code


This effectively decouples your deployments from your config, allowing you to fully automate

- 🐦 Canary deployments
- 💍 Ring deployments
- 🛞 Rollbacks

without having to coordinate updating your config.

<!-- omit from toc -->
# Table of Contents
- [🌱 Installation](#-installation)
  - [Homebrew](#homebrew)
  - [Linux](#linux)
    - [apt](#apt)
    - [deb File](#deb-file)
    - [rpm File](#rpm-file)
  - [tarballs](#tarballs)
  - [Docker](#docker)
  - [Windows](#windows)
- [💻 Usage](#-usage)
- [🔢 Multiple Environments](#-multiple-environments)
- [🚀 Deploying](#-deploying)
  - [exec](#exec)
  - [export](#export)
- [☁ AWS Configuration](#-aws-configuration)
- [🚛 Migrating to griffin](#-migrating-to-griffin)
  - [Chamber](#chamber)
  - [dotenv](#dotenv)
  - [SSM](#ssm)
- [⬆️ Upgrade Guide](#️-upgrade-guide)
  - [v2](#v2)
- [🚏 Roadmap](#-roadmap)
- [📖 Commands](#-commands)
  - [`griffin autocomplete [SHELL]`](#griffin-autocomplete-shell)
  - [`griffin exec COMMAND [ARGS]`](#griffin-exec-command-args)
  - [`griffin export`](#griffin-export)
  - [`griffin help [COMMANDS]`](#griffin-help-commands)
  - [`griffin ssm config get`](#griffin-ssm-config-get)
  - [`griffin ssm config set`](#griffin-ssm-config-set)
  - [`griffin ssm create`](#griffin-ssm-create)
  - [`griffin ssm delete`](#griffin-ssm-delete)
  - [`griffin ssm history`](#griffin-ssm-history)
  - [`griffin ssm import`](#griffin-ssm-import)
  - [`griffin ssm read`](#griffin-ssm-read)
  - [`griffin ssm remove`](#griffin-ssm-remove)
  - [`griffin ssm update`](#griffin-ssm-update)
  - [`griffin ssm write`](#griffin-ssm-write)
  - [`griffin update [CHANNEL]`](#griffin-update-channel)
  - [`griffin version`](#griffin-version)

# 🌱 Installation

If you have Node installed, you can install using `npm`:

```sh
npm install --global griffin-cli
```

or just use npx

```sh
npx griffin-cli
```

Alternatively, you can install using the tar files attached to the [release](https://github.com/griffin-cli/griffin-cli/releases).

## Homebrew

To install using brew, use the following commands

```sh
brew tap griffin-cli/brew
brew update
brew install griffin
```

## Linux

### apt

If you're using a relatively modern version of Ubuntu, use the following to add the griffin repo and install it:

```sh
wget -qO- https://griffin-cli-prod.s3.amazonaws.com/pub.gpg | sudo tee /usr/share/keyrings/griffin.gpg
echo "deb [arch=amd64,arm64,armel signed-by=/usr/share/keyrings/griffin.gpg] https://griffin-cli-prod.s3.amazonaws.com/apt/ /" | sudo tee /etc/apt/sources.list.d/griffin.list > /dev/null
sudo apt update
sudo apt install -y griffin
```

On older versions, you can use `apt-key add` instead:

```sh
wget -qO- https://griffin-cli-prod.s3.amazonaws.com/pub.gpg | apt-key add -
echo "deb https://griffin-cli-prod.s3.amazonaws.com/apt/ /" | sudo tee /etc/apt/sources.list.d/griffin.list
sudo apt update
sudo apt install -y griffin
```

### deb File

1. Download the latest .deb file from the [releases page](https://github.com/griffin-cli/griffin-cli/releases).
2. Install the package

```sh
apt install /path/to/file.deb
```

### rpm File

1. Download the latest .rpm file from the [releases page](https://github.com/griffin-cli/griffin-cli/releases).
2. Install the package

```sh
yum install /path/to/file.rpm
# or
dnf install /path/to/file.rpm
```

## tarballs

Tarballs for Linux, Windows, and Mac are available on the [releases page](https://github.com/griffin-cli/griffin-cli/releases).  You can download and unpack manually or you can use the script below to install on most Linux and Mac machines:

```sh
wget -q -O - https://raw.githubusercontent.com/griffin-cli/griffin-cli/main/install.sh | sh
```

## Docker

To run commands in an interactive shell, run

```sh
docker run -it --rm griffincli/griffin-cli sh
```

To run a command directly, specify the command to run after `griffincli/griffin-cli`.  For example, to check the version

```sh
docker run -it --rm griffincli/griffin-cli griffin version
```

To use a specific version, you can add the version tag after the image.  For example, you could run

```sh
docker run -it --rm griffincli/griffin-cli:0.2.0 sh
```

To use in a Dockerfile, add the following line

```dockerfile
FROM griffincli/griffin-cli
```

## Windows

Download the executable available on the [release](https://github.com/griffin-cli/griffin-cli/releases) and run it.

# 💻 Usage

*See the [Commands](#-commands) section below for a full list of commands available.*

First, create your first secret:

```sh
griffin ssm create --env production -n /griffin-cli/prod/SUPERUSER_PASSWORD
```

This will prompt you to enter the value for the secret.  Alternatively, you could specify `-v` and enter the value as part of the command, but this will make your secret value available in your terminal history.

Now you can run a program and access the value of `API_KEY`

```sh
griffin exec --env production -- echo $API_KEY
```

If you wanted to review the changes made to the parameter over time, you could then run

```sh
griffin ssm history --env production -n /griffin-cli/prod/SUPERUSER_PASSWORD
```

This will list all the versions for `/griffin-cli/prod/SUPERUSER_PASSWORD`, including the value and who modified the parameter.

All of these examples leverage griffin's versioning capability; however, not all config should be locked to a specific version.  This limits your ability to make updates to your config as needed.  If your config is not dependent on your code, you can add the `--always-use-latest` (`-l` shorthand) flag when creating, importing, or updating your parameter:

```sh
griffin ssm import --env demo -n /griffin-cli/demo/API_KEY -l
```

Similarly, griffin will treat all parameters as required by default and fail when running `export` or `exec` if a required parameter is missing.  To mark a parameter as optional, you can specify the `--optional` flag when creating, importing, or updating your parameter:

```sh
griffin ssm config set -n /griffin-cli/OPTIONAL_VAR --optional
```


# 🔢 Multiple Environments

Multiple environments are supported natively.  Just add the `--env` (`-E` shorthand) flag supported by all commands and specify the environment name.  For example,

```sh
griffin ssm read --env production /path/var
```

If the `--env` flag is not specified, `default` is used instead.

If you would like to inject the config from multiple environments, you can do so by generating a single `.env` file and sourcing it.  Similar to the following

```sh
griffin export --env prod_global --format dotenv > .env
griffin export --env prod_service --format dotenv >> .env

source .env

./startup.sh
```

# 🚀 Deploying

There are 2 main ways to deploy an app using griffin.  You can use griffin directly using the `exec` command or you can export your config and inject it using whatever method you'd like.

## exec

To run a target command and inject your config into the environment, you can run the `exec` command:

```sh
griffin exec --env production -- /server
```

Make sure to replace `/server` with the appropriate command to execute.  Everything after the `--` is passed to the command specified.  For example, `--nodes=3` and `server.exe` are both passed to `startup.sh`

```sh
griffin exec --env production -- ./startup.sh --nodes=3 server.exe
```

By default, this method makes any existing environment variables available to the target command.  If you would like to make it so only the config defined in your griffin config file is made available, use `--pristine`:

```sh
griffin exec --env staging --pristine -- /server
```

## export

If you would like to export your config and inject it into your environment/app as you see fit, you can do so using `export`:

```sh
griffin export --env production --format dotenv --output .env
```

You could then `source` the generated dotenv file:

```sh
griffin export --env production --format dotenv --output tmp.env
source tmp.env
rm tmp.env
```

# ☁ AWS Configuration

Griffin uses the official [AWS SDK](https://github.com/aws/aws-sdk-js-v3) to access AWS.  To use AWS-backed stores, you must [configure both your credentials and region](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html).

If you're using a config file or credentials file with the `default` profile, you can run griffin without any additional configuration:

```sh
griffin ssm history /my/var
```

If you're using a named profile, you can use the `AWS_PROFILE` environment variable to tell the AWS SDK which profile to load

```sh
AWS_PROFILE=prod griffin ssm history /my/var
```

# 🚛 Migrating to griffin

## Chamber

Chamber is an awesome tool, but it's limited by not locking versions.  This makes rollbacks and canary/ring deployments difficult to manage.  The good news is griffin makes migrating off of chamber easy.  Just run

```sh
griffin ssm import -c chamber-service-1 -c chamber-service-2
```

If you want griffin to behave the same as chamber and always pull the latest value without locking the version and ignoring missing values, use this command instead

```sh
griffin ssm import --always-use-latest --optional -c chamber-service-1 -c chamber-service-2
```

## dotenv

dotenv is another great tool, but you'll likely need a separate tool to manage secrets.  Griffin makes it easy to manage both in the same place.  To move a dotenv file to griffin, just run

```sh
griffin ssm import -d ./path/to/.env
```

## SSM

To import your config directly from SSM, use the `--name` flag:

```sh
griffin ssm import -n /path/var
```

# ⬆️ Upgrade Guide

## v2

v2 introduced YAML-based config, replacing the legacy JSON-based config to improve readability and user-friendliness.  Config generated in earlier versions will no longer be usable by Griffin.

To help migrate, Griffin will automatically detect legacy JSON config files and ask you if you would like to automatically convert them to the new format.  If you choose to use this method, no work is needed by you to migrate your config.


# 🚏 Roadmap

Griffin is growing!  We're always looking for contributors and maintainers to help us get to where we're going.  Amongst other things, Griffin is looking to add support for

- Native package managers
  - yum - Improved support
- Other AWS services
  - S3
  - SecretsManager
- Other cloud providers
  - GCP
  - Azure

As Griffin continues to grow, we may also refactor into more of a plugin-based architecture so you only have to install what you need.

# 📖 Commands
<!-- commands -->
* [`griffin autocomplete [SHELL]`](#griffin-autocomplete-shell)
* [`griffin exec COMMAND [ARGS]`](#griffin-exec-command-args)
* [`griffin export`](#griffin-export)
* [`griffin help [COMMAND]`](#griffin-help-command)
* [`griffin ssm config get`](#griffin-ssm-config-get)
* [`griffin ssm config set`](#griffin-ssm-config-set)
* [`griffin ssm create`](#griffin-ssm-create)
* [`griffin ssm delete`](#griffin-ssm-delete)
* [`griffin ssm history`](#griffin-ssm-history)
* [`griffin ssm import`](#griffin-ssm-import)
* [`griffin ssm read`](#griffin-ssm-read)
* [`griffin ssm remove`](#griffin-ssm-remove)
* [`griffin ssm update`](#griffin-ssm-update)
* [`griffin ssm write`](#griffin-ssm-write)
* [`griffin update [CHANNEL]`](#griffin-update-channel)
* [`griffin version`](#griffin-version)

## `griffin autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ griffin autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ griffin autocomplete

  $ griffin autocomplete bash

  $ griffin autocomplete zsh

  $ griffin autocomplete powershell

  $ griffin autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.0.12/src/commands/autocomplete/index.ts)_

## `griffin exec COMMAND [ARGS]`

Execute a command, injecting config into the environment.

```
USAGE
  $ griffin exec COMMAND [ARGS] [-E <value>] [--cwd <value>] [-p]

ARGUMENTS
  COMMAND  the command to execute
  ARGS

FLAGS
  -E, --env=<value>  [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                     alphanumeric string; default: default
  -p, --pristine     only use config managed by griffin; do not inherit existing environment variables
      --cwd=<value>  the directory where griffin's config file is located, both relative and absolute paths are
                     supported; default: .

DESCRIPTION
  Execute a command, injecting config into the environment.

EXAMPLES
  $ griffin exec -- ./server

  $ griffin exec --pristine -- ./server
```

_See code: [src/commands/exec.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/exec.ts)_

## `griffin export`

Export parameters in the specified format.

```
USAGE
  $ griffin export [-E <value>] [--cwd <value>] [-f json|dotenv|yaml|csv] [-o <value>]

FLAGS
  -E, --env=<value>      [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                         alphanumeric string; default: default
  -f, --format=<option>  [default: json] output format
                         <options: json|dotenv|yaml|csv>
  -o, --output=<value>   output file; if not specified, prints to stdout
      --cwd=<value>      the directory where griffin's config file is located, both relative and absolute paths are
                         supported; default: .

DESCRIPTION
  Export parameters in the specified format.

EXAMPLES
  $ griffin export

  $ griffin export --format json

  $ griffin export --output ./.env --format dotenv
```

_See code: [src/commands/export.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/export.ts)_

## `griffin help [COMMAND]`

Display help for griffin.

```
USAGE
  $ griffin help [COMMAND] [-n]

ARGUMENTS
  COMMAND  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for griffin.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.17/src/commands/help.ts)_

## `griffin ssm config get`

Get the config value for a parameter tracked by griffin.

```
USAGE
  $ griffin ssm config get -n <value> [-E <value>] [--cwd <value>] [-c version|envVarName|allowMissingValue] [-a]

FLAGS
  -E, --env=<value>           [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                              alphanumeric string; default: default
  -a, --all                   show the entire config for the parameter
  -c, --config-name=<option>  the name of the config option
                              <options: version|envVarName|allowMissingValue>
  -n, --name=<value>          (required) the name of the parameter
      --cwd=<value>           the directory where griffin's config file is located, both relative and absolute paths are
                              supported; default: .

DESCRIPTION
  Get the config value for a parameter tracked by griffin.

EXAMPLES
  $ griffin ssm config get --name /example/var --config-name version

  $ griffin ssm config get --name /example/var --all
```

_See code: [src/commands/ssm/config/get.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/config/get.ts)_

## `griffin ssm config set`

Set the config value for a parameter.

```
USAGE
  $ griffin ssm config set -n <value> [-E <value>] [--cwd <value>] [-e <value>] [-l | -v <value>] [-o]

FLAGS
  -E, --env=<value>             [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                                alphanumeric string; default: default
  -e, --env-var-name=<value>    if this parameter does not exist, specifies the name of the environment variable that
                                should be assigned the value of this parameter; default: normalized parameter name,
                                without the prefix
  -l, --[no-]always-use-latest  do not lock the version, instead always pull the latest version; if false, the latest
                                version is pulled from Parameter Store and set as the current version; to use a
                                different version, use --version instead
  -n, --name=<value>            (required) the name of the parameter
  -o, --[no-]optional           do not fail when running exec or exporting variables if this parameter does not exist
  -v, --version=<value>         lock the version of the parameter to this version
      --cwd=<value>             the directory where griffin's config file is located, both relative and absolute paths
                                are supported; default: .

DESCRIPTION
  Set the config value for a parameter.

EXAMPLES
  $ griffin ssm config set --name /example/var --version 5

  $ griffin ssm config set --name /example/var --no-optional
```

_See code: [src/commands/ssm/config/set.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/config/set.ts)_

## `griffin ssm create`

Create a new a parameter in Parameter Store.

```
USAGE
  $ griffin ssm create -n <value> [-E <value>] [--cwd <value>] [-d <value>] [-t SecureString|String|StringList]
    [-v <value> | -l | --from-stdin] [-e <value>] [-l] [-o]

FLAGS
  -E, --env=<value>   [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default
  -n, --name=<value>  (required) the name of the parameter
      --cwd=<value>   the directory where griffin's config file is located, both relative and absolute paths are
                      supported; default: .

SSM CONFIG FLAGS
  -d, --description=<value>  the description for the parameter in Parameter Store
  -t, --type=<option>        the type for the parameter, only has to be specified for new parameters; default:
                             SecureString
                             <options: SecureString|String|StringList>

GRIFFIN CONFIG FLAGS
  -e, --env-var-name=<value>  if this parameter does not exist, specifies the name of the environment variable that
                              should be assigned the value of this parameter; default: normalized parameter name,
                              without the prefix
  -l, --always-use-latest     do not lock the version, instead always pull the latest version
  -o, --optional              do not fail when running exec or exporting variables if this parameter does not exist

VALUE INPUT FLAGS
  -l, --read-single-line  if reading from stdin, stop reading at \n
  -v, --value=<value>     the value of the parameter; if not specified and the value is not read from stdin, you will be
                          prompted for the value
      --from-stdin        use stdin to get the value

DESCRIPTION
  Create a new a parameter in Parameter Store.

EXAMPLES
  $ griffin ssm create --name /example/var

  $ griffin ssm create --name /example/var --value example

  $ griffin ssm create --name /example/var --from-stdin

  $ griffin ssm create --name /example/var --env-var-name EXAMPLE_VER --type SecureString
```

_See code: [src/commands/ssm/create.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/create.ts)_

## `griffin ssm delete`

Permanently delete a parameter from Parameter Store and remove it from tracking.

```
USAGE
  $ griffin ssm delete -n <value> [-E <value>] [--cwd <value>]

FLAGS
  -E, --env=<value>   [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default
  -n, --name=<value>  (required) the name of the parameter
      --cwd=<value>   the directory where griffin's config file is located, both relative and absolute paths are
                      supported; default: .

DESCRIPTION
  Permanently delete a parameter from Parameter Store and remove it from tracking.

EXAMPLES
  $ griffin ssm delete --name /example/var
```

_See code: [src/commands/ssm/delete.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/delete.ts)_

## `griffin ssm history`

View the history of a parameter.

```
USAGE
  $ griffin ssm history -n <value> [-E <value>] [--cwd <value>] [--columns <value> | ] [--sort <value>] [--filter
    <value>] [-x] [--no-header | [--output csv|json|yaml | --no-truncate]]

FLAGS
  -E, --env=<value>      [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                         alphanumeric string; default: default
  -n, --name=<value>     (required) the name of the parameter
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --cwd=<value>      the directory where griffin's config file is located, both relative and absolute paths are
                         supported; default: .
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  [default: json] the format for the output
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  View the history of a parameter.

EXAMPLES
  $ griffin ssm history --name /example/var
```

_See code: [src/commands/ssm/history.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/history.ts)_

## `griffin ssm import`

Import a parameter from Parameter Store or another config source.

```
USAGE
  $ griffin ssm import [-E <value>] [--cwd <value>] [-l] [-o] [-q] [-e <value> -n <value>] [-c <value>] [-t
    SecureString|String|StringList [-d <value> --prefix <value>]] [--overwrite ]

FLAGS
  -E, --env=<value>        [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                           alphanumeric string; default: default
  -l, --always-use-latest  do not lock the version, instead always pull the latest version
  -o, --optional           do not fail when running exec or exporting variables if parameter does not exist
  -q, --quiet              quiet (no output)
      --cwd=<value>        the directory where griffin's config file is located, both relative and absolute paths are
                           supported; default: .

CHAMBER FLAGS
  -c, --chamber-service=<value>...  import all parameters using this chamber service prefix

DOTENV FLAGS
  -d, --from-dotenv=<value>  import parameters from a dotenv file and save to Parameter Store
  -t, --type=<option>        the type for any parameters created in Parameter Store; default: SecureString
                             <options: SecureString|String|StringList>
      --overwrite            if a parameter already exists with the generated name, should it be overwritten
      --prefix=<value>       the prefix to use when saving parameters from a dotenv file to Parameter Store

SSM FLAGS
  -e, --env-var-name=<value>  the name of the environment variable that should be assigned the value of this parameter;
                              default: normalized parameter name, without the prefix
  -n, --name=<value>          the name of the parameter

DESCRIPTION
  Import a parameter from Parameter Store or another config source.

EXAMPLES
  $ griffin ssm import --name /example/var

  $ griffin ssm import --from-dotenv .env --prefix /example/path

  $ griffin ssm import --chamber-service /example

  $ griffin ssm import --chamber-service /example --optional --always-use-latest
```

_See code: [src/commands/ssm/import.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/import.ts)_

## `griffin ssm read`

Read a parameter from Parameter Store.

```
USAGE
  $ griffin ssm read -n <value> [-E <value>] [--cwd <value>] [-v <value> | -l] [-q] [--columns <value> | ]
    [--sort <value>] [--filter <value>] [-x] [--no-header | [--output csv|json|yaml | --no-truncate]]

FLAGS
  -E, --env=<value>      [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                         alphanumeric string; default: default
  -l, --latest           read the latest version
  -n, --name=<value>     (required) the name of the parameter
  -q, --quiet            print only the parameter value
  -v, --version=<value>  the version of the parameter to read, defaults to the version in your .griffon-config.json file
  -x, --extended         show extra columns
      --columns=<value>  only show provided columns (comma-separated)
      --cwd=<value>      the directory where griffin's config file is located, both relative and absolute paths are
                         supported; default: .
      --filter=<value>   filter property by partial string matching, ex: name=foo
      --no-header        hide table header from output
      --no-truncate      do not truncate output to fit screen
      --output=<option>  [default: json] the format for the output
                         <options: csv|json|yaml>
      --sort=<value>     property to sort by (prepend '-' for descending)

DESCRIPTION
  Read a parameter from Parameter Store.

EXAMPLES
  $ griffin ssm read --name /example/var

  $ griffin ssm read --name /example/var --latest

  $ griffin ssm read --name /example/var --version 3 --quiet
```

_See code: [src/commands/ssm/read.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/read.ts)_

## `griffin ssm remove`

Remove a parameter without deleting it from Parameter Store.

```
USAGE
  $ griffin ssm remove -n <value> [-E <value>] [--cwd <value>]

FLAGS
  -E, --env=<value>   [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default
  -n, --name=<value>  (required) the name of the parameter
      --cwd=<value>   the directory where griffin's config file is located, both relative and absolute paths are
                      supported; default: .

DESCRIPTION
  Remove a parameter without deleting it from Parameter Store.

EXAMPLES
  $ griffin ssm remove --name /example/var
```

_See code: [src/commands/ssm/remove.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/remove.ts)_

## `griffin ssm update`

Update an existing parameter in Parameter Store.

```
USAGE
  $ griffin ssm update -n <value> [-E <value>] [--cwd <value>] [-d <value>] [-v <value> | -l | --from-stdin] [-u]

FLAGS
  -E, --env=<value>     [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                        alphanumeric string; default: default
  -n, --name=<value>    (required) the name of the parameter
  -u, --skip-unchanged  skip updating the parameter if the value has not changed
      --cwd=<value>     the directory where griffin's config file is located, both relative and absolute paths are
                        supported; default: .

SSM CONFIG FLAGS
  -d, --description=<value>  the description for the parameter in Parameter Store

VALUE INPUT FLAGS
  -l, --read-single-line  if reading from stdin, stop reading at \n
  -v, --value=<value>     the value of the parameter; if not specified and the value is not read from stdin, you will be
                          prompted for the value
      --from-stdin        use stdin to get the value

DESCRIPTION
  Update an existing parameter in Parameter Store.

EXAMPLES
  $ griffin ssm update --name /example/var

  $ griffin ssm update --name /example/var --value example

  $ griffin ssm update --name /example/var --from-stdin
```

_See code: [src/commands/ssm/update.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/update.ts)_

## `griffin ssm write`

Write a parameter to Parameter Store.

```
USAGE
  $ griffin ssm write -n <value> [-E <value>] [--cwd <value>] [-d <value>] [-t SecureString|String|StringList]
    [-v <value> | -l | --from-stdin] [-e <value>] [-l] [-o] [-u]

FLAGS
  -E, --env=<value>     [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                        alphanumeric string; default: default
  -n, --name=<value>    (required) the name of the parameter
  -u, --skip-unchanged  skip updating the parameter if the value has not changed
      --cwd=<value>     the directory where griffin's config file is located, both relative and absolute paths are
                        supported; default: .

SSM CONFIG FLAGS
  -d, --description=<value>  the description for the parameter in Parameter Store
  -t, --type=<option>        the type for the parameter, only has to be specified for new parameters; default:
                             SecureString
                             <options: SecureString|String|StringList>

GRIFFIN CONFIG FLAGS
  -e, --env-var-name=<value>  if this parameter does not exist, specifies the name of the environment variable that
                              should be assigned the value of this parameter; default: normalized parameter name,
                              without the prefix
  -l, --always-use-latest     do not lock the version, instead always pull the latest version
  -o, --optional              do not fail when running exec or exporting variables if this parameter does not exist

VALUE INPUT FLAGS
  -l, --read-single-line  if reading from stdin, stop reading at \n
  -v, --value=<value>     the value of the parameter; if not specified and the value is not read from stdin, you will be
                          prompted for the value
      --from-stdin        use stdin to get the value

DESCRIPTION
  Write a parameter to Parameter Store.

EXAMPLES
  $ griffin ssm write --name /example/var

  $ griffin ssm write --name /example/var --value example

  $ griffin ssm write --name /example/var --from-stdin

  $ griffin ssm write --name /example/var --env-var-name EXAMPLE_VER --type SecureString
```

_See code: [src/commands/ssm/write.ts](https://github.com/griffin-cli/griffin-cli/blob/v2.0.0/src/commands/ssm/write.ts)_

## `griffin update [CHANNEL]`

update the griffin CLI

```
USAGE
  $ griffin update [CHANNEL] [-a] [--force] [-i | -v <value>]

FLAGS
  -a, --available        See available versions.
  -i, --interactive      Interactively select version to install. This is ignored if a channel is provided.
  -v, --version=<value>  Install a specific version.
      --force            Force a re-download of the requested version.

DESCRIPTION
  update the griffin CLI

EXAMPLES
  Update to the stable channel:

    $ griffin update stable

  Update to a specific version:

    $ griffin update --version 1.0.0

  Interactively select version:

    $ griffin update --interactive

  See available versions:

    $ griffin update --available
```

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v4.2.0/src/commands/update.ts)_

## `griffin version`

```
USAGE
  $ griffin version [--json] [--verbose]

FLAGS
  --verbose  Show additional information about the CLI.

GLOBAL FLAGS
  --json  Format output as json.

FLAG DESCRIPTIONS
  --verbose  Show additional information about the CLI.

    Additionally shows the architecture, node version, operating system, and versions of plugins that the CLI is using.
```

_See code: [@oclif/plugin-version](https://github.com/oclif/plugin-version/blob/v2.0.14/src/commands/version.ts)_
<!-- commandsstop -->
