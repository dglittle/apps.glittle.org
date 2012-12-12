
child_process = require('child_process')
fs = require('fs')
url = require('url')
querystring = require('querystring')
crypto = require('crypto')
http = require('http')
config = require('./_config.js')
require('./myutil.js')

consume = function (input, encoding, cb) {
    if (encoding == 'buffer') {
        var buffer = new Buffer(1 * input.headers['content-length'])
        var cursor = 0
    } else {
        var chunks = []
        input.setEncoding(encoding || 'utf8')
    }
    
    input.on('data', function (chunk) {
        if (encoding == 'buffer') {
            chunk.copy(buffer, cursor)
            cursor += chunk.length
        } else {
            chunks.push(chunk)
        }
    })
    function onDone() {
        if (encoding == 'buffer') {
            cb(buffer)
        } else {
            cb(chunks.join(''))
        }
    }
    input.on('end', onDone)
    input.on('close', onDone)
}

wget = function (url, params, encoding, cb) {
    var u = global.url.parse(url)
    
    var o = {
        method : params ? 'POST' : 'GET',
        hostname : u.hostname,
        path : u.path
    }
    if (u.port)
        o.port = u.port
    
    var data = ""
    if (params) {
        data = values(map(params, function (v, k) { return escapeUrl(k) + "=" + escapeUrl(v) })).join('&')
        
        o.headers = {
            "Content-Type" : "application/x-www-form-urlencoded",
            "Content-Length" : Buffer.byteLength(data, 'utf8')
        }
    }
    
    var req = require(u.protocol.replace(/:/, '')).request(o, function (res) {
        consume(res, encoding, cb)
    })
    req.end(data, 'utf8')
}


var oldInterval

function respawn() {
    clearInterval(oldInterval)
    
    console.log("respawning...")
    
    var log = fs.createWriteStream('_log.txt', {'flags': 'a'})
    log.end("respawning at : " + time() + "\n")
    
    var p = child_process.spawn('node', ['server.js'])
    p.stdout.on('data', function (data) { console.log("" + data) })
    p.stderr.on('data', function (data) { console.log("" + data) })
    p.on('exit', function () {
        setTimeout(function () {
            respawn()
        }, 2000)
    })
    
    oldInterval = setInterval(function () {
        var t = setTimeout(function () {
            console.log("unresponsive.. killing..")
            p.kill('SIGKILL')
        }, 5 * 1000)
        console.log("still alive?")
        wget('http://' + config.host + '/admin/alive', null, 'utf8', function (s) {
            console.log("..yep")
            clearTimeout(t)
        })
    }, 10 * 1000)
}    
respawn()

process.on('uncaughtException', function (err) {
    console.log('uncaught exception: ' + err.stack)
})

