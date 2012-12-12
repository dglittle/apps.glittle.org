
////////////////////////////////////////////////////////////////
// Facebook Stuff
// adapted from http://coolaj86.info/articles/facebook-with-node.js.html

var get_fb_cookie = function (req, appId, secret) {
    var c = getCookies(req)
    
    var fb_cookie = c['fbs_' + appId]
    if (fb_cookie) {
        var args = querystring.parse(fb_cookie.replace(/^"|"$/g, ''))
    
        var x = map(keys(args).sort(), function (key) {
            if (key == 'sig') return ""
            return key + '=' + args[key]
        }).join('')
        
        if (args.sig != crypto.createHash('md5').update(x + secret).digest('hex'))
            return null
        
        return args
    }
    
    var fb_cookie = c['fbsr_' + appId]
    if (fb_cookie) {
        var x = fb_cookie.split('.')
        
        var o = unJson((new Buffer(x[1], 'base64')).toString('utf8'))
        if (o.algorithm != "HMAC-SHA256")
            error("unknown algorithm for signing FB cookie: " + o.algorithm)
        
        if (x[0] != crypto.createHmac('SHA256', secret).update(x[1]).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''))
            return null
        
        o.uid = o.user_id
        return o
    }
}

register('/fb_channel', function () {
    var e = 60*60*24*365
    return {
        data : '<script src="//connect.facebook.net/en_US/all.js"></script>',
        'Content-Type' : 'text/html',
        'Pragma' : 'public',
        'Cache-Control' : 'max-age=' + e,
        'Expires' : new Date(time() + e * 1000).toGMTString()
    }
})

////////////////////////////////////////////////////////////////

module.exports.getUser = function (req) {
    ensure(db, "login", "fb_users", {})
    
    if (config.debugLoginUser) {
        return config.debugLoginUser
    }
    
    var fb = get_fb_cookie(req, config.fb.appId, config.fb.secret)
    if (fb) {
        var u = db.login.fb_users[fb.uid]
        if (u) return u
        function getUserData(access_token) {
            var s = wget('https://graph.facebook.com/me?access_token=' + access_token)
            s = unJson(s)
            u = {
                url : 'facebook://' + s.id,
                name : s.name,
                img : 'http://graph.facebook.com/' + s.id + '/picture'
            }
            return db.login.fb_users[fb.uid] = u
        }
        if (fb.access_token) {
            return getUserData(fb.access_token)
        } else {
            return getUserData(querystring.parse(wget("https://graph.facebook.com/oauth/access_token?client_id=" +  config.fb.appId + "&redirect_uri=&client_secret=" + config.fb.secret + "&code=" + fb.code))['access_token'])
        }
    }
}

