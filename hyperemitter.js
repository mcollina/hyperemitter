var EventEmitter = require('events').EventEmitter
var hyperlog = require('hyperlog')
var net = require('net')
var cuid = require('cuid')
var os = require('os')
var pump = require('pump')
var fastparallel = require('fastparallel')
var eos = require('end-of-stream')
var bulkws = require('bulk-write-stream')
var through2 = require('through2')
var xtend = require('xtend')
var duplexify = require('duplexify')
var deepEqual = require('deep-equal')
var noop = function () {}

var STOREID = '!!STOREID!!'
var PEERS = '!!PEERS!!'
var MYEVENTPEER = '!!MYEVENTPEER!!'
var defaults = {
  reconnectTimeout: 1000
}

var fs = require('fs')
var path = require('path')
var protobuf = require('protocol-buffers')
var coreCodecs = protobuf(fs.readFileSync(path.join(__dirname, 'codecs.proto')))

function initializeCodecs (codecs) {
  codecs = codecs || []

  if (Buffer.isBuffer(codecs) || typeof codecs === 'string') {
    codecs = protobuf(codecs)
  }

  Object.keys(coreCodecs).forEach(function (name) {
    codecs[name] = coreCodecs[name]
  })

  return codecs
}

function createChangeStream () {
  var readStream = this._hyperlog.createReadStream({
    since: this._hyperlog.changes,
    live: true
  })

  return pump(readStream, bulkws.obj(processStream.bind(this)))
}

function processStream (changes, next) {
  var that = this

  that._parallel(that, publish, changes, next)
}

function publish (change, done) {
  var container = this.codecs.Event.decode(change.value)
  var name = container.name
  var decoder = this.codecs[name]
  var event = container.payload

  if (decoder) event = decoder.decode(event)
  this._parallel(this, this._listeners[name] || [], event, done)
}

function createServer () {
  var that = this

  this._server = net.createServer(function (peerStream) {
    that.status.emit('peerConnected')

    var peerId = that._lastPeerId++
    var localStream = that._hyperlog.replicate({live: true})
    var boundStreams = pump(peerStream, localStream, peerStream, function (err) {
      if (err) that.status.emit('peerError', err)
      else delete that._peers[peerId]
    })

    that._peers[peerId] = boundStreams
  })
}

function getLocalAddresses () {
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

function connectToPeer (that, port, host, tries, callback) {
  var stream = net.connect(port, host)
  var key = host + ':' + port

  if (that._peers[key]) {
    return callback ? callback() : undefined
  }

  that._peers[key] = stream

  stream.on('connect', function () {
    var replicate = that._hyperlog.replicate({ live: true })
    pump(replicate, stream, replicate)

    var peers = Object.keys(that._peers).map(function (key) {
      var split = key.split(':')
      return { address: split[0], port: split[1] }
    })

    that._db.put(PEERS, JSON.stringify(peers), function (err) {
      if (callback) {
        callback(err)
        callback = null
      }
    })
  })

  eos(stream, function (err) {
    delete that._peers[key]
    if (err) {
      that.status.emit('connectionError', err, stream)
      if (!that._closed && tries < 10) {
        setTimeout(function () {
          connectToPeer(that, port, host, tries + 1, callback)
        }, that._opts.reconnectTimeout)
      } else {
        return callback ? callback(err) : undefined
      }
    }
  })
}

function connectToKnownPeers () {
  var that = this

  this._db.get(PEERS, function (err, peers) {
    if (err && err.notFound) return
    if (err) return that.status.emit('error', err)

    function connectToPeer (peer, next) {
      that.connect(peer.port, peer.address, next)
    }

    that._parallel(that, connectToPeer, JSON.parse(peers), noop)
  })
}

function handleNewPeers () {
  var that = this

  this.on('EventPeer', function (peer, callback) {
    var port = peer.addresses[0].port
    var address = peer.addresses[0].ip

    if (peer.id !== peer.id) that.connect(port, address, callback)
    else callback()
  })
}

function destroyOrClose (resource, callback) {
  if (resource.destroy) {
    resource.destroy()
    setImmediate(callback)
  } else {
    resource.close(callback)
  }
}

function HyperEmitter (db, codecs, opts) {
  if (!(this instanceof HyperEmitter)) {
    return new HyperEmitter(db, codecs, opts)
  }

  this._opts = xtend(defaults, opts)
  this._parallel = fastparallel({ results: false })
  this._db = db
  this._hyperlog = hyperlog(db)

  this._closed = false
  this._listening = false

  this._peers = {}
  this._lastPeerId = 0
  this._listeners = {}

  this.status = new EventEmitter()
  this.codecs = initializeCodecs(codecs)
  this.messages = this.codecs

  createServer.call(this)
  connectToKnownPeers.call(this)
  handleNewPeers.call(this)

  var that = this
  this._hyperlog.ready(function () {
    if (that._closed) return

    that.changeStream = createChangeStream.call(that)
    that.changes = that.changeStream
    that.status.emit('ready')
  })

}

HyperEmitter.prototype.emit = function (name, data, callback) {
  var encoder = this.codecs[name]

  if (encoder) data = encoder.encode(data)
  var container = this.codecs.Event.encode({
    name: name,
    payload: data
  })

  this._hyperlog.append(container, callback)

  return this
}

HyperEmitter.prototype.on = function (name, handler) {
  var toInsert = handler

  if (toInsert.length < 2) {
    toInsert = function (msg, callback) {
      handler(msg)
      callback()
    }

    handler.wrapped = toInsert
  }

  this._listeners[name] = this._listeners[name] || []
  this._listeners[name].push(toInsert)

  return this
}

HyperEmitter.prototype.registerCodec = function (name, codec) {
  if (typeof name === 'string') {
    this.codecs[name] = codec
    return this
  }

  var codecs = name
  var that = this

  if (Array.isArray(codecs)) {
    codecs.forEach(function (element) {
      that.codecs[element.name] = element.codec
    })
    return that
  }

  if (typeof codecs === 'object') {
    Object.keys(codecs).forEach(function (name) {
      that.codecs[name] = codecs[name]
    })
    return that
  }

  return this
}

HyperEmitter.prototype.removeListener = function (name, func) {
  if (func.wrapped) {
    func = func.wrapped
  }

  this._listeners[name].splice(this._listeners[name].indexOf(func), 1)
  return this
}

HyperEmitter.prototype.getId = function (callback) {
  if (this.id) { return callback(null, this.id) }

  var that = this
  var db = this._db

  db.get(STOREID, function (err, value) {
    if (err && !err.notFound) { return callback(err) }
    that.id = value || cuid()
    db.put(STOREID, that.id, function (err) {
      if (err) {
        return callback(err)
      }
      callback(null, that.id)
    })
  })
}

HyperEmitter.prototype.connect = function (port, host, callback) {
  connectToPeer(this, port, host, 1, callback)
}

HyperEmitter.prototype.listen = function (port, address, callback) {
  var that = this

  if (typeof address === 'function') {
    callback = address
    address = null
  }

  this._listening = true

  this.getId(function (err, id) {
    if (err) {
      return callback(err)
    }

    that._server.listen(port, address, function (err) {
      if (err) {
        return callback(err)
      }

      var addresses = address ? [{ address: address }] : getLocalAddresses()

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
          return callback(err)
        }

        if (deepEqual(value, toStore)) {
          return callback(null, that._server.address())
        }

        that.emit('EventPeer', toStore, function (err) {
          if (err) { return callback(err) }

          that._db.put(MYEVENTPEER, JSON.stringify(toStore), function (err) {
            if (err) { return callback(err) }

            callback(null, that._server.address())
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
      var container = that.codecs.Event.decode(change.value)
      var name = container.name
      var decoder = that.codecs[name]
      var event = container.payload

      if (decoder) event = decoder.decode(event)

      this.push({
        name: name,
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

HyperEmitter.prototype.close = function (callback) {
  var resources = [this._db]

  if (this.changeStream) resources.push(this.changeStream)
  if (this._listening) resources.push(this._server)

  var that = this
  Object.keys(this._peers).forEach(function (peerId) {
    resources.unshift(that._peers[peerId])
  })

  this._closed = true
  this._parallel(this, destroyOrClose, resources, callback || noop)
}

module.exports = HyperEmitter
