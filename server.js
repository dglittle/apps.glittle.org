
firstRun = typeof(firstRun) == "undefined" 
if (firstRun)
    require('fibers')

Fiber(function () {        
    fs = require('fs')
    url = require('url')
    querystring = require('querystring')
    exec = require('child_process').exec
    crypto = require('crypto')
    http = require('http')

    require('./myutil')
    require('./nodeutil')
    config = require('./_config')
    s3 = new (require('./s3').s3)(config.aws.id, config.aws.secret, config.s3.bucket)
    mturk = require('./mturk')
    
    now = time()
    
    // db stuff
    if (firstRun) {
        try {
            db = unJson(s3.get(s3.get('/db/current')))
        } catch (e) {
            db = {}
        }
    }
    function saveDb() {
        if (!config.saveDb) return
            
        try {
            var oldPath = s3.get('/db/current')
        } catch (e) {
        }
    
        var path = '/db/' + randomIdentifier(10)
        s3.put(path, json(decycle(db), "    "))
        s3.put('/db/current', path)
        
        if (Math.random() < (1 / 144)) {
            // don't delete it. keep it as a backup (about 1 per day),
            // since we're saving every 10 minutes
        } else {
            if (oldPath) {
                s3.del(oldPath)
            }
        }
    }
    if (typeof(saveDbInterval) != "undefined")
        clearInterval(saveDbInterval)
    saveDbInterval = setInterval(function () {
        run(function () {
            saveDb()
        })
    }, 1000 * 60 * 10)
    
    // register
    _pathToFunc = {}
    _reToFunc = {}
    register = function (path, func) {
        _pathToFunc[path] = func
    }
    registerRe = function (re, func) {
        _reToFunc[re] = func
    }
    registerAdmin = function (path, func) {
        register(path, function (q) {
            if (config.local || (q.session && q.session.admin) || (q.login && q.login.admin) || (config.adminPassword && config.adminPassword == q.adminPassword)) {
                q.session.admin = true
                return func.apply(this, arguments)
            } else {
                error("access denied")
            }
        })
    }
    getRegisteredFunc = function (path) {
        var f = _pathToFunc[path]
        if (f) return f
        foreach(_reToFunc, function (ff, re) {
            if (path.match(new RegExp(re))) {
                f = ff
                return false
            }
        })
        return f
    }
    
    // sessions
    if (typeof sessionDb == "undefined") {
        sessionDb = {}
    }
    function getSession(c) {
        if (c && c.headers) c = c.headers.cookie
        var key = getCookies(c).sessionKey || ("" + Math.random())
        return ensure(sessionDb, key, { key : key, time : now })
    }
    function setSessionCookie(s) {
        return 'sessionKey=' + s.key + ';' +
            ' expires=' + (new Date(now + 1000 * 60 * 60 * 24 * 365)).toUTCString() + '; path=/'
    }
    function removeSession(s) {
        delete sessionDb[s.key]
    }
    
    // web sockets
    _channels = {}
    registerChannel = function (name, func) {
        _channels[name] = func
    }
    onConnect = function (socket) {
        var session = sessionDb[getCookies(socket.handshake.headers.cookie).sessionKey]
        socket.on('channel', function (channel, func) {
            _channels[(typeof(channel) == "string") ? channel : channel.channel](socket, session, channel)
            if (func) func()
        })
    }
    
    // static files
    _staticFiles = {}
    getStaticFile = function (path, encoding) {
        if (path in _staticFiles) return _staticFiles[path]
        if (encoding === undefined) encoding = 'utf8' 
        var s = fiberize(fs.readFile, path, encoding)
        if (encoding == 'utf8') {
            s = s.replace(/\{\{(.*?)\}\}/g, function (g0, g1) {
                return eval(g1)
            })
        }
        return _staticFiles[path] = s
    }
    
    // login stuff
    
    login = require('./login')
    
    // register default stuff
    
    register('/myutil.js', function () {
        return getStaticFile('./myutil.js')
    })
    foreach(fiberize(fs.readdir, './clientJs'), function (file) {
        register('/' + file, function () {
            return getStaticFile('./clientJs/' + file)
        })
    })
    
    foreach(fiberize(fs.readdir, './images'), function (file) {
        register('/' + file, function () {
            return {
                data : getStaticFile('./images/' + file, null),
                "Content-Type" : "image/" + file.match(/[^\.]*$/)[0]
            }
        })
    })
    
    foreach(fiberize(fs.readdir, './fonts'), function (file) {
        register('/' + file, function () {
            return {
                data : getStaticFile('./fonts/' + file, null),
                "Content-Type" : "font/opentype"
            }
        })
    })
    
    registerAdmin("/admin/saveDb", saveDb)
    
    register(config.github.hook, function () {
        var r = fiberize(exec, "git pull https://" + config.github.username + ":" + config.github.password + "@" + config.github.repo + " master")
        return r.join('')
    })
    
    registerAdmin("/admin/kill", function () {
        process.exit(0)
    })
    
    registerAdmin("/admin/jsonBrowser", function () {
        return getStaticFile("jsonBrowser.html")
    })
    registerAdmin("/admin/db", function () {
        return json(decycle(db), "    ")
    })
    registerAdmin("/admin/eval", function (q) {
        return eval(q.code)
    })
    
    register("/admin/alive", function (q) {
        return "yes"
    })
    
    register("/admin/clearSession", function (q) {
        removeSession(q.session)
    })
    
    registerAdmin("/admin/loop", function (q) {
        var start = time()
        while (time() < start + 60 * 1000) {}
    })
    
    // servlets
    
    foreach(fiberize(fs.readdir, './servlets'), function (file) {
        if (file.match(/\.js$/)) {
            require('./servlets/' + file)
        }
    })

    // request handler
    
    onReq = function (req, res) {
        var startTime = time()
        try {
            now = time()
            
            var p = url.parse(req.url, true)
            var func = getRegisteredFunc(p.pathname)
            var q = p.query
            
            var postData = (req.method == 'POST') ? consume(req) : null
            if (postData) {
                merge(q, querystring.parse(postData))
            }
            
            q.session = getSession(req)
            q.login = login.getUser(req)
            
            var ret = func(q)
            
            if (typeof(ret) == "string") {
                res.writeHead(200, {
                    'Set-Cookie' : setSessionCookie(q.session),
                    'Content-Type' : 'text/html'
                })
                res.end(ret)
            } else if (typeof(ret) == "object" && ret['Content-Type']) {
                var code = ret.code || 200
                delete ret.code
                
                var data = ret.data
                delete ret.data
                
                if (ret['Content-Type'] === true) {
                    delete ret['Content-Type']
                }
                
                res.writeHead(code, ret)
                res.end(data)
            } else {
                res.writeHead(200, {
                    'Set-Cookie' : setSessionCookie(q.session),
                    'Content-Type' : 'application/json'
                })
                if (ret === undefined) ret = null
                res.end(json(ret))
            }
        } catch (e) {
            res.writeHead(500, {'Content-Type': 'text/plain'})
            res.end(e.stack)
        }
        if (config.logAccesses)
            console.log(p.pathname + " " + (time() - startTime))
    }
    
    // code reloading
    
    function reload() { 
        oldOnReq = onReq
        oldPathToFunc = _pathToFunc
        oldReToFunc = _reToFunc
        try {
            console.log("reloading...")
            for (m in require.cache) {
                delete require.cache[m]
            }
            require('./server.js')
            console.log("...loaded")
        } catch (e) {
            onReq = oldOnReq
            _pathToFunc = oldPathToFunc
            _reToFunc = oldReToFunc
            console.log(e.stack)
        }
    }
    if (typeof _watchers != "undefined") {
        foreach(_watchers, function (w) { w.close() })
    }
    _watchers = []
    _watcherTimeout = null
    function onWatch() {
        if (_watcherTimeout) clearTimeout(_watcherTimeout)
        _watcherTimeout = setTimeout(reload, 500)
    }
    _watchers.push(fs.watch('.', onWatch))
    _watchers.push(fs.watch('./clientJs', onWatch))
    _watchers.push(fs.watch('./servlets', onWatch))
    _watchers.push(fs.watch('./images', onWatch))
    
    registerAdmin('/admin/reload', reload)

    // actual web server
    
    if (firstRun) {
        process.on('uncaughtException', function (err) {
            console.log('uncaught exception: ' + err.stack)
        })
        
        var app = http.createServer(function (req, res) {
            run(function () {
                onReq(req, res)
            })
        })
        
        io = require('socket.io').listen(app)
        if (!config.local) {
            // production settings from https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
            io.enable('browser client minification');  // send minified client
            io.enable('browser client etag');          // apply etag caching logic based on version number
            io.enable('browser client gzip');          // gzip the file
            io.set('log level', 1);                    // reduce logging
            io.set('transports', [                     // enable all transports (optional if you want flashsocket)
                'websocket'
              , 'flashsocket'
              , 'htmlfile'
              , 'xhr-polling'
              , 'jsonp-polling'
            ]);
        }
        io.sockets.on('connection', function (socket) {
            onConnect(socket)
        })
        
        app.listen(config.port)
        console.log('serving...')
    }
        
    
}).run()

