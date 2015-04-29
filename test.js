var test = require('tape')
var EventStore = require('./')
var levelup = require('levelup')
var memdown = require('memdown')
var fs = require('fs')
var path = require('path')
var basicProto = fs.readFileSync(path.join(__dirname, 'fixture', 'basic.proto'))

test('standalone works', function (t) {
  t.plan(7)

  var store = new EventStore(levelup({
    db: memdown
  }), basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  var test2 = {
    bar: 'world',
    id: 23
  }

  var count = 2

  store.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  store.emit('Test2', test2, function (err) {
    t.error(err, 'no error')
  })

  store.emit('abcde', {}, function (err) {
    t.ok(err, 'errors')
    t.equal(err.message, 'Non supported event')
  })

  store.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')
    release()
  })

  store.on('Test2', function (msg, cb) {
    t.deepEqual(msg, test2, 'Test2 event matches')

    // second argument can be a function, backpressure is supported
    cb()
    release()
  })

  function release () {
    if (--count === 0) {
      store.close(t.pass.bind(t, 'closed successfully'))
    }
  }
})

test('paired works', function (t) {
  t.plan(7)

  var store1 = new EventStore(levelup({
    db: memdown
  }), basicProto)

  var store2 = new EventStore(levelup({
    db: memdown
  }), basicProto)

  store1.listen(9901, function (err) {
    t.error(err, 'no error')

    store2.connect(9901, '127.0.0.1', function (err) {
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

  store2.on('Test1', function (msg) {
    t.deepEqual(msg, test1, 'Test1 event matches')
    release()
  })

  store1.on('Test2', function (msg) {
    t.deepEqual(msg, test2, 'Test2 event matches')
    release()
  })

  store1.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
  })

  store2.emit('Test2', test2, function (err) {
    t.error(err, 'no error')
  })

  function release () {
    if (--count === 0) {
      store1.close(function () {
        store2.close(t.pass.bind(t, 'closed successfully'))
      })
    }
  }
})

test('remove listeners', function (t) {
  t.plan(2)

  var store = new EventStore(levelup({
    db: memdown
  }), basicProto)

  var test1 = {
    foo: 'hello',
    num: 42
  }

  store.on('Test1', onEvent)
  store.removeListener('Test1', onEvent)

  store.emit('Test1', test1, function (err) {
    t.error(err, 'no error')
    store.close(t.pass.bind(t, 'closed successfully'))
  })

  function onEvent (msg, cb) {
    t.fail('this should never be called')
  }
})
