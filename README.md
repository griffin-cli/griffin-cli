griffin-cli
=================

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![GitHub license](https://img.shields.io/github/license/griffin-cli/griffin-cli)](https://github.com/griffin-cli/griffin-cli/blob/main/LICENSE)

- [griffin-cli](#griffin-cli)
- [Installation](#installation)
  - [Mac \& Linux](#mac--linux)
    - [Homebrew](#homebrew)
    - [Direct Install](#direct-install)
  - [Windows](#windows)
- [AWS Configuration](#aws-configuration)
- [Migrating to griffin](#migrating-to-griffin)
  - [Chamber](#chamber)
  - [Dotenv](#dotenv)
- [Roadmap](#roadmap)
- [Usage](#usage)
- [Commands](#commands)
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

Alternatively, you can install using the tar files attached to the [release](https://github.com/griffin-cli/griffin-cli/releases).

## Mac & Linux

### Homebrew

To install using brew, use the following commands

```sh
brew tap griffin-cli/brew
brew update
brew install griffin
```

### Direct Install

```sh
VERSION={vX.Y.Z}          # Update with latest
OS={debian|linux}         # Select your OS
ARCH={arm64|x64|arm|x86}  # Select your arch

# Download the tarball.
wget https://github.com/griffin-cli/griffin-cli/releases/download/$VERSION/griffin-$VERSION-$OS-$ARCH.tar.gz
# Extract it.
mkdir -p ~/.griffin && tar -xvf griffin-$VERSION-$OS-$ARCH.tar.gz -C ~/.griffin --strip-components 1
# Add it to your PATH.
sudo ln -sf ~/.griffin/bin/griffin /usr/local/bin
```

## Windows

Download the executable available on the [release](https://github.com/griffin-cli/griffin-cli/releases) and run it.

# AWS Configuration

Griffin uses the official [AWS SDK](https://github.com/aws/aws-sdk-js-v3) to access AWS.  To use AWS-backed stores, you must [configure both your credentials and region](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html).

# Migrating to griffin

## Chamber

Chamber is an awesome tool, but it's limited by not locking versions.  This makes rollbacks and canary/ring deployments difficult to manage.  The good news is griffin makes migrating off of chamber easy.  Just run

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

# Roadmap

Griffin is growing!  We're always looking for contributors and maintainers to help us get to where we're going.  Amongst other things, Griffin is looking to add support for

- Native package managers
  - homebrew
  - apt
  - yum
- Other AWS services
  - S3
  - SecretsManager
- Other cloud providers
  - GCP
  - Azure

As Griffin continues to grow, we may also refactor into more of a plugin-based architecture so you only have to install what you need.

# Usage
<!-- usage -->
```sh-session
$ npm install -g griffin-cli
$ griffin COMMAND
running command...
$ griffin (--version)
griffin-cli/0.1.3 linux-x64 node-v18.18.2
$ griffin --help [COMMAND]
USAGE
  $ griffin COMMAND
...
```
<!-- usagestop -->

# Commands
<!-- commands -->
- [griffin-cli](#griffin-cli)
- [Installation](#installation)
  - [Mac \& Linux](#mac--linux)
    - [Homebrew](#homebrew)
    - [Direct Install](#direct-install)
  - [Windows](#windows)
- [AWS Configuration](#aws-configuration)
- [Migrating to griffin](#migrating-to-griffin)
  - [Chamber](#chamber)
  - [Dotenv](#dotenv)
- [Roadmap](#roadmap)
- [Usage](#usage)
- [Commands](#commands)
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

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.0.1/src/commands/autocomplete/index.ts)_

## `griffin exec COMMAND [ARGS]`

Execute a command, injecting config into the environment.

```
USAGE
  $ griffin exec COMMAND [ARGS] [--env <value>] [-p]

ARGUMENTS
  COMMAND  the command to execute
  ARGS

FLAGS
  -p, --pristine  only use config managed by griffin; do not inherit existing environment variables
  --env=<value>   [default: default] the name of the environment (e.g. prod, qa, staging), this can be any alphanumeric
                  string; default: default

DESCRIPTION
  Execute a command, injecting config into the environment.

EXAMPLES
  $ griffin exec -- ./server

  $ griffin exec --pristine -- ./server
```

_See code: [src/commands/exec.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/exec.ts)_

## `griffin export`

Export parameters in the specified format.

```
USAGE
  $ griffin export [--env <value>] [-f json|dotenv|yaml|csv] [-o <value>]

FLAGS
  -f, --format=<option>  [default: json] output format
                         <options: json|dotenv|yaml|csv>
  -o, --output=<value>   output file; if not specified, prints to stdout
  --env=<value>          [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                         alphanumeric string; default: default

DESCRIPTION
  Export parameters in the specified format.

EXAMPLES
  $ griffin export

  $ griffin export --format json

  $ griffin export --output ./.env --format dotenv
```

_See code: [src/commands/export.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/export.ts)_

## `griffin help [COMMANDS]`

Display help for griffin.

```
USAGE
  $ griffin help [COMMANDS] [-n]

ARGUMENTS
  COMMANDS  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for griffin.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.5/src/commands/help.ts)_

## `griffin ssm config get`

Get the config value for a parameter tracked by griffin.

```
USAGE
  $ griffin ssm config get -n <value> [--env <value>] [-c version|envVarName|allowMissingVersion] [-a]

FLAGS
  -a, --all                   show the entire config for the parameter
  -c, --config-name=<option>  the name of the config option
                              <options: version|envVarName|allowMissingVersion>
  -n, --name=<value>          (required) the name of the parameter
  --env=<value>               [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                              alphanumeric string; default: default

DESCRIPTION
  Get the config value for a parameter tracked by griffin.

EXAMPLES
  $ griffin ssm config get --store ssm --name /example/var --config-name version

  $ griffin ssm config get --store ssm --name /example/var --all
```

_See code: [src/commands/ssm/config/get.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/config/get.ts)_

## `griffin ssm config set`

Set the config value for a parameter.

```
USAGE
  $ griffin ssm config set -n <value> [--env <value>] [-e <value>] [-l | -v <value>] [-m]

FLAGS
  -e, --env-var-name=<value>  if this parameter does not exist, specifies the name of the environment variable that
                              should be assigned the value of this parameter; default: normalized parameter name,
                              without the prefix
  -l, --always-use-latest     do not lock the version, instead always pull the latest version; if false, the latest
                              version is pulled from Parameter Store and set as the current version; to use a different
                              version, use --use-version instead
  -m, --allow-missing-value   do not fail when running exec or exporting variables if this parameter does not exist
  -n, --name=<value>          (required) the name of the parameter
  -v, --use-version=<value>   lock the version of the parameter to this version
  --env=<value>               [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                              alphanumeric string; default: default

DESCRIPTION
  Set the config value for a parameter.

EXAMPLES
  $ griffin ssm config set --name /example/var --version 5

  $ griffin ssm config set --name /example/var --no-allow-missing-value
```

_See code: [src/commands/ssm/config/set.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/config/set.ts)_

## `griffin ssm create`

Create a new a parameter in Parameter Store.

```
USAGE
  $ griffin ssm create -n <value> [--env <value>] [-d <value>] [-t SecureString|String|StringList] [-v <value> |
    -l | --from-stdin] [-e <value>] [-l] [-m]

FLAGS
  -n, --name=<value>  (required) the name of the parameter
  --env=<value>       [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default

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
  -m, --allow-missing-value   do not fail when running exec or exporting variables if this parameter does not exist

VALUE INPUT FLAGS
  -l, --read-single-line  if reading from stdin, stop reading at \n
  -v, --value=<value>     the value of the parameter; if not specified and the value is not read from stdin, you will be
                          prompted for the value
  --from-stdin            use stdin to get the value

DESCRIPTION
  Create a new a parameter in Parameter Store.

EXAMPLES
  $ griffin ssm create --name /example/var

  $ griffin ssm create --name /example/var --value example

  $ griffin ssm create --name /example/var --from-stdin

  $ griffin ssm create --name /example/var --env-var-name EXAMPLE_VER --type SecureString
```

_See code: [src/commands/ssm/create.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/create.ts)_

## `griffin ssm delete`

Permanently delete a parameter from Parameter Store and remove it from tracking.

```
USAGE
  $ griffin ssm delete -n <value> [--env <value>]

FLAGS
  -n, --name=<value>  (required) the name of the parameter
  --env=<value>       [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default

DESCRIPTION
  Permanently delete a parameter from Parameter Store and remove it from tracking.

EXAMPLES
  $ griffin ssm delete --name /example/var
```

_See code: [src/commands/ssm/delete.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/delete.ts)_

## `griffin ssm history`

View the history of a parameter.

```
USAGE
  $ griffin ssm history -n <value> [--env <value>] [--columns <value> | ] [--sort <value>] [--filter <value>]
    [-x] [--no-header | [--output csv|json|yaml | --no-truncate]]

FLAGS
  -n, --name=<value>  (required) the name of the parameter
  -x, --extended      show extra columns
  --columns=<value>   only show provided columns (comma-separated)
  --env=<value>       [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default
  --filter=<value>    filter property by partial string matching, ex: name=foo
  --no-header         hide table header from output
  --no-truncate       do not truncate output to fit screen
  --output=<option>   [default: json] the format for the output
                      <options: csv|json|yaml>
  --sort=<value>      property to sort by (prepend '-' for descending)

DESCRIPTION
  View the history of a parameter.

EXAMPLES
  $ griffin ssm history --name /example/var
```

_See code: [src/commands/ssm/history.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/history.ts)_

## `griffin ssm import`

Import a parameter from Parameter Store or another config source.

```
USAGE
  $ griffin ssm import [--env <value>] [-l] [-m] [-e <value> -n <value>] [-c <value>] [-t
    SecureString|String|StringList [-d <value> --prefix <value>]]

FLAGS
  -l, --always-use-latest    do not lock the version, instead always pull the latest version
  -m, --allow-missing-value  do not fail when running exec or exporting variables if parameter does not exist
  --env=<value>              [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                             alphanumeric string; default: default

CHAMBER FLAGS
  -c, --chamber-service=<value>...  import all parameters using this chamber service prefix

DOTENV FLAGS
  -d, --from-dotenv=<value>  import parameters from a dotenv file and save to Parameter Store
  -t, --type=<option>        the type for any parameters created in Parameter Store; default: SecureString
                             <options: SecureString|String|StringList>
  --prefix=<value>           the prefix to use when saving parameters from a dotenv file to Parameter Store

SSM FLAGS
  -e, --env-var-name=<value>  the name of the environment variable that should be assigned the value of this parameter;
                              default: normalized parameter name, without the prefix
  -n, --name=<value>          the name of the parameter

DESCRIPTION
  Import a parameter from Parameter Store or another config source.

EXAMPLES
  $ griffin ssm import --name /example/var

  $ griffin ssm import --from-dotenv .env

  $ griffin ssm import --chamber-service /example

  $ griffin ssm import --chamber-service /example --allow-missing-value --always-use-latest
```

_See code: [src/commands/ssm/import.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/import.ts)_

## `griffin ssm read`

Read a parameter from Parameter Store.

```
USAGE
  $ griffin ssm read -n <value> [--env <value>] [-v <value> | -l] [-q] [--columns <value> | ] [--sort <value>]
    [--filter <value>] [-x] [--no-header | [--output csv|json|yaml | --no-truncate]]

FLAGS
  -l, --latest           read the latest version
  -n, --name=<value>     (required) the name of the parameter
  -q, --quiet            print only the parameter value
  -v, --version=<value>  the version of the parameter to read, defaults to the version in your .griffon-config.json file
  -x, --extended         show extra columns
  --columns=<value>      only show provided columns (comma-separated)
  --env=<value>          [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                         alphanumeric string; default: default
  --filter=<value>       filter property by partial string matching, ex: name=foo
  --no-header            hide table header from output
  --no-truncate          do not truncate output to fit screen
  --output=<option>      [default: json] the format for the output
                         <options: csv|json|yaml>
  --sort=<value>         property to sort by (prepend '-' for descending)

DESCRIPTION
  Read a parameter from Parameter Store.

EXAMPLES
  $ griffin ssm read --name /example/var

  $ griffin ssm read --name /example/var --latest

  $ griffin ssm read --name /example/var --version 3 --quiet
```

_See code: [src/commands/ssm/read.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/read.ts)_

## `griffin ssm remove`

Remove a parameter without deleting it from Parameter Store.

```
USAGE
  $ griffin ssm remove -n <value> [--env <value>]

FLAGS
  -n, --name=<value>  (required) the name of the parameter
  --env=<value>       [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                      alphanumeric string; default: default

DESCRIPTION
  Remove a parameter without deleting it from Parameter Store.

EXAMPLES
  $ griffin ssm remove --name /example/var
```

_See code: [src/commands/ssm/remove.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/remove.ts)_

## `griffin ssm update`

Update an existing parameter in Parameter Store.

```
USAGE
  $ griffin ssm update -n <value> [--env <value>] [-d <value>] [-v <value> | -l | --from-stdin] [-u]

FLAGS
  -n, --name=<value>    (required) the name of the parameter
  -u, --skip-unchanged  skip updating the parameter if the value has not changed
  --env=<value>         [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                        alphanumeric string; default: default

SSM CONFIG FLAGS
  -d, --description=<value>  the description for the parameter in Parameter Store

VALUE INPUT FLAGS
  -l, --read-single-line  if reading from stdin, stop reading at \n
  -v, --value=<value>     the value of the parameter; if not specified and the value is not read from stdin, you will be
                          prompted for the value
  --from-stdin            use stdin to get the value

DESCRIPTION
  Update an existing parameter in Parameter Store.

EXAMPLES
  $ griffin ssm update --name /example/var

  $ griffin ssm update --name /example/var --value example

  $ griffin ssm update --name /example/var --from-stdin
```

_See code: [src/commands/ssm/update.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/update.ts)_

## `griffin ssm write`

Write a parameter to Parameter Store.

```
USAGE
  $ griffin ssm write -n <value> [--env <value>] [-d <value>] [-t SecureString|String|StringList] [-v <value> |
    -l | --from-stdin] [-e <value>] [-l] [-m] [-u]

FLAGS
  -n, --name=<value>    (required) the name of the parameter
  -u, --skip-unchanged  skip updating the parameter if the value has not changed
  --env=<value>         [default: default] the name of the environment (e.g. prod, qa, staging), this can be any
                        alphanumeric string; default: default

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
  -m, --allow-missing-value   do not fail when running exec or exporting variables if this parameter does not exist

VALUE INPUT FLAGS
  -l, --read-single-line  if reading from stdin, stop reading at \n
  -v, --value=<value>     the value of the parameter; if not specified and the value is not read from stdin, you will be
                          prompted for the value
  --from-stdin            use stdin to get the value

DESCRIPTION
  Write a parameter to Parameter Store.

EXAMPLES
  $ griffin ssm write --name /example/var

  $ griffin ssm write --name /example/var --value example

  $ griffin ssm write --name /example/var --from-stdin

  $ griffin ssm write --name /example/var --env-var-name EXAMPLE_VER --type SecureString
```

_See code: [src/commands/ssm/write.ts](https://github.com/griffin-cli/griffin-cli/blob/v0.1.3/src/commands/ssm/write.ts)_

## `griffin update [CHANNEL]`

update the griffin CLI

```
USAGE
  $ griffin update [CHANNEL] [-a] [--force] [-i | -v <value>]

FLAGS
  -a, --available        See available versions.
  -i, --interactive      Interactively select version to install. This is ignored if a channel is provided.
  -v, --version=<value>  Install a specific version.
  --force                Force a re-download of the requested version.

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

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v4.1.3/src/commands/update.ts)_
<!-- commandsstop -->
