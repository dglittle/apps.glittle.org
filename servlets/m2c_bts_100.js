
var ns = "m2c_bts_100"
function myRegister(path, func) {
    register('/' + ns + path, func)
}
var db = ensure(global.db, ns, {})

if (!db.version || db.version < 21) {
    db.version = 21
    
    delete db.users
    db.questions = []
    db.objs = {}
    
    var questionToQuestion = {}
    var turkToUser = {}
    
    foreach(global.db.m2c_experiment.results, function (r) {
        var q = questionToQuestion[r.question]
        if (!q) {
            q = newObj('question')
            q.text = r.question
            q.answerCounts = {}
            q._answers = {}
            q.guessNum = 0
            q.guessDen = 0
            questionToQuestion[r.question] = q
            db.questions.push(q)
        }
        
        var u = null
        if (r.workerId) {
            u = turkToUser[r.workerId]
            if (!u) {
                u = newObj('user')
                u.turkId = r.workerId
                turkToUser[r.workerId] = u
            }
        }
        
        try {
            answerQuestion(u, q, r.answer, (1 * r.percent.match(/\d+/)[0]) / 100)
        } catch (e) {
            console.log("----------")
            console.log("r = " + json(r) + "\n" + json(q._answers[u.key]))
            console.log("----------")
        }
    })
}

function pruneCopy(o, depth) {
    function helper(o, depth) {
        if ((typeof(o) == "object") && o) {
            if (depth <= 0)
                return "too deep"
            var oo = {}
            foreach(o, function (e, k) {
                if (typeof(k) == "string" && k.match(/^_/))
                    return
                oo[k] = helper(e, depth - 1)
            })
            return oo
        } else {
            return o
        }
    }
    return helper(o, depth)
}

function getUniqueKey() {
    var key = randomIdentifier(4)
    while (key in db.objs)
        key += randomIdentifier(2)
    return key
}

function newObj(kind) {
    var key = getUniqueKey()
    var o = {
        key : key,
        kind : kind,
        time : now
    }
    return db.objs[key] = o
}

function getObj(key, kind) {
    if (!key) return
    var o = db.objs[key]
    if (!o)
        error('object not found: ' + key)
    if (o.kind != kind)
        error('expected "' + kind + '" object, but got "' + o.kind + '" instead')
    return o
}

function getUser(q) {
    if (!q.session) error('error.. maybe your cookies are disabled?')
    var u = getObj(q.session.userKey, 'user')
    if (!u) {
        u = newObj('user')
        u.score = 0
        u.scoreDen = 0
        q.session.userKey = u.key
    }
    return u
}

function answerQuestion(u, q, answer, guess) {
    var a = newObj('answer')
    a.user = u
    a.answer = answer
    a.guess = guess
    
    if (u) {
        if (q._answers[u.key]) error('you already answered this!')
        q._answers[u.key] = a
    } else {
        q._answers[randomIdentifier(15)] = a
    }
    
    bagAdd(q.answerCounts, a.answer)
    q.averageAnswer = q.answerCounts.yes / (q.answerCounts.yes + q.answerCounts.no)
    
    if (a.answer.match(/yes|no/)) {
        q.guessNum += a.guess
        q.guessDen += 1
        q.averageGuess = q.guessNum / q.guessDen
        
        if (u) {
            ensure(u, 'score', 0)
            ensure(u, 'scoreDen', 0)
            u.score += lerpCap(0, 100, 0.5, 0, Math.abs(guess - q.averageAnswer))
            u.scoreDen += 100
        }
    }
    
    return a
}

function getQuestions(u, n) {
    var qs = []
    shuffle(db.questions)
    foreach(db.questions, function (q) {
        if (!q._answers[u.key])
            qs.push(q)
        if (qs.length >= n) return false
    })
    return map(qs, function (e) { return { key : e.key, text : e.text } })
}

myRegister('/getQuestions', function (q) {
    var u = getUser(q)
    return {
        questions : getQuestions(u, 3),
        user : pruneCopy(u, 1)
    }
})

myRegister('/answerQuestion', function (q) {
    var u = getUser(q)
    var qq = getObj(q.question, 'question')
    var a = answerQuestion(u, qq, q.answer, 1 * q.guess)
    
    a.otherQuestion = getObj(q.otherQuestion, 'question')
    a.otherOlder = q.otherOlder
    a.otherAbove = q.otherAbove
    
    return {
        question : merge(pruneCopy(qq, 2), { userAnswer : pruneCopy(a, 1) }),
        newQuestions : getQuestions(u, 3),
        user : pruneCopy(u, 1)
    }
})

myRegister('', function (q) {
    if (!(q.session.userKey in db.objs)) delete q.session.userKey 
    return getStaticFile('./servlets/' + ns + '.html')
})

