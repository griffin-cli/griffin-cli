# Contributing to griffin-cli

Thank you for considering contributing to griffin-cli.

Griffin is a project I started because I saw a pattern of companies needing to version their config.  I made it open source in the hope that others would be able to use it and help me make it better.

Focus is important in an open source project, so contributions should be focused on the core goal and use cases of griffin.

## Submitting a Bug Report

To submit a new bug report, open an issue on the [GitHub Issues](https://github.com/griffin-cli/griffin-cli/issues/new) page.

If you are filing a bug report or regression, it's extremely important to provide as much information as possible to help reproduce and investigate the issue.  Before submitting a new issue, please

1. Search existing [issues](https://github.com/griffin-cli/griffin-cli/issues?q=is%3Aissue) (both open and closed). If an issue already exists, vote on the issue by reacting to the original post to avoid pinging community members watching the issue.
2. Ensure you have tested with the latest version of the CLI.  We cannot provide a bug fix against an older version of the CLI and the issue may have already been resolved.
3. Provide as much information requested in the template as possible, including environment information and a test case.

## Submitting a Feature Request

Feature requests are welcome and can be submitted on the [GitHub Issues](https://github.com/griffin-cli/griffin-cli/issues/new) page.

Please do not start a PR without a Feature Request first.  This gives us an opportunity to decide if the request falls within the scope of griffin.  Even if a feature request does fall within the scope of griffin, we do not guarantee the feature will be worked on.  However, any PRs implementing the feature would be accepted.

## Stale Issues and Pull Requests

Issues and PRs that have been inactive (e.g. not received updates or comments) for some period of time will be closed.  This does not imply the issue will never be resolved, just that there is not enough interest in resolving the issue at this time.

## Submitting a Pull Request

PRs are always welcome.  If you are implementing a new feature, please make sure to open a a Feature Request first.  This is recommended for bug fixes, too, to avoid duplication of work.

### Building and Testing

#### Prerequisites

You must have the following installed on your system for local development

- Node v20+
- npm
- Docker

After cloning the repo, run

```sh
npm install
```

#### Running Tests

To run all tests, just run

```sh
npm test
```

#### Building

To run your changes locally, you don't have to build your code.  Instead run

```sh
./bin/dev [command] [subcommand]
```

For example, if you've added a new `--foobar` flag to the `ssm history` command, you might run it locally like this

```sh
./bin/dev ssm history --foobar --name /test/var
```

##### Guidelines

Different CLIs take different approaches to CLI design.  To make sure Griffin has a consistent UX, follow these general guidelines when contributing:

1. **Always use flags.** - We take a similar stance to the AWS CLI in preferring to be explicit at the cost of extra verbosity.  Using shorthands (single characters) is encouraged.
2. **Limit subcommands to a depth of 3.** - Depth allows you to organize your commands, but at the cost of UX.  To balance both, we limit command depth to 3.  Great: `griffin exec`; Good: `griffin ssm read`; Ok: `griffin ssm config set`; Bad: `griffin ssm secret config set`
