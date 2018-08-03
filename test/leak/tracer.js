'use strict'

const tracer = require('../..').init()

const test = require('tape')
const memwatch = require('memwatch-next')
const whats = new Set([
  'DatadogSpan',
  'DatadogSpanContext'
])

test('should not keep unfinished spans in memory if they are no longer needed', t => {
  t.plan(1)

  const hd = new memwatch.HeapDiff()

  tracer.startSpan('test')
  tracer.startSpan('test')
  tracer.startSpan('test')

  const diff = hd.end()
  const leaks = diff.change.details
    .filter(detail => whats.has(detail.what))

  t.deepEqual(leaks, [])
})
