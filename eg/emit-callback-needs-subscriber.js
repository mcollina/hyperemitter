// - Emit Callback Needs Subscriber
// This example demonstrates that an emit's callback
// is only called when there is a subscriber present.

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

  // a simple obj that matches one example-schema.proto,
  // note only the id and username fields are required.
  var userAddedMsg = {
    id: 1,
    username: 'user'
  }

  // We have a subscriber embeded in the callback, if we had an external
  // subscriber this code would work but because no other subscribers or
  // emitter with subscribers the callback is never called.
  emitter.emit('userAdded', userAddedMsg, function () {
    emitter.on('userAdded', function (msg) {
      console.log('userAdded: ', msg)
    })
  })

  // Clean up the emitter and print a complete message
  function complete () {
    console.log('example complete')
    emitter.close()
  }

  // After 1000ms the subscriber will still not be called.
  setTimeout(complete, 1000)
})
