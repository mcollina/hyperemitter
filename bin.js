#! /usr/bin/env node

var memdb = require('memdb')()
var fs = require('fs')
var vm = require('vm')
var minimist = require('minimist')
var repl = require('repl')
var argv = minimist(process.argv.splice(2), {
  string: ['host', 'port', 'targetHost'],
  boolean: ['help'],
  alias: {
    'targetHost': 'target-host',
    'targetPort': 'target-port',
    'help': 'h'
  },
  default: {
    host: 'localhost',
    targetHost: 'localhost',
    port: 0
  }
})

function usage () {
  console.log('Usage: pes-client SCHEMA [--port PORT] [--host HOST]\n' +
              '                  [--target-host HOST] [--target-port PORT]')
}

if (argv.help) {
  usage()
  process.exit(1)
}

if (!argv._[0]) {
  console.error('Missing schema')
  console.log()
  usage()
  process.exit(1)
}

var messages = fs.readFileSync(argv._[0])
var store = require('./')(memdb, messages)

store.listen(argv.port, argv.host, function (err, bound) {
  if (err) {
    throw err
  }
  console.log('listening on', bound.port, bound.address)

  if (argv.targetHost && argv.targetPort) {
    store.connect(argv.targetPort, argv.targetHost, startREPL)
  } else {
    startREPL()
  }
})

function startREPL (err) {
  if (err) {
    throw err
  }

  var instance = repl.start({
    ignoreUndefined: true,
    eval: noOutputEval,
    input: process.stdin,
    output: process.stdout
  })

  instance.context.store = store

  Object.keys(store.messages).map(function (key) {
    return store.messages[key]
  }).forEach(function (message) {
    store.on(message.name, print)
  })

  instance.on('exit', function () {
    process.exit(0)
  })

  function print (msg) {
    instance.inputStream.write('\n')
    console.log(msg)

    // undocumented function in node and io
    instance.displayPrompt()
  }
}

function noOutputEval (cmd, context, filename, callback) {
  var err

  if (cmd === '(\n)') {
    return callback(null, undefined)
  }

  try {
    var script = vm.createScript(cmd, {
      filename: filename,
      displayErrors: false
    })
  } catch (e) {
    console.log('parse error', e)
    err = e
  }

  if (!err) {
    try {
      script.runInContext(context, { displayErrors: false })
    } catch(e) {
      err = e
    }
  }

  callback(err, undefined)
}
