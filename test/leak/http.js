'use strict'

require('../..').init()

const test = require('tape')
const http = require('http')
const getPort = require('get-port')
const memwatch = require('memwatch-next')

// test('http plugin should not attach event listeners to reusable sockets', t => {
//   t.plan(1)

//   const server = http.createServer()
//   const agent = new http.Agent({ keepAlive: true })
//   const sockets = new Set()

//   server.on('request', (req, res) => {
//     sockets.add(req.socket)
//     res.writeHead(200)
//     res.end()
//   })

//   server.keepAliveTimeout = 0

//   getPort().then(port => {
//     const listener = server.listen(port, 'localhost', () => {
//       recurse(0)

//       function recurse (index) {
//         const req = http.request({ port, agent }, res => {
//           res.on('data', () => {})
//           res.on('end', () => {
//             setTimeout(() => {
//               if (index < 10) {
//                 recurse(index + 1)
//               } else {
//                 const listenerCount = req.socket.listenerCount('close')

//                 listener.close()
//                 sockets.forEach(socket => socket.destroy())

//                 t.equal(listenerCount, 1)
//               }
//             })
//           })
//         })

//         req.end()
//       }
//     })
//   })
// })

test('http plugin should not leak over time', t => {
  t.plan(1)

  const server = http.createServer()
  const agent = new http.Agent({ keepAlive: true })
  const sockets = new Set()

  server.on('request', (req, res) => {
    sockets.has(req.socket) || req.socket.on('close', () => sockets.delete(req.socket))
    sockets.add(req.socket)
    res.writeHead(200)
    res.end()
  })

  server.keepAliveTimeout = 0

  getPort().then(port => {
    const listener = server.listen(port, 'localhost', () => {
      profile(operation)
        .then(t.pass)
        .catch(e => {
          console.log(JSON.stringify(e.leak, null, 2))
          t.fail()
        })
        .then(() => {
          listener.close()
          sockets.forEach(socket => socket.destroy())
        })
        .catch(t.fail)

      function operation (done) {
        const req = http.request({ port, agent }, res => {
          res.on('data', () => {})
          res.on('end', done)
        })

        req.on('socket', socket => {
          socket.setMaxListeners(0)
        })

        req.on('error', done)

        req.end()
      }
    })
  })
})

function profile (operation) {
  let done = false
  let fail = false

  // warmup
  setTimeout(() => {
    // start detection
    const finishTimeout = setTimeout(() => {
      done = true
    }, 25000)

    memwatch.on('leak', () => {
      clearTimeout(finishTimeout)

      done = fail = true
    })
  }, 5000)

  const promises = []
  const hd = new memwatch.HeapDiff()

  for (let i = 0; i < 10; i++) {
    const promise = new Promise((resolve, reject) => {
      run()

      function run () {
        setImmediate(() => {
          if (done) {
            return resolve()
          }

          operation(run)
        })
      }
    })

    promises.push(promise)
  }

  return Promise.all(promises)
    .catch(() => {})
    .then(() => {
      if (fail) {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const diff = hd.end()
            const error = new Error('Memory leak detected.')

            error.leak = diff

            reject(error)
          })
        })
      }

      return Promise.resolve()
    })
}
