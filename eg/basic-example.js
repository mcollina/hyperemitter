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

  // Subscribe and handle any messages that match
  // the userAdded definition from the schema.
  emitter.on('userAdded', function (msg) {
    console.log('userAdded: ', msg)
  })

  // Subscribe and handle any messages that match
  // the userRemoved definition from the schema.
  emitter.on('userRemoved', function (msg) {
    console.log('userRemoved', msg)
  })

  // Emit both messages above.
  emitter.emit('userAdded', userAddedMsg)
  emitter.emit('userRemoved', userRemovedMsg)

  // Clean up the emitter.
  function complete () {
    emitter.close()
  }

  // We will wait for 500ms to
  // let the program run/
  setTimeout(complete, 500)
})
