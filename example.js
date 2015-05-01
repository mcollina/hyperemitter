var assert = require('assert')
var fs = require('fs')
var path = require('path')
var schema = fs.readFileSync(path.join(__dirname, 'fixture', 'basic.proto'))
var HyperEmitter = require('./')
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
