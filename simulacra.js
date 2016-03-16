/*!
 * Simulacra.js
 * Version 0.11.0
 * MIT License
 * https://github.com/0x8890/simulacra
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

var processNodes = require('./process_nodes')

module.exports = bindKeys


/**
 * Define getters & setters. This function does most of the heavy lifting.
 *
 * @param {*}
 * @param {Object} obj
 * @param {Object} def
 * @param {Node} parentNode
 * @param {Array} path
 */
function bindKeys (scope, obj, def, parentNode, path) {
  // Using the closure here to store private object.
  var store = {}
  var key

  if (typeof obj !== 'object')
    throw new TypeError(
      'Invalid type of value "' + obj + '", object expected.')

  for (key in def) define(key)

  function define (key) {
    var initialValue = obj[key]
    var branch = def[key]
    var mutator = branch.mutator
    var definition = branch.definition

    // Keeping state in this closure.
    var keyPath = path.concat(key)
    var activeNodes = []
    var previousValues = []
    var isArray

    // Assign root object.
    keyPath.root = path.root

    Object.defineProperty(obj, key, {
      get: getter, set: setter, enumerable: true
    })

    // For initialization, call this once.
    setter(initialValue)

    function getter () {
      return store[key]
    }

    function setter (x) {
      var i, j, value

      // Special case for binding same node as parent.
      if (branch.__isBoundToParent) {
        if (mutator) mutator(parentNode, x, store[key], keyPath)

        // Need to qualify this check for non-empty value.
        else if (definition && x != null)
          bindKeys(scope, x, definition, parentNode, keyPath)

        store[key] = x
        return null
      }

      isArray = Array.isArray(x)
      value = isArray ? x : [ x ]

      // Assign custom mutator methods on the array instance.
      if (isArray && !value.__hasMutators) {
        value.__hasMutators = true

        // These mutators preserve length.
        value.reverse = reverse
        value.sort = sort
        value.copyWithin = copyWithin
        value.fill = fill

        // These mutators may alter length.
        value.pop = pop
        value.push = push
        value.shift = shift
        value.unshift = unshift
        value.splice = splice

        // Handle array index assignment.
        for (i = 0, j = value.length; i < j; i++) defineIndex(value, i)
      }

      // Handle rendering to the DOM.
      for (i = 0, j = Math.max(previousValues.length, value.length);
        i < j; i++) checkValue(value, i)

      // Reset length to current values, implicitly deleting indices from
      // `previousValues` and `activeNodes` and allowing for garbage
      // collection.
      previousValues.length = activeNodes.length = value.length

      store[key] = x

      return x
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
      var endPath = keyPath

      // Cast previous value to null if undefined.
      if (previousValue === void 0) previousValue = null

      delete previousValues[i]

      if (activeNode) {
        if (mutator) {
          if (isArray) {
            endPath = keyPath.concat(i)
            endPath.root = path.root
          }
          mutator(activeNode, null, previousValue, endPath)
        }
        branch.marker.parentNode.removeChild(activeNode)
        delete activeNodes[i]
      }
    }

    function addNode (value, previousValue, i) {
      var j, k, node, nextNode, activeNode = activeNodes[i]
      var endPath = keyPath

      // Cast previous value to null if undefined.
      if (previousValue === void 0) previousValue = null

      // If value is undefined or null, just remove it.
      if (value == null) {
        removeNode(null, previousValue, i)
        return
      }

      if (isArray) {
        endPath = keyPath.concat(i)
        endPath.root = path.root
      }

      previousValues[i] = value

      if (mutator) {
        if (activeNode) {
          mutator(activeNode, value, previousValue, endPath)
          return
        }

        node = branch.node.cloneNode(true)
        mutator(node, value, previousValue, endPath)
      }

      else if (definition) {
        if (activeNode) removeNode(value, previousValue, i)
        node = processNodes(scope, branch.node.cloneNode(true), definition, i)
        bindKeys(scope, value, definition, node, endPath)
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

},{"./process_nodes":3}],2:[function(require,module,exports){
'use strict'

var processNodes = require('./process_nodes')
var bindKeys = require('./bind_keys')

module.exports = simulacra


/**
 * Dynamic dispatch function.
 *
 * @param {Node|String|Object}
 * @param {Function|Object}
 */
function simulacra (a, b) {
  var Node = this ? this.Node : window.Node

  if (typeof a === 'string' || a instanceof Node) return define(a, b)
  if (typeof a === 'object' && a !== null) return bind.call(this, a, b)

  throw new TypeError('First argument must be either ' +
    'a DOM Node, string, or an Object.')
}


/**
 * Define a binding.
 *
 * @param {Node|String}
 * @param {Function|Object}
 */
function define (node, def) {
  // Memoize the selected node.
  var obj = { node: node }

  if (typeof def === 'function')
    obj.mutator = def

  else if (typeof def === 'object')
    obj.definition = def

  else if (def !== void 0)
    throw new TypeError('Second argument must be either ' +
      'a function or an object.')

  return obj
}


/**
 * Bind an object to a Node.
 *
 * @param {Object}
 * @param {Object}
 * @return {Node}
 */
function bind (obj, def) {
  var Node = this ? this.Node : window.Node
  var document = this ? this.document : window.document
  var node, query, path = []

  if (Array.isArray(obj))
    throw new TypeError('First argument must be a singular object.')

  if (!def || typeof def.definition !== 'object')
    throw new TypeError('Top-level binding must be an object.')

  if (!(def.node instanceof Node)) {
    query = def.node
    def.node = document.querySelector(query)
    if (!def.node) throw new Error(
      'Top-level Node "' + query + '" could not be found in the document.')
  }

  ensureNodes(def.node, def.definition)

  node = processNodes(this, def.node.cloneNode(true), def.definition)

  // Assign root object.
  path.root = obj

  bindKeys(this, obj, def.definition, node, path)

  return node
}


// Default DOM mutation functions.
function replaceText (node, value) { node.textContent = value }
function replaceValue (node, value) { node.value = value }
function replaceChecked (context) { node.checked = context.value }

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


/**
 * Internal function to mutate string selectors into Nodes and validate that
 * they are allowed.
 *
 * @param {Node} parentNode
 * @param {Object} def
 */
function ensureNodes (parentNode, def) {
  var i, j, key, query, branch, boundNode, ancestorNode
  var adjacentNodes = []

  for (key in def) {
    branch = def[key]

    if (typeof branch.node === 'string') {
      query = branch.node

      // May need to get the node above the parent, in case of binding to
      // the parent node.
      ancestorNode = parentNode.parentNode || parentNode

      branch.node = ancestorNode.querySelector(query)
      if (!branch.node) throw new Error(
        'The Node for selector "' + query + '" was not found.')
    }

    boundNode = branch.node

    // Special case for binding to parent node.
    if (parentNode === boundNode) {
      branch.__isBoundToParent = true
      if (branch.mutator && branch.mutator.__isDefault)
        branch.mutator = noop(key)
      else if (branch.definition)
        ensureNodes(boundNode, branch.definition)
      continue
    }
    else adjacentNodes.push([ key, boundNode ])

    if (!parentNode.contains(boundNode))
      throw new Error('The bound DOM Node must be either ' +
        'contained in or equal to its parent binding.')

    if (branch.definition) ensureNodes(boundNode, branch.definition)
    else if (!branch.mutator)
      if (boundNode.nodeName === 'INPUT' || boundNode.nodeName === 'SELECT')
        if (boundNode.type === 'checkbox' || boundNode.type === 'radio')
          branch.mutator = replaceChecked
        else branch.mutator = replaceValue
      else branch.mutator = replaceText
  }

  // Need to invalidate containment in adjacent nodes, after the adjacent
  // nodes are found.
  for (key in def) {
    boundNode = def[key].node
    for (i = 0, j = adjacentNodes.length; i < j; i++)
      if (adjacentNodes[i][1].contains(boundNode) &&
        adjacentNodes[i][1] !== boundNode)
        throw new Error('The Node for key "' + key + '" is contained in the ' +
          'Node for the adjacent key "' + adjacentNodes[i][0] + '".')
  }
}

},{"./bind_keys":1,"./process_nodes":3}],3:[function(require,module,exports){
'use strict'

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
  var map = matchNodes(scope, node, def)
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


/**
 * Internal function to find matching DOM nodes on cloned nodes.
 *
 * @param {*}
 * @param {Node} node
 * @param {Object} def
 * @return {WeakMap}
 */
function matchNodes (scope, node, def) {
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

window.simulacra = require('../lib')

},{"../lib":2}]},{},[4]);
