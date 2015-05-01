var test = require('tape')
var HyperEmitter = require('./')
var memdb = require('memdb')
var fs = require('fs')
var path = require('path')
var basicProto = fs.readFileSync(path.join(__dirname, 'fixture', 'basic.proto'))

test('standalone works', function (t) {
  t.plan(7)

  var emitter = new HyperEmitter(memdb(), basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  var test2 = {
    bar: 'world',
    id: 23
  }

  var count = 2

  emitter.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  emitter.emit('Test2', test2, function (err) {
    t.error(err, 'no error')
  })

  emitter.emit('abcde', {}, function (err) {
    t.ok(err, 'errors')
    t.equal(err.message, 'Non supported event')
  })

  emitter.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')
    release()
  })

  emitter.on('Test2', function (msg, cb) {
    t.deepEqual(msg, test2, 'Test2 event matches')

    // second argument can be a function, backpressure is supported
    cb()
    release()
  })

  function release () {
    if (--count === 0) {
      emitter.close(t.pass.bind(t, 'closed successfully'))
    }
  }
})

test('paired works', function (t) {
  t.plan(7)

  var emitter1 = new HyperEmitter(memdb(), basicProto)

  var emitter2 = new HyperEmitter(memdb(), basicProto)

  emitter1.listen(9901, function (err) {
    t.error(err, 'no error')

    emitter2.connect(9901, '127.0.0.1', function (err) {
      t.error(err, 'no error')
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
    t.deepEqual(msg, test1, 'Test1 event matches')
    release()
  })

  emitter1.on('Test2', function (msg) {
    t.deepEqual(msg, test2, 'Test2 event matches')
    release()
  })

  emitter1.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  emitter2.emit('Test2', test2, function (err) {
    t.error(err, 'no error')
  })

  function release () {
    if (--count === 0) {
      emitter1.close(function () {
        emitter2.close(t.pass.bind(t, 'closed successfully'))
      })
    }
  }
})

test('three way works', function (t) {
  t.plan(9)

  var emitter1 = new HyperEmitter(memdb(), basicProto)

  var emitter2 = new HyperEmitter(memdb(), basicProto)

  var emitter3 = new HyperEmitter(memdb(), basicProto)

  emitter1.listen(9901, '127.0.0.1', function (err) {
    t.error(err, 'no error')

    emitter2.connect(9901, '127.0.0.1', function (err) {
      t.error(err, 'no error')

      emitter2.listen(9902, '127.0.0.1', function (err) {
        t.error(err, 'no error')

        emitter3.connect(9902, '127.0.0.1', function (err) {
          t.error(err, 'no error')
        })
      })
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

  emitter3.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')
    release()
  })

  emitter3.on('Test2', function (msg) {
    t.deepEqual(msg, test2, 'Test2 event matches')
    release()
  })

  emitter1.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  emitter1.emit('Test2', test2, function (err) {
    t.error(err, 'no error')
  })

  function release () {
    if (--count === 0) {
      emitter1.close(function () {
        emitter2.close(function () {
          emitter3.close(t.pass.bind(t, 'closed successfully'))
        })
      })
    }
  }
})

test('remove listeners', function (t) {
  t.plan(2)

  var emitter = new HyperEmitter(memdb(), basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  emitter.on('Test1', onEvent)
  emitter.removeListener('Test1', onEvent)

  emitter.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
    emitter.close(t.pass.bind(t, 'closed successfully'))
  })

  function onEvent (msg, cb) {
    t.fail('this should never be called')
  }
})

test('offline peer sync', function (t) {
  t.plan(8)

  var emitter1 = new HyperEmitter(memdb(), basicProto)

  var emitter2db = memdb()

  var emitter2 = new HyperEmitter(emitter2db, basicProto)

  emitter1.listen(9901, function (err) {
    t.error(err, 'no error')

    emitter2.connect(9901, '127.0.0.1', function (err) {
      t.error(err, 'no error')
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

  emitter1.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  var oldClose = emitter2db.close
  emitter2db.close = function (cb) {
    return cb()
  }

  emitter2.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')

    emitter2.close(function () {
      emitter2db.close = oldClose
      emitter2 = new HyperEmitter(emitter2db, basicProto)

      emitter1.emit('Test2', test2, function (err) {
        t.error(err, 'no error')
      })

      emitter2.on('Test2', function (msg) {
        t.deepEqual(msg, test2, 'Test2 event matches')

        emitter1.close(function () {
          emitter2.close(t.pass.bind(t, 'closed successfully'))
        })
      })

      emitter2.connect(9901, '127.0.0.1', function (err) {
        t.error(err, 'no error')
      })
    })
  })
})

test('offline reconnect', function (t) {
  t.plan(7)

  var emitter1 = new HyperEmitter(memdb(), basicProto)

  var emitter2db = memdb()

  var emitter2 = new HyperEmitter(emitter2db, basicProto)

  emitter1.listen(9901, function (err) {
    t.error(err, 'no error')

    emitter2.connect(9901, '127.0.0.1', function (err) {
      t.error(err, 'no error')
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

  emitter1.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  var oldClose = emitter2db.close
  emitter2db.close = function (cb) {
    return cb()
  }

  emitter2.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')

    emitter2.close(function () {
      emitter2db.close = oldClose
      emitter2 = new HyperEmitter(emitter2db, basicProto)

      emitter1.emit('Test2', test2, function (err) {
        t.error(err, 'no error')
      })

      emitter2.on('Test2', function (msg) {
        t.deepEqual(msg, test2, 'Test2 event matches')

        emitter1.close(function () {
          emitter2.close(t.pass.bind(t, 'closed successfully'))
        })
      })
    })
  })
})

test('automatically reconnects', function (t) {
  t.plan(7)

  var emitter1 = new HyperEmitter(memdb(), basicProto)

  var emitter2 = new HyperEmitter(memdb(), basicProto, {
    reconnectTimeout: 10
  })

  emitter1.listen(9901, function (err) {
    t.error(err, 'no error')

    emitter2.connect(9901, '127.0.0.1', function (err) {
      t.error(err, 'no error')
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

  emitter1.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  emitter2.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')

    // using internal data to fake a connection failure
    emitter2._clients['127.0.0.1:9901'].destroy()

    setImmediate(function () {
      emitter1.emit('Test2', test2, function (err) {
        t.error(err, 'no error')
      })

      emitter2.on('Test2', function (msg) {
        t.deepEqual(msg, test2, 'Test2 event matches')

        emitter1.close(function () {
          emitter2.close(t.pass.bind(t, 'closed successfully'))
        })
      })
    })
  })
})

test('do not re-emit old events', function (t) {
  t.plan(3)

  var db = memdb()
  var emitter = new HyperEmitter(db, basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  emitter.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  var oldClose = db.close
  db.close = function (cb) {
    return cb()
  }

  emitter.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')

    emitter.close(function () {
      db.close = oldClose
      emitter = new HyperEmitter(db, basicProto)

      emitter.on('Test1', function () {
        t.fail('this should not happen')
      })

      // timeout needed to wait for the Test1 event to
      // be eventually emitted
      setTimeout(function () {
        emitter.close(t.pass.bind(t, 'closed successfully'))
      }, 100)
    })
  })
})

test('as stream', function (t) {
  t.plan(6)

  var emitter = new HyperEmitter(memdb(), basicProto)
  var stream = emitter.stream()

  var test1 = {
    foo: 'hello',
    num: 42
  }

  var test2 = {
    bar: 'world',
    id: 23
  }

  var count = 2

  emitter.emit('Test1', test1, function (err) {
    t.error(err, 'no error')

    stream.end({
      name: 'Test2',
      payload: test2
    }, function (err) {
      t.error(err, 'no error')
    })
  })

  stream.once('data', function (msg) {
    t.deepEqual(msg, {
      name: 'Test1',
      payload: test1
    }, 'Test1 event matches')

    stream.once('data', function (msg) {
      t.deepEqual(msg, {
        name: 'Test2',
        payload: test2
      }, 'Test2 event matches')
    })
    release()
  })

  emitter.on('Test2', function (msg, cb) {
    t.deepEqual(msg, test2, 'Test2 event matches')

    // second argument can be a function, backpressure is supported
    cb()
    release()
  })

  function release () {
    if (--count === 0) {
      emitter.close(t.pass.bind(t, 'closed successfully'))
    }
  }
})

test('as stream starting from a certain point', function (t) {
  t.plan(3)

  var emitter = new HyperEmitter(memdb(), basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  var test2 = {
    bar: 'world',
    id: 23
  }

  emitter.on('Test1', function (msg, cb) {
    var stream = emitter.stream()

    emitter.emit('Test2', test2)

    stream.once('data', function (msg) {
      t.deepEqual(msg, {
        name: 'Test2',
        payload: test2
      }, 'Test2 event matches')

      emitter.close(t.pass.bind(t, 'closed successfully'))
    })
  })

  emitter.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })
})

test('as stream starting from the beginning', function (t) {
  t.plan(4)

  var emitter = new HyperEmitter(memdb(), basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  var test2 = {
    bar: 'world',
    id: 23
  }

  emitter.on('Test1', function (msg, cb) {
    var stream = emitter.stream({ from: 'beginning' })

    emitter.emit('Test2', test2)
    stream.once('data', function (msg) {
      t.deepEqual(msg, {
        name: 'Test1',
        payload: test1
      }, 'Test1 event matches')

      stream.once('data', function (msg) {
        t.deepEqual(msg, {
          name: 'Test2',
          payload: test2
        }, 'Test2 event matches')

        emitter.close(t.pass.bind(t, 'closed successfully'))
      })
    })
  })

  emitter.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })
})

test('no eventpeer if it is not needed', function (t) {
  t.plan(3)

  var db = memdb()

  var emitter = new HyperEmitter(db, basicProto)

  emitter.listen(9901, function (err) {
    t.error(err, 'no error')

    var oldClose = db.close
    db.close = function (cb) {
      return cb()
    }

    emitter.close(function () {
      db.close = oldClose
      emitter = new HyperEmitter(db, basicProto)

      emitter.on('EventPeer', function (msg) {
        t.fail('EventPeer should never be emitted')
      })

      emitter.listen(9901, function (err) {
        t.error(err, 'no error')

        // wait some time for the event to be published
        setTimeout(function () {
          emitter.close(t.pass.bind(t, 'closed successfully'))
        }, 50)
      })
    })
  })
})
