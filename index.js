'use strict'
/* eslint-env node */

/**
 * Module used as a wrapper to make application logging framework agnostic
 * It also serves  as a facade to provide Convenience functions to wrap specific Module logging funtionalities
 * bunyan logging apis
 * fatal : The service/app is going to stop or become unusable now. An operator should definitely look into this soon.
 * error : Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
 * warn  : A note on something that should probably be looked at by an operator eventually.
 * info  : Detail on regular operation.
 * debug : Anything else, i.e. too verbose to be included in "info" level.
 * trace : Logging from external libraries used by your app or very detailed application logging.
 */

const Bunyan = require('bunyan')
const extend = require('extend')
const fs = require('fs')
const LOG_DIR = './logs'
let loggers = []
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR)
}

let STDOUT_LOG_LEVEL
function detectStdOutLogLevel () {
  let validLogLevel = ['fatal', 'error', 'warn', 'debug', 'info', 'trace'].indexOf(process.env.NODE_LOG_LEVEL) !== -1
  if (process.env.NODE_ENV === 'production') {
    if (validLogLevel) {
      STDOUT_LOG_LEVEL = process.env.NODE_LOG_LEVEL
    } else {
      STDOUT_LOG_LEVEL = 'info'
    }
  } else if (process.env.NODE_ENV !== 'production' && validLogLevel) {
    STDOUT_LOG_LEVEL = process.env.NODE_LOG_LEVEL
  } else {
    STDOUT_LOG_LEVEL = 'trace'
  }
}

detectStdOutLogLevel()

function setupConfig (loggerType, options) {
  let config = options || { name: 'unknown' }
  config.level = config.level ? config.level : 'trace'
  config.loggerType = loggerType
  config.name += '.' + config.loggerType
  config.streams = config.streams || []
  config.streams.push({
    type: 'rotating-file',
    path: LOG_DIR + '/' + config.name + '.log',
    level: config.level ? config.level : 'trace',
    period: '1d',
    count: 3
  }, {
    level: STDOUT_LOG_LEVEL,
    stream: process.stdout
  })
  return config
}

module.exports = (function () {
  const bunyan = Bunyan
  /**
   * config should have `name` to specify the name of the logger
   */

  let DefaultLogger = function () {
    let Logger = function (options) {
      let config = setupConfig('default', options)
      extend(this, bunyan.createLogger(config).child({loggerType: config.loggerType}))
      loggers.push({name: config.name, logger: this})
    }
    Logger.prototype.log = function (message) { this.log(message) }
    return Logger
  }

  /**
   * Generic Logger used for logging generic activities in Routes
   */
  let RouteLogger = function () {
    let Logger = function (options) {
      let config = setupConfig('route', options)
      extend(this, bunyan.createLogger(config).child({loggerType: config.loggerType}))
      // this.debug('Created new Route Logger ' + config.name)
      loggers.push({name: config.name, logger: this})
    }
    Logger.prototype.configured = function (methods, url) {
      this.trace({methods: methods, url: url}, 'Configured new Route')
    }
    return Logger
  }

  /**
   * Generic Logger used for logging generic activities in Controllers
   */
  let ControllerLogger = function () {
    let Logger = function (options) {
      let config = setupConfig('controller', options)
      extend(this, bunyan.createLogger(config).child({loggerType: config.loggerType}))
      loggers.push({name: config.name, logger: this})
    }

    Logger.prototype.success = function (url) {
      this.debug({url: url}, 'Processed a successful request')
    }
    Logger.prototype.error = function (url) {
      this.error({url: url}, 'Processed a failed request')
    }
    Logger.prototype.conflict = function (url) {
      this.error({url: url}, 'Processed a conflict request')
    }
    return Logger
  }
  /**
   * Generic Logger used for logging generic activities in Models
   */
  let ModelLogger = function () {
    let Logger = function (options) {
      let config = setupConfig('model', options)
      extend(this, bunyan.createLogger(config).child({loggerType: config.loggerType}))
      loggers.push({name: config.name, logger: this})
    }
    /**
     * Convenience function for logging normal Queries
     */
    Logger.prototype.query = function (queryName, param, promise) {
      const self = this
      if (promise && typeof promise.then === 'function') {
        promise.then(function (result) { self.debug({query: queryName, param: param}, 'Queried Database ') })
          .catch(function (err) { self.failed(queryName, param, err) })
      } else {
        this.debug(queryName, param, null)
        this.error({queryName: queryName, param: param}, 'Promise not returned for Query Call')
      }
    }
    /**
     * Convenience Function for logging errors
     */
    Logger.prototype.failed = function (query, param, error) {
      this.error({query: query, param: param, error: error}, 'Failed Database Transaction')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.validating = function (doc) {
      this.trace({object: doc}, 'Validating Document')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.saving = (doc) => {
      this.trace({object: doc}, 'Saving Document')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.valid = (doc) => {
      this.trace({object: doc}, 'Validated Document')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.invalid = function (doc, err) {
      this.trace({object: doc, error: err}, 'Invalid Document ')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.saving = function (doc) {
      this.trace({object: doc}, 'Saving Data')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.saved = function (doc) {
      this.trace({object: doc}, 'Saved Successfully ')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.failedSave = function (doc) {
      this.trace({object: doc}, 'Not Saved Successfully ')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.updated = function (doc) {
      this.trace({object: doc}, 'Updated Successfully ')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.failedUpdate = function (doc) {
      this.trace({object: doc}, 'Not Updated Successfully ')
    }
    /**
     * Convenience Function for logging Validation
     */
    Logger.prototype.deleted = function (id) {
      this.trace({id: id}, 'Deleted Successfully ')
    }
    return Logger
  }

  return {DefaultLogger: DefaultLogger(), RouteLogger: RouteLogger(), ControllerLogger: ControllerLogger(), ModelLogger: ModelLogger()}
})()
