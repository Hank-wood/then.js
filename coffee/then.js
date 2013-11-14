(function() {
  var closurePromise, createHandler, each, eachAndSeriesFactory, eachSeries, getError, isArray, isFunction, nextTick, noop, parallel, parallelAndSeriesFactory, series, slice, thenjs, tryNextTick;

  slice = [].slice;

  isArray = Array.isArray;

  noop = function() {};

  isFunction = function(fn) {
    return typeof fn === 'function';
  };

  nextTick = typeof process === 'object' && isFunction(process.nextTick) ? process.nextTick : setTimeout;

  getError = function(obj, method, type) {
    return new Error("Argument " + obj + " in \"" + method + "\" function is not a " + type + " !");
  };

  each = function(defer, array, iterator, context) {
    var i, item, next, resultArray, total, _i, _len, _results;
    next = function(index, err, result) {
      total -= 1;
      resultArray[index] = result;
      if (total <= 0 || (err != null)) {
        return defer(err || null, resultArray);
      }
    };
    resultArray = [];
    next._next_then = {};
    if (!isArray(array)) {
      return defer(getError(array, 'each', 'array'));
    } else if (!isFunction(iterator)) {
      return defer(getError(iterator, 'each', 'function'));
    } else {
      total = array.length;
      if (!total) {
        return defer(null, resultArray);
      } else {
        _results = [];
        for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
          item = array[i];
          _results.push(iterator.call(context, next.bind(null, i), item, i, array));
        }
        return _results;
      }
    }
  };

  eachSeries = function(defer, array, iterator, context) {
    var end, i, next, resultArray;
    next = function(err, result) {
      resultArray[i] = result;
      i += 1;
      if (i < end && !(err != null)) {
        return iterator.call(context, next, array[i], i, array);
      } else {
        delete resultArray[-1];
        return defer(err || null, resultArray);
      }
    };
    i = -1;
    resultArray = [];
    next._next_then = {};
    if (!isArray(array)) {
      return defer(getError(array, 'eachSeries', 'array'));
    } else if (!isFunction(iterator)) {
      return defer(getError(iterator, 'eachSeries', 'function'));
    } else {
      end = array.length;
      if (end) {
        return next();
      } else {
        return defer(null, resultArray);
      }
    }
  };

  parallel = function(defer, array, context) {
    var fn, i, next, resultArray, total, _i, _len, _results;
    next = function(index, err, result) {
      total -= 1;
      resultArray[index] = result;
      if (total <= 0 || (err != null)) {
        return defer(err || null, resultArray);
      }
    };
    resultArray = [];
    next._next_then = {};
    if (!isArray(array)) {
      return defer(getError(array, 'parallel', 'array'));
    } else {
      total = array.length;
      if (total) {
        _results = [];
        for (i = _i = 0, _len = array.length; _i < _len; i = ++_i) {
          fn = array[i];
          if (isFunction(fn)) {
            _results.push(fn.call(context, next.bind(null, i), i));
          } else {
            _results.push(defer(getError(fn, 'parallel', 'function')));
          }
        }
        return _results;
      } else {
        return defer(null, resultArray);
      }
    }
  };

  series = function(defer, array, context) {
    var end, i, next, resultArray;
    next = function(err, result) {
      resultArray[i] = result;
      i += 1;
      if (i < end && !(err != null)) {
        if (isFunction(array[i])) {
          return array[i].call(context, next, i);
        } else {
          return defer(getError(array[i], 'series', 'function'));
        }
      } else {
        delete resultArray[-1];
        return defer(err || null, resultArray);
      }
    };
    i = -1;
    resultArray = [];
    next._next_then = {};
    if (isArray(array)) {
      end = array.length;
      if (end) {
        return next();
      } else {
        return defer(null, resultArray);
      }
    } else {
      return defer(getError(array, 'series', 'array'));
    }
  };

  tryNextTick = function(defer, fn) {
    return nextTick(function() {
      try {
        return fn();
      } catch (error) {
        return defer(error);
      }
    });
  };

  createHandler = function(defer, handler) {
    if (isFunction(handler)) {
      if (handler._next_then) {
        return handler;
      } else {
        return handler.bind(null, defer);
      }
    }
  };

  closurePromise = function(debug) {
    var Promise, chain, fail, promiseFactory;
    fail = [];
    chain = 0;
    promiseFactory = function(fn) {
      var defer, promise;
      promise = new Promise();
      defer = promise.defer.bind(promise);
      defer._next_then = promise;
      fn(defer);
      return promise;
    };
    Promise = (function() {

      function Promise() {}

      Promise.prototype.debug = !debug || isFunction(debug) ? debug : typeof console === 'object' && isFunction(console.log) && function() {
        return console.log.apply(console, arguments);
      };

      Promise.prototype.all = function(allHandler) {
        var _this = this;
        return promiseFactory(function(defer) {
          return _this._all = createHandler(defer, allHandler);
        });
      };

      Promise.prototype.then = function(successHandler, errorHandler) {
        var _this = this;
        return promiseFactory(function(defer) {
          _this._success = createHandler(defer, successHandler);
          return _this._error = createHandler(defer, errorHandler);
        });
      };

      Promise.prototype.fail = function(errorHandler) {
        var _this = this;
        return promiseFactory(function(defer) {
          _this._fail = createHandler(defer, errorHandler);
          _this._success = defer.bind(defer, null);
          if (_this._fail) {
            return fail.push(_this._fail);
          }
        });
      };

      Promise.prototype.each = function(array, iterator, context) {
        var _this = this;
        return promiseFactory(function(defer) {
          return _this._each = function(dArray, dIterator, dContext) {
            return each(defer, array || dArray, iterator || dIterator, context || dContext);
          };
        });
      };

      Promise.prototype.eachSeries = function(array, iterator, context) {
        var _this = this;
        return promiseFactory(function(defer) {
          return _this._eachSeries = function(dArray, dIterator, dContext) {
            return eachSeries(defer, array || dArray, iterator || dIterator, context || dContext);
          };
        });
      };

      Promise.prototype.parallel = function(array, context) {
        var _this = this;
        return promiseFactory(function(defer) {
          return _this._parallel = function(dArray, dContext) {
            return parallel(defer, array || dArray, context || dContext);
          };
        });
      };

      Promise.prototype.series = function(array, context) {
        var _this = this;
        return promiseFactory(function(defer) {
          return _this._series = function(dArray, dContext) {
            return series(defer, array || dArray, context || dContext);
          };
        });
      };

      Promise.prototype.defer = function(err) {
        var args;
        chain += 1;
        this._error = this._fail ? fail.shift() : this._error;
        this._success = this._success || this._each || this._eachSeries || this._parallel || this._series || noop;
        try {
          if (this.debug) {
            args = slice.call(arguments);
            args.unshift("Then chain " + chain + ":");
            if (isFunction(this.debug)) {
              this.debug.apply(this.debug, args);
            } else if (typeof console === 'object' && isFunction(console.log)) {
              console.log.apply(console, args);
            }
          }
          if (this._all) {
            return this._all.apply(this._all._next_then, slice.call(arguments));
          } else if (!(err != null)) {
            return this._success.apply(this._success._next_then, slice.call(arguments, 1));
          } else {
            throw err;
          }
        } catch (error) {
          if (this._error || fail.length) {
            return (this._error ? this._error : fail.shift()).call(this, error);
          } else {
            throw error;
          }
        } finally {
          this._all = noop;
        }
      };

      return Promise;

    })();
    return promiseFactory;
  };

  eachAndSeriesFactory = function(fn) {
    return function(array, iterator, context, debug) {
      return closurePromise(debug)(function(defer) {
        return tryNextTick(defer, fn.bind(null, defer, array, iterator, context));
      });
    };
  };

  parallelAndSeriesFactory = function(fn) {
    return function(array, context, debug) {
      return closurePromise(debug)(function(defer) {
        return tryNextTick(defer, fn.bind(null, defer, array, context));
      });
    };
  };

  thenjs = function(startFn, context, debug) {
    return closurePromise(debug)(function(defer) {
      return tryNextTick(defer, isFunction(startFn) ? startFn.bind(context, defer) : defer);
    });
  };

  thenjs.each = eachAndSeriesFactory(each);

  thenjs.eachSeries = eachAndSeriesFactory(eachSeries);

  thenjs.parallel = parallelAndSeriesFactory(parallel);

  thenjs.series = parallelAndSeriesFactory(series);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = thenjs;
  } else if (typeof define === 'function') {
    define(function() {
      return thenjs;
    });
  }

  if (typeof window === 'object') {
    window.then = thenjs;
  }

  return thenjs;

}).call(this);
