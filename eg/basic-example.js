// - Basic Example
// A bare minimum example of two subscribers
// handling some messages.

'use strict'

// Needed to read in the example schema.
var fs = require('fs')
var path = require('path')

// The emitter itself as well as an in memory
// leveldb based store
var HyperEmitter = require('../hyperemitter')
var buildDB = require('memdb')

// Create a new emitter using an in memory leveldb
// use the example-schema.proto as the message schema.
var schema = fs.readFileSync(path.join('.', 'example-schema.proto'))
var emitter = new HyperEmitter(buildDB('a'), schema)

// Listen on port 9001, ensure no connection error.
emitter.listen(9901, function (err) {
  if (err) return

  // Messages must match definitions
  // added to the emitter earlier.
  var userAddedMsg = {
    id: 1,
    username: 'user'
  }

  // Messages are simple objects.
  var userRemovedMsg = {
    id: 1
  }

  // prove we called both subscribers.
  var callCount = 0

  // Subscribe and handle any messages that match
  // the userAdded definition from the schema.
  emitter.on('userAdded', function (msg) {
    ++callCount
    console.log('userAdded: ', msg)
  })

  // Subscribe and handle any messages that match
  // the userRemoved definition from the schema.
  emitter.on('userRemoved', function (msg) {
    ++callCount
    console.log('userRemoved', msg)
  })

  // emit both messages above.
  emitter.emit('userAdded', userAddedMsg)
  emitter.emit('userRemoved', userRemovedMsg)

  // call count will be 2.
  function complete () {
    console.log('call count: ' + callCount)
    emitter.close()
  }

  // we will wait for 500ms to see if more than one
  // message is delivered to the subscriber above.
  setTimeout(complete, 500)
})
