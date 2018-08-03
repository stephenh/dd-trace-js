'use strict'

require('../..').init()

const test = require('tape')
const memwatch = require('memwatch-next')
const whats = new Set([
  'Context',
  'ContextExecution',
  'Map',
  'Set'
])

test('scope manager should destroy executions even if their context is already destroyed', t => {
  t.plan(1)

  const hd = new memwatch.HeapDiff()

  resolve().then(() => {
    const diff = hd.end()
    const leaks = diff.change.details
      .filter(detail => whats.has(detail.what))
      .filter(detail => detail['+'] - detail['-'] > 50)

    t.deepEqual(leaks, [])
  })

  function resolve () {
    const promises = []

    for (let i = 0; i < 100; i++) {
      promises.push(Promise.resolve())
    }

    return Promise.all(promises)
  }
})
