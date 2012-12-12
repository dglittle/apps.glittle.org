
function Slider(width, height, notches) {
    
    var headWidth = height
    var maxHeadX = width - headWidth
    
    if (notches) {
        for (var i = 0; i < notches.length; i++) {
            notches[i] = lerp(0, 0, 1, maxHeadX, notches[i])
        }
    }
    
    var base = document.createElement('div')
    base.style.width = width + "px"
    base.style.height = height + "px"
    base.style.background = "white"
    
    var head = document.createElement('div')
    head.style.width = headWidth + "px"
    head.style.height = height + "px"
    head.style.marginRight = '-' + head.style.width
    head.style.marginBottom = '-' + head.style.height
    head.style.position = "relative"
    head.style.background = "red"
    base.appendChild(head)
    
    var glass = document.createElement('div')
    glass.style.width = width + "px"
    glass.style.height = height + "px"
    glass.style.marginRight = '-' + glass.style.width
    glass.style.marginBottom = '-' + glass.style.height
    glass.style.position = "relative"
    base.appendChild(glass)
    
    this.head = head
    this.div = base

    //////////////////////////////////////////////////////////////
    // head position
    
    var onHeadMove = null
    
    function positionInt(e) {
        if (e === undefined) {
            return getPos(head).x - getPos(base).x
        } else {
            if (notches) {
                var x = 0
                var closest = Infinity
                for (var i = 0; i < notches.length; i++) {
                    var dist = Math.abs(notches[i] - e)
                    if (dist < closest) {
                        closest = dist
                        x = notches[i] 
                    }
                }
                e = x
            }
            head.style.left = Math.round(cap(e, 0, maxHeadX)) + "px"
            var p = position()
            if (onHeadMove) onHeadMove(p)
        }
    }
    
    function position(e) {
        if (e === undefined) {
            return lerp(0, 0, maxHeadX, 1, positionInt())
        } else if (typeof(e) == "function") {
            onHeadMove = e
        } else {
            positionInt(lerp(0, 0, 1, maxHeadX, e))
        }
    }
    
    this.position = position    
    setTimeout(function () {
        position(0.5)
    }, 0)

    //////////////////////////////////////////////////////////////
    // mouse

    glass.onmousedown = function (e) {
        e.preventDefault()
        var pos = getRelPos(glass, e)
        
        var grabX = headWidth / 2
        var headX = positionInt()
        if (pos.x >= headX && pos.x < headX + headWidth) {
            grabX = pos.x - headX
        }
        
        positionInt(pos.x - grabX)

        var oldMove = document.onmousemove
        document.onmousemove = function (e) {
            var pos = getRelPos(glass, e)
            
            positionInt(pos.x - grabX)
        }
        
        var oldUp = document.onmouseup
        document.onmouseup = function (e) {
            document.onmousemove = oldMove
            document.onmouseup = oldUp
        }
    }

    //////////////////////////////////////////////////////////////
    // touch

    glass.ontouchstart = function (e) {
        e.preventDefault()
        var pos = getRelPos(glass, e.touches[0])

        var grabX = headWidth / 2
        var headX = positionInt()
        if (pos.x >= headX && pos.x < headX + headWidth) {
            grabX = pos.x - headX
        }

        positionInt(pos.x - grabX)

        var oldMove = document.ontouchmove
        document.ontouchmove = function (e) {
            e.preventDefault();
            var pos = getRelPos(glass, e.touches[0])
            positionInt(pos.x - grabX)
        }

        var oldEnd = document.ontouchend;
        var oldCancel = document.ontouchcancel
        document.ontouchend = document.ontouchcancel = function (e) {
            document.ontouchmove = oldMove
            document.ontouchend = oldEnd
            document.ontouchcancel = oldCancel;
        }
    }

    //////////////////////////////////////////////////////////////
    // utils
    
    function cap(t, mi, ma) {
        if (t < mi) return mi
        if (t > ma) return ma
        return t
    }

    function lerp(t0, v0, t1, v1, t) {
        return (t - t0) * (v1 - v0) / (t1 - t0) + v0
    }
    
    function getPos(e) {
        var x = 0, y = 0
        while (e != null) {
            x += e.offsetLeft
            y += e.offsetTop
            e = e.offsetParent
        }
        return {x : x, y : x}
    }
    
    function getRelPos(to, positionedObject) {
        var pos = getPos(to)
        return {
            x : positionedObject.pageX - pos.x,
            y : positionedObject.pageY - pos.y
        }
    }
}

