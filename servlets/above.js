
var ns = "above"
function myRegister(path, func) {
    register('/' + ns + path, func)
}
var db = ensure(global.db, ns, {})

if (!db.version || db.version < 1) {
    db.version = 1
    db.objs = {}
}
if (db.version < 2) {
    db.version = 2
    db.points = {}
}
if (db.version < 3) {
    db.version = 3
    db.users = {}
}

///

var h = 30

function isValidPoint(p) {
    if (p.x < 0 || p.y < 0 || p.x > 400 || p.y > 400) return false
        
    if ((p.x - 5) % 10 != 0) return false
    if ((p.y - 5) % 10 != 0) return false
        
    return p.x < 400 / 3 || p.x > 400*2/3 || p.y < 200 - (h / 2) || p.y > 200 + (h / 2)
}

function randomPoint() {
    while (true) {
        var p = {
            x : randomIndex(400 / 10) * 10 + 5,
            y : randomIndex(400 / 10) * 10 + 5
        }
        if (isValidPoint(p)) break
    }
    return p
}

function setPoint(x, y, yes) {
    var p = { x : x, y : y }
    if (!isValidPoint(p)) throw "error"
    var key = '' + x + ',' + y
    var o = db.points[key]
    if (!o) {
        p.yesses = 0
        p.noes = 0
        o = db.points[key] = p
    }
    if (yes) o.yesses++
    else o.noes++
}

function getUser(q) {
    var u = db.users[q.session.key]
    if (!u) {
        u = db.users[q.session.key] = {
            randomPoint : randomPoint(),
            setPoint : false
        }
    }
    return u
}

myRegister('', function (q) {
    var u = getUser(q)
        
    if (q.command == 'setPoint') {
        u.setPoint = true
        var args = unJson(q.args)
        setPoint(args.x, args.y, args.yes)
        return db.points
    } else if (q.session.admin && q.command == 'clearPoints') {
        db.points = {}
        db.users = {}
        return "done"
    } else {
        var data = {}
        if (u.setPoint) {
            data = { points : db.points }
        } else {
            data = { randomPoint : u.randomPoint }
        }
        var s = getStaticFile('./servlets/' + ns + '.html')
        s = s.replace(/@@@data@@@/g, json(data))
        return s
    }
})

