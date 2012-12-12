
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

