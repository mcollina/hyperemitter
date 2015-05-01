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
var eos = require('end-of-stream')
var through2 = require('through2')
var xtend = require('xtend')
var duplexify = require('duplexify')
var deepEqual = require('deep-equal')
var STOREID = '!!STOREID!!'
var PEERS = '!!PEERS!!'
var MYEVENTPEER = '!!MYEVENTPEER!!'
var defaults = {
  reconnectTimeout: 1000
}

function HyperEmitter (db, schema, opts) {
  if (!(this instanceof HyperEmitter)) {
    return new HyperEmitter(db, schema, opts)
  }

  this.messages = protobuf(schema)
  this._db = db
  this._hyperlog = hyperlog(db)
  this._last = null
  this._opts = xtend(defaults, opts)
  this._listening = false
  this._parallel = fastparallel()
  this._clients = {}
  this._lastClient = 0
  this._listeners = {}
  this._closed = false

  var that = this
  this._hyperlog.heads(function (err, heads) {
    if (err) { return that.status.emit('error', err) }

    that._last = heads
  })

  Object.keys(headers).forEach(function (header) {
    that.messages[header] = headers[header]
  })

  this._hyperlog.ready(function () {
    if (that._closed) {
      return
    }

    that.status.emit('ready')

    that._changes =
      pump(
        that._hyperlog.createReadStream({ since: that._hyperlog.changes, live: true }),
        through2.obj(process)
      )
  })

  function process (change, enc, next) {
    that._last = change.key
    var header = headers.Event.decode(change.value)
    var event = that.messages[header.name].decode(header.payload)
    that._parallel(that, that._listeners[header.name] || [], event, next)
  }

  // the status of this HyperEmitter
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
      that.connect(peer.port, peer.address, cb)
    }, value, function () {})
  })
}

HyperEmitter.prototype.emit = function (name, data, cb) {
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

  this._hyperlog.add(this._last, header, cb)

  return this
}

HyperEmitter.prototype.on = function (name, callback) {
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

HyperEmitter.prototype.removeListener = function (name, func) {
  if (func.wrapped) {
    func = func.wrapped
  }

  this._listeners[name].splice(this._listeners[name].indexOf(func), 1)
  return this
}

HyperEmitter.prototype.getId = function (cb) {
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

function _connect (that, port, host, tries, cb) {
  var stream = net.connect(port, host)
  var key = host + ':' + port

  if (that._clients[key]) {
    return cb ? cb() : undefined
  }

  that._clients[key] = stream

  stream.on('connect', function () {
    var replicate = that._hyperlog.replicate({ live: true })
    pump(replicate, stream, replicate)

    var peers = Object.keys(that._clients).map(function (key) {
      var split = key.split(':')
      return { address: split[0], port: split[1] }
    })

    that._db.put(PEERS, JSON.stringify(peers), function (err) {
      if (cb) {
        cb(err) // what to do if cb is not specified?
        cb = null
      }
    })
  })

  eos(stream, function (err) {
    delete that._clients[key]
    if (err) {
      that.status.emit('connectionError', err, stream)
      if (!that._closed && tries < 10) {
        setTimeout(function () {
          _connect(that, port, host, cb)
        }, that._opts.reconnectTimeout)
      } else {
        return cb ? cb(err) : undefined
      }
    }
  })
}

HyperEmitter.prototype.connect = function (port, host, cb) {
  _connect(this, port, host, 1, cb)
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

HyperEmitter.prototype.listen = function (port, address, cb) {
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

      var toStore = {
        id: id,
        addresses: addresses
      }

      that._db.get(MYEVENTPEER, { valueEncoding: 'json' }, function (err, value) {
        if (err && !err.notFound) {
          return cb(err)
        }

        if (deepEqual(value, toStore)) {
          return cb(null, that._server.address())
        }

        that.emit('EventPeer', toStore, function (err) {
          if (err) { return cb(err) }

          that._db.put(MYEVENTPEER, JSON.stringify(toStore), function (err) {
            if (err) { return cb(err) }

            cb(null, that._server.address())
          })
        })
      })
    })
  })
}

HyperEmitter.prototype.stream = function (opts) {
  var that = this
  var result = duplexify.obj()
  var input = through2.obj(function (chunk, enc, next) {
    that.emit(chunk.name, chunk.payload, next)
  })

  result.setWritable(input)

  that._hyperlog.ready(function () {
    var filter = through2.obj(function (change, enc, next) {
      var header = headers.Event.decode(change.value)
      var event = that.messages[header.name].decode(header.payload)
      this.push({
        name: header.name,
        payload: event
      })
      next()
    })

    var since = opts && opts.from === 'beginning' ? 0 : that._hyperlog.changes

    pump(that._hyperlog.createReadStream({
      since: since,
      live: true
    }), filter)

    result.setReadable(filter)
  })

  return result
}

HyperEmitter.prototype.close = function (cb) {
  var that = this

  if (this._changes) {
    this._changes.destroy()
  }

  var toClose = [that._db]
  if (that._listening) {
    toClose.push(that._server)
  }
  this._closed = true

  Object.keys(this._clients).forEach(function (key) {
    toClose.unshift(that._clients[key])
  })
  that._parallel(that, doClose, toClose, cb || function nop () {})
}

function doClose (stuff, cb) {
  if (stuff.close) {
    stuff.close(cb)
  } else {
    stuff.destroy()
    setImmediate(cb)
  }
}

module.exports = HyperEmitter
