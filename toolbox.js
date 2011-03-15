(function () {
    "use strict";

    // `ctor` and `inherits` are from Backbone.js (with some modifications):
    // http://documentcloud.github.com/backbone/

    // Shared empty constructor function to aid in prototype-chain creation.
    var ctor = function(){};

    // Helper function to correctly set up the prototype chain, for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    var inherits = function(parent, protoProps, staticProps) {
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call `super()`.
        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            child = protoProps.constructor;
        } else {
            child = function () { return parent.apply(this, arguments); };
        }

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        ctor.prototype = parent.prototype;
        child.prototype = new ctor();

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Add static properties to the constructor function, if supplied.
        if (staticProps) _.extend(child, staticProps);

        // Correctly set child's `prototype.constructor`, for `instanceof`.
        child.prototype.constructor = child;

        // Set a convenience property in case the parent's prototype is needed later.
        child.__super__ = parent.prototype;

        return child;
    };

    // Self-propagating extend function.
    // Create a new class that inherits from the class found in the `this` context object.
    // This function is meant to be called in the context of a constructor function.
    function extendThis(protoProps, staticProps) {
        var child = inherits(this, protoProps, staticProps);
        child.extend = extendThis;
        return child;
    }

    // A simple base class that allows easy creation of subclasses.
    // All subclasses will have the `extend` function.
    // Example:
    //     var MyClass = Base.extend({
    //         someProp: 'My property value',
    //         someMethod: function () { ... }
    //     });
    //     var inst1 = new MyClass();
    function Base() {}
    Base.extend = extendThis;

    // Declare a computed property.
    // `watched` is a list of property names that this computed property depends on.
    // A change to any property in `watches` will trigger a change event for the property.
    // `getter` is a function that takes no arguments and returns the property value.
    // `setter` is a function that takes a new property value and does whatever is
    // appropriate to store the new value.
    // `watched` is required, but can be an empty array
    // `getter` is required
    // `setter` is optional
    function prop(watches, getter, setter) {
        return {
            watches: watches,
            getter: getter,
            setter: setter,
            isComputedProperty: true
        };
    }

    // Provides support for property change notifications and computed properties.
    // This module can be used by mixing it into an object or class prototype.
    // `set()` will trigger a change event for the modified property, where the
    // event name is: `*propertyName*Changed`.
    // A computed property can be declared using `Toolbox.prop()`.
    // Example:
    // var MyClass = Base.extend({
    //     prop1: 'apple',
    //     prop2: Toolbox.prop(['prop1'], function () {
    //         return 'pine' + this.get('prop1');
    //     })
    // });
    // var obj = new MyClass();
    // alert(obj.get('prop1')); // apple
    // alert(obj.get('prop2')); // pineapple
    var SmartProperties = {

        // Initialize properties to the defaults provided in `initProps` and process
        // computed properties.
        initSmartProperties: function (initProps) {
            var that = this;
            if (initProps) {
                _.extend(this, initProps);
            }

            // Build a mapping from a property name to the list of property names
            // that depend on it.
            var watchers = this._watchers = {};

            // NOTE: This loop should include both properties explicitly assigned
            // to `this` and properties inherited from the prototype chain, so that
            // we handle all computed properties.
            for (var key in this) {
                var value = this[key];
                if (value && value.isComputedProperty) {
                    _.each(value.watches, function (watch) {
                        watchers[watch] = watchers[watch] || [];
                        watchers[watch].push(key);
                    });
                }
            }
        },

        // Return the value of the property with the given name.
        // If the property is a computed property, the value is determined by the
        // return value of the computed property's getter function.
        get: function (name) {
            var value = this[name];
            if (value && value.isComputedProperty) {
                return value.getter.call(this);
            }
            return this[name];
        },

        // Sets the value of the property with the given name.
        // If the property is a computed property, the property's setter function
        // will be called with the provided `value` as the first argument.
        set: function (name, value) {
            var currentValue = this[name];
            var changed = false;
            if (currentValue && currentValue.isComputedProperty) {
                if (currentValue.setter) {
                    currentValue.setter.call(this, value);
                    changed = true;
                }
            } else {
                this[name] = value;
                changed = true;
            }
            if (changed) {
                this._triggerChange(name);
            }
        },

        // Trigger a change event for the given property name.
        // Also triggers change events for all properties that are watching this property.
        _triggerChange: function (name) {
            var that = this;
            this.trigger(name + 'Changed');
            _.each(this._watchers[name], function (watcher) {
                that._triggerChange(watcher);
            });
        }
    };

    // Mix events module into SmartProperties module.
    _.extend(SmartProperties, Backbone.Events);

    // Convenience class that extends Base and already integrates the SmartProperties
    // mixin module.
    var LiveObject = Base.extend({
        constructor: function (props) {
            this.initSmartProperties(props);
        }
    });
    _.extend(LiveObject.prototype, SmartProperties);

    // Bind a property of `obj1` to a property of `obj2`.
    // Initially, the property of `obj1` will take on the value of the `obj2` property.
    // Subsequent changes to either property will be automatically propagated to the
    // other property.
    function bindProperties(obj1, prop1, obj2, prop2) {
        function createUpdateFunc(obj1, prop1, obj2, prop2) {
            return function () {
                var curValue = obj1.get(prop1);
                var newValue = obj2.get(prop2);
                if (curValue !== newValue) {
                    obj1.set(prop1, obj2.get(prop2));
                }
            };
        }
        var update1 = createUpdateFunc(obj1, prop1, obj2, prop2);
        var update2 = createUpdateFunc(obj2, prop2, obj1, prop1);
        obj1.bind(prop1 + 'Changed', update2);
        obj2.bind(prop2 + 'Changed', update1);
        update1();
    }

    window.Toolbox = {
        Base: Base,
        prop: prop,
        SmartProperties: SmartProperties,
        LiveObject: LiveObject,
        bindProperties: bindProperties
    };
})();


(function ($) {
    $.fn.disable = function () {
        this.attr('disabled', 'disabled');
    };

    $.fn.enable = function () {
        this.removeAttr('disabled');
    };
})(jQuery);
