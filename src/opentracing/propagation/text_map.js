'use strict'

const Uint64BE = require('int64-buffer').Uint64BE
const Int64BE = require('int64-buffer').Int64BE
const DatadogSpanContext = require('../span_context')

const traceKey = 'x-datadog-trace-id'
const spanKey = 'x-datadog-parent-id'
const samplingKey = 'x-datadog-sampling-priority'
const baggagePrefix = 'ot-baggage-'
const baggageExpr = new RegExp(`^${baggagePrefix}(.+)$`)

class TextMapPropagator {
  constructor (prioritySampler) {
    this._prioritySampler = prioritySampler
  }

  inject (spanContext, carrier) {
    carrier[traceKey] = new Int64BE(spanContext.traceId.toBuffer()).toString()
    carrier[spanKey] = new Int64BE(spanContext.spanId.toBuffer()).toString()

    this._injectSamplingPriority(spanContext, carrier)
    this._injectBaggageItems(spanContext, carrier)
  }

  extract (carrier) {
    if (!carrier[traceKey] || !carrier[spanKey]) {
      return null
    }

    const spanContext = new DatadogSpanContext({
      traceId: new Uint64BE(carrier[traceKey], 10),
      spanId: new Uint64BE(carrier[spanKey], 10)
    })

    this._extractBaggageItems(carrier, spanContext)
    this._extractSamplingPriority(carrier, spanContext)

    return spanContext
  }

  _injectSamplingPriority (spanContext, carrier) {
    this._prioritySampler.sample(spanContext)

    carrier[samplingKey] = spanContext.sampling.priority.toString()
  }

  _injectBaggageItems (spanContext, carrier) {
    spanContext.baggageItems && Object.keys(spanContext.baggageItems).forEach(key => {
      carrier[baggagePrefix + key] = String(spanContext.baggageItems[key])
    })
  }

  _extractBaggageItems (carrier, spanContext) {
    Object.keys(carrier).forEach(key => {
      const match = key.match(baggageExpr)

      if (match) {
        spanContext.baggageItems[match[1]] = carrier[key]
      }
    })
  }

  _extractSamplingPriority (carrier, spanContext) {
    const priority = parseInt(carrier[samplingKey], 10)

    if (this._prioritySampler.validate(priority)) {
      spanContext.sampling.priority = priority
    }
  }
}

module.exports = TextMapPropagator
