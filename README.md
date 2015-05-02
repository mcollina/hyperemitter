# HyperEmitter &nbsp;&nbsp;[![Build Status](https://travis-ci.org/mcollina/hyperemitter.png)](https://travis-ci.org/mcollina/hyperemitter)

HyperEmitter is a horizontally scalable __and__ persistent EventEmitter powered by a [Merkle DAG](http://npm.im/hyperlog).
(Yes, it's like a blockchain). In other contexts, this concept is also called an EventStore. HyperEmitter
uses [protocol-buffers](https://developers.google.com/protocol-buffers/), specifically
[mafintosh's](https://github.com/mafintosh/protocol-buffers) implementation, for handling message schemas.

> This module is __highly experimental__, __possibly under-perfoming__, and __may have bugs__, use with
> caution. On the other end, if the thought of a persistent, horizontally scaleable EventStore gets you
> excite please jump in wherever you feel you can help!

## Installation
To install the module for use locally in your project use:

```
npm install hyperemitter --save
```

To install the companion [cli](./docs/cli-tool.md) tool, you will need to install globally:

```bash
npm install hyperemitter -g
```

## Documentation
We have some documentation to help you get up to speed with HyperEmitter:

- [Quick Start](./docs/getting-started.md)
- [Using the CLI Tool](./docs/cli-tool.md)
- [API Reference](./docs/api-reference.md)

_Also check out our [Examples](./eg) folder for commented sample code._

## Contributing
HyperEmitter is a mad science project and like all mad science project it requires mad scientists, the more
the merrier! If you feel you can help in any way, be it with examples, extra testing, or new features please
be our guest.

_See our [Contribution Guide]() for information on obtaining the source and an overview of the tooling used._

[![js-standard-style](https://raw.githubusercontent.com/feross/standard/master/badge.png)](https://github.com/feross/standard)

## License

Copyright Matteo Collina 2015, Licensed under [ISC](./LICENSE)
