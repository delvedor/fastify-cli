'use strict'

const fs = require('fs')
const path = require('path')

const t = require('tap')
const test = t.test
const sget = require('simple-get').concat
const sinon = require('sinon')
const proxyquire = require('proxyquire').noPreserveCache()
const start = require('../start')

// FIXME
// paths are relative to the root of the project
// this can be run only from there

test('should start the server', t => {
  t.plan(5)

  const fastify = start.start({
    port: 3000,
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3000'
    }, (err, response, body) => {
      console.log('-- response')
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('should start fastify with custom options', t => {
  t.plan(1)
  // here the test should fail because of the wrong certificate
  // or because the server is booted without the custom options
  try {
    start.start({
      port: 3000,
      options: true,
      _: ['./examples/plugin-with-options.js']
    })
    t.fail('Custom options')
  } catch (e) {
    t.pass('Custom options')
  }
})

test('should start the server at the given prefix', t => {
  t.plan(5)

  const fastify = start.start({
    port: 3000,
    _: ['./examples/plugin.js'],
    prefix: '/api/hello'
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3000/api/hello'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('should start fastify at given socket path', t => {
  t.plan(2)

  const sockFile = path.resolve('test.sock')

  const fastify = start.start({
    socket: sockFile,
    options: true,
    _: ['./examples/plugin.js']
  })
  t.tearDown(() => fastify.close())

  try {
    fs.unlinkSync(sockFile)
  } catch (e) { }

  fastify.ready(err => {
    t.error(err)

    var request = require('http').request({
      method: 'GET',
      path: '/',
      socketPath: sockFile
    }, function (response) {
      t.deepEqual(response.statusCode, 200)
    })
    request.end()
  })
})

test('should only accept plugin functions with 3 arguments', t => {
  t.plan(1)

  const oldStop = start.stop
  t.tearDown(() => { start.stop = oldStop })
  start.stop = function (err) {
    t.equal(err.message, 'Plugin function should contain 3 arguments. Refer to documentation for more information.')
  }

  start.start({
    port: 3000,
    _: ['./test/data/incorrect-plugin.js']
  })
})

test('should throw on file not found', t => {
  t.plan(1)

  const oldStop = start.stop
  t.tearDown(() => { start.stop = oldStop })
  start.stop = function (err) {
    t.ok(/Cannot find module.*not-found/.test(err.message), err.message)
  }

  start.start({
    port: 3000,
    _: ['./_data/not-found.js']
  })
})

test('should throw on package not found', t => {
  t.plan(1)

  const oldStop = start.stop
  t.tearDown(() => { start.stop = oldStop })
  start.stop = function (err) {
    t.ok(/Cannot find module.*unknown-package/.test(err.message), err.message)
  }

  start.start({
    port: 3000,
    _: ['./test/data/package-not-found.js']
  })
})

test('should throw on parsing error', t => {
  t.plan(1)

  const oldStop = start.stop
  t.tearDown(() => { start.stop = oldStop })
  start.stop = function (err) {
    t.equal(err.constructor, SyntaxError)
  }

  start.start({
    port: 3000,
    _: ['./test/data/parsing-error.js']
  })
})

test('should start the server with an async/await plugin', t => {
  if (Number(process.versions.node[0]) < 7) {
    t.pass('Skip because Node version < 7')
    return t.end()
  }

  t.plan(5)

  const fastify = start.start({
    port: 3000,
    _: ['./examples/async-await-plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3000'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })
    })
  })
})

test('should exit without error on help', t => {
  t.plan(1)

  const oldStop = start.stop
  t.tearDown(() => { start.stop = oldStop })
  start.stop = function (err) {
    t.equal(err, undefined)
  }

  start.start({
    port: 3000,
    help: true
  })
})

test('should throw the right error on require file', t => {
  t.plan(1)

  const oldStop = start.stop
  t.tearDown(() => { start.stop = oldStop })
  start.stop = function (err) {
    t.ok(/undefinedVariable is not defined/.test(err.message), err.message)
  }

  start.start({
    port: 3000,
    _: ['./test/data/undefinedVariable.js']
  })
})

test('should respond 413 - Payload too large', t => {
  t.plan(5)

  const bodyTooLarge = '{1: 11}'
  const bodySmaller = '{1: 1}'

  const fastify = start.start({
    port: 3000,
    'body-limit': bodyTooLarge.length + 2 - 1,
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'POST',
      url: 'http://localhost:3000',
      body: bodyTooLarge,
      json: true
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 413)
    })

    sget({
      method: 'POST',
      url: 'http://localhost:3000',
      body: bodySmaller,
      json: true
    }, (err, response) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
    })
  })
})

test('should start the server (using env var)', t => {
  t.plan(5)

  process.env.FASTIFY_PORT = 3030
  const fastify = start.start({
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3030'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })

      delete process.env.FASTIFY_PORT
    })
  })
})

test('should start the server (using PORT-env var)', t => {
  t.plan(5)

  process.env.PORT = 3030
  const fastify = start.start({
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3030'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })

      delete process.env.PORT
    })
  })
})

test('should start the server (using FASTIFY_PORT-env preceding PORT-env var)', t => {
  t.plan(5)

  process.env.FASTIFY_PORT = 3030
  process.env.PORT = 3031
  const fastify = start.start({
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3030'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })

      delete process.env.FASTIFY_PORT
      delete process.env.PORT
    })
  })
})

test('should start the server at the given prefix (using env var)', t => {
  t.plan(5)

  process.env.FASTIFY_PORT = 3030
  process.env.FASTIFY_PREFIX = '/api/hello'
  const fastify = start.start({
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)

    sget({
      method: 'GET',
      url: 'http://localhost:3030/api/hello'
    }, (err, response, body) => {
      t.error(err)
      t.strictEqual(response.statusCode, 200)
      t.strictEqual(response.headers['content-length'], '' + body.length)
      t.deepEqual(JSON.parse(body), { hello: 'world' })

      delete process.env.FASTIFY_PORT
      delete process.env.FASTIFY_PREFIX
    })
  })
})

test('should start the server at the given prefix (using env var read from .env)', t => {
  t.plan(2)

  const fastify = start.start({
    _: ['./examples/plugin.js']
  })

  fastify.ready(err => {
    t.error(err)
    t.strictEqual(fastify.server.address().port, 8080)
    delete process.env.FASTIFY_PORT
    fastify.close()
  })
})

test('The plugin is registered with fastify-plugin', t => {
  t.plan(2)

  const fastify = start.start({
    _: ['./examples/plugin.js']
  })

  fastify.ready(err => {
    t.error(err)
    t.strictEqual(fastify.test, true)
    fastify.close()
  })
})

test('should start the server listening on 0.0.0.0 when runing in docker', t => {
  t.plan(2)
  const isDocker = sinon.stub()
  isDocker.returns(true)

  const start = proxyquire('../start', {
    'is-docker': isDocker
  })

  const fastify = start.start({
    port: 3000,
    _: ['./examples/plugin.js']
  })

  t.tearDown(() => fastify.close())

  fastify.ready(err => {
    t.error(err)
    t.strictEqual(fastify.server.address().address, '0.0.0.0')
  })
})
