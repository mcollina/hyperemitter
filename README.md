# hyperemitter

Horizontally scalable __and__ persistent EventEmitter powered by a [Merkle DAG](http://npm.im/hyperlog).
(Yes, it's like a blockchain). In other contexts, this concept is also called an EventStore.

  * <a href="#install">Installation</a>
  * <a href="#example">Example</a>
  * <a href="#cli">Command Line Interface</a>
  * <a href="#api">API</a>
  * <a href="#licence">Licence &amp; copyright</a>

__This is highly experimental, possibly under-perfoming, and brand-new module: use with caution__.
On the other end, you should get exited about it, and _help fix those problems!_

It is based on [protocol-buffers](https://developers.google.com/protocol-buffers/), and in particular on
@mafintosh implementation https://github.com/mafintosh/protocol-buffers.

This library assumes that you defines your events as protobuf messages,
like so:

```
message Hello {
  optional string from = 1;
  optional string message = 2;
}
```

## Installation

If you need the [cli](#cli), you will need to install globally:

```bash
npm install hyperemitter -g
```

If you want to use it as a module, install it locally:

```bash
npm install hyperemitter --save
```

## Example

```js
var assert = require('assert')
var fs = require('fs')
var path = require('path')
var schema = fs.readFileSync(path.join(__dirname, 'fixture', 'basic.proto'))
var HyperEmitter = require('hyperemitter')
var buildDB = require('memdb')
// or
// var buildDB = require('level')

var emitter1 = new HyperEmitter(buildDB('a'), schema)

var emitter2 = new HyperEmitter(buildDB('b'), schema)

emitter1.listen(9901, function (err) {
  assert(!err, 'no error')

  emitter2.connect(9901, '127.0.0.1', function (err) {
    assert(!err, 'no error')
  })
})

var test1 = {
  foo: 'hello',
  num: 42
}

var test2 = {
  bar: 'world',
  id: 23
}

var count = 2

emitter2.on('Test1', function (msg) {
  assert.deepEqual(msg, test1, 'Test1 event matches')
  console.log('Test1', msg)
  release()
})

emitter1.on('Test2', function (msg) {
  assert.deepEqual(msg, test2, 'Test2 event matches')
  console.log('Test2', msg)
  release()
})

emitter1.emit('Test1', test1, function (err) {
  assert(!err, 'no error')
})

emitter2.emit('Test2', test2, function (err) {
  assert(!err, 'no error')
})

function release () {
  if (--count === 0) {
    emitter1.close(function () {
      emitter2.close()
    })
  }
}
```

## CLI

__hyperemitter__ comes with a nice CLI to work with other remote HyperEmitter. Also, it is really useful for debugging.


To get started, save the messages defined above in a file called `messages.proto`, and in a shell run:

```bash
$ hypem --db db --port 1234 fixture/messages.proto
listening on 1234 127.0.0.1
>
EventPeer { id: 'ci94rxvk50000ku1xeyypyipl',
  addresses: [ { ip: 'localhost', port: 1234 } ] }
> hyper.emit('Hello', { from: 'Matteo' })
>
Hello { from: 'Matteo', message: '' }
>
```

Yes, it's a standard node repl, and `hyper` is an instance of
__hyperemitter__.

In another shell, run:

```bash
$ hypem --target-port 1234 fixture/messages.proto --db db2
connected to localhost 1234
>
EventPeer { id: 'ci94u8r4g0000hg1xruy56hqn',
  addresses: [ { ip: 'localhost', port: 1234 } ] }
>
Hello { from: 'Matteo', message: '' }
>
```

As you can see the events are synced up!

You can also export the data in [newline delimited
json](http://ndjson.org/) with:

```bash
$ hypem --no-repl --target-port 1234 fixture/messages.proto --db db4
{"name":"EventPeer","payload":{"id":"ci94u8r4g0000hg1xruy56hqn","addresses":[{"ip":"localhost","port":1234}]}}
{"name":"Hello","payload":{"from":"Matteo","message":""}}
```

It works also as a input stream, following the UNIX philosophy.

If you close a REPL or a ndjson stream, the next time it will start where it
stopped. If you have a stream, you can start back from the beginning
passing `--from-scratch`.

## API

  * <a href="#hyperemitter"><code>hyperemitter</code></a>
  * <a href="#emit"><code>hyperemitter#<b>emit()</b></code></a>
  * <a href="#on"><code>hyperemitter#<b>on()</b></code></a>
  * <a href="#removeListener"><code>hyperemitter#<b>removeListener()</b></code></a>
  * <a href="#connect"><code>hyperemitter#<b>connect()</b></code></a>
  * <a href="#listen"><code>hyperemitter#<b>listen()</b></code></a>
  * <a href="#messages"><code>hyperemitter#<b>messages</b></code></a>
  * <a href="#stream"><code>hyperemitter#<b>stream()</b></code></a>
  * <a href="#close"><code>hyperemitter#<b>close()</b></code></a>

-------------------------------------------------------
<a name="hyperemitter"></a>
### HyperEmitter(db, schema, [opts])

HyperEmitter is the class and function exposed by this module.
It can be created by `HyperEmitter()` or using `new HyperEmitter()`.

The `db` argument is a [levelup](http://npm.im/levelup) instance,
something you can get from [level](http://npm.im/level) or
[memdb](http://npm.im/memdb).

The `schema` argument is a protocol buffer schema, like the following
one:

```
message Hello {
  optional string from = 1;
  optional string message = 2;
}
```

An HyperEmitter accepts the following options:

- `reconnectTimeout`: the timeout that this instance will wait before
  reconnecting to peers.

A standard event is added to handle peer reconnections.

```
message EventPeer {
  required string id = 1;
  repeated PeerAddress addresses = 2;

  message PeerAddress {
    required string ip = 1;
    required int32 port = 2;
  }
}
```

An `HyperEmitter` will automatically reconnects to all known peers if
started up again.

-------------------------------------------------------
<a name="emit"></a>
### emitter.emit(event, message, [callback])

Emit the given message, which must be specified in the schema.
`callback` will be called when the message has been added to the
[hyperlog](http://npm.im/hyperlog).

-------------------------------------------------------
<a name="on"></a>
### emitter.on(topic, callback(message[, done]))

Subscribe to the given event.

-------------------------------------------------------
<a name="removeListener"></a>
### emitter.removeListener(topic, callback(message[, done]))

The inverse of `on`.

-------------------------------------------------------
<a name="connect"></a>
### emitter.connect(port, host[, done])

Connects to a given peer.

-------------------------------------------------------
<a name="listen"></a>
### emitter.listen(port[, host[, done]])

Listen on a given port/host combination. An `EventPeer` event will be
emitter.

-------------------------------------------------------
<a name="messages"></a>
### emitter.messages

The known messages, as returned by
[protocol-buffers](http://npm.im/protocol-buffers).

-------------------------------------------------------
<a name="close"></a>
### emitter.close(callback())

Close the given __hyperemitter__. After, all `emit` will return an error.

## License

ISC
