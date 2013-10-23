(function(e){if("function"==typeof bootstrap)bootstrap("lgtm",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeLGTM=e}else"undefined"!=typeof window?window.LGTM=e():global.LGTM=e()})(function(){var define,ses,bootstrap,module,exports;
return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
var ValidatorBuilder = require("./lgtm/validator_builder");
var ObjectValidator = require("./lgtm/object_validator");
var core = require("./lgtm/helpers/core");
var config = require("./lgtm/config");

core.register();

function validator() {
  return new ValidatorBuilder();
}

function register() {
  ValidatorBuilder.registerHelper.apply(ValidatorBuilder, arguments);
}

function unregister() {
  ValidatorBuilder.unregisterHelper.apply(ValidatorBuilder, arguments);
}

var helpers = {
  core       : core,
  register   : register,
  unregister : unregister
};

function configure(key, value) {
  config[key] = value;
}

// This kinda sucks, but I don't think ES6 has the ability to require modules
// that may not exist. And we may be in node or in the browser.
if (typeof RSVP !== 'undefined') {
  configure('defer', RSVP.defer);
} else if (typeof require === 'function') {
  try {
    var rsvpSoBrowserifyCannotSeeIt = 'rsvp';
    configure('defer', require(rsvpSoBrowserifyCannotSeeIt).defer);
  } catch (e) {}
}


exports.configure = configure;
exports.validator = validator;
exports.helpers = helpers;
exports.ObjectValidator = ObjectValidator;
},{"./lgtm/config":2,"./lgtm/helpers/core":3,"./lgtm/object_validator":4,"./lgtm/validator_builder":6}],2:[function(require,module,exports){
"use strict";
var config = {};

config.defer = function() {
  throw new Error('No "defer" function provided to LGTM! Please use lgtm-standalone.js or call LGTM.configure("defer", myDeferFunction) e.g. to use with Q, use Q.defer.');
};


module.exports = config;
},{}],3:[function(require,module,exports){
"use strict";
var ValidatorBuilder = require("../validator_builder");

/**
 * Checks that the given value is present. That is, whether it is a
 * non-whitespace string, non-null, and non-undefined.
 *
 * @param {object} value
 * @return {boolean}
 */
function present(value) {
  if (typeof value === 'string') {
    value = value.trim();
  }

  return value !== '' && value !== null && value !== undefined;
}

/**
 * Checks that the given value is an email address. Strings will be trimmed
 * before checking.
 *
 * @param {string} value
 * @return {boolean}
 */
function checkEmail(value) {
  if (typeof value === 'string') {
    value = value.trim();
  }

  // http://stackoverflow.com/a/46181/11236
  var regexp = /^(([^<>()\[\]\\.,;:\s@\"]+(\.[^<>()\[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return regexp.test(value);
}

/**
 * Generates a function that checks that its argument contains at least
 * minLength characters.
 *
 * @param {number} minLength
 * @return {function(string)}
 */
function checkMinLength(minLength) {
  if (minLength === null || minLength === undefined) {
    throw new Error('must specify a min length')
  }

  return function(value) {
    if (value !== null && value !== undefined) {
      return value.length >= minLength;
    } else {
      return false;
    }
  };
}

/**
 * Generates a function that checks that its argument contains at most
 * maxLength characters.
 *
 * @param {number} maxLength
 * @return {function(string)}
 */
function checkMaxLength(maxLength) {
  if (maxLength === null || maxLength === undefined) {
    throw new Error('must specify a max length')
  }

  return function(value) {
    if (value !== null && value !== undefined) {
      return value.length <= maxLength;
    } else {
      return false;
    }
  };
}

/**
 * Registers the core helpers with ValidatorBuilder.
 */
function register() {
  ValidatorBuilder.registerHelper('required', function(message) {
    this.using(present, message);
  });

  ValidatorBuilder.registerHelper('optional', function() {
    this.when(present);
  });

  ValidatorBuilder.registerHelper('email', function(message) {
    this.using(checkEmail, message);
  });

  ValidatorBuilder.registerHelper('minLength', function(minLength, message) {
    this.using(checkMinLength(minLength), message);
  });

  ValidatorBuilder.registerHelper('maxLength', function(maxLength, message) {
    this.using(checkMaxLength(maxLength), message);
  });
}


exports.present = present;
exports.checkEmail = checkEmail;
exports.checkMinLength = checkMinLength;
exports.checkMaxLength = checkMaxLength;
exports.register = register;
},{"../validator_builder":6}],4:[function(require,module,exports){
"use strict";
var config = require("./config");
var __dependency1__ = require("./utils");
var all = __dependency1__.all;
var resolve = __dependency1__.resolve;
var contains = __dependency1__.contains;
var keys = __dependency1__.keys;
var forEach = __dependency1__.forEach;
var get = __dependency1__.get;
var uniq = __dependency1__.uniq;

/**
 * Represents validations for named object attributes.
 *
 * @constructor
 */
function ObjectValidator() {
  this._validations  = {};
  this._dependencies = {};
}

/**
 * Maps attribute names to a list of predicate/message pairs.
 *
 * @type {object}
 * @private
 */
ObjectValidator.prototype._validations = null;

/**
 * Maps attribute names to a list of dependent attributes.
 *
 * @type {object}
 * @private
 */
ObjectValidator.prototype._dependencies = null;

/**
 * Add a validation for the given attribute.
 *
 * @param {string} attr
 * @param {function(object, string, object)} fn
 * @param {object} message
 */
ObjectValidator.prototype.addValidation = function(attr, fn, message) {
  var list = this._validations[attr];

  if (!list) {
    list = this._validations[attr] = [];
  }

  list.push([fn, message]);
};

/**
 * Register dependents of the given attribute.
 *
 * @param {string} parentAttribute
 * @param {string...} dependentAttributes
 */
ObjectValidator.prototype.addDependentsFor = function(/* parentAttribute, ...dependentAttributes */) {
  var dependentAttributes = [].slice.apply(arguments);
  var parentAttribute = dependentAttributes.shift();

  var dependentsForParent = this._dependencies[parentAttribute];

  if (!dependentsForParent) {
    dependentsForParent = this._dependencies[parentAttribute] = [];
  }

  for (var i = 0; i < dependentAttributes.length; i++) {
    var attr = dependentAttributes[i];
    if (!contains(dependentsForParent, attr)) {
      dependentsForParent.push(attr)
    }
  }
};

/**
 * Retrieves the list of attributes this validator knows about. This includes
 * all attributes for which there is a validation plus all the attributes which
 * are dependended on by other attributes.
 *
 * @return {array<string>}
 */
ObjectValidator.prototype.attributes = function() {
  return uniq(
    keys(this._validations).concat(
      keys(this._dependencies)
    )
  );
};

/**
 * Validates the given object. By default all attributes will be validated, but
 * you can specify the attributes you wish to validate by passing additional
 * attribute names as arguments.
 *
 *    validator.validate(obj, 'name', 'age');
 *
 * If you pass a callback function it will be called with an error, if any
 * occurred while validating, followed by the validation results.
 *
 *    validator.validate(obj, function(error, results){});
 *
 * If no callback function is given then a promise will be returned that will
 * resolve to the validation result or, in the event of an error while
 * validating, will be rejected with the exception that was thrown.
 *
 *    validator.validate(obj).then(function(result){}, function(error){});
 *
 * @param {object} object
 * @param {string...} attributes
 * @param {function(object, object)} callback
 * @return {object}
 */
ObjectValidator.prototype.validate = function(/* object, attributes..., callback */) {
  var attributes = [].slice.apply(arguments);
  var object = attributes.shift();
  var callback = attributes.pop();
  var self = this;

  if (typeof callback === 'string') {
    attributes.push(callback);
    callback = null;
  }

  if (attributes.length === 0) {
    attributes = keys(this._validations);
  }

  var validationPromises = [];
  for (var i = 0; i < attributes.length; i++) {
    var attr = attributes[i];
    validationPromises = validationPromises.concat(this._validateAttribute(object, attr));
  }

  var promise = all(validationPromises).then(
    function(results) {
      results = self._collectResults(results);
      if (callback) {
        callback(null, results);
      }
      return results;
    },
    function(err) {
      if (callback) {
        callback(err);
      }
      throw err;
    });

  if (!callback) {
    return promise;
  }
};

/**
 * Runs all validations for a particular attribute and all of its dependents on
 * the given object. Returns an array of promises, one entry for each
 * validation, resolving to attribute name/message pairs, where the message is
 * null if validation passed or there were no validations for an attribute.
 *
 * @param {object} object
 * @param {string} attr
 * @return {array}
 * @private
 */
ObjectValidator.prototype._validateAttribute = function(object, attr) {
  var value       = get(object, attr);
  var validations = this._validations[attr];
  var results     = [];

  if (validations) {
    forEach(validations, function(pair) {
      var fn      = pair[0];
      var message = pair[1];

      var promise = resolve()
        .then(function() {
          return fn(value, attr, object);
        })
        .then(function(isValid) {
          return [ attr, isValid ? null : message ];
        });

      results.push(promise);
    });
  } else if (contains(this.attributes(), attr)) {
    results.push([ attr, null ]);
  }

  var dependents = this._getDependentsFor(attr);
  for (var i = 0; i < dependents.length; i++) {
    var dependent = dependents[i];
    results = results.concat(this._validateAttribute(object, dependent));
  }

  return results;
};

/**
 * Helper method to build the final result based on the individual validation
 * results for each validated attribute.
 *
 * @param {array} results
 * @return {object}
 */
ObjectValidator.prototype._collectResults = function(results) {
  var result = {
    valid  : true,
    errors : {}
  };

  for (var i = 0; i < results.length; i++) {
    if (!results[i]){ continue; }

    var attr = results[i][0];
    var message = results[i][1];
    var messages = result.errors[attr];

    if (!messages) {
      messages = result.errors[attr] = [];
    }

    if (message) {
      messages.push(message);
      result.valid = false;
    }
  }

  return result;
};

/**
 * Gets all attributes dependent on the given attribute.
 *
 * @param {string} parentAttribute
 * @return {array<string>}
 */
ObjectValidator.prototype._getDependentsFor = function(parentAttribute) {
  return (this._dependencies[parentAttribute] || []).slice();
};


module.exports = ObjectValidator;
},{"./config":2,"./utils":5}],5:[function(require,module,exports){
"use strict";
var config = require("./config");

/**
 * Iteration
 */

/**
 * Iterates over the given object's entries using the given iterator.
 *
 * @param {object|array} iterable
 * @param {function(object, string|number)} iterator
 */
function forEach(iterable, iterator) {
  if (typeof iterable.forEach === 'function') {
    iterable.forEach(iterator);
  } else if ({}.toString.call(iterable) === '[object Object]') {
    var hasOwnProp = {}.hasOwnProperty;
    for (var key in iterable) {
      if (hasOwnProp.call(iterable, key)) {
        iterator(iterable[key], key);
      }
    }
  } else {
    for (var i = 0; i < iterable.length; i++) {
      iterator(iterable[i], i);
    }
  }
}

/**
 * Returns all the keys this object has not on its prototype.
 *
 * @param {object} object
 * @return {array<string>}
 */
function keys(object) {
  if (Object.getOwnPropertyNames) {
    return Object.getOwnPropertyNames(object);
  } else {
    var result = [];
    forEach(object, function(key) {
      result.push(key);
    });
    return result;
  }
}



/**
 * Property access
 */

/**
 * Gets the given property from the given object. If the object has a method
 * named "get" then it will be used to retrieve the value, otherwise direct
 * property access will be used. If object is null or undefined then undefined
 * will be returned.
 *
 * @param {object} object
 * @param {string} property
 * @return {object}
 */
function get(object, property) {
  if (object === null || object === undefined) {
    return;
  } else if (typeof object.get === 'function') {
    return object.get(property);
  } else {
    return object[property];
  }
}

/**
 * Get a list of property values from the given object with the given names.
 *
 * @param {object} object
 * @param {array<string>} properties
 * @return {array<object>}
 */
function getProperties(object, properties) {
  return properties.map(function(prop) {
    return get(object, prop);
  });
}



/**
 * Array manipulation
 */

/**
 * Determines whether the given array contains the given object.
 *
 * @param {array} array
 * @param {object} object
 * @return {boolean}
 */
function contains(array, object) {
  return array.indexOf(object) > -1;
}

/**
 * Returns an array with duplicate values in the given array removed. Only the
 * first instance of any value will be kept.
 *
 * @param {array} array
 * @return {array}
 */
function uniq(array) {
  var result = [];

  for (var i = 0; i < array.length; i++) {
    var item = array[i];
    if (!contains(result, item)) {
      result.push(item);
    }
  }

  return result;
}



/**
 * Promises
 */

/**
 * Generates a promise resolving to the given object or, if the object is
 * itself a promise, resolving to the final value of that promise.
 *
 * @param {object} promiseOrValue
 * @return {object}
 */
function resolve(promiseOrValue) {
  var deferred = config.defer();
  deferred.resolve(promiseOrValue);
  return deferred.promise;
}

/**
 * Generates a promise that resolves to an array of values. Any non-promises
 * among the given array will be used as-is, and any promises among the given
 * array will be replaced by their final resolved value.
 *
 * @param {array<object>} promisesOrValues
 * @return {object}
 */
function all(promisesOrValues) {
  if (promisesOrValues.length === 0) {
    return resolve([]);
  }

  var results = [];
  var remaining = promisesOrValues.length;
  var deferred = config.defer();

  function resolver(index) {
    return function(value) {
      results[index] = value;
      if (--remaining === 0) {
        deferred.resolve(results);
      }
    };
  }

  for (var i = 0; i < promisesOrValues.length; i++) {
    var promiseOrValue = promisesOrValues[i];
    resolve(promiseOrValue).then(resolver(i), deferred.reject);
  }

  return deferred.promise;
}


exports.forEach = forEach;
exports.keys = keys;
exports.get = get;
exports.getProperties = getProperties;
exports.contains = contains;
exports.uniq = uniq;
exports.resolve = resolve;
exports.all = all;
},{"./config":2}],6:[function(require,module,exports){
"use strict";
var ObjectValidator = require("./object_validator");
var __dependency1__ = require("./utils");
var getProperties = __dependency1__.getProperties;
var resolve = __dependency1__.resolve;

/**
 * This object builds an ObjectValidator using the builder pattern. The result
 * is intended to read more or less as a sentence – a description of what the
 * validator will do.
 *
 * @constructor
 */
function ValidatorBuilder() {
  this._validator = new ObjectValidator();
}

/**
 * The current validated attribute – the last value passed to validates().
 *
 * @type {string}
 * @private
 */
ValidatorBuilder.prototype._attr = null;

/**
 * The current condition function – the last value passed to when().
 *
 * @type {function}
 * @private
 */
ValidatorBuilder.prototype._condition = null;

/**
 * The ObjectValidator being built. Returned by build().
 *
 * @type {ObjectValidator}
 * @private
 */
ValidatorBuilder.prototype._validator = null;

/**
 * Configures the builder to start building validation for the given attribute.
 *
 * @param {string} attr
 * @return {ValidatorBuilder}
 */
ValidatorBuilder.prototype.validates = function(attr) {
  this._attr = attr;
  this._condition = null;
  return this;
};

/**
 * Configures the builder to make subsequent validations for the current
 * attribute conditional based on the given predicate function.
 *
 * @param {string...} dependencies Attributes this condition depends on.
 * @param {function} condition The condition used to gate validations.
 * @return {ValidatorBuilder}
 */
ValidatorBuilder.prototype.when = function(/* ...dependencies, condition */) {
  var dependencies = [].slice.apply(arguments);
  var condition    = dependencies.pop();

  if (dependencies.length === 0) {
    dependencies = [this._attr];
  }

  for (var i = 0; i < dependencies.length; i++) {
    var dependency = dependencies[i];
    if (dependency !== this._attr) {
      this._validator.addDependentsFor(dependency, this._attr);
    }
  }

  this._condition = condition;
  this._conditionDependencies = dependencies;
  return this;
};

/**
 * Register a validation for the current attribute.
 *
 * @param {string...} dependencies Attributes this validation depends on.
 * @param {function} predicate The function to validate the current attribute.
 * @param {object} message A message, usually a string, to pass when invalid.
 * @return {ValidatorBuilder}
 */
ValidatorBuilder.prototype.using = function(/* ...dependencies, predicate, message */) {
  var dependencies = [].slice.apply(arguments);
  var message      = dependencies.pop();
  var predicate    = dependencies.pop();

  if (typeof message === 'function' && typeof predicate === 'undefined') {
    throw new Error('missing expected argument `message` after predicate function');
  }

  if (dependencies.length === 0) {
    dependencies = [this._attr];
  }

  for (var i = 0; i < dependencies.length; i++) {
    var dependency = dependencies[i];
    if (dependency !== this._attr) {
      this._validator.addDependentsFor(dependency, this._attr);
    }
  }

  function validation(value, attr, object) {
    var properties = getProperties(object, dependencies);
    return predicate.apply(null, properties.concat([attr, object]));
  }

  var condition = this._condition;
  var conditionDependencies = this._conditionDependencies;

  function validationWithCondition(value, attr, object) {
    var properties = getProperties(object, conditionDependencies);
    var conditionResult = condition.apply(null, properties.concat([attr, object]));
    return resolve(conditionResult).then(function(result) {
      if (result) {
        // condition resolved to a truthy value, so continue with validation
        return validation(value, attr, object);
      } else {
        // condition resolved to a falsy value, so just return as valid
        return true;
      }
    });
  }

  this._validator.addValidation(
    this._attr,
    condition ? validationWithCondition : validation,
    message
  );
  return this;
};

/**
 * Build the ObjectValidator for use with validation.
 *
 * @return {ObjectValidator}
 */
ValidatorBuilder.prototype.build = function() {
  return this._validator;
};

/**
 * Registers a helper to extend the DSL offered by ValidatorBuilder.
 *
 * @param {string} name The name to use for the DSL method.
 * @param {function} fn A callback for when the helper is used.
 */
ValidatorBuilder.registerHelper = function(name, fn) {
  ValidatorBuilder.prototype[name] = function() {
    fn.apply(this, arguments);
    return this;
  };
};

/**
 * Unregisters an existing DSL helper. Existing ObjectValidators built using
 * the helper will continue to function, but new ValidatorBuilder instances
 * will not have the helper.
 *
 * @param {string} name
 */
ValidatorBuilder.unregisterHelper = function(name) {
  delete ValidatorBuilder.prototype[name];
};


module.exports = ValidatorBuilder;
},{"./object_validator":4,"./utils":5}]},{},[1])(1)
});
;