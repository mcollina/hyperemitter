## HyperEmitter - Using The CLI Tool
HyperEmitter comes with a nice CLI to work with other remote HyperEmitter. Also, it is really useful for debugging.

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
