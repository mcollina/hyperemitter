// - Emit Before On
// This example demonstrates that events that are
// emitted before a listener is added are still
// sent to the listener.

'use strict'

// Needed to read in the example schema.
var fs = require('fs')
var path = require('path')

// The emitter itself as well as an in memory
// leveldb based store
var HyperEmitter = require('../hyperemitter')
var buildDB = require('memdb')

// create a new emitter using an in memory leveldb
// use the exampleSchema.proto as the message schema.
var schema = fs.readFileSync(path.join('.', 'exampleSchema.proto'))
var emitter = new HyperEmitter(buildDB('a'), schema)

// listen on port 9001, ensure no connection error.
emitter.listen(9901, function (err) {
  if (err) return

  // a simple obj that matches one example.Schema.proto,
  // note only the id and username fields are required.
  var userAddedMsg = {
    id: 1,
    username: 'user'
  }

  // We are going to emit a message before anything
  // has subscribed. These messages will be stored.
  emitter.emit('userAdded', userAddedMsg)

  // The message sent before this subscription will
  // still be delivered here. Messages are received
  // in the order thant they are sent.
  emitter.on('userAdded', function (msg) {
    console.log('userAdded', msg)
    emitter.close()
  })
})
