firstRun = typeof(firstRun) == "undefined" 
if (firstRun)
    require('fibers')

Fiber(function () {
    child_process = require('child_process')
    fs = require('fs')
    url = require('url')
    querystring = require('querystring')
    crypto = require('crypto')
    http = require('http')
    config = require('./_config.js')
    require('./myutil.js')
    require('./nodeutil.js')
    s3 = new (require('./s3').s3)(config.aws.id, config.aws.secret, config.s3.bucket)
    
    console.log("hi: " + s3.id)
    
    s3.put('/test', 'hicon')
  
    console.log("hi??")
}).run()

