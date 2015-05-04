## HyperEmitter - API Reference
This page contains a list of public API's exposed by the HyperEmitter module as well as a brief
description of their use. For additional samples please checkout out our [Examples](../eg/)
folder.

## Table Of Contents

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
## HyperEmitter(db, schema, [opts])
HyperEmitter is both the name of the module and of the function to be required. The function is actually
a class or a class factory depending on how it is used. The code below shows both valid ways to get a
new instance of HyperEmitter for use:

```
var emitterOne = HyperEmmiter(someDb, someSchema)
var emiiterTwo = new HyperEmitter(someDb, someSchema)
```

#### _db_
The `db` argument accepts a [levelup](http://npm.im/levelup) instance, which in turn is powered by
[leveldb](). We recommend [level](http://npm.im/level) for persistent storage and
[memdb](http://npm.im/memdb) if you require an in memory store.

#### _schema_
The `schema` argument is a protocol buffer schema.

#### _opts_
The `opts` argument is an optional object that can be provided to configure the created instance. All
available options are listed below.

- `reconnectTimeout`: the timeout that this instance will wait before reconnecting to peers.

<a name="emit"></a>
## .emit(event, message, [callback])
Messages can be emitted from HyperEmitter using the `.emit()` method. This method takes the name of the
event to be emitted and validates `message` against the schema before sending it off to any listening
subscribers, in parallel. Once complete the `callback` function is called, if present.

#### _event_
The name of one of the message definitions from the provided schema.

#### _message_
Any object who's shape matches the named event. It's keys are validated against the schema.

#### _callback_
An optional function that will be called once the emitted message has been added to the log.

<a name="on"></a>
## .on(event, callback(message[, done]))
Subscribes to and provides a function to be called each time and event is raised.

#### _event_
The name of the event being subscribed to.

#### _callback_
The function to be called when a new event is raised. The `message` arg holds the message emitted. The `done`
arg can be used for letting the emitter know when the function has completed the handling of the event.

<a name="removeListener"></a>
## .removeListener(event, callback(message[, done]))
Removes the listener who matches the one provided. This method does not work with anonymous functions, only a
function with a prior reference can be removed.

#### _event_
The name of the event the listener is subscribed to.

#### _callback_
The reference of the function orginally used in the `.on` call.

<a name="connect"></a>
## .connect(port, host[, done])
Connects this HyperEmitter with another one which we call a peer. Peers can exist on other machines, HyperEmitter
will communicate over TCP using the `host` and `port` provided. An optional function can be provided that will be
called once the connection has been made.

#### _port_
The port of the machine the peer to connect to resides on

#### _host_
The host of the machine the peer to connect to resides on.

#### _done_
A function to be called when connected.

<a name="listen"></a>
## .listen(port[, host[, done]])
Listen on a given port/host combination. An `EventPeer` event will be
emitter.

#### _port_
The port to listen on.

#### _host_
The host to listen on.

#### _done_
An optional function to be called one listening has begun.

<a name="messages"></a>
## .messages()

The known messages, as returned by
[protocol-buffers](http://npm.im/protocol-buffers).

<a name="stream"></a>
## .stream([opts])
A Duplex stream to emit and receive events.

#### _opts_
An optional object of settings.
- `from: 'beginning'` will return all the events from the beginning.

<a name="close"></a>
## .close(callback)
Close the given __hyperemitter__. After, all `emit` will return an error.

#### _callback_
An optional function to be called when close has completed.
