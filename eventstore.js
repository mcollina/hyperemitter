var inherits = require('util').inherits
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
var STOREID = '!!STOREID!!'

function EventStore(db, schema, opts) {
  if (!(this instanceof EventStore)) {
    return new EventStore(db, schema, opts)
  }

  this._messages = protobuf(schema)
  this._db = db
  this._hyperlog = hyperlog(db)
  this._last = []
  this._opts = opts || {}
  this._listening = false

  genWriters(this, this._messages)

  var that = this
  this._hyperlog.heads(function(err, heads) {
    if (err) { return that.emit('error', err) }

    that._last = that._last.concat(heads)
  })

  // TODO restore only from a given point
  this._changes = this._hyperlog.createReadStream({ live: true })

  this._changes.on('data', function process(change) {
    var header = headers.Event.decode(change.value)
    var event;

    switch (header.name) {
      case 'EventPeer':
        event = headers[header.name].decode(header.payload)
        that.connect(event.addresses[0])
        break;
      default:
        event = that._messages[header.name].decode(header.payload)
        that.emit(header.name, event)
    }
  })

  this._server = net.createServer(function handle(stream) {
    var replicate = that._hyperlog.replicate()
    pump(stream, replicate, stream)
  })
}

inherits(EventStore, EventEmitter)

function genWriters(that, messages) {
  Object.keys(messages).map(function(key) {
    return messages[key]
  }).reduce(genWriter, that)
}

function genWriter (that, msg) {
  if (msg.encode) {
    that['put' + msg.name] = function writer(data, cb) {
      this.putEvent({
        name: msg.name,
        payload: msg.encode(data)
      }, cb)
    }
  } else {
    genWriters(that, msg)
  }

  return that
}

EventStore.prototype.putEvent = function (data, cb) {
  var header = headers.Event.encode(data)
  var that = this

  this._hyperlog.add(this._last, header, function (err, node) {
    if (err) { return cb(err) }

    that._last.push(node.key)
    cb()
  })

  this._last = []
}

EventStore.prototype.getId = function (cb) {
  if (this.id) { return cb(null, id) }

  var that = this
  var db = this._db

  db.get(STOREID, function(err, value) {
    that.id = value || cuid()
    db.put(STOREID, that.id, function(err) {
      if (err) { return cb(err) }
      cb(null, that.id)
    })
  })
}

EventStore.prototype.connect = function (port, host, cb) {
  var stream = net.connect(port, host)
  var that = this

  stream.on('connect', function() {
    var replicate = that._hyperlog.replicate()
    pump(stream, replicate, stream)

    if (cb) {
      stream.removeListener('error', cb)
      cb()
    }
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
    if (err) { return cb(err) }

    that._server.listen(port, address, function (err) {
      if (err) { return cb(err) }

      var addresses = address ? [address] : localIps()

      addresses = addresses.map(function (ip) {
        return {
          ip: ip.address,
          port: port
        }
      })

      that.putEvent({
        name: 'EventPeer',
        payload: headers.EventPeer.encode({
          id: that.id,
          addresses: addresses
        })
      }, cb)
    })
  })
}

EventStore.prototype.close = function (cb) {
  var count = this._listening? 2 : 1
  this._changes.destroy()
  this._db.close(release)

  if (this._listening) {
    this._server.close(release)
  }

  function release(err) {
    if (err) { return cb(err) }

    if (--count === 0) { return cb() }
  }

}

module.exports = EventStore
