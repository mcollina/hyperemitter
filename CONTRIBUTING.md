# Contributing
Hyperemitter is an __open project__ and encourages participation. If you feel you can help in any way,
be it with examples, extra testing, or new features please be our guest.

## Helping out
Contributing is not always about adding new features, there are plenty of other ways to get
involved, for instance:

- add more tests, unit or performance based.
- write guides and documentation or proof-read and fix existing ones.
- report, find and/or fix bugs.
- add examples of usage, patterns or integration with other tools.

Like any other repository there is plenty to be done for people of all skill levels and
specialities, if you have any questions, simply open an issue on our [Issues Board][].

## Obtaining the Source
In order to obtain the source for HyperEmitter we first suggest you clone it in Github. After this
is done, navigate to a suitable directory on your machine and run:

```
git clone https://github.com/<USERNAME>/hyperemitter.git
```

This will pull your fork into a new folder `/hyperemitter`, move to this directory:

```
cd hyperemitter
```

Finally, install HyperEmitter's dependencies from npm:

```
npm install
```

## Running Tests and Linting
HyperEmitter's tests are written using [Tape][], a [TAP][] compliant testing module, [Faucet][]
is used to pretty print the TAP stream. Tests are located in the `/test` folder and can be
ran with the following command:

```
npm run test
```

For linting and related checks, HyperEmitter users [JSStandard][]. Linting can be performed with the
following command:

```
npm run lint
```

In both cases, results are outputted to the console window.

## Making a Contribution
If you have something you would like to contribute first ensure your master branch is up to date with
ours, we assume a remote named mcollina exists that points to this repo.

```
git checkout master
git pull --rebase mcollina master
```

Next, create a branch for your contribution:

```
git checkout -b name-of-my-branch
```

HyperEmitter uses [Precommit][] to ensure that tests pass and your
code is linted before allowing a commit to be created. Unfortunately this means most visual git tools will
not allow commits. To create a commit at the command line simply do:

```
git add --all
git commit -m "a commit message"
```

If you need to create multiline commits simple press enter before adding the second `"` this will cause
the console to add a line break to the commit and put the curser on a new line, to finish simply close the
string and press enter.

## Creating a Pull Request
Commit your changes until you are happy. Once you are ready to submit a pull request jump back out to master
and rebase again to ensure you have the latest source:

```
git checkout master
git pull --rebase mcollina master
git push -f origin master
```

Next jump back on to your branch and rebase it with your newly updated master:

```
git checkout name-of-my-branch
git rebase master
git push -f origin name-of-my-branch
```

Finally navigate to your fork on github. You should see a small marker to create a pull request, just
above the repo explorer. Make sure you add some information along with your pull request, it makes
reviewing it easier.

## Got Questions
If you have any issues or need any help please reach out to [@matteocollina][Twitter].

[Issues Board]: https://github.com/mcollina/hyperemitter/issues
[Tape]: https://www.npmjs.com/package/tape
[TAP]: https://testanything.org/
[JSStandard]: https://www.npmjs.com/package/standard
[Precommit]: https://www.npmjs.com/package/pre-commit
[Faucet]: https://www.npmjs.com/package/faucet
[Twitter]: https://twitter.com/matteocollina
