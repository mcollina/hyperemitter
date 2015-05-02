## HyperEmitter - API Reference
This page contains a list of public API's exposed by the HyperEmitter module as well as a brief
description of their use. For additional samples please checkout out our [Examples](../eg/)
folder.

## Table Of Contents

  * <a href="#hyperemitter"><code>hyperemitter</code></a>
  * <a href="#emit"><code>hyperemitter#<b>emit()</b></code></a>
  * <a href="#on"><code>hyperemitter#<b>on()</b></code></a>
  * <a href="#removeListener"><code>hyperemitter#<b>removeListener()</b></code></a>
  * <a href="#connect"><code>hyperemitter#<b>connect()</b></code></a>
  * <a href="#listen"><code>hyperemitter#<b>listen()</b></code></a>
  * <a href="#messages"><code>hyperemitter#<b>messages</b></code></a>
  * <a href="#stream"><code>hyperemitter#<b>stream()</b></code></a>
  * <a href="#close"><code>hyperemitter#<b>close()</b></code></a>

<a name="hyperemitter"></a>
## HyperEmitter(db, schema, [opts])

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

<a name="emit"></a>
## emitter.emit(event, message, [callback])

Emit the given message, which must be specified in the schema.
`callback` will be called when the message has been added to the
[hyperlog](http://npm.im/hyperlog).

<a name="on"></a>
## emitter.on(event, callback(message[, done]))

Subscribe to the given event.

<a name="removeListener"></a>
## emitter.removeListener(event, callback(message[, done]))

The inverse of `on`.

<a name="connect"></a>
## emitter.connect(port, host[, done])

Connects to a given peer.

<a name="listen"></a>
## emitter.listen(port[, host[, done]])

Listen on a given port/host combination. An `EventPeer` event will be
emitter.

<a name="messages"></a>
## emitter.messages

The known messages, as returned by
[protocol-buffers](http://npm.im/protocol-buffers).

<a name="stream"></a>
## emitter.stream([opts])

A Duplex stream to emit and receive events.

`stream()` supports the following options:

- `from: 'beginning'` will return all the events from the beginning.

<a name="close"></a>
## emitter.close(callback())

Close the given __hyperemitter__. After, all `emit` will return an error.
