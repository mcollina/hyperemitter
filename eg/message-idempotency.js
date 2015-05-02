// - Message Idempotency
// This example demonstrates that messages that
// are structurally the same are idempotent.

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
var schema = fs.readFileSync(path.join('.', 'example-schema.proto'))
var emitter = new HyperEmitter(buildDB('a'), schema)

// listen on port 9001, ensure no connection error.
emitter.listen(9901, function (err) {
  if (err) {
    return
  }

  // a simple obj that matches one example.Schema.proto,
  // note only the id and username fields are required.
  var userAddedMsg = {
    id: 1,
    username: 'user'
  }

  // Idempotency is structural based on the values. This
  // message will not get through either.
  var userAddedMsgDup = {
    id: 1,
    username: 'user'
  }

  // Optional values are taken into account. This message
  // will get through as it is structurally unique.
  var userAddedMsgAdditional = {
    id: 1,
    username: 'user',
    name: 'anne'
  }

  // We expect the subscriber below to be called
  // twice, one for each structurally unique mesage.
  var callCount = 0
  emitter.on('userAdded', function (msg) {
    ++callCount
    console.log('userAdded: ', msg)
  })

  // Remember only the first and last message will
  // be sent on to the subscriber.
  emitter.emit('userAdded', userAddedMsg)
  emitter.emit('userAdded', userAddedMsg)
  emitter.emit('userAdded', userAddedMsgDup)
  emitter.emit('userAdded', userAddedMsgAdditional)

  // call count will be 2.
  function complete () {
    console.log('call count: ' + callCount)
    emitter.close()
  }

  // we will wait for 500ms to see if more than one
  // message is delivered to the subscriber above.
  setTimeout(complete, 500)
})
