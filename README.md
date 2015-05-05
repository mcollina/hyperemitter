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

To install the companion CLI tool, you will need to install globally:

```
npm install hyperemitter -g
```

## Using The CLI Tool
HyperEmitter comes with a nice CLI to work with other remote HyperEmitter's. Also, it is really useful
for debugging. The sample below uses the schema in `test/fixture/`.

```
hypem --db db --port 1234 fixture/messages.proto
```

On pressing enter, you should see output similar to the following:

```
listening on 1234 127.0.0.1

EventPeer {
  id: 'ci94rxvk50000ku1xeyypyipl',
  addresses: [ { ip: 'localhost', port: 1234 } ]
}
```

From here you can then use the provided REPL to work with HyperEmitter:

```
hyper.emit('Hello', { from: 'Matteo' })
```

And receive the following response:

```
Hello { from: 'Matteo', message: '' }
```

To connect another hyperEmitter in another shell:

```
hypem --db db2 --target-port 1234 fixture/messages.proto
```

Which will output the following:

```
connected to localhost 1234

EventPeer {
  id: 'ci94u8r4g0000hg1xruy56hqn',
  addresses: [ { ip: 'localhost', port: 1234 } ]
}

Hello { from: 'Matteo', message: '' }
```

As you can see the events are synced up! You can also export the data in
[newline delimited json](http://ndjson.org/) with:

```
$ hypem --no-repl --db db4 --target-port 1234 fixture/messages.proto
```
{"name":"EventPeer","payload":{"id":"ci94u8r4g0000hg1xruy56hqn","addresses":[{"ip":"localhost","port":1234}]}}
{"name":"Hello","payload":{"from":"Matteo","message":""}}
```

It works also as a input stream, following the UNIX philosophy.

If you close a REPL or a ndjson stream, the next time it will start where it
stopped. If you have a stream, you can start back from the beginning
passing `--from-scratch`.

## API Reference
This page contains a list of public API's exposed by the HyperEmitter module as well as a brief
description of their use. For additional samples please checkout out our [examples](./examples/)
folder.

  * <a href="#hyperemitter">HyperEmitter</a>
  * <a href="#emit">.emit()</a>
  * <a href="#on">.on()</a>
  * <a href="#removeListener">.removeListener()</a>
  * <a href="#connect">.connect()</a>
  * <a href="#listen">.listen()</a>
  * <a href="#messages">.messages</a>
  * <a href="#stream">.stream()</a>
  * <a href="#close">.close()</a>

<a name="hyperemitter"></a>
### HyperEmitter(db, schema, [opts])
HyperEmitter is both the name of the module and of the function to be required. The function is actually
a class or a class factory depending on how it is used. The code below shows both valid ways to get a
new instance of HyperEmitter for use:

```
var emitterOne = HyperEmmiter(someDb, someSchema)
var emiiterTwo = new HyperEmitter(someDb, someSchema)
```

##### _db_
The `db` argument accepts a [levelup](http://npm.im/levelup) instance, which in turn is powered by
[leveldb](). We recommend [level](http://npm.im/level) for persistent storage and
[memdb](http://npm.im/memdb) if you require an in memory store.

##### _schema_
The `schema` argument is a protocol buffer schema.

##### _opts_
The `opts` argument is an optional object that can be provided to configure the created instance. All
available options are listed below.

- `reconnectTimeout`: the timeout that this instance will wait before reconnecting to peers.

<a name="emit"></a>
### .emit(event, message, [callback])
Messages can be emitted from HyperEmitter using the `.emit()` method. This method takes the name of the
event to be emitted and validates `message` against the schema before sending it off to any listening
subscribers, in parallel. Once complete the `callback` function is called, if present.

##### _event_
The name of one of the message definitions from the provided schema.

##### _message_
Any object who's shape matches the named event. It's keys are validated against the schema.

##### _callback_
An optional function that will be called once the emitted message has been added to the log.

<a name="on"></a>
### .on(event, callback(message[, done]))
Subscribes to and provides a function to be called each time and event is raised.

##### _event_
The name of the event being subscribed to.

##### _callback_
The function to be called when a new event is raised. The `message` arg holds the message emitted. The `done`
arg can be used for letting the emitter know when the function has completed the handling of the event.

<a name="removeListener"></a>
### .removeListener(event, callback(message[, done]))
Removes the listener who matches the one provided. This method does not work with anonymous functions, only a
function with a prior reference can be removed.

##### _event_
The name of the event the listener is subscribed to.

##### _callback_
The reference of the function orginally used in the `.on` call.

<a name="connect"></a>
### .connect(port, host[, done])
Connects this HyperEmitter with another one which we call a peer. Peers can exist on other machines, HyperEmitter
will communicate over TCP using the `host` and `port` provided. An optional function can be provided that will be
called once the connection has been made.

##### _port_
The port of the machine the peer to connect to resides on

##### _host_
The host of the machine the peer to connect to resides on.

##### _done_
A function to be called when connected.

<a name="listen"></a>
### .listen(port[, host[, done]])
Listen on a given port/host combination. An `EventPeer` event will be
emitter.

##### _port_
The port to listen on.

##### _host_
The host to listen on.

##### _done_
An optional function to be called one listening has begun.

<a name="messages"></a>
### .messages()

The known messages, as returned by
[protocol-buffers](http://npm.im/protocol-buffers).

<a name="stream"></a>
### .stream([opts])
A Duplex stream to emit and receive events.

##### _opts_
An optional object of settings.
- `from: 'beginning'` will return all the events from the beginning.

<a name="close"></a>
### .close(callback)
Close the given __hyperemitter__. After, all `emit` will return an error.

##### _callback_
An optional function to be called when close has completed.

## Contributing
HyperEmitter is a mad science project and like all mad science project it requires mad scientists, the more
the merrier! If you feel you can help in any way, be it with examples, extra testing, or new features please
be our guest.

_See our [Contribution Guide]() for information on obtaining the source and an overview of the tooling used._

[![js-standard-style](https://raw.githubusercontent.com/feross/standard/master/badge.png)](https://github.com/feross/standard)

## License

Copyright Matteo Collina 2015, Licensed under [ISC](./LICENSE)
