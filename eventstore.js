var EventEmitter = require('events').EventEmitter
var fs = require('fs')
var path = require('path')
var protobuf = require('protocol-buffers')
var headers = protobuf(fs.readFileSync(path.join(__dirname, 'headers.proto')))
var hyperlog = require('hyperlog')
var net = require('net')
var cuid = require('cuid')
var os = require('os')
var pump = require('pump')
var fastparallel = require('fastparallel')
var through2 = require('through2')
var STOREID = '!!STOREID!!'
var PEERS = '!!PEERS!!'

function EventStore (db, schema, opts) {
  if (!(this instanceof EventStore)) {
    return new EventStore(db, schema, opts)
  }

  this.messages = protobuf(schema)
  this._db = db
  this._hyperlog = hyperlog(db)
  this._last = []
  this._opts = opts || {}
  this._listening = false
  this._parallel = fastparallel()
  this._clients = {}
  this._lastClient = 0
  this._listeners = {}

  var that = this
  this._hyperlog.heads(function (err, heads) {
    if (err) { return that.emit('error', err) }

    that._last = that._last.concat(heads)
  })

  Object.keys(headers).forEach(function (header) {
    that.messages[header] = headers[header]
  })

  // TODO restore only from a given point
  this._changes =
    pump(
      this._hyperlog.createReadStream({ live: true }),
      through2.obj(process)
    )

  function process (change, enc, next) {
    var header = headers.Event.decode(change.value)
    var event = that.messages[header.name].decode(header.payload)
    that._parallel(that, that._listeners[header.name] || [], event, next)
  }

  // the status of this EventStore
  this.status = new EventEmitter()

  this._server = net.createServer(function handle (stream) {
    that.status.emit('clientConnected')

    var id = that._lastClient++
    var replicate = that._hyperlog.replicate({ live: true })
    var result = pump(stream, replicate, stream, function (err) {
      if (err) { return that.status.emit('clientError', err) }
      delete that._clients[id]
    })

    that._clients[id] = result
  })

  this.on('EventPeer', function (peer, cb) {
    if (peer.id !== peer.id) {
      that.connect(peer.addresses[0].port, peer.addresses[0].ip, cb)
    } else {
      cb()
    }
  })

  this._db.get(PEERS, function (err, value) {
    if (err && !err.notFound) {
      return that.status.emit('error', err)
    }

    if (err && err.notFound) {
      // nothing to do
      return
    }

    value = JSON.parse(value)

    that._parallel(that, function (peer, cb) {
      console.log('reconnecting', peer)
      that.connect(peer.port, peer.address, cb)
    }, value, function () {})
  })
}

EventStore.prototype.emit = function (name, data, cb) {
  var encoder = headers[name] || this.messages[name]
  var err

  if (!encoder) {
    err = new Error('Non supported event')
    if (cb) { return cb(err) }
    else throw err
  }

  var header = headers.Event.encode({
    name: name,
    payload: encoder.encode(data)
  })
  var that = this

  this._hyperlog.add(this._last, header, function (err, node) {
    if (err) { return cb(err) }

    that._last.push(node.key)
    if (cb) {
      cb()
    }
  })

  this._last = []
  return this
}

EventStore.prototype.on = function (name, callback) {
  var toInsert = callback
  this._listeners[name] = this._listeners[name] || []
  if (toInsert.length < 2) {
    toInsert = function (msg, cb) {
      callback(msg)
      cb()
    }

    callback.wrapped = toInsert
  }
  this._listeners[name].push(toInsert)
  return this
}

EventStore.prototype.removeListener = function (name, func) {
  if (func.wrapped) {
    func = func.wrapped
  }

  this._listeners[name].splice(this._listeners[name].indexOf(func), 1)
  return this
}

EventStore.prototype.getId = function (cb) {
  if (this.id) { return cb(null, this.id) }

  var that = this
  var db = this._db

  db.get(STOREID, function (err, value) {
    if (err && !err.notFound) { return cb(err) }
    that.id = value || cuid()
    db.put(STOREID, that.id, function (err) {
      if (err) {
        return cb(err)
      }
      cb(null, that.id)
    })
  })
}

EventStore.prototype.connect = function (port, host, cb) {
  var stream = net.connect(port, host)
  var that = this
  var key = host + ':' + port

  if (this._clients[key]) {
    return cb ? cb() : this
  }

  this._clients[key] = stream

  stream.on('connect', function () {
    var replicate = that._hyperlog.replicate({ live: true })
    pump(replicate, stream, replicate)

    var peers = Object.keys(that._clients).map(function (key) {
      var split = key.split(':')
      return { address: split[0], port: split[1] }
    })

    that._db.put(PEERS, JSON.stringify(peers), function (err) {
      if (cb) {
        stream.removeListener('error', cb)
        cb(err) // what to do if cb is not specified?
      }
    })
  })

  if (cb) {
    stream.on('error', cb)
  }
}

function localIps () {
  var ifaces = os.networkInterfaces()
  return Object.keys(ifaces).reduce(function (addresses, iface) {
    return ifaces[iface].filter(function (ifaceIp) {
      return !ifaceIp.internal
    }).reduce(function (addresses, ifaceIp) {
      addresses.push(ifaceIp)
      return addresses
    }, addresses)
  }, [])
}

EventStore.prototype.listen = function (port, address, cb) {
  var that = this

  if (typeof address === 'function') {
    cb = address
    address = null
  }

  this._listening = true

  this.getId(function (err, id) {
    if (err) {
      return cb(err)
    }

    that._server.listen(port, address, function (err) {
      if (err) {
        return cb(err)
      }

      var addresses = address ? [{ address: address }] : localIps()

      addresses = addresses.map(function (ip) {
        return {
          ip: ip.address,
          port: that._server.address().port
        }
      })

      that.emit('EventPeer', {
        id: id,
        addresses: addresses
      }, function (err) {
        if (err) { return cb(err) }
        cb(null, that._server.address())
      })
    })
  })
}

EventStore.prototype.close = function (cb) {
  var that = this

  this._changes.destroy()

  var toClose = [that._db]
  if (that._listening) {
    toClose.push(that._server)
  }

  Object.keys(this._clients).forEach(function (key) {
    toClose.unshift(that._clients[key])
  })
  that._parallel(that, doClose, toClose, cb)
}

function doClose (stuff, cb) {
  if (stuff.close) {
    stuff.close(cb)
  } else {
    stuff.destroy()
    setImmediate(cb)
  }
}

module.exports = EventStore
