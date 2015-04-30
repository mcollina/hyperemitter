#! /usr/bin/env node

var memdb = require('memdb')
var pump = require('pump')
var level = require('level')
var fs = require('fs')
var vm = require('vm')
var minimist = require('minimist')
var repl = require('repl')
var ndjson = require('ndjson')
var argv = minimist(process.argv.splice(2), {
  string: ['host', 'port', 'targetHost', 'db'],
  boolean: ['help', 'repl'],
  alias: {
    'targetHost': 'target-host',
    'targetPort': 'target-port',
    'help': 'h'
  },
  default: {
    host: 'localhost',
    targetHost: 'localhost',
    repl: true
  }
})

function usage () {
  console.log('Usage: pes-client SCHEMA [--port PORT] [--host HOST]\n' +
              '                  [--target-host HOST] [--target-port PORT]\n' +
              '                  [--db PATH] [--no-repl]')
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
var db = argv.db ? level(argv.db) : memdb()
var store = require('./')(db, messages)
var start = argv.repl ? startREPL : startStream

if (argv.port) {
  store.listen(argv.port, argv.host, function (err, bound) {
    if (err) {
      throw err
    }

    if (argv.repl) {
      console.log('listening on', bound.port, bound.address)
    }

    connect(start)
  })
} else {
  connect(start)
}

function connect (next) {
  if (argv.targetHost && argv.targetPort) {
    store.connect(argv.targetPort, argv.targetHost, function (err) {
      if (err) {
        throw err
      }

      if (argv.repl) {
        console.log('connected to', argv.targetHost, argv.targetPort)
      }

      next()
    })
  } else {
    next()
  }
}

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
    store.on(message.name, function (msg) {
      instance.inputStream.write('\n')
      console.log(message.name, msg)

      // undocumented function in node and io
      instance.displayPrompt()
    })
  })

  instance.on('exit', function () {
    process.exit(0)
  })
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

function startStream () {
  var stream = store.stream()

  // input pipeline
  pump(
    process.stdin,
    ndjson.parse(),
    stream
  )

  // output pipeline
  pump(
    stream,
    ndjson.serialize(),
    process.stdout
  )
}
