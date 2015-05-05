// - Subscribers Synchronisation
// This example demonstrates that messages are sent to
// all subscribers regardless of when the connect.

'use strict'

// Needed to read in the example schema.
var fs = require('fs')
var path = require('path')

// The emitter itself as well as an in memory
// leveldb based store. any leveldb store will do.
var HyperEmitter = require('../hyperemitter')
var buildDB = require('memdb')

// create a new emitter using an in memory leveldb
// use the example-schema.proto as the message schema.
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

  // Add the first handler. The second handler would
  // not be called if this wasn't here. There needs
  // to be at least one subscriber to have emit's
  // callback raised.
  emitter.on('userAdded', function (msg) {
    console.log('userAdded: ', msg)
  })

  // Even though the second subsciber is added only after
  // emit is called it still gets the messages once live.
  emitter.emit('userAdded', userAddedMsg, function () {
    emitter.on('userAdded', function (msg) {
      console.log('userAdded: ', msg)
    })
  })

  // Cleanup
  function complete () {
    emitter.close()
  }

  // We will wait for 500ms to see if more than one
  // message is delivered to the subscriber above.
  setTimeout(complete, 500)
})
