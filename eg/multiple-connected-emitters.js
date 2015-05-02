// - Multiple Connected Emitters
// This example demonstrates connecting
// multiple emitters together.

'use strict'

// Needed to read in the example schema.
var fs = require('fs')
var path = require('path')

// The emitter itself as well as an in memory
// leveldb based store, any leveldb store will do.
var HyperEmitter = require('../hyperemitter')
var buildDB = require('memdb')

// use the example-schema.proto as the message schema.
var schema = fs.readFileSync(path.join('.', 'example-schema.proto'))

// two emmiters will be used for this example, notice each
// maintains it's own leveldb store and share the same schema.
var emitterOne = new HyperEmitter(buildDB('a'), schema)
var emitterTwo = new HyperEmitter(buildDB('b'), schema)

// listen on port 9001, ensure no connection error.
emitterOne.listen(9901, function (err) {
  if (err) {
    return
  }

  // connect to the first emitter.
  emitterTwo.connect(9901, '127.0.0.1', function (err) {
    if (err) {
      return
    }
  })

  // basic message type
  var userAddedMsg = {
    id: 1,
    username: 'user'
  }

  // basic message type
  var userRemovedMsg = {
    id: 1
  }

  // Messages sent on either emitter will be handled.
  emitterOne.on('userRemoved', function (msg) {
    console.log('userRemoved: ', msg)
  })

  // Messages sent on either emitter will be handled.
  emitterTwo.on('userAdded', function (msg) {
    console.log('userAdded: ', msg)
  })

  // We send each message across the opposite emmiter.
  emitterOne.emit('userAdded', userAddedMsg)
  emitterTwo.emit('userRemoved', userRemovedMsg)

  // call count will be 2.
  function complete () {
    emitterOne.close()
    emitterTwo.close()
  }

  // we will wait for 500ms to see if more than one
  // message is delivered to the subscribers above.
  setTimeout(complete, 500)
})
