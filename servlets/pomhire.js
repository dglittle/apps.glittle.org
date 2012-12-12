
var ns = "pomhire"
function myRegister(path, func) {
    register('/' + ns + path, func)
}
var db = ensure(global.db, ns, {})

ensure(db, "signups", [])

myRegister('', function (q) {
    if (q.s) {
        if (q.s.length < 10000) {
            db.signups.push(q.s)
        } else {
            db.signups.push("too long: " + q.s.length)
        }
    }
    return getStaticFile('./servlets/' + ns + '.html')
})

register('/favicon.ico', function () {
    return {
        data : getStaticFile('./images/orange-tomato.png', null),
        "Content-Type" : "image/png"
    }
})

myRegister('/pom.png', function () {
    return {
        data : getStaticFile('./images/orange-tomato.png', null),
        "Content-Type" : "image/png"
    }
})

/////////////////////////////////////////////////////////////////
// version 0.001

if (!db.version || db.version < 1) {
    db.version = 1
    db.objs = {}
    db.peopleToPoms = {}
}
if (!db.version || db.version < 2) {
    db.version = 2
    db.piratePad = "http://piratepad.net/KndYcGpeJ7"
    createPom("0.01259", "hello there 1")
    createPom("0.01259", "hello there 2")
}
if (!db.version || db.version < 3) {
    db.version = 3
    delete db.peopleToPoms
    db.objs = {}
}
if (!db.version || db.version < 4) {
    db.version = 4
    delete db.objs
    db.poms = {}
}
if (!db.version || db.version < 5) {
    db.version = 5
    db.oldPoms = {}
}

function createPom(user, pom) {
    if (pom.length > 20) error('key too long')
        
    var p = db.oldPoms[pom]
    if (p) {
        delete p.deleted
        db.poms[p.key] = p
        return p
    }
        
    var p = {}
    p.key = pom
    p.time = now
    p.user = user
    p.desc = 'untitled'
    //p.piratePad = 'http://23.21.59.136:9001/p/' + randomIdentifier(10)
    p.piratePad = 'http://piratepad.net/' + randomIdentifier(10)
    p.readyPeople = {}
    p.peopleCount = 0
    db.poms[p.key] = p
    db.oldPoms[p.key] = p
    return p
}

function joinPom(user, pom) {
    var p = db.poms[pom]
    if (!p && pom) {
        p = createPom(user, pom) 
    }
    if (p) {
        p.peopleCount++
    }
    return p
}

function leavePom(user, pom) {
    var p = db.poms[pom]
    if (p) {
        p.peopleCount--
        if (p.peopleCount == 0) {
//        if (p.user == user || p.peopleCount == 0) {

// work here : deleting disabled for now

//            delete db.poms[p.key]
//            p.deleted = true
        }
    }
    return p
}

function readyPom(user, pom) {
    var p = db.poms[pom]
    if (p) {
        p.readyPeople[user] = true
        if (keys(p.readyPeople).length == 2) {
            p.deadline = time() + (1000 * 60 * 20)
        }
    }
    return p
}

function changeDesc(user, pom, desc) {
    if (desc.length > 140) error('description too long (140 characters maximum)')
    var p = db.poms[pom]
    if (p) {
        p.desc = desc
    }
    return p
}

myRegister('/version0.001', function (q) {
    return getStaticFile('./servlets/pomhire_version1.html')
})

g_pomhire_channelVersion = 2

registerChannel(ns, function (socket, session, channel) {
    var myChannelVersion = g_pomhire_channelVersion
        
    function tellPeople(p, exceptMe) {
        var poms = {}
        poms[p.key] = p.deleted ? null : p
        var reload = (myChannelVersion != g_pomhire_channelVersion)
        if (exceptMe) {
            socket.broadcast.in(ns).emit('update', { cmd : 'update pom', poms : poms, reload : reload, time : time() })
        } else {
            io.sockets.in(ns).emit('update', { cmd : 'update pom', poms : poms, reload : reload, time : time() })
        }
    }
    
    var user = session.key
    var currentPom = channel.pom
    var p = joinPom(user, currentPom)
    if (p)
        tellPeople(p, true)
    
    socket.join(ns)
    socket.emit('update', { cmd : 'refresh', time : time(), model : {
        user : user,
        piratePad : db.piratePad,
        poms : db.poms
    } })
    
    socket.on('update', function (o, func) {
        if (o.cmd == 'ready pom') {
            var p = readyPom(user, currentPom)
            if (p)
                tellPeople(p)
        } else if (o.cmd == 'change desc') {
            var p = changeDesc(user, currentPom, o.desc)
            if (p)
                tellPeople(p)
        }
        if (func)
            func()
    })
    socket.on('disconnect', function () {
        var p = leavePom(user, currentPom)
        if (p)
            tellPeople(p)
    })
})

