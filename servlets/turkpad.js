
var ns = "turkpad"
function myRegister(path, func) {
    register('/' + ns + path, func)
}
myRegister('', function () {
    return getStaticFile('./servlets/' + ns + '.html')
})
var db = ensure(global.db, ns, {})

if (!db.version || db.version < 2) {
    db.version = 2
    db.pads = {}
}

function getPad(pad) {
    if (!pad || !pad.match(/[a-zA-Z0-9_]{1,20}/))
        error('illegal pad identifier: ' + pad)
        
    var p = db.pads[pad]
    if (!p) {
        p = db.pads[pad] = {
            key : pad,
            padUrl : "http://piratepad.net/" + pad,
            title : "Do simple text based task",
            desc : "You will see a collaborative writing pad with instructions.",
            people : 100,
            rate : 0.01,
            hitUrl : null
        }
    }
    
    return p
}

function getBalance() {
    var r = mturk.request(config.aws.id, config.aws.secret, false, {
        Operation : 'GetAccountBalance'
    })
    return db.balance = r.match(/<AvailableBalance><Amount>(.*?)</)[1]
}

function setPad(pad, title, people, rate, padUrl) {
    var p = getPad(pad)

    if (padUrl.length > 4000) error('title too long. Max 4000 characters.')
    p.padUrl = padUrl
        
    if (title.length > 140) error('title too long. Max 140 characters.')
    p.title = title

    p.people = 1 * people
    p.rate = 1 * rate
    if (p.people != Math.round(p.people)) error('you must have an integer number of people')
    if (p.people < 1) error('you need at least one person')
    if (p.rate < 0) error('you cannot charge a negative rate')
    if (p.people * p.rate > 1) error('you can only spend up to $1 of my money ;)')
    
    return p
}

function postHIT(pad, title, people, rate, padUrl) {
    var p = setPad(pad, title, people, rate, padUrl)
    if (p.hitUrl) error('HIT already posted')

    var sandbox = config.local

    var r = mturk.request(config.aws.id, config.aws.secret, sandbox, {
        Operation : 'CreateHIT',
        Title : p.title,
        Description : p.desc,
        
        Question : '<ExternalQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd"><ExternalURL>' + escapeXml('http://' + config.host + '/turkpad?pad=' + escapeUrl(p.key)) + '</ExternalURL><FrameHeight>800</FrameHeight></ExternalQuestion>',
        
        MaxAssignments : p.people,        
        'Reward.1.Amount' : p.rate,
        'Reward.1.CurrencyCode' : 'USD',
        AssignmentDurationInSeconds : 60 * 30,
        LifetimeInSeconds : 60 * 60 * 24,
        AutoApprovalDelayInSeconds : 60 * 60 * 1,
    })
    
    p.hitUrl = 'https://' + (sandbox ? 'workersandbox.' : 'www.') + 'mturk.com/mturk/preview?groupId=' + r.match(/<HITTypeId>(.*?)</)[1]
    
    getBalance()
    
    return p
}

myRegister('/postHIT', function (q) {
    var p = postHIT(q.pad, q.title, q.people, q.rate, q.padUrl)
    return {
        balance : db.balance,
        pad : p
    }
})

myRegister('/registerTurker', function (q) {
    var p = getPad(q.pad)
    ensure(p, 'turkers', {})[q.workerId] = true
    return "ok"
})

myRegister('/getStuff', function (q) {
    var p = getPad(q.pad)
    
    if (db.balance == null)
        getBalance()
    
    return {
        balance : db.balance,
        pad : p
    }
})

myRegister('/setStuff', function (q) {
    var p = setPad(q.pad, q.title, q.people, q.rate, q.padUrl)
    return {
        balance : db.balance,
        pad : p
    }
})

