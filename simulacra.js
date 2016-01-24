/*!
 * Simulacra.js
 * Version 0.7.1
 * MIT License
 * https://github.com/0x8890/simulacra
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

/**
 * Like `Object.assign`, but faster and more restricted in what it does.
 *
 * @param {Object} target
 * @param {Object} source
 * @return {Object}
 */
module.exports = function assign (target, source) {
  var key

  for (key in source) target[key] = source[key]

  return target
}

},{}],2:[function(require,module,exports){
'use strict'

var processNodes = require('./process_nodes')
var assign = require('./assign')

module.exports = defineProperties


/**
 * Define getters & setters. This function does most of the heavy lifting.
 *
 * @param {*}
 * @param {Object} obj
 * @param {Object} def
 * @param {Node} parentNode
 * @param {Object} [parentObj]
 */
function defineProperties (scope, obj, def, parentNode, parentObj) {
  // Using the closure here to store private object.
  var store = {}
  var property

  if (typeof obj !== 'object')
    throw new TypeError(
      'Invalid type of value "' + obj + '", object expected.')

  // Define a non-enumerable property `parent` if it exists.
  if (parentObj) {
    if ('parent' in obj) throw new Error(
      'The bound object may not contain the reserved key "parent".')

    Object.defineProperty(obj, 'parent', { value: parentObj })
  }

  for (property in def) define(property)

  function define (key) {
    var initialValue = obj[key]
    var branch = def[key]
    var mutator = branch.mutator
    var definition = branch.definition
    var context = { object: obj, key: key }

    // Keeping state in this closure.
    var activeNodes = []
    var previousValues = []

    Object.defineProperty(obj, key, {
      get: getter, set: setter, enumerable: true
    })

    // For initialization, call this once.
    setter(initialValue)

    function getter () {
      return store[key]
    }

    function setter (x) {
      var i, j

      // Special case for binding same node as parent.
      if (branch.__isBoundToParent) {
        if (mutator) mutator(assign({
          node: parentNode,
          value: x,
          previousValue: store[key]
          // Note that index is omitted.
        }, context))

        // Need to qualify this check for non-empty value.
        else if (definition && x != null)
          defineProperties(scope, x, definition, parentNode, obj)

        store[key] = x
        return null
      }

      store[key] = x

      if (!Array.isArray(x)) x = [ x ]

      // Assign custom mutator methods on the array instance.
      else if (!x.__hasMutators) {
        x.__hasMutators = true

        // These mutators preserve length.
        x.reverse = reverse
        x.sort = sort
        x.copyWithin = copyWithin
        x.fill = fill

        // These mutators may alter length.
        x.pop = pop
        x.push = push
        x.shift = shift
        x.unshift = unshift
        x.splice = splice

        // Handle array index assignment.
        for (i = 0, j = x.length; i < j; i++) defineIndex(x, i)
      }

      // Handle rendering to the DOM.
      for (i = 0, j = Math.max(previousValues.length, x.length); i < j; i++)
        checkValue(x, i)

      // Reset length to current values, implicitly deleting indices from
      // `previousValues` and `activeNodes` and allowing for garbage
      // collection.
      previousValues.length = activeNodes.length = x.length

      return store[key]
    }

    function checkValue (array, i) {
      var value = array[i]
      var previousValue = previousValues[i]

      if (previousValue === value) return

      addNode(value, previousValue, i)
    }

    function defineIndex (array, i) {
      var value = array[i]

      Object.defineProperty(array, i, {
        get: function () { return value },
        set: function (x) { value = x; checkValue(array, i) },
        enumerable: true, configurable: true
      })
    }

    function removeNode (value, previousValue, i) {
      var activeNode = activeNodes[i]

      // Cast previous value to null if undefined.
      if (previousValue === void 0) previousValue = null

      delete previousValues[i]

      if (activeNode) {
        if (mutator) mutator(assign({
          node: activeNode,
          value: null,
          previousValue: previousValue,
          index: i
        }, context))
        branch.marker.parentNode.removeChild(activeNode)
        delete activeNodes[i]
      }
    }

    function addNode (value, previousValue, i) {
      var j, k, node, nextNode, activeNode = activeNodes[i]

      // Cast previous value to null if undefined.
      if (previousValue === void 0) previousValue = null

      // If value is undefined or null, just remove it.
      if (value == null) return removeNode(null, previousValue, i)

      previousValues[i] = value

      if (mutator) {
        if (activeNode) {
          mutator(assign({
            node: activeNode,
            value: value,
            previousValue: previousValue,
            index: i
          }, context))
          return null
        }

        node = branch.node.cloneNode(true)
        mutator(assign({
          node: node,
          value: value,
          previousValue: previousValue,
          index: i
        }, context))
      }

      else if (definition) {
        if (activeNode) removeNode(value, previousValue, i)
        node = processNodes(scope, branch.node.cloneNode(true), definition, i)
        defineProperties(scope, value, definition, node, obj)
      }

      // Find the next node.
      for (j = i + 1, k = activeNodes.length; j < k; j++)
        if (activeNodes[j]) {
          nextNode = activeNodes[j]
          break
        }

      activeNodes[i] = branch.marker.parentNode.insertBefore(
        node, nextNode || branch.marker)
    }


    // =======================================
    // Below are array mutator methods.
    // They have to exist within this closure.
    // =======================================

    function reverse () {
      return setter(Array.prototype.reverse.call(this))
    }

    function sort (fn) {
      return setter(Array.prototype.sort.call(this, fn))
    }

    function fill (a, b, c) {
      return setter(Array.prototype.fill.call(this, a, b, c))
    }

    function copyWithin (a, b, c) {
      return setter(Array.prototype.copyWithin.call(this, a, b, c))
    }

    function pop () {
      var i = this.length - 1
      var previousValue = previousValues[i]
      var value = Array.prototype.pop.call(this)

      removeNode(null, previousValue, i)
      previousValues.length = activeNodes.length = this.length

      return value
    }

    function push () {
      var i = this.length, j
      var value = Array.prototype.push.apply(this, arguments)

      for (j = i + arguments.length; i < j; i++) {
        addNode(this[i], null, i)
        defineIndex(this, i)
      }

      return value
    }

    function shift () {
      removeNode(null, previousValues[0], 0)

      Array.prototype.shift.call(previousValues)
      Array.prototype.shift.call(activeNodes)
      return Array.prototype.shift.call(this)
    }

    function unshift () {
      var i = this.length, j, value

      Array.prototype.unshift.apply(previousValues, arguments)
      Array.prototype.unshift.apply(activeNodes, Array(arguments.length))
      value = Array.prototype.unshift.apply(this, arguments)

      for (j = arguments.length; j--;) addNode(arguments[j], null, j)
      for (j = i + arguments.length; i < j; i++) defineIndex(this, i)

      return value
    }

    function splice (start, count) {
      var args = Array.prototype.slice.call(arguments, 2)
      var i, j, k = args.length - count, value

      for (i = start, j = start + count; i < j; i++)
        removeNode(null, previousValues[i], i)

      Array.prototype.splice.apply(previousValues, arguments)
      Array.prototype.splice.apply(activeNodes,
        [ start, count ].concat(Array(args.length)))
      value = Array.prototype.splice.apply(this, arguments)

      for (i = start + args.length - 1, j = start; i >= j; i--)
        addNode(args[(i - start) | 0], null, i)

      if (k < 0)
        previousValues.length = activeNodes.length = this.length

      else if (k > 0)
        for (i = this.length - k, j = this.length; i < j; i++)
          defineIndex(this, i)

      return value
    }
  }
}

},{"./assign":1,"./process_nodes":5}],3:[function(require,module,exports){
'use strict'

module.exports = findNodes


/**
 * Find matching DOM nodes on cloned nodes.
 *
 * @param {*}
 * @param {Node} node
 * @param {Object} def
 * @return {WeakMap}
 */
function findNodes (scope, node, def) {
  var document = scope ? scope.document : window.document
  var NodeFilter = scope ? scope.NodeFilter : window.NodeFilter
  var treeWalker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT)
  var map = new WeakMap()
  var nodes = []
  var i, j, key, currentNode

  for (key in def) nodes.push(def[key].node)

  while (treeWalker.nextNode() && nodes.length)
    for (i = 0, j = nodes.length; i < j; i++) {
      currentNode = nodes[i]
      if (treeWalker.currentNode.isEqualNode(currentNode)) {
        map.set(currentNode, treeWalker.currentNode)
        nodes.splice(i, 1)
      }
    }

  return map
}

},{}],4:[function(require,module,exports){
'use strict'

var processNodes = require('./process_nodes')
var defineProperties = require('./define_properties')

module.exports = simulacra


/**
 * Dynamic dispatch function.
 *
 * @param {Node|Object}
 * @param {Function|Object}
 */
function simulacra (a, b) {
  var scope = this
  var Node = scope ? scope.Node : window.Node

  if (a instanceof Node) return define(scope, a, b)
  if (typeof a === 'object' && a !== null) return bind(scope, a, b)

  throw new TypeError('First argument must be either ' +
    'a DOM Node or an Object.')
}


/**
 * Define a binding.
 *
 * @param {*}
 * @param {String|Node}
 * @param {Function|Object}
 */
function define (scope, node, def) {
  // Memoize the selected node.
  var obj = { node: node }

  // Although WeakSet would work here, WeakMap has better browser support.
  var seen = new WeakMap()

  var key, branch, boundNode

  if (typeof def === 'function')
    obj.mutator = def

  else if (typeof def === 'object') {
    obj.definition = def

    for (key in def) {
      branch = def[key]
      boundNode = branch.node

      // Special case for binding to parent node.
      if (node === boundNode) {
        branch.__isBoundToParent = true
        if (branch.mutator && branch.mutator.__isDefault)
          branch.mutator = noop(key)
        continue
      }

      if (!node.contains(boundNode))
        throw new Error('The bound DOM Node must be either ' +
          'contained in or equal to its parent binding.')

      if (!seen.get(boundNode)) seen.set(boundNode, true)
      else throw new Error('Can not bind multiple keys to the same child ' +
        'DOM Node. Collision found on key "' + key + '".')
    }
  }

  else if (def === void 0)
    if (node.nodeName === 'INPUT' || node.nodeName === 'SELECT')
      if (node.type === 'checkbox' || node.type === 'radio')
        obj.mutator = replaceChecked
      else obj.mutator = replaceValue
    else obj.mutator = replaceText

  else throw new TypeError('Second argument must be either ' +
    'a function or an object.')

  return obj
}


/**
 * Bind an object to a Node.
 *
 * @param {*}
 * @param {Object}
 * @param {Object}
 * @return {Node}
 */
function bind (scope, obj, def) {
  var Node = scope ? scope.Node : window.Node, node

  if (Array.isArray(obj))
    throw new TypeError('First argument must be a singular object.')

  if (!(def.node instanceof Node))
    throw new TypeError('Top-level binding must have a Node.')

  if (typeof def.definition !== 'object')
    throw new TypeError('Top-level binding must be an object.')

  node = processNodes(scope, def.node.cloneNode(true), def.definition)
  defineProperties(scope, obj, def.definition, node)

  return node
}


// Default DOM mutation functions.

function replaceText (context) {
  context.node.textContent = context.value
}

function replaceValue (context) {
  if (context.previousValue === null)
    context.node.addEventListener('input', function () {
      context.object[context.key] = context.node.value
    })

  if (context.node.value !== context.value)
    context.node.value = context.value
}

function replaceChecked (context) {
  if (context.previousValue === null)
    context.node.addEventListener('input', function () {
      context.object[context.key] = context.node.checked
    })

  if (context.node.checked !== context.value)
    context.node.checked = context.value
}

// Private static property, used for checking parent binding function.
replaceText.__isDefault =
  replaceValue.__isDefault =
  replaceChecked.__isDefault =
  true

function noop (key) {
  return function () {
    console.warn( // eslint-disable-line
      'Undefined mutator function for key "' + key + '".')
  }
}

},{"./define_properties":2,"./process_nodes":5}],5:[function(require,module,exports){
'use strict'

var findNodes = require('./find_nodes')

module.exports = processNodes


/**
 * Internal function to remove bound nodes and replace them with markers.
 *
 * @param {*}
 * @param {Node}
 * @param {Object}
 * @return {Node}
 */
function processNodes (scope, node, def) {
  var document = scope ? scope.document : window.document
  var map = findNodes(scope, node, def)
  var branch, key, mirrorNode, marker, parent

  for (key in def) {
    branch = def[key]
    if (branch.__isBoundToParent) continue
    mirrorNode = map.get(branch.node)
    parent = mirrorNode.parentNode
    marker = document.createTextNode('')
    branch.marker = parent.insertBefore(marker, mirrorNode)
    parent.removeChild(mirrorNode)
  }

  return node
}

},{"./find_nodes":3}],6:[function(require,module,exports){
'use strict'

window.simulacra = require('../lib')

},{"../lib":4}]},{},[6]);
