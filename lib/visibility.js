/*
 * Copyright 2011 Andrey “A.I.” Sitnik <andrey@sitnik.ru>.
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

;(function() {
    "use strict";

    window.Visibility = {

        // Link to document object to change it in tests.
        _doc: window.document,

        // Vendor prefixes to create event and properties names.
        _prefixes: ['webkit', 'moz', 'o', 'ms'],

        // Vendor prefix cached by `_prefix` function.
        _chechedPrefix: null,

        // Is listener for `visibilitychange` event is already added
        // by `_setListener` method.
        _listening: false,

        // Callbacks from `change` method, that wait visibility changes.
        _changeCallbacks: [],

        // Callbacks from `onVisible` method, that wait when page become to be
        // visible.
        _onVisibleCallbacks: [],

        // Last timer number.
        _lastTimer: 0,

        // Callbacks and intervals added by `every` method.
        _timers: { },

        // Variable to check hidden-visible state changes.
        _hiddenBefore: false,

        // Initialize variables on page loading.
        _init: function () {
            this._hiddenBefore = this.hidden();
        },

        // Detect vendor prefix and return it.
        _prefix: function () {
            if ( null !== this._chechedPrefix ) {
                return this._chechedPrefix;
            }
            if ( 'undefined' != typeof(this._doc.visibilityState) ) {
                return this._chechedPrefix = '';
            }
            var name;
            for ( var i = 0; i < this._prefixes.length; i++ ) {
                name = this._prefixes[i] + 'VisibilityState';
                if ( 'undefined' != typeof(this._doc[name]) ) {
                    return this._chechedPrefix = this._prefixes[i];
                }
            }
        },

        // Return property name with vendor prefix.
        _name: function (name) {
            var prefix = this._prefix();
            if ( '' == prefix ) {
                return name;
            } else {
                return prefix +
                    name.substr(0, 1).toUpperCase() + name.substr(1);
            }
        },

        // Return document’s property value with name with vendor prefix.
        _prop: function (name) {
            return this._doc[this._name(name)]
        },

        // Listener for `visibilitychange` event.
        _onVisibilityChange: function(event) {
            var isHidden = this.hidden(),
                state    = this.state();

            for ( var i = 0; i < this._changeCallbacks.length; i++ ) {
                this._changeCallbacks[i].call(this._doc, event, state);
            }

            var hiddenBefore = this._hiddenBefore;
            if ( (isHidden && !hiddenBefore) || (!isHidden && hiddenBefore) ) {
                for ( i in this._timers ) {
                    this._stopTimer(i);
                    this._runTimer(i, !isHidden);
                }
            }

            if ( !isHidden ) {
                for ( var i = 0; i < this._onVisibleCallbacks.length; i++ ) {
                    this._onVisibleCallbacks[i]();
                }
                this._onVisibleCallbacks = [];
            }

            this._hiddenBefore = isHidden;
        },

        // Set listener for `visibilitychange` event.
        _setListener: function () {
            if ( this._listening ) {
                return;
            }
            var event = this._prefix() + 'visibilitychange';
            this._doc.addEventListener(event, function () {
                Visibility._onVisibilityChange.apply(Visibility, arguments);
            }, false);
            this._listening = true;
            this._hiddenBefore = this.hidden();
        },

        // Set interval by `setInterval`. Allow to change function for tests or
        // syntax sugar in `interval` arguments.
        _setInterval: function (callback, interval) {
            return setInterval(callback, interval);
        },

        // Try to run timer from every method by it’s ID. It will be use
        // `interval` or `hiddenInterval` depending on visibility state.
        // If page is hidden and `hiddenInterval` is null,
        // it will not run timer.
        //
        // Argument `now` say, that timers must be execute now too.
        _runTimer: function (id, now) {
            var interval,
                timer = this._timers[id];
            if ( this.hidden() ) {
                if ( null === timer.hiddenInterval ) {
                    return;
                }
                interval = timer.hiddenInterval;
            } else {
                interval = timer.interval;
            }
            if ( now ) {
                timer.callback.call(window);
            }
            timer.intervalID = this._setInterval(timer.callback, interval);
        },

        // Stop timer from `every` method by it's ID.
        _stopTimer: function (id) {
            var timer = this._timers[id];
            clearInterval(timer.intervalID);
            delete timer.intervalID;
        },

        // Return true if browser support Page Visibility API.
        support: function () {
            return ('undefined' != typeof(this._prefix()));
        },

        // Return true if page now isn’t visible to user.
        //
        // It is just proxy to `document.hidden`, but use vendor prefix.
        hidden: function () {
            if ( !this.support() ) {
                return false;
            }
            return this._prop('hidden');
        },

        // Return visibility state: 'visible', 'hidden' or 'prerender'.
        //
        // It is just proxy to `document.visibilityState`, but use
        // vendor prefix.
        state: function () {
            if ( !this.support() ) {
                return 'visible';
            }
            return this._prop('visibilityState');
        },

        // Call callback when visibility will be changed. First argument for
        // callback will be original event object, second will be visibility
        // state name.
        //
        // If Page Visibility API doesn’t supported method will be return false
        // and callback never will be called.
        //
        // It is just proxy to `visibilitychange` event, but use vendor prefix.
        change: function (callback) {
            if ( !this.support() ) {
                return false;
            }
            this._changeCallbacks.push(callback);
            this._setListener();
            return true;
        },

        // Call callback only when page become to visible for user or
        // call it now if page is visible now or Page Visibility API
        // doesn’t supported.
        //
        // Return true if callback if called now.
        onVisible: function (callback) {
            if ( !this.support() || !this.hidden() ) {
                callback();
                return true;
            }
            this._onVisibleCallbacks.push(callback);
            this._setListener();
        },

        // Run callback every `interval` milliseconds if page is visible and
        // every `hiddenInterval` milliseconds if page is hidden.
        //
        // You can skip `hiddenInterval` and callback will be called only if
        // page is visible.
        //
        // It is analog of `setInterval(callback, interval)` but use visibility
        // state.
        //
        // It return timer ID, that you can use in `Visibility.stop(id)` to stop
        // timer (`clearInterval` analog).
        // Warning: timer ID is different from intervalID from `setInterval`,
        // so don't use it in `clearInterval`.
        //
        // On change state from hidden to visible timers will be execute.
        every: function (interval, hiddenInterval, callback) {
            if ( 'undefined' == typeof(callback) ) {
                callback = hiddenInterval;
                hiddenInterval = null;
            }
            this._lastTimer += 1;
            var number = this._lastTimer;
            this._timers[number] = ({
                interval:       interval,
                hiddenInterval: hiddenInterval,
                callback:       callback
            });
            this._runTimer(number, false);
            return number;
        },

        // Stop timer from `every` method by it ID (`every` method return it).
        stop: function(id) {
            var timer = this._timers[id]
            if ( 'undefined' == typeof(timer) ) {
                return false;
            }
            this._stopTimer(id);
            delete this._timers[id];
            return timer;
        }

    };

    Visibility._init();

})();