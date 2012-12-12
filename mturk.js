
require('./myutil')
require('./nodeutil')

function sign(text, secret) {
    return crypto.createHmac('sha1', secret).update(text).digest('base64')
}

// api at: http://docs.amazonwebservices.com/AWSMechTurk/2012-03-25/AWSMturkAPI/Welcome.html?r=5777

module.exports.request = function (id, secret, sandbox, params) {
    if (!params) params = {}
    ensure(params, 'Service', 'AWSMechanicalTurkRequester')
    ensure(params, 'AWSAccessKeyId', id)
    ensure(params, 'Version', '2012-03-25')
    ensure(params, 'Timestamp', new Date().toISOString().replace(/\.\d+/, ''))
    ensure(params, 'Signature', sign(params.Service + params.Operation + params.Timestamp, secret))
    
    var url = sandbox ? "https://mechanicalturk.sandbox.amazonaws.com" : "https://mechanicalturk.amazonaws.com"
    
    return wget(url, params)
}

