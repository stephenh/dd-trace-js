'use strict'

require('../..').init()

const test = require('tape')
const http = require('http')
const getPort = require('get-port')

test('http plugin should not attach event listeners to reusable sockets', t => {
  t.plan(1)

  const server = http.createServer()
  const agent = new http.Agent({ keepAlive: true })
  const sockets = new Set()

  server.on('request', (req, res) => {
    sockets.add(req.socket)
    res.writeHead(200)
    res.end()
  })

  server.keepAliveTimeout = 0

  getPort().then(port => {
    const listener = server.listen(port, 'localhost', () => {
      recurse(0)

      function recurse (index) {
        const req = http.request({ port, agent }, res => {
          res.on('data', () => {})
          res.on('end', () => {
            setTimeout(() => {
              if (index < 10) {
                recurse(index + 1)
              } else {
                const listenerCount = req.socket.listenerCount('close')

                listener.close()
                sockets.forEach(socket => socket.destroy())

                t.equal(listenerCount, 1)
              }
            })
          })
        })

        req.end()
      }
    })
  })
})
