
var ns = "pomhire2"
function myRegister(path, func) {
    register('/' + ns + path, func)
}
var db = ensure(global.db, ns, {})

myRegister('', function (q) {
    return getStaticFile('./servlets/' + ns + '.html')
})

if (!db.version || db.version < 8) {
    db.version = 8
    db.users = {}
    db.chats = {}
    db.sessionToUser = {}
}

function getUserFromSession(session) {
    var user = db.sessionToUser[session.key]
    if (!user) {
        user = db.sessionToUser[session.key] = newUser()
    }
    return user
}

function newObj() {
    return {
        key : randomIdentifier(10),
        time : time()
    }
}

function newUser() {
    var u = newObj()
    u.name = 'anonymous'
    u.skills = ''
    u.img = ''
    u.chats = {}
    u._alerts = true
    return db.users[u.key] = u
}

function getDiff_setUser(_db, dest, src) {
    if (!db.users[dest.key]) error('invalid dest user')
    if (src.name && src.name.length > 64) error('name too long')
    if (src.skills && src.skills.length > 512) error('skills too long')
    if (src.img && src.img.length > 1024) error('image url too long')
    
    dest = ensure(_db, 'users', dest.key, {})
    if (src.name) dest.name = src.name
    if (src.skills) dest.skills = src.skills
    if (src.img) dest.img = src.img
    if (src.available != null) dest.available = !!src.available
    if (src._alerts != null) dest._alerts = !!src._alerts
}

function getDiff_enterChat(_db, user, chat) {
    ensure(_db, 'users', user.key, 'chats', {})[chat.key] = true
    ensure(_db, 'chats', chat.key, 'users', {})[user.key] = true
    ensure(_db, 'users', user.key, {}).available = false
    getDiff_sendMessage(_db, chat, null, user.name + ' is here')
}

function getDiff_leaveChat(_db, user, chat) {
    ensure(_db, 'users', user.key, 'chats', {})[chat.key] = null
    ensure(_db, 'chats', chat.key, 'users', {})[user.key] = null
    getDiff_sendMessage(_db, chat, null, user.name + ' left')
}

function getDiff_newChat(_db, users) {
    var c = newObj()
    c.users = {}
    c.timer = {}
    c.messages = {}
    
    ensure(_db, 'chats', {})[c.key] = c
    
    foreach(users, function (_, k) {
        getDiff_enterChat(_db, db.users[k], c)
    })
}

function getDiff_connect(_db, user) {
    ensure(_db, 'users', user.key, {}).online = true
    ensure(_db, 'users', user.key, {}).lastOnline = time()
    foreach(user.chats, function (_, k) {
        var c = db.chats[k]
        getDiff_sendMessage(_db, c, null, user.name + ' connected')
    })
}

function getDiff_disconnect(_db, user) {
    ensure(_db, 'users', user.key, {}).online = false
    foreach(user.chats, function (_, k) {
        var c = db.chats[k]
        getDiff_sendMessage(_db, c, null, user.name + ' disconnected')
    })
}

function getDiff_sendMessage(_db, chat, username, message) {
    if (message.length > 10 * 1024) error('message too long')
    var m = newObj()
    m.username = username
    m.text = message
    ensure(_db, 'chats', chat.key, 'messages', {})[m.key] = m 
}

global["g_channelVersion_for_" + ns] = 1

if (!global["g_userToSocket_for_" + ns]) {
    global["g_userToSocket_for_" + ns] = {}
}

registerChannel(ns, function (socket, session, channel) {
    socket.join(ns)
    
    var myChannelVersion = global["g_channelVersion_for_" + ns]
    function emit(m, dest) {
        m.reload = (myChannelVersion != global["g_channelVersion_for_" + ns])
        m.time = time()
        if (typeof(dest) == 'object') {
            foreach(dest, function (e, k) {
                var s = e
                if (e === true) s = k
                if (typeof(s) == 'string') s = db.users[s]
                if (s.key) s = global["g_userToSocket_for_" + ns][s.key]
                
                s.emit('update', m)
            })
        } else if (dest == 'me') {
            socket.emit('update', m)
        } else if (dest == 'not me') {
            socket.broadcast.in(ns).emit('update', m)
        } else {
            io.sockets.in(ns).emit('update', m)
        }
    }
    
    var user = getUserFromSession(session)
    
    var oldSocket = global["g_userToSocket_for_" + ns][user.key]
    if (oldSocket) {
        oldSocket.disconnect()
    }
    global["g_userToSocket_for_" + ns][user.key] = socket
    
    var _db = {}
    merge(ensure(_db, 'users', user.key, {}), user)
    getDiff_connect(_db, user)
    deepMerge(db, _db)
    emit({ cmd : 'update', db : _db }, 'not me')
    
    emit({
        cmd : 'refresh',
        db : {
            me : user.key,
            users : filter(db.users, function (e) { return e.online }),
            chats : map(user.chats, function (_, k) { return db.chats[k] })
        }
    }, 'me')
    
    socket.on('update', function (o, func) {
        var _db = {}
        var dest = 'all'
        
        if (o.cmd == 'update user') {
            if (user.key == o.user.key) {
                getDiff_setUser(_db, user, o.user)
            } else {
                error('you can only edit your own information')
            }
        } else if (o.cmd == 'new chat') {
            if (keys(o.users).length > 2) error('too many people')
            foreach(o.users, function (_, k) {
                var u = db.users[k]
                if (u.available || u.key == user.key) {
                } else {
                    error('invalid chat')
                }
            })
            getDiff_newChat(_db, o.users)
        } else if (o.cmd == 'leave chat') {
            var chat = db.chats[o.chat]
            getDiff_leaveChat(_db, user, chat)
        } else if (o.cmd == 'send message') {
            var chat = db.chats[o.chat]
            getDiff_sendMessage(_db, chat, user.name, o.message)
            dest = chat.users
        } else {
            error('unknown command: ' + cmd)
        }
        
        deepMerge(db, _db)
        emit({ cmd : 'update', db : _db }, dest)
        
        if (func)
            func()
    })
    socket.on('disconnect', function () {
        var _db = {}
        getDiff_disconnect(_db, user)
        deepMerge(db, _db)
        emit({ cmd : 'update', db : _db }, 'not me')
    })
})

