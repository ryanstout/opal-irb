(function(undefined) {
  // The Opal object that is exposed globally
  var Opal = this.Opal = {};

  // Very root class
  function BasicObject(){}

  // Core Object class
  function Object(){}

  // Class' class
  function Class(){}

  // Module's class
  function Module(){}

  // the class of nil
  function NilClass(){}

  // TopScope is used for inheriting constants from the top scope
  var TopScope = function(){};

  // Opal just acts as the top scope
  TopScope.prototype = Opal;

  // To inherit scopes
  Opal.constructor  = TopScope;

  // This is a useful reference to global object inside ruby files
  Opal.global = this;

  // Minify common function calls
  var $hasOwn = Opal.hasOwnProperty;
  var $slice  = Opal.slice = Array.prototype.slice;

  // Generates unique id for every ruby object
  var unique_id = 0;

  // Return next unique id
  Opal.uid = function() {
    return unique_id++;
  };

  // Table holds all class variables
  Opal.cvars = {};

  // Globals table
  Opal.gvars = {};

  /*
   * Create a new constants scope for the given class with the given
   * base. Constants are looked up through their parents, so the base
   * scope will be the outer scope of the new klass.
   */
  function create_scope(base, klass, id) {
    var const_alloc   = function() {};
    var const_scope   = const_alloc.prototype = new base.constructor();
    klass._scope      = const_scope;
    const_scope.base  = klass;
    const_scope.constructor = const_alloc;

    if (id) {
      base[id] = base.constructor[id] = klass;
    }
  }

  Opal.klass = function(base, superklass, id, constructor) {
    var klass;

    if (!base._isClass) {
      base = base._klass;
    }

    if (superklass === null) {
      superklass = ObjectClass;
    }

    if ($hasOwn.call(base._scope, id)) {
      klass = base._scope[id];

      if (!klass._isClass) {
        throw Opal.TypeError.$new(id + " is not a class");
      }

      if (superklass !== klass._super && superklass !== ObjectClass) {
        throw Opal.TypeError.$new("superclass mismatch for class " + id);
      }
    }
    else {
      klass = boot_class(superklass, constructor);

      klass._name = (base === ObjectClass ? id : base._name + '::' + id);

      create_scope(base._scope, klass);

      base[id] = base._scope[id] = klass;

      if (superklass.$inherited) {
        superklass.$inherited(klass);
      }
    }

    return klass;
  };

  // Define new module (or return existing module)
  Opal.module = function(base, id, constructor) {
    var klass;

    if (!base._isClass) {
      base = base._klass;
    }

    if ($hasOwn.call(base._scope, id)) {
      klass = base._scope[id];

      if (!klass._mod$ && klass !== ObjectClass) {
        throw Opal.TypeError.$new(id + " is not a module")
      }
    }
    else {
      klass = boot_module(ModuleClass, constructor)
      klass._name = (base === ObjectClass ? id : base._name + '::' + id);

      create_scope(base._scope, klass, id);
    }

    return klass;
  };

  function boot_module(superklass) {
    // module itself
    function OpalModule() {
      this._id = unique_id++;
    }

    var mtor = function() {};
        mtor.prototype = superklass.constructor.prototype;

    OpalModule.prototype = new mtor();
    var prototype = OpalModule.prototype;

    prototype._alloc = constructor;
    prototype._isClass = true;
    prototype.constructor = OpalModule;
    prototype._super = superklass;
    prototype._methods = [];

    var klass = new OpalModule();

    // method table (_proto) for a module can be a simple js object as
    // we dont inherit methods, and we dont ever instantialize it.
    klass._proto = {};

    klass._mod$ = true;
    klass._included_in = [];

    return klass;
  }

  // Boot a base class (makes instances).
  var boot_defclass = function(id, constructor, superklass) {
    if (superklass) {
      var ctor           = function() {};
          ctor.prototype = superklass.prototype;

      constructor.prototype = new ctor();
    }

    var prototype = constructor.prototype;

    prototype.constructor = constructor;

    return constructor;
  };

  // Boot the actual (meta?) classes of core classes
  var boot_makemeta = function(id, klass, superklass) {
    function RubyClass() {
      this._id = unique_id++;
    };

    var ctor            = function() {};
        ctor.prototype  = superklass.prototype;

    RubyClass.prototype = new ctor();

    var prototype         = RubyClass.prototype;
    prototype._alloc      = klass;
    prototype._isClass    = true;
    prototype._name       = id;
    prototype._super      = superklass;
    prototype.constructor = RubyClass;
    prototype._methods    = [];

    var result = new RubyClass();
    klass.prototype._klass = result;
    result._proto = klass.prototype;

    Opal[id] = result;

    return result;
  };

  // Create generic class with given superclass.
  var boot_class = Opal.boot = function(superklass, constructor) {
    // instances
    var ctor = function() {};
        ctor.prototype = superklass._proto;

    constructor.prototype = new ctor();
    var prototype = constructor.prototype;

    prototype.constructor = constructor;

    // class itself
    function OpalClass() {
      this._id = unique_id++;
    };

    var mtor = function() {};
        mtor.prototype = superklass.constructor.prototype;

    OpalClass.prototype = new mtor();

    prototype = OpalClass.prototype;
    prototype._alloc = constructor;
    prototype._isClass = true;
    prototype.constructor = OpalClass;
    prototype._super = superklass;
    prototype._methods = [];

    var result = new OpalClass();
    constructor.prototype._klass = result;

    result._proto = constructor.prototype;

    return result;

    return constructor;
  };

  var bridge_class = function(name, constructor) {
    var klass = boot_class(ObjectClass, constructor);
    var i, length, m;

    constructor.prototype.constructor = constructor;

    constructor._super        = Object;
    constructor.constructor   = Class;
    constructor._methods      = [];

    bridged_classes.push(klass);

    var table = ObjectClass._proto, methods = ObjectClass._methods;

    for (i = 0, length = methods.length; i < length; i++) {
      m = methods[i];
      constructor.prototype[m] = table[m];
    }

    klass._name = name;
    create_scope(Opal, klass, name);

    return klass;
  };

  Opal.puts = function(a) { console.log(a); };

  Opal.add_stubs = function(stubs) {
    for (var i = 0, length = stubs.length; i < length; i++) {
      var stub = stubs[i];

      if (!BasicObject.prototype[stub]) {
        BasicObject.prototype[stub] = true;
        add_stub_for(BasicObject.prototype, stub);
      }
    }
  };

  function add_stub_for(prototype, stub) {
    function method_missing_stub() {
      this.$method_missing._p = method_missing_stub._p;
      method_missing_stub._p = null;

      return this.$method_missing.apply(this, [stub.slice(1)].concat($slice.call(arguments)));
    }

    method_missing_stub.rb_stub = true;
    prototype[stub] = method_missing_stub;
  }

  Opal.add_stub_for = add_stub_for;

  // Const missing dispatcher
  Opal.cm = function(name) {
    return this.base.$const_missing(name);
  };

  // Arity count error dispatcher
  Opal.ac = function(actual, expected, object, meth) {
    var inspect = ((typeof(object) !== 'function') ? object._klass._name + '#' : object._name + '.') + meth;
    var msg = '[' + inspect + '] wrong number of arguments(' + actual + ' for ' + expected + ')';
    throw Opal.ArgumentError.$new(msg);
  };

  // Super dispatcher
  Opal.dispatch_super = function(obj, jsid, args, iter, defs) {
    var dispatcher;

    if (defs) {
      dispatcher = obj._isClass ? defs._super : obj._klass._proto;
    }
    else {
      dispatcher = obj._isClass ? obj._klass : obj._klass._super._proto;
    }

    dispatcher = dispatcher['$' + jsid];
    dispatcher._p = iter;

    return dispatcher.apply(obj, args);
  };

  // return helper
  Opal.$return = function(val) {
    Opal.returner.$v = val;
    throw Opal.returner;
  };

  // handles yield calls for 1 yielded arg
  Opal.$yield1 = function(block, arg) {
    if (typeof(block) !== "function") {
      throw Opal.LocalJumpError.$new("no block given");
    }

    if (block.length > 1) {
      if (arg._isArray) {
        return block.apply(null, arg);
      }
      else {
        return block(arg);
      }
    }
    else {
      return block(arg);
    }
  };

  // handles yield for > 1 yielded arg
  Opal.$yieldX = function(block, args) {
    if (block.length > 1 && args.length == 1) {
      if (args[0]._isArray) {
        return block.apply(null, args[0]);
      }
    }

    return block.apply(null, args);
  };

  // Helper to convert the given object to an array
  Opal.to_ary = function(value) {
    if (value._isArray) {
      return value;
    }

    return [value];
  };

  /*
    Call a ruby method on a ruby object with some arguments:

      var my_array = [1, 2, 3, 4]
      Opal.send(my_array, 'length')     # => 4
      Opal.send(my_array, 'reverse!')   # => [4, 3, 2, 1]

    A missing method will be forwarded to the object via
    method_missing.

    The result of either call with be returned.

    @param [Object] recv the ruby object
    @param [String] mid ruby method to call
  */
  Opal.send = function(recv, mid) {
    var args = $slice.call(arguments, 2),
        func = recv['$' + mid];

    if (func) {
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  Opal.block_send = function(recv, mid, block) {
    var args = $slice.call(arguments, 3),
        func = recv['$' + mid];

    if (func) {
      func._p = block;
      return func.apply(recv, args);
    }

    return recv.$method_missing.apply(recv, [mid].concat(args));
  };

  /**
   * Donate methods for a class/module
   */
  Opal.donate = function(klass, defined, indirect) {
    var methods = klass._methods, included_in = klass._included_in;

    // if (!indirect) {
      klass._methods = methods.concat(defined);
    // }

    if (included_in) {
      for (var i = 0, length = included_in.length; i < length; i++) {
        var includee = included_in[i];
        var dest = includee._proto;

        for (var j = 0, jj = defined.length; j < jj; j++) {
          var method = defined[j];
          dest[method] = klass._proto[method];
        }

        if (includee._included_in) {
          Opal.donate(includee, defined, true);
        }
      }
    }
  };

  // Initialization
  // --------------

  // Constructors for *instances* of core objects
  boot_defclass('BasicObject', BasicObject);
  boot_defclass('Object', Object, BasicObject);
  boot_defclass('Module', Module, Object);
  boot_defclass('Class', Class, Module);

  // Constructors for *classes* of core objects
  var BasicObjectClass = boot_makemeta('BasicObject', BasicObject, Class);
  var ObjectClass      = boot_makemeta('Object', Object, BasicObjectClass.constructor);
  var ModuleClass      = boot_makemeta('Module', Module, ObjectClass.constructor);
  var ClassClass       = boot_makemeta('Class', Class, ModuleClass.constructor);

  // Fix booted classes to use their metaclass
  BasicObjectClass._klass = ClassClass;
  ObjectClass._klass = ClassClass;
  ModuleClass._klass = ClassClass;
  ClassClass._klass = ClassClass;

  // Fix superclasses of booted classes
  BasicObjectClass._super = null;
  ObjectClass._super = BasicObjectClass;
  ModuleClass._super = ObjectClass;
  ClassClass._super = ModuleClass;

  // Defines methods onto Object (which are then donated to bridged classes)
  ObjectClass._defn = function (mid, body) {
    this._proto[mid] = body;
    Opal.donate(this, [mid]);
  };

  var bridged_classes = ObjectClass._included_in = [];

  Opal.base = ObjectClass;
  BasicObjectClass._scope = ObjectClass._scope = Opal;
  Opal.Kernel = ObjectClass;

  create_scope(Opal, ModuleClass);
  create_scope(Opal, ClassClass);

  ObjectClass._proto.toString = function() {
    return this.$to_s();
  };

  ClassClass._proto._defn = function(mid, body) { this._proto[mid] = body; };

  Opal.top = new ObjectClass._alloc();

  Opal.klass(ObjectClass, ObjectClass, 'NilClass', NilClass);

  var nil = Opal.nil = new NilClass;
  nil.call = nil.apply = function() { throw Opal.LocalJumpError.$new('no block given'); };

  Opal.breaker  = new Error('unexpected break');
  Opal.returner = new Error('unexpected return');

  bridge_class('Array', Array);
  bridge_class('Boolean', Boolean);
  bridge_class('Numeric', Number);
  bridge_class('String', String);
  bridge_class('Proc', Function);
  bridge_class('Exception', Error);
  bridge_class('Regexp', RegExp);
  bridge_class('Time', Date);

  TypeError._super = Error;
}).call(this);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$attr_writer', '$=~', '$raise', '$const_missing', '$to_str', '$name', '$append_features', '$included']);
  return (function($base, $super){
    function Module() {};
    Module = $klass($base, $super, "Module", Module);

    var def = Module._proto, $scope = Module._scope, TMP_1, TMP_2, TMP_3;

    Module.constructor.prototype['$new'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      
      function AnonModule(){}
      var klass = Opal.boot(Module, AnonModule);
      klass._name = nil;
      klass._scope = Module._scope;
      klass._klass = Module;

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;
    
    };

    def['$==='] = function(object) {
      
      
      if (object == null) {
        return false;
      }

      var search = object._klass;

      while (search) {
        if (search === this) {
          return true;
        }

        search = search._super;
      }

      return false;
    
    };

    def.$alias_method = function(newname, oldname) {
      
      this._proto['$' + newname] = this._proto['$' + oldname];
      return this;
    };

    def.$alias_native = function(mid, jsid) {
      if (jsid == null) {
        jsid = mid
      }
      return this._proto['$' + mid] = this._proto[jsid];
    };

    def.$ancestors = function() {
      
      
      var parent = this,
          result = [];

      while (parent) {
        result.push(parent);

        if (parent.$included_modules) {
          result = result.concat(parent.$included_modules)
        }

        parent = parent._super;
      }

      return result;
    ;
    };

    def.$append_features = function(klass) {
      
      
      var module = this;

      if (!klass.$included_modules) {
        klass.$included_modules = [];
      }

      for (var idx = 0, length = klass.$included_modules.length; idx < length; idx++) {
        if (klass.$included_modules[idx] === module) {
          return;
        }
      }

      klass.$included_modules.push(module);

      if (!module._included_in) {
        module._included_in = [];
      }

      module._included_in.push(klass);

      var donator   = module._proto,
          prototype = klass._proto,
          methods   = module._methods;

      for (var i = 0, length = methods.length; i < length; i++) {
        var method = methods[i];
        prototype[method] = donator[method];
      }

      // if (prototype._smethods) {
      //  prototype._smethods.push.apply(prototype._smethods, methods);
      //}

      if (klass._included_in) {
        $opal.donate(klass, methods.slice(), true);
      }
    ;
      return this;
    };

    def.$attr_accessor = function(names) {
      var $a, $b;names = $slice.call(arguments, 0);
      ($a = this).$attr_reader.apply($a, [].concat(names));
      return ($b = this).$attr_writer.apply($b, [].concat(names));
    };

    def.$attr_reader = function(names) {
      names = $slice.call(arguments, 0);
      
      var proto = this._proto, cls = this;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function() { return this[name] };

          if (cls._isSingleton) {
            proto.constructor.prototype['$' + name] = func;
          }
          else {
            proto['$' + name] = func;
          }
        })(names[i]);
      }
    ;
      return nil;
    };

    def.$attr_writer = function(names) {
      names = $slice.call(arguments, 0);
      
      var proto = this._proto, cls = this;
      for (var i = 0, length = names.length; i < length; i++) {
        (function(name) {
          proto[name] = nil;
          var func = function(value) { return this[name] = value; };

          if (cls._isSingleton) {
            proto.constructor.prototype['$' + name + '='] = func;
          }
          else {
            proto['$' + name + '='] = func;
          }
        })(names[i]);
      }
    ;
      return nil;
    };

    def.$attr = def.$attr_accessor;

    def.$constants = function() {
      
      
      var result = [];
      var name_re = /^[A-Z][A-Za-z0-9_]+$/;
      var scopes = [this._scope];
      var own_only;
      if (this === Opal.Class || this === Opal.Module) {
        own_only = false;
      }
      else {
        own_only = true;
        var parent = this._super;
        while (parent && (parent !== Opal.Object)) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }
      for (var i = 0, len = scopes.length; i < len; i++) {
        var scope = scopes[i];
        for (name in scope) {
          if ((!own_only || scope.hasOwnProperty(name)) && name_re.test(name)) {
            result.push(name);
          }
        }
      }

      return result;
    ;
    };

    def['$const_defined?'] = function(name, inherit) {
      var $a;if (inherit == null) {
        inherit = true
      }
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };
      
      scopes = [this._scope];
      if (inherit || this === Opal.Object) {
        var parent = this._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$const_get = function(name, inherit) {
      var $a;if (inherit == null) {
        inherit = true
      }
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };
      
      var scopes = [this._scope];
      if (inherit || this == Opal.Object) {
        var parent = this._super;
        while (parent !== Opal.BasicObject) {
          scopes.push(parent._scope);
          parent = parent._super;
        }
      }

      for (var i = 0, len = scopes.length; i < len; i++) {
        if (scopes[i].hasOwnProperty(name)) {
          return scopes[i][name];
        }
       }

      return this.$const_missing(name);
    ;
    };

    def.$const_missing = function(const$) {
      var $a, name = nil;
      name = this._name;
      return this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "uninitialized constant " + (name) + "::" + (const$));
    };

    def.$const_set = function(name, value) {
      var $a;
      if (($a = name['$=~'](/^[A-Z]\w+$/)) === false || $a === nil) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "wrong constant name " + (name))
      };
      try {
        name = name.$to_str()
      } catch ($err) {
      if (true){
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "conversion with #to_str failed")}else { throw $err; }
      };
      
      this._scope[name] = value;

      if (value._isClass && value._name === nil) {
        value._name = this.$name() + '::' + name;
      }

      return value
    ;
    };

    def.$define_method = TMP_2 = function(name, method) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      
      if (method) {
        block = method;
      }

      if (block === nil) {
        throw new Error("no block given");
      }

      var jsid    = '$' + name;
      block._jsid = jsid;
      block._sup  = this._proto[jsid];
      block._s    = null;

      this._proto[jsid] = block;
      $opal.donate(this, [jsid]);

      return null;
    
    };

    def.$include = function(mods) {
      mods = $slice.call(arguments, 0);
      
      var i = mods.length - 1, mod;
      while (i >= 0) {
        mod = mods[i];
        i--;

        if (mod === this) {
          continue;
        }

        (mod).$append_features(this);
        (mod).$included(this);
      }

      return this;
    
    };

    def.$instance_methods = function(include_super) {
      if (include_super == null) {
        include_super = false
      }
      
      var methods = [], proto = this._proto;

      for (var prop in this._proto) {
        if (!include_super && !proto.hasOwnProperty(prop)) {
          continue;
        }

        if (prop.charAt(0) === '$') {
          methods.push(prop.substr(1));
        }
      }

      return methods;
    ;
    };

    def.$included = function(mod) {
      
      return nil;
    };

    def.$module_eval = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      
      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.call(this);
      block._s = block_self;

      return result;
    
    };

    def.$class_eval = def.$module_eval;

    def['$method_defined?'] = function(method) {
      
      
      var body = this._proto['$' + method];
      return (!!body) && !body.rb_stub;
    ;
    };

    def.$module_function = function(methods) {
      methods = $slice.call(arguments, 0);
      
      for (var i = 0, length = methods.length; i < length; i++) {
        var meth = methods[i], func = this._proto['$' + meth];

        this.constructor.prototype['$' + meth] = func;
      }

      return this;
    
    };

    def.$name = function() {
      
      return this._name;
    };

    def.$public = function() {
      
      return nil;
    };

    def.$private = def.$public;

    def.$protected = def.$public;

    def['$public_method_defined?'] = def['$method_defined?'];

    def.$remove_const = function(name) {
      
      
      var old = this._scope[name];
      delete this._scope[name];
      return old;
    ;
    };

    def.$to_s = function() {
      
      return this._name;
    };

    def.$undef_method = function(symbol) {
      
      $opal.add_stub_for(this._proto, "$" + symbol);
      return this;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/module.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$allocate']);
  return (function($base, $super){
    function Class() {};
    Class = $klass($base, $super, "Class", Class);

    var def = Class._proto, $scope = Class._scope, TMP_1, TMP_2;

    Class.constructor.prototype['$new'] = TMP_1 = function(sup) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (sup == null) {
        sup = (($a = $scope.Object) == null ? $opal.cm("Object") : $a)
      }
      
      function AnonClass(){};
      var klass   = Opal.boot(sup, AnonClass)
      klass._name = nil;
      klass._scope = sup._scope;

      sup.$inherited(klass);

      if (block !== nil) {
        var block_self = block._s;
        block._s = null;
        block.call(klass);
        block._s = block_self;
      }

      return klass;
    
    };

    def.$allocate = function() {
      
      
      var obj = new this._alloc;
      obj._id = Opal.uid();
      return obj;
    ;
    };

    def.$inherited = function(cls) {
      
      return nil;
    };

    def.$new = TMP_2 = function(args) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;args = $slice.call(arguments, 0);
      
      var obj = this.$allocate();
      obj._id = Opal.uid();

      obj.$initialize._p = block;
      obj.$initialize.apply(obj, args);
      return obj;
    ;
    };

    def.$superclass = function() {
      
      return this._super || nil;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/class.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$raise']);
  return (function($base, $super){
    function BasicObject() {};
    BasicObject = $klass($base, $super, "BasicObject", BasicObject);

    var def = BasicObject._proto, $scope = BasicObject._scope, TMP_1, TMP_2, TMP_3, TMP_4;

    def.$initialize = function() {
      
      return nil;
    };

    def['$=='] = function(other) {
      
      return this === other;
    };

    def.$__send__ = TMP_1 = function(symbol, args) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      
      var func = this['$' + symbol]

      if (func) {
        if (block !== nil) { func._p = block; }
        return func.apply(this, args);
      }

      if (block !== nil) { this.$method_missing._p = block; }
      return this.$method_missing.apply(this, [symbol].concat(args));
    ;
    };

    def['$eql?'] = def['$=='];

    def['$equal?'] = def['$=='];

    def.$instance_eval = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      
      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.call(this, this);
      block._s = block_self;

      return result;
    ;
    };

    def.$instance_exec = TMP_3 = function(args) {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;args = $slice.call(arguments, 0);
      
      if (block === nil) {
        throw new Error("no block given");
      }

      var block_self = block._s, result;

      block._s = null;
      result = block.apply(this, args);
      block._s = block_self;

      return result;
    
    };

    def.$method_missing = TMP_4 = function(symbol, args) {
      var $a, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;args = $slice.call(arguments, 1);
      return (($a = $scope.Kernel) == null ? $opal.cm("Kernel") : $a).$raise((($a = $scope.NoMethodError) == null ? $opal.cm("NoMethodError") : $a), "undefined method `" + (symbol) + "' for BasicObject instance");
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/basic_object.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $gvars = $opal.gvars;

  $opal.add_stubs(['$raise', '$inspect', '$==', '$native?', '$to_a', '$new', '$to_proc', '$respond_to?', '$to_ary', '$allocate', '$class', '$initialize_copy', '$include', '$singleton_class', '$to_i', '$to_s', '$to_f', '$*', '$>', '$length', '$shift', '$print', '$format', '$puts', '$each', '$<=', '$[]', '$is_a?', '$rand']);
  return (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_8;

    def.$initialize = def.$initialize;

    def['$=='] = def['$=='];

    def.$__send__ = def.$__send__;

    def['$eql?'] = def['$eql?'];

    def['$equal?'] = def['$equal?'];

    def.$instance_eval = def.$instance_eval;

    def.$instance_exec = def.$instance_exec;

    def.$method_missing = TMP_1 = function(symbol, args) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      return this.$raise((($a = $scope.NoMethodError) == null ? $opal.cm("NoMethodError") : $a), "undefined method `" + (symbol) + "' for " + (this.$inspect()));
    };

    def['$=~'] = function(obj) {
      
      return false;
    };

    def['$==='] = function(other) {
      
      return this == other;
    };

    def['$<=>'] = function(other) {
      
      
      if (this['$=='](other)) {
        return 0;
      }

      return nil;
    ;
    };

    def.$method = function(name) {
      var $a;
      
      var recv = this,
          meth = recv['$' + name],
          func = function() {
            return meth.apply(recv, $slice.call(arguments, 0));
          };

      if (!meth) {
        this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a));
      }

      func._klass = (($a = $scope.Method) == null ? $opal.cm("Method") : $a);
      return func;
    ;
    };

    def.$methods = function(all) {
      if (all == null) {
        all = true
      }
      
      var methods = [];
      for(var k in this) {
        if(k[0] == "$" && typeof (this)[k] === "function") {
          if(all === false || all === nil) {
            if(!Object.hasOwnProperty.call(this, k)) {
              continue;
            }
          }
          methods.push(k.substr(1));
        }
      }
      return methods;
    ;
    };

    def.$Array = TMP_2 = function(object, args) {
      var $a, $b, $c, $d, $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;args = $slice.call(arguments, 1);
      
      if (object == null || object === nil) {
        return [];
      }
      else if (this['$native?'](object)) {
        return ($a = ($b = (($c = ((($d = $scope.Native) == null ? $opal.cm("Native") : $d))._scope).Array == null ? $c.cm('Array') : $c.Array)).$new, $a._p = block.$to_proc(), $a).apply($b, [object].concat(args)).$to_a();
      }
      else if (object['$respond_to?']("to_ary")) {
        return object.$to_ary();
      }
      else if (object['$respond_to?']("to_a")) {
        return object.$to_a();
      }
      else {
        return [object];
      }
    ;
    };

    def.$class = function() {
      
      return this._klass;
    };

    def.$define_singleton_method = TMP_3 = function(name) {
      var $iter = TMP_3._p, body = $iter || nil;TMP_3._p = null;
      
      if (body === nil) {
        throw new Error("no block given");
      }

      var jsid   = '$' + name;
      body._jsid = jsid;
      body._sup  = this[jsid];
      body._s    = null;

      this[jsid] = body;

      return this;
    
    };

    def.$dup = function() {
      var copy = nil;
      copy = this.$class().$allocate();
      
      for (var name in this) {
        if (name.charAt(0) !== '$') {
          copy[name] = this[name];
        }
      }
    ;
      copy.$initialize_copy(this);
      return copy;
    };

    def.$enum_for = function(method, args) {
      var $a, $b;if (method == null) {
        method = "each"
      }args = $slice.call(arguments, 1);
      return ($a = (($b = $scope.Enumerator) == null ? $opal.cm("Enumerator") : $b)).$new.apply($a, [this, method].concat(args));
    };

    def['$equal?'] = function(other) {
      
      return this === other;
    };

    def.$extend = function(mods) {
      mods = $slice.call(arguments, 0);
      
      for (var i = 0, length = mods.length; i < length; i++) {
        this.$singleton_class().$include(mods[i]);
      }

      return this;
    
    };

    def.$format = function(format, args) {
      args = $slice.call(arguments, 1);
      
      var idx = 0;
      return format.replace(/%(\d+\$)?([-+ 0]*)(\d*|\*(\d+\$)?)(?:\.(\d*|\*(\d+\$)?))?([cspdiubBoxXfgeEG])|(%%)/g, function(str, idx_str, flags, width_str, w_idx_str, prec_str, p_idx_str, spec, escaped) {
        if (escaped) {
          return '%';
        }

        var width,
        prec,
        is_integer_spec = ("diubBoxX".indexOf(spec) != -1),
        is_float_spec = ("eEfgG".indexOf(spec) != -1),
        prefix = '',
        obj;

        if (width_str === undefined) {
          width = undefined;
        } else if (width_str.charAt(0) == '*') {
          var w_idx = idx++;
          if (w_idx_str) {
            w_idx = parseInt(w_idx_str, 10) - 1;
          }
          width = (args[w_idx]).$to_i();
        } else {
          width = parseInt(width_str, 10);
        }
        if (!prec_str) {
          prec = is_float_spec ? 6 : undefined;
        } else if (prec_str.charAt(0) == '*') {
          var p_idx = idx++;
          if (p_idx_str) {
            p_idx = parseInt(p_idx_str, 10) - 1;
          }
          prec = (args[p_idx]).$to_i();
        } else {
          prec = parseInt(prec_str, 10);
        }
        if (idx_str) {
          idx = parseInt(idx_str, 10) - 1;
        }
        switch (spec) {
        case 'c':
          obj = args[idx];
          if (obj._isString) {
            str = obj.charAt(0);
          } else {
            str = String.fromCharCode((obj).$to_i());
          }
          break;
        case 's':
          str = (args[idx]).$to_s();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'p':
          str = (args[idx]).$inspect();
          if (prec !== undefined) {
            str = str.substr(0, prec);
          }
          break;
        case 'd':
        case 'i':
        case 'u':
          str = (args[idx]).$to_i().toString();
          break;
        case 'b':
        case 'B':
          str = (args[idx]).$to_i().toString(2);
          break;
        case 'o':
          str = (args[idx]).$to_i().toString(8);
          break;
        case 'x':
        case 'X':
          str = (args[idx]).$to_i().toString(16);
          break;
        case 'e':
        case 'E':
          str = (args[idx]).$to_f().toExponential(prec);
          break;
        case 'f':
          str = (args[idx]).$to_f().toFixed(prec);
          break;
        case 'g':
        case 'G':
          str = (args[idx]).$to_f().toPrecision(prec);
          break;
        }
        idx++;
        if (is_integer_spec || is_float_spec) {
          if (str.charAt(0) == '-') {
            prefix = '-';
            str = str.substr(1);
          } else {
            if (flags.indexOf('+') != -1) {
              prefix = '+';
            } else if (flags.indexOf(' ') != -1) {
              prefix = ' ';
            }
          }
        }
        if (is_integer_spec && prec !== undefined) {
          if (str.length < prec) {
            str = "0"['$*'](prec - str.length) + str;
          }
        }
        var total_len = prefix.length + str.length;
        if (width !== undefined && total_len < width) {
          if (flags.indexOf('-') != -1) {
            str = str + " "['$*'](width - total_len);
          } else {
            var pad_char = ' ';
            if (flags.indexOf('0') != -1) {
              str = "0"['$*'](width - total_len) + str;
            } else {
              prefix = " "['$*'](width - total_len) + prefix;
            }
          }
        }
        var result = prefix + str;
        if ('XEG'.indexOf(spec) != -1) {
          result = result.toUpperCase();
        }
        return result;
      });
    
    };

    def.$hash = function() {
      
      return this._id;
    };

    def.$initialize_copy = function(other) {
      
      return nil;
    };

    def.$inspect = function() {
      
      return this.$to_s();
    };

    def['$instance_of?'] = function(klass) {
      
      return this._klass === klass;
    };

    def['$instance_variable_defined?'] = function(name) {
      
      return this.hasOwnProperty(name.substr(1));
    };

    def.$instance_variable_get = function(name) {
      
      
      var ivar = this[name.substr(1)];

      return ivar == null ? nil : ivar;
    ;
    };

    def.$instance_variable_set = function(name, value) {
      
      return this[name.substr(1)] = value;
    };

    def.$instance_variables = function() {
      
      
      var result = [];

      for (var name in this) {
        if (name.charAt(0) !== '$') {
          result.push(name);
        }
      }

      return result;
    
    };

    def.$Integer = function(str) {
      
      return parseInt(str);
    };

    def['$is_a?'] = function(klass) {
      
      
      var search = this._klass;

      while (search) {
        if (search === klass) {
          return true;
        }

        search = search._super;
      }

      return false;
    ;
    };

    def['$kind_of?'] = def['$is_a?'];

    def.$lambda = TMP_4 = function() {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      return block;
    };

    def.$loop = TMP_5 = function() {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      while (true) {;
      if ($opal.$yieldX(block, []) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def['$nil?'] = function() {
      
      return false;
    };

    def.$object_id = function() {
      
      return this._id || (this._id = Opal.uid());
    };

    def.$printf = function(args) {
      var $a, fmt = nil;args = $slice.call(arguments, 0);
      if (args.$length()['$>'](0)) {
        fmt = args.$shift();
        this.$print(($a = this).$format.apply($a, [fmt].concat(args)));
      };
      return nil;
    };

    def.$proc = TMP_6 = function() {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      
      if (block === nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "no block given");
      }
      block.is_lambda = false;
      return block;
    ;
    };

    def.$puts = function(strs) {
      var $a;strs = $slice.call(arguments, 0);
      return ($a = $gvars["stdout"]).$puts.apply($a, [].concat(strs));
    };

    def.$p = function(args) {
      var TMP_7, $a, $b;args = $slice.call(arguments, 0);
      ($a = ($b = args).$each, $a._p = (TMP_7 = function(obj) {

        var self = TMP_7._s || this;
        if (obj == null) obj = nil;
        
        return $gvars["stdout"].$puts(obj.$inspect())
      }, TMP_7._s = this, TMP_7), $a).call($b);
      if (args.$length()['$<='](1)) {
        return args['$[]'](0)
      } else {
        return args
      };
    };

    def.$print = def.$puts;

    def.$raise = function(exception, string) {
      var $a;
      
      if (exception == null && $gvars["!"]) {
        exception = $gvars["!"];
      }
      else if (typeof(exception) === 'string') {
        exception = (($a = $scope.RuntimeError) == null ? $opal.cm("RuntimeError") : $a).$new(exception);
      }
      else if (!exception['$is_a?']((($a = $scope.Exception) == null ? $opal.cm("Exception") : $a))) {
        exception = exception.$new(string);
      }

      throw exception;
    ;
    };

    def.$fail = def.$raise;

    def.$rand = function(max) {
      
      
      if(!max) {
        return Math.random();
      } else {
        if (max._isRange) {
          var arr = max.$to_a();
          return arr[this.$rand(arr.length)];
        } else {
          return Math.floor(Math.random() * Math.abs(parseInt(max)));
        }
      }
    
    };

    def['$respond_to?'] = function(name, include_all) {
      if (include_all == null) {
        include_all = false
      }
      
      var body = this['$' + name];
      return (!!body) && !body.rb_stub;
    ;
    };

    def.$send = def.$__send__;

    def.$public_send = def.$__send__;

    def.$singleton_class = function() {
      
      
      if (this._isClass) {
        if (this._singleton) {
          return this._singleton;
        }

        var meta = new $opal.Class._alloc;
        meta._klass = $opal.Class;
        this._singleton = meta;
        // FIXME - is this right? (probably - methods defined on
        // class' singleton should also go to subclasses?)
        meta._proto = this.constructor.prototype;
        meta._isSingleton = true;

        meta._scope = this._scope;

        return meta;
      }

      if (this._isClass) {
        return this._klass;
      }

      if (this._singleton) {
        return this._singleton;
      }

      else {
        var orig_class = this._klass,
            class_id   = "#<Class:#<" + orig_class._name + ":" + orig_class._id + ">>";

        var Singleton = function () {};
        var meta = Opal.boot(orig_class, Singleton);
        meta._name = class_id;

        meta._proto = this;
        this._singleton = meta;
        meta._klass = orig_class._klass;
        meta._scope = orig_class._scope;

        return meta;
      }
    ;
    };

    def.$sprintf = def.$format;

    def.$String = function(str) {
      
      return String(str);
    };

    def.$tap = TMP_8 = function() {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;
      if ($opal.$yield1(block, this) === $breaker) return $breaker.$v;
      return this;
    };

    def.$to_proc = function() {
      
      return this;
    };

    def.$to_s = function() {
      
      return "#<" + this._klass._name + ":" + this._id + ">";;
    };

    def.$to_str = def.$to_s;

    def.$freeze = function() {
      
      this.___frozen___ = true;
      return this;
    };

    def['$frozen?'] = function() {
      var $a;
      if (this.___frozen___ == null) this.___frozen___ = nil;

      return ((($a = this.___frozen___) !== false && $a !== nil) ? $a : false);
    };
    ;$opal.donate(Kernel, ["$initialize", "$==", "$__send__", "$eql?", "$equal?", "$instance_eval", "$instance_exec", "$method_missing", "$=~", "$===", "$<=>", "$method", "$methods", "$Array", "$class", "$define_singleton_method", "$dup", "$enum_for", "$equal?", "$extend", "$format", "$hash", "$initialize_copy", "$inspect", "$instance_of?", "$instance_variable_defined?", "$instance_variable_get", "$instance_variable_set", "$instance_variables", "$Integer", "$is_a?", "$kind_of?", "$lambda", "$loop", "$nil?", "$object_id", "$printf", "$proc", "$puts", "$p", "$print", "$raise", "$fail", "$rand", "$respond_to?", "$send", "$public_send", "$singleton_class", "$sprintf", "$String", "$tap", "$to_proc", "$to_s", "$to_str", "$freeze", "$frozen?"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/kernel.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$raise']);
  return (function($base, $super){
    function NilClass() {};
    NilClass = $klass($base, $super, "NilClass", NilClass);

    var def = NilClass._proto, $scope = NilClass._scope;

    def['$&'] = function(other) {
      
      return false;
    };

    def['$|'] = function(other) {
      
      return other !== false && other !== nil;
    };

    def['$^'] = function(other) {
      
      return other !== false && other !== nil;
    };

    def['$=='] = function(other) {
      
      return other === nil;
    };

    def.$dup = function() {
      var $a;
      return this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a));
    };

    def.$inspect = function() {
      
      return "nil";
    };

    def['$nil?'] = function() {
      
      return true;
    };

    def.$singleton_class = function() {
      var $a;
      return (($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a);
    };

    def.$to_a = function() {
      
      return [];
    };

    def.$to_h = function() {
      
      return $opal.hash();
    };

    def.$to_i = function() {
      
      return 0;
    };

    def.$to_f = def.$to_i;

    def.$to_n = function() {
      
      return null;
    };

    def.$to_s = function() {
      
      return "";
    };

    def.$object_id = function() {
      var $a;
      return (($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a)._id || ((($a = $scope.NilClass) == null ? $opal.cm("NilClass") : $a)._id = $opal.uid());
    };

    return def.$hash = def.$object_id;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/nil_class.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs([]);
  (function($base, $super){
    function Boolean() {};
    Boolean = $klass($base, $super, "Boolean", Boolean);

    var def = Boolean._proto, $scope = Boolean._scope;

    def._isBoolean = true;

    def['$&'] = function(other) {
      
      return (this == true) ? (other !== false && other !== nil) : false;
    };

    def['$|'] = function(other) {
      
      return (this == true) ? true : (other !== false && other !== nil);
    };

    def['$^'] = function(other) {
      
      return (this == true) ? (other === false || other === nil) : (other !== false && other !== nil);
    };

    def['$=='] = function(other) {
      
      return (this == true) === other.valueOf();
    };

    def.$singleton_class = def.$class;

    def.$to_s = function() {
      
      return (this == true) ? 'true' : 'false';
    };

    def.$to_n = function() {
      
      return this.valueOf();
    };

    return nil;
  })(self, null);
  $scope.TrueClass = (($a = $scope.Boolean) == null ? $opal.cm("Boolean") : $a);
  return $scope.FalseClass = (($a = $scope.Boolean) == null ? $opal.cm("Boolean") : $a);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/boolean.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$name', '$class']);
  (function($base, $super){
    function Exception() {};
    Exception = $klass($base, $super, "Exception", Exception);

    var def = Exception._proto, $scope = Exception._scope;
    def.message = nil;

    Exception.$attr_reader("message");

    Exception.constructor.prototype['$new'] = function(message) {
      if (message == null) {
        message = ""
      }
      
      var err = new Error(message);
      err._klass = this;
      err.name = this._name;
      return err;
    
    };

    def.$backtrace = function() {
      
      
      var backtrace = this.stack;

      if (typeof(backtrace) === 'string') {
        return backtrace.split("\n").slice(0, 15);
      }
      else if (backtrace) {
        return backtrace.slice(0, 15);
      }

      return [];
    ;
    };

    def.$inspect = function() {
      
      return "#<" + (this.$class().$name()) + ": '" + (this.message) + "'>";
    };

    return def.$to_s = def.$message;
  })(self, null);
  (function($base, $super){
    function StandardError() {};
    StandardError = $klass($base, $super, "StandardError", StandardError);

    var def = StandardError._proto, $scope = StandardError._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
  (function($base, $super){
    function NameError() {};
    NameError = $klass($base, $super, "NameError", NameError);

    var def = NameError._proto, $scope = NameError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function NoMethodError() {};
    NoMethodError = $klass($base, $super, "NoMethodError", NoMethodError);

    var def = NoMethodError._proto, $scope = NoMethodError._scope;

    return nil
  })(self, (($a = $scope.NameError) == null ? $opal.cm("NameError") : $a));
  (function($base, $super){
    function RuntimeError() {};
    RuntimeError = $klass($base, $super, "RuntimeError", RuntimeError);

    var def = RuntimeError._proto, $scope = RuntimeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function LocalJumpError() {};
    LocalJumpError = $klass($base, $super, "LocalJumpError", LocalJumpError);

    var def = LocalJumpError._proto, $scope = LocalJumpError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function TypeError() {};
    TypeError = $klass($base, $super, "TypeError", TypeError);

    var def = TypeError._proto, $scope = TypeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function ArgumentError() {};
    ArgumentError = $klass($base, $super, "ArgumentError", ArgumentError);

    var def = ArgumentError._proto, $scope = ArgumentError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function IndexError() {};
    IndexError = $klass($base, $super, "IndexError", IndexError);

    var def = IndexError._proto, $scope = IndexError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function StopIteration() {};
    StopIteration = $klass($base, $super, "StopIteration", StopIteration);

    var def = StopIteration._proto, $scope = StopIteration._scope;

    return nil
  })(self, (($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
  (function($base, $super){
    function KeyError() {};
    KeyError = $klass($base, $super, "KeyError", KeyError);

    var def = KeyError._proto, $scope = KeyError._scope;

    return nil
  })(self, (($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
  (function($base, $super){
    function RangeError() {};
    RangeError = $klass($base, $super, "RangeError", RangeError);

    var def = RangeError._proto, $scope = RangeError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function IOError() {};
    IOError = $klass($base, $super, "IOError", IOError);

    var def = IOError._proto, $scope = IOError._scope;

    return nil
  })(self, (($a = $scope.StandardError) == null ? $opal.cm("StandardError") : $a));
  (function($base, $super){
    function ScriptError() {};
    ScriptError = $klass($base, $super, "ScriptError", ScriptError);

    var def = ScriptError._proto, $scope = ScriptError._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
  (function($base, $super){
    function SyntaxError() {};
    SyntaxError = $klass($base, $super, "SyntaxError", SyntaxError);

    var def = SyntaxError._proto, $scope = SyntaxError._scope;

    return nil
  })(self, (($a = $scope.ScriptError) == null ? $opal.cm("ScriptError") : $a));
  (function($base, $super){
    function NotImplementedError() {};
    NotImplementedError = $klass($base, $super, "NotImplementedError", NotImplementedError);

    var def = NotImplementedError._proto, $scope = NotImplementedError._scope;

    return nil
  })(self, (($a = $scope.ScriptError) == null ? $opal.cm("ScriptError") : $a));
  return (function($base, $super){
    function SystemExit() {};
    SystemExit = $klass($base, $super, "SystemExit", SystemExit);

    var def = SystemExit._proto, $scope = SystemExit._scope;

    return nil
  })(self, (($a = $scope.Exception) == null ? $opal.cm("Exception") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/error.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars;

  $opal.add_stubs(['$new']);
  return (function($base, $super){
    function Regexp() {};
    Regexp = $klass($base, $super, "Regexp", Regexp);

    var def = Regexp._proto, $scope = Regexp._scope;

    def._isRegexp = true;

    Regexp.constructor.prototype['$escape'] = function(string) {
      
      return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\^\$\|]/g, '\\$&');
    };

    Regexp.constructor.prototype['$new'] = function(regexp, options) {
      
      return options? new RegExp(regexp, options) : new RegExp(regexp);
    };

    def['$=='] = function(other) {
      
      return other.constructor == RegExp && this.toString() === other.toString();
    };

    def['$==='] = function(str) {
      
      return this.test(str);
    };

    def['$=~'] = function(string) {
      var $a;
      
      var re = this;
      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        re = new RegExp(re.source, 'g' + (re.multiline ? 'm' : '') + (re.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        $gvars["~"] = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(re, result);
      }
      else {
        $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
      }

      return result ? result.index : nil;
    ;
    };

    def['$eql?'] = def['$=='];

    def.$inspect = function() {
      
      return this.toString();
    };

    def.$match = function(string, pos) {
      var $a;
      
      var re = this;
      if (re.global) {
        // should we clear it afterwards too?
        re.lastIndex = 0;
      }
      else {
        re = new RegExp(re.source, 'g' + (this.multiline ? 'm' : '') + (this.ignoreCase ? 'i' : ''));
      }

      var result = re.exec(string);

      if (result) {
        return $gvars["~"] = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(re, result);
      }
      else {
        return $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
      }
    ;
    };

    def.$source = function() {
      
      return this.source;
    };

    def.$to_s = def.$source;

    def.$to_n = function() {
      
      return this.valueOf();
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/regexp.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs(['$==', '$<=>', '$<=', '$>=', '$>', '$<']);
  return (function($base){
    function Comparable() {};
    Comparable = $module($base, "Comparable", Comparable);
    var def = Comparable._proto, $scope = Comparable._scope;

    def['$<'] = function(other) {
      
      return this['$<=>'](other)['$=='](-1);
    };

    def['$<='] = function(other) {
      
      return this['$<=>'](other)['$<='](0);
    };

    def['$=='] = function(other) {
      
      return this['$<=>'](other)['$=='](0);
    };

    def['$>'] = function(other) {
      
      return this['$<=>'](other)['$=='](1);
    };

    def['$>='] = function(other) {
      
      return this['$<=>'](other)['$>='](0);
    };

    def['$between?'] = function(min, max) {
      var $a;
      return (($a = this['$>'](min)) ? this['$<'](max) : $a);
    };
    ;$opal.donate(Comparable, ["$<", "$<=", "$==", "$>", "$>=", "$between?"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/comparable.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs(['$enum_for', '$==', '$call', '$raise', '$===', '$[]=', '$new', '$<<', '$[]', '$each', '$>', '$<', '$map', '$sort', '$first']);
  return (function($base){
    function Enumerable() {};
    Enumerable = $module($base, "Enumerable", Enumerable);
    var def = Enumerable._proto, $scope = Enumerable._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_17, TMP_18, TMP_19, TMP_20;

    def['$all?'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      
      var result = true, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;
          var args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value === false || value === nil) {
            result = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if ((obj === false || obj === nil) && arguments.length < 2) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def['$any?'] = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      
      var result = false, proc;

      if (block !== nil) {
        proc = function(obj) {
          var value;
          var args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = true;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if ((obj !== false && obj !== nil) || arguments.length >= 2) {
            result      = true;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$collect = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (block === nil) {
        return this.$enum_for("collect")
      };
      
      var result = [];

      var proc = function() {
        var value, args = $slice.call(arguments);

        if (block.length > 1 && args.length === 1 && args[0]._isArray) {
          args = args[0]
        }

        if ((value = block.apply(null, args)) === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      };

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$reduce = TMP_4 = function(object) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      
      var result = object == undefined ? 0 : object;

      var proc = function() {
        var obj = $slice.call(arguments), value;

        if ((value = block.apply(nil, [result].concat(obj))) === $breaker) {
          result = $breaker.$v;
          $breaker.$v = nil;

          return $breaker;
        }

        result = value;
      };

      this.$each._p = proc;
      this.$each();

      return result;
    ;
    };

    def.$count = TMP_5 = function(object) {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      
      var result = 0;

      if (object != null) {
        block = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          return (param)['$=='](object);
        };
      }
      else if (block === nil) {
        block = function() { return true; };
      }

      var proc = function() {
        var value, param = $slice.call(arguments);

        if ((value = block.apply(null, param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result++;
        }
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$detect = TMP_6 = function(ifnone) {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      
      var result = nil;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result       = param;
          $breaker.$v = nil;

          return $breaker;
        }
      };

      this.$each();

      if (result !== nil) {
        return result;
      }

      if (typeof(ifnone) === 'function') {
        return ifnone.$call();
      }

      return ifnone == null ? nil : ifnone;
    
    };

    def.$drop = function(number) {
      var $a;
      
      var result  = [],
          current = 0;

      if (number < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a));
      }

      this.$each._p = function(e) {
        if (number < current) {
          result.push(e);
        }

        current++;
      };

      this.$each()

      return result;
    
    };

    def.$drop_while = TMP_7 = function() {
      var $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      if (block === nil) {
        return this.$enum_for("drop_while")
      };
      
      var result = [];

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker;
        }

        if (value === false || value === nil) {
          result.push(param);
          return value;
        }

        return $breaker;
      };

      this.$each();

      return result;
    
    };

    def.$each_slice = TMP_8 = function(n) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;
      if (block === nil) {
        return this.$enum_for("each_slice", n)
      };
      
      var all = [];

      this.$each._p = function() {
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        all.push(param);

        if (all.length == n) {
          block(all.slice(0));
          all = [];
        }
      };

      this.$each();

      // our "last" group, if smaller than n then wont have been yielded
      if (all.length > 0) {
        block(all.slice(0));
      }

      return nil;
    
    };

    def.$each_with_index = TMP_9 = function() {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;
      if (block === nil) {
        return this.$enum_for("each_with_index")
      };
      
      var index = 0;

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param, index)) === $breaker) {
          return $breaker.$v;
        }

        index++;
      };
      this.$each();

      return nil;
    
    };

    def.$each_with_object = TMP_10 = function(object) {
      var $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;
      if (block === nil) {
        return this.$enum_for("each_with_object", object)
      };
      
      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param, object)) === $breaker) {
          return $breaker.$v;
        }
      };

      this.$each();

      return object;
    ;
    };

    def.$entries = function() {
      
      
      var result = [];

      this.$each._p = function() {
        if (arguments.length == 1) {
          result.push(arguments[0]);
        }
        else {
          result.push($slice.call(arguments));
        }
      };

      this.$each();

      return result;
    
    };

    def.$find = def.$detect;

    def.$find_all = TMP_11 = function() {
      var $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;
      
      var result = [];

      this.$each._p = function() {
        var value;
        var param = arguments.length == 1 ?
          arguments[0] : $slice.call(arguments);

        if ((value = block(param)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(param);
        }
      };

      this.$each();

      return result;
    
    };

    def.$find_index = TMP_12 = function(object) {
      var $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;
      
      var proc, result = nil, index = 0;

      if (object != null) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if ((param)['$=='](object)) {
            result = index;
            return $breaker;
          }

          index += 1;
        };
      }
      else if (block !== nil) {
        proc = function() {
          var value;
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if ((value = block(param)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = index;
            $breaker.$v = index;

            return $breaker;
          }

          index += 1;
        };
      }
      else {
        return this.$enum_for("find_index");
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$first = function(number) {
      
      
      var result  = [],
          current = 0,
          proc;

      if (number == null) {
        result = nil;
        proc   = function() {
          result = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          return $breaker;
        };
      }
      else {
        proc = function() {
          if (number <= current) {
            return $breaker;
          }

          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          result.push(param);

          current++;
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$grep = TMP_13 = function(pattern) {
      var $iter = TMP_13._p, block = $iter || nil;TMP_13._p = null;
      
      var result = [],
          proc;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var value = pattern['$==='](param);

          if (value !== false && value !== nil) {
            if ((value = block(param)) === $breaker) {
              return $breaker.$v;
            }

            result.push(value);
          }
        };
      }
      else {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var value = pattern['$==='](param);

          if (value !== false && value !== nil) {
            result.push(param);
          }
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$group_by = TMP_14 = function() {
      var TMP_15, $a, $b, $c, TMP_16, $iter = TMP_14._p, block = $iter || nil, hash = nil;TMP_14._p = null;
      if (block === nil) {
        return this.$enum_for("group_by")
      };
      hash = ($a = ($b = (($c = $scope.Hash) == null ? $opal.cm("Hash") : $c)).$new, $a._p = (TMP_15 = function(h, k) {

        var self = TMP_15._s || this;
        if (h == null) h = nil;
        if (k == null) k = nil;
        
        return h['$[]='](k, [])
      }, TMP_15._s = this, TMP_15), $a).call($b);
      ($a = ($c = this).$each, $a._p = (TMP_16 = function(el) {

        var self = TMP_16._s || this;
        if (el == null) el = nil;
        
        return hash['$[]'](block.$call(el))['$<<'](el)
      }, TMP_16._s = this, TMP_16), $a).call($c);
      return hash;
    };

    def.$map = def.$collect;

    def.$max = TMP_17 = function() {
      var $a, $iter = TMP_17._p, block = $iter || nil;TMP_17._p = null;
      
      var proc, result;
      var arg_error = false;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if (result == undefined) {
            result = param;
          }
          else if ((value = block(param, result)) === $breaker) {
            result = $breaker.$v;

            return $breaker;
          }
          else {
            if (value > 0) {
              result = param;
            }

            $breaker.$v = nil;
          }
        }
      }
      else {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var modules = param.$class().$included_modules;

          if (modules == undefined || modules.length == 0 || modules.indexOf(Opal.Comparable) == -1) {
            arg_error = true;

            return $breaker;
          }

          if (result == undefined || (param)['$>'](result)) {
            result = param;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      if (arg_error) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#max");
      }

      return (result == undefined ? nil : result);
    
    };

    def.$min = TMP_18 = function() {
      var $a, $iter = TMP_18._p, block = $iter || nil;TMP_18._p = null;
      
      var proc,
          result,
          arg_error = false;

      if (block !== nil) {
        proc = function() {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          if (result == undefined) {
            result = param;
          }
          else if ((value = block(param, result)) === $breaker) {
            result = $breaker.$v;

            return $breaker;
          }
          else {
            if (value < 0) {
              result = param;
            }

            $breaker.$v = nil;
          }
        }
      }
      else {
        proc = function(obj) {
          var param = arguments.length == 1 ?
            arguments[0] : $slice.call(arguments);

          var modules = param.$class().$included_modules;

          if (modules == undefined || modules.length == 0 || modules.indexOf(Opal.Comparable) == -1) {
            arg_error = true;

            return $breaker;
          }

          if (result == undefined || (param)['$<'](result)) {
            result = param;
          }
        }
      }

      this.$each._p = proc;
      this.$each();

      if (arg_error) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#min");
      }

      return result == undefined ? nil : result;
    
    };

    def['$none?'] = TMP_19 = function() {
      var $iter = TMP_19._p, block = $iter || nil;TMP_19._p = null;
      
      var result = true,
          proc;

      if (block !== nil) {
        proc = function(obj) {
          var value,
              args = $slice.call(arguments);

          if ((value = block.apply(this, args)) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
        }
      }
      else {
        proc = function(obj) {
          if (arguments.length == 1 && (obj !== false && obj !== nil)) {
            result       = false;
            $breaker.$v = nil;

            return $breaker;
          }
          else {
            for (var i = 0, length = arguments.length; i < length; i++) {
              if (arguments[i] !== false && arguments[i] !== nil) {
                result       = false;
                $breaker.$v = nil;

                return $breaker;
              }
            }
          }
        };
      }

      this.$each._p = proc;
      this.$each();

      return result;
    
    };

    def.$sort_by = TMP_20 = function() {
      var TMP_21, $a, $b, TMP_22, $c, $d, $iter = TMP_20._p, block = $iter || nil;TMP_20._p = null;
      if (block === nil) {
        return this.$enum_for("sort_by")
      };
      return ($a = ($b = ($c = ($d = this).$map, $c._p = (TMP_22 = function(f) {

        var self = TMP_22._s || this;
        f = $slice.call(arguments, 0);
        f = f.length === 1 ? f[0] : f;
        return [block.$call(f), f];
      }, TMP_22._s = this, TMP_22), $c).call($d).$sort()).$map, $a._p = (TMP_21 = function(f) {

        var self = TMP_21._s || this;
        if (f == null) f = nil;
        
        return f[1];
      }, TMP_21._s = this, TMP_21), $a).call($b);
    };

    def.$select = def.$find_all;

    def.$take = function(num) {
      
      return this.$first(num);
    };

    def.$to_a = def.$entries;

    def.$inject = def.$reduce;
    ;$opal.donate(Enumerable, ["$all?", "$any?", "$collect", "$reduce", "$count", "$detect", "$drop", "$drop_while", "$each_slice", "$each_with_index", "$each_with_object", "$entries", "$find", "$find_all", "$find_index", "$first", "$grep", "$group_by", "$map", "$max", "$min", "$none?", "$sort_by", "$select", "$take", "$to_a", "$inject"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/enumerable.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$enum_for', '$call', '$__send__', '$to_a', '$empty?', '$raise', '$shift']);
  return (function($base, $super){
    function Enumerator() {};
    Enumerator = $klass($base, $super, "Enumerator", Enumerator);

    var def = Enumerator._proto, $scope = Enumerator._scope, $a, TMP_1;
    def.object = def.method = def.args = def.cache = nil;

    Enumerator.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def.$initialize = function(obj, method, args) {
      if (method == null) {
        method = "each"
      }args = $slice.call(arguments, 2);
      this.object = obj;
      this.method = method;
      return this.args = args;
    };

    def.$each = TMP_1 = function() {
      var TMP_2, $a, $b, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };
      return ($a = ($b = this.object).$__send__, $a._p = (TMP_2 = function(e) {

        var self = TMP_2._s || this, $a;
        e = $slice.call(arguments, 0);
        return ($a = block).$call.apply($a, [].concat(e))
      }, TMP_2._s = this, TMP_2), $a).apply($b, [this.method].concat(this.args));
    };

    def.$next = function() {
      var $a;
      ((($a = this.cache) !== false && $a !== nil) ? $a : this.cache = this.$to_a());
      if (($a = this.cache['$empty?']()) !== false && $a !== nil) {
        this.$raise((($a = $scope.StopIteration) == null ? $opal.cm("StopIteration") : $a), "end of enumeration")
      };
      return this.cache.$shift();
    };

    def.$rewind = function() {
      
      this.cache = nil;
      return this;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/enumerator.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$new', '$class', '$raise', '$respond_to?', '$hash', '$<=>', '$==', '$enum_for', '$flatten', '$replace', '$object_id', '$[]', '$inspect', '$to_s', '$delete_if', '$to_proc', '$each', '$reverse', '$keep_if', '$to_n', '$empty?', '$to_ary', '$size', '$length', '$[]=', '$<<', '$at', '$times']);
  return (function($base, $super){
    function Array() {};
    Array = $klass($base, $super, "Array", Array);

    var def = Array._proto, $scope = Array._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12, TMP_13, TMP_14, TMP_15, TMP_16, TMP_17, TMP_18, TMP_19, TMP_22;

    Array.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def._isArray = true;

    Array.constructor.prototype['$[]'] = function(objects) {
      objects = $slice.call(arguments, 0);
      return objects
    };

    def.$initialize = function(args) {
      var $a;args = $slice.call(arguments, 0);
      return ($a = this.$class()).$new.apply($a, [].concat(args));
    };

    Array.constructor.prototype['$new'] = TMP_1 = function(size, obj) {
      var $a, $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (obj == null) {
        obj = nil
      }
      

      if (arguments.length > 2)
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("wrong number of arguments. Array#new"));

      if (arguments.length == 0)
        return [];

      var size,
          obj = arguments[1],
          arr = [];

      if (!obj) {
        if (size['$respond_to?']("to_ary")) {
          if (size['$is_a?'](Array))
            return size;
          return size['$to_ary']();
        }
      }

      if (typeof(arguments[0]) == 'number')
        size = arguments[0];
      else {
        if ((arguments[0])['$respond_to?']("to_int")) {
          size = arguments[0]['$to_int']();
          if (typeof(size) == 'number') {
            if (size % 1 !== 0) {
              this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
            }
          } else {
            this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
          }
        } else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Integer. Array#new"));
        }
      }

      if (size < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("negative array size"));
      }

      if (obj == undefined) {
        obj = nil;
      }


      if (block === nil)
        for (var i = 0; i < size; i++) {
          arr.push(obj);
        }
      else {
        for (var i = 0, value; i < size; i++) {
          value = block(i);
          if (value === $breaker) {
            return $breaker.$v;
          }
          arr[i] = block(i);
        }
      }

      return arr;
    ;
    };

    Array.constructor.prototype['$try_convert'] = function(obj) {
      
      
      if (obj._isArray) {
        return obj;
      }

      return nil;
    
    };

    def['$&'] = function(other) {
      
      
      var result = [],
          seen   = {};

      for (var i = 0, length = this.length; i < length; i++) {
        var item = this[i];
        if (item._isString) {
          item = item.toString();
        }

        if (!seen[item]) {
          for (var j = 0, length2 = other.length; j < length2; j++) {
            var item2 = other[j];
            if (item2._isString) {
              item2 = item2.toString();
            }

            if (item === item2 && !seen[item]) {
              seen[item] = true;

              result.push(item);
            }
          }
        }
      }

      return result;
    
    };

    def['$*'] = function(other) {
      var $a;
      
      if (typeof(other) === 'string') {
        return this.join(other);
      }
      if (other < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a));
      }

      var result = [];

      for (var i = 0; i < other; i++) {
        result = result.concat(this);
      }

      return result;
    ;
    };

    def['$+'] = function(other) {
      var $a;
      
      var arr = other;

      if (!other._isArray){
        if (other['$respond_to?']("to_ary")) {
          arr = other['$to_ary']();
        }
        else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#+"));
        }
      }

      return this.concat(arr);
    
    };

    def['$-'] = function(other) {
      var $a;
      
      var a = this,
          b = other,
          tmp = [],
          result = [];

     if (typeof(b) == "object" && !(b._isArray))  {
        if (other['$respond_to?']("to_ary")) {
          b = b['$to_ary']();
        } else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#-"));
        }
      }else if ((typeof(b) != "object")) {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new("can't convert to Array. Array#-"));
      }

      if (a.length == 0)
        return [];
      if (b.length == 0)
        return a;

      for(var i = 0, length = b.length; i < length; i++) {
        tmp[b[i]] = true;
      }
      for(var i = 0, length = a.length; i < length; i++) {
        if (!tmp[a[i]]) {
          result.push(a[i]);
        }
     }

      return result;
    ;
    };

    def['$<<'] = function(object) {
      
      this.push(object);;
      return this;
    };

    def['$<=>'] = function(other) {
      
      
      if (this.$hash() === other.$hash()) {
        return 0;
      }

      if (this.length != other.length) {
        return (this.length > other.length) ? 1 : -1;
      }

      for (var i = 0, length = this.length, tmp; i < length; i++) {
        if ((tmp = (this[i])['$<=>'](other[i])) !== 0) {
          return tmp;
        }
      }

      return 0;
    ;
    };

    def['$=='] = function(other) {
      
      
      if (!other || (this.length !== other.length)) {
        return false;
      }

      for (var i = 0, length = this.length, tmp1, tmp2; i < length; i++) {
        tmp1 = this[i];
        tmp2 = other[i];

        if (tmp1._isArray && tmp2._isArray && (tmp1 === this)) {
          continue;
        }

        if (!((tmp1)['$=='](tmp2))) {
          return false;
        }

      }


      return true;
    ;
    };

    def['$[]'] = function(index, length) {
      
      
      var size = this.length;

      if (typeof index !== 'number' && !index._isNumber) {
        if (index._isRange) {
          var exclude = index.exclude;
          length      = index.end;
          index       = index.begin;

          if (index > size) {
            return nil;
          }

          if (length < 0) {
            length += size;
          }

          if (!exclude) length += 1;
          return this.slice(index, length);
        }
        else {
          this.$raise("bad arg for Array#[]");
        }
      }

      if (index < 0) {
        index += size;
      }

      if (length !== undefined) {
        if (length < 0 || index > size || index < 0) {
          return nil;
        }

        return this.slice(index, index + length);
      }
      else {
        if (index >= size || index < 0) {
          return nil;
        }

        return this[index];
      }
    ;
    };

    def['$[]='] = function(index, value, extra) {
      var $a;
      
      var size = this.length;

      if (typeof index !== 'number' && !index._isNumber) {
        if (index._isRange) {
          var exclude = index.exclude;
          extra = value;
          value = index.end;
          index = index.begin;

          if (value < 0) {
            value += size;
          }

          if (!exclude) value += 1;

          value = value - index;
        }
        else {
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a));
        }
      }

      if (index < 0) {
        index += size;
      }

      if (extra != null) {
        if (value < 0) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a));
        }

        if (index > size) {
          for (var i = size; index > i; i++) {
            this[i] = nil;
          }
        }

        this.splice.apply(this, [index, value].concat(extra));

        return extra;
      }

      if (index > size) {
        for (var i = size; i < index; i++) {
          this[i] = nil;
        }
      }

      return this[index] = value;
    ;
    };

    def.$assoc = function(object) {
      
      
      for (var i = 0, length = this.length, item; i < length; i++) {
        if (item = this[i], item.length && (item[0])['$=='](object)) {
          return item;
        }
      }

      return nil;
    ;
    };

    def.$at = function(index) {
      
      
      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this[index];
    ;
    };

    def.$clear = function() {
      
      this.splice(0, this.length);
      return this;
    };

    def.$clone = function() {
      
      return this.slice();
    };

    def.$collect = TMP_2 = function() {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      if (block === nil) {
        return this.$enum_for("collect")
      };
      
      var result = [];


      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        result.push(value);
      }

      return result;
    
    };

    def['$collect!'] = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      
      for (var i = 0, length = this.length, val; i < length; i++) {
        if ((val = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        this[i] = val;
      }
    ;
      return this;
    };

    def.$compact = function() {
      
      
      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        if ((item = this[i]) !== nil) {
          result.push(item);
        }
      }

      return result;
    
    };

    def['$compact!'] = function() {
      
      
      var original = this.length;

      for (var i = 0, length = this.length; i < length; i++) {
        if (this[i] === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;
    ;
    };

    def.$concat = function(other) {
      
      
      for (var i = 0, length = other.length; i < length; i++) {
        this.push(other[i]);
      }
    
      return this;
    };

    def.$delete = function(object) {
      
      
      var original = this.length;

      for (var i = 0, length = original; i < length; i++) {
        if ((this[i])['$=='](object)) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : object;
    ;
    };

    def.$delete_at = function(index) {
      
      
      if (index < 0) {
        index += this.length;
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      var result = this[index];

      this.splice(index, 1);

      return result;
    ;
    };

    def.$delete_if = TMP_4 = function() {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (block === nil) {
        return this.$enum_for("delete_if")
      };
      
      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }
    ;
      return this;
    };

    def.$drop = function(number) {
      var $a;
      
      if (number < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a))
      }

      return this.slice(number);
    ;
    };

    def.$dup = def.$clone;

    def.$each = TMP_5 = function() {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };
      
      if (block.length > 1) {
        for (var i = 0, length = this.length, el; i < length; i++) {
          el = this[i];
          if (!el._isArray) el = [el];

          if (block.apply(null, el) === $breaker) return $breaker.$v;
        }
      } else {
        for (var i = 0, length = this.length; i < length; i++) {
          if (block(this[i]) === $breaker) return $breaker.$v;
        }
      }
    ;
      return this;
    };

    def.$each_index = TMP_6 = function() {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      if (block === nil) {
        return this.$enum_for("each_index")
      };
      for (var i = 0, length = this.length; i < length; i++) {;
      if ($opal.$yield1(block, i) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def['$empty?'] = function() {
      
      return !this.length;
    };

    def.$fetch = TMP_7 = function(index, defaults) {
      var $a, $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      
      var original = index;

      if (index < 0) {
        index += this.length;
      }

      if (index >= 0 && index < this.length) {
        return this[index];
      }

      if (block !== nil) {
        return block(original);
      }

      if (defaults != null) {
        return defaults;
      }

      this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "Array#fetch");
    ;
    };

    def.$fill = TMP_8 = function(obj) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;
      
      if (block !== nil) {
        for (var i = 0, length = this.length; i < length; i++) {
          this[i] = block(i);
        }
      }
      else {
        for (var i = 0, length = this.length; i < length; i++) {
          this[i] = obj;
        }
      }
    ;
      return this;
    };

    def.$first = function(count) {
      var $a;
      
      if (count != null) {

        if (count < 0) {
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a));
        }

        return this.slice(0, count);
      }

      return this.length === 0 ? nil : this[0];
    ;
    };

    def.$flatten = function(level) {
      
      
      var result = [];

      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item._isArray) {
          if (level == null) {
            result = result.concat((item).$flatten());
          }
          else if (level === 0) {
            result.push(item);
          }
          else {
            result = result.concat((item).$flatten(level - 1));
          }
        }
        else {
          result.push(item);
        }
      }

      return result;
    
    };

    def['$flatten!'] = function(level) {
      
      
      var size = this.length;
      this.$replace(this.$flatten(level));

      return size === this.length ? nil : this;
    ;
    };

    def.$hash = function() {
      
      return this._id || (this._id = Opal.uid());
    };

    def['$include?'] = function(member) {
      
      
      for (var i = 0, length = this.length; i < length; i++) {
        if ((this[i])['$=='](member)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$index = TMP_9 = function(object) {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;
      
      if (object != null) {
        for (var i = 0, length = this.length; i < length; i++) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = 0, length = this.length, value; i < length; i++) {
          if ((value = block(this[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else {
        return this.$enum_for("index");
      }

      return nil;
    ;
    };

    def.$insert = function(index, objects) {
      var $a;objects = $slice.call(arguments, 1);
      
      if (objects.length > 0) {
        if (index < 0) {
          index += this.length + 1;

          if (index < 0) {
            this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "" + (index) + " is out of bounds");
          }
        }
        if (index > this.length) {
          for (var i = this.length; i < index; i++) {
            this.push(nil);
          }
        }

        this.splice.apply(this, [index, 0].concat(objects));
      }
    ;
      return this;
    };

    def.$inspect = function() {
      
      
      var i, inspect, el, el_insp, length, object_id;

      inspect = [];
      object_id = this.$object_id();
      length = this.length;

      for (i = 0; i < length; i++) {
        el = this['$[]'](i);

        // Check object_id to ensure it's not the same array get into an infinite loop
        el_insp = (el).$object_id() === object_id ? '[...]' : (el).$inspect();

        inspect.push(el_insp);
      }
      return '[' + inspect.join(', ') + ']';
    ;
    };

    def.$join = function(sep) {
      if (sep == null) {
        sep = ""
      }
      
      var result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        result.push((this[i]).$to_s());
      }

      return result.join(sep);
    
    };

    def.$keep_if = TMP_10 = function() {
      var $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;
      if (block === nil) {
        return this.$enum_for("keep_if")
      };
      
      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          this.splice(i, 1);

          length--;
          i--;
        }
      }
    ;
      return this;
    };

    def.$last = function(count) {
      var $a;
      
      var length = this.length;

      if (count === nil || typeof(count) == 'string') {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "no implicit conversion to integer");
      }

      if (typeof(count) == 'object') {
        if (count['$respond_to?']("to_int")) {
          count = count['$to_int']();
        }
        else {
          this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "no implicit conversion to integer");
        }
      }

      if (count == null) {
        return length === 0 ? nil : this[length - 1];
      }
      else if (count < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "negative count given");
      }

      if (count > length) {
        count = length;
      }

      return this.slice(length - count, length);
    ;
    };

    def.$length = function() {
      
      return this.length;
    };

    def.$map = def.$collect;

    def['$map!'] = def['$collect!'];

    def.$pop = function(count) {
      var $a;
      
      var length = this.length;

      if (count == null) {
        return length === 0 ? nil : this.pop();
      }

      if (count < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "negative count given");
      }

      return count > length ? this.splice(0, this.length) : this.splice(length - count, length);
    ;
    };

    def.$push = function(objects) {
      objects = $slice.call(arguments, 0);
      
      for (var i = 0, length = objects.length; i < length; i++) {
        this.push(objects[i]);
      }
    
      return this;
    };

    def.$rassoc = function(object) {
      
      
      for (var i = 0, length = this.length, item; i < length; i++) {
        item = this[i];

        if (item.length && item[1] !== undefined) {
          if ((item[1])['$=='](object)) {
            return item;
          }
        }
      }

      return nil;
    ;
    };

    def.$reject = TMP_11 = function() {
      var $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;
      if (block === nil) {
        return this.$enum_for("reject")
      };
      
      var result = [];

      for (var i = 0, length = this.length, value; i < length; i++) {
        if ((value = block(this[i])) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          result.push(this[i]);
        }
      }
      return result;
    
    };

    def['$reject!'] = TMP_12 = function() {
      var $a, $b, $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;
      if (block === nil) {
        return this.$enum_for("reject!")
      };
      
      var original = this.length;
      ($a = ($b = this).$delete_if, $a._p = block.$to_proc(), $a).call($b);
      return this.length === original ? nil : this;
    ;
    };

    def.$replace = function(other) {
      
      
      this.splice(0, this.length);
      this.push.apply(this, other);
      return this;
    ;
    };

    def.$reverse = function() {
      
      return this.slice(0).reverse();
    };

    def['$reverse!'] = function() {
      
      return this.reverse();
    };

    def.$reverse_each = TMP_13 = function() {
      var $a, $b, $iter = TMP_13._p, block = $iter || nil;TMP_13._p = null;
      if (block === nil) {
        return this.$enum_for("reverse_each")
      };
      ($a = ($b = this.$reverse()).$each, $a._p = block.$to_proc(), $a).call($b);
      return this;
    };

    def.$rindex = TMP_14 = function(object) {
      var $iter = TMP_14._p, block = $iter || nil;TMP_14._p = null;
      
      if (object != null) {
        for (var i = this.length - 1; i >= 0; i--) {
          if ((this[i])['$=='](object)) {
            return i;
          }
        }
      }
      else if (block !== nil) {
        for (var i = this.length - 1, value; i >= 0; i--) {
          if ((value = block(this[i])) === $breaker) {
            return $breaker.$v;
          }

          if (value !== false && value !== nil) {
            return i;
          }
        }
      }
      else if (object == null) {
        return this.$enum_for("rindex");
      }

      return nil;
    ;
    };

    def.$select = TMP_15 = function() {
      var $iter = TMP_15._p, block = $iter || nil;TMP_15._p = null;
      if (block === nil) {
        return this.$enum_for("select")
      };
      
      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          result.push(item);
        }
      }

      return result;
    
    };

    def['$select!'] = TMP_16 = function() {
      var $a, $b, $iter = TMP_16._p, block = $iter || nil;TMP_16._p = null;
      if (block === nil) {
        return this.$enum_for("select!")
      };
      
      var original = this.length;
      ($a = ($b = this).$keep_if, $a._p = block.$to_proc(), $a).call($b);
      return this.length === original ? nil : this;
    ;
    };

    def.$shift = function(count) {
      
      
      if (this.length === 0) {
        return nil;
      }

      return count == null ? this.shift() : this.splice(0, count)
    ;
    };

    def.$size = def.$length;

    def.$shuffle = function() {
      
      
        for (var i = this.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = this[i];
          this[i] = this[j];
          this[j] = tmp;
        }

        return this;
    ;
    };

    def.$slice = def['$[]'];

    def['$slice!'] = function(index, length) {
      
      
      if (index < 0) {
        index += this.length;
      }

      if (length != null) {
        return this.splice(index, length);
      }

      if (index < 0 || index >= this.length) {
        return nil;
      }

      return this.splice(index, 1)[0];
    ;
    };

    def.$sort = TMP_17 = function() {
      var $a, $iter = TMP_17._p, block = $iter || nil;TMP_17._p = null;
      
      var copy = this.slice();
      var t_arg_error = false;
      var t_break = [];

      if (block !== nil) {
        var result = copy.sort(function(x, y) {
          var result = block(x, y);
          if (result === $breaker) {
            t_break.push($breaker.$v);
          }
          if (result === nil) {
            t_arg_error = true;
          }
          if ((result != null) && (result)['$respond_to?']("<=>")) {
            result = result['$<=>'](0);
          }
          if (result !== -1 && result !== 0 && result !== 1) {
            t_arg_error = true;
          }
          return result;
        });

        if (t_break.length > 0)
          return t_break[0];
        if (t_arg_error)
          this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#sort");

        return result;
      }

      var result = copy.sort(function(a, b){
        if (typeof(a) !== typeof(b)) {
          t_arg_error = true;
        }

        if (a['$<=>'] && typeof(a['$<=>']) == "function") {
          var result = a['$<=>'](b);
          if (result === nil) {
            t_arg_error = true;
          }
          return result;
        }
        if (a > b)
          return 1;
        if (a < b)
          return -1;
        return 0;
      });

      if (t_arg_error)
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "Array#sort");

      return result;
    ;
    };

    def['$sort!'] = TMP_18 = function() {
      var $iter = TMP_18._p, block = $iter || nil;TMP_18._p = null;
      
      var result;
      if (block !== nil) {
        //strangely
        result = this.slice().sort(block);
      } else {
        result = this.slice()['$sort']();
      }
      this.length = 0;
      for(var i = 0; i < result.length; i++) {
        this.push(result[i]);
      }
      return this;
    
    };

    def.$take = function(count) {
      var $a;
      
      if (count < 0) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a));
      }

      return this.slice(0, count);
    ;
    };

    def.$take_while = TMP_19 = function() {
      var $iter = TMP_19._p, block = $iter || nil;TMP_19._p = null;
      
      var result = [];

      for (var i = 0, length = this.length, item, value; i < length; i++) {
        item = this[i];

        if ((value = block(item)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          return result;
        }

        result.push(item);
      }

      return result;
    
    };

    def.$to_a = function() {
      
      return this;
    };

    def.$to_ary = def.$to_a;

    def.$to_n = function() {
      
      
      var result = [], obj

      for (var i = 0, len = this.length; i < len; i++) {
        obj = this[i];

        if (obj.$to_n) {
          result.push((obj).$to_n());
        }
        else {
          result.push(obj);
        }
      }

      return result;
    ;
    };

    def.$to_s = def.$inspect;

    def.$transpose = function() {
      var $a, TMP_20, $b, result = nil, max = nil;
      if (($a = this['$empty?']()) !== false && $a !== nil) {
        return []
      };
      result = [];
      max = nil;
      ($a = ($b = this).$each, $a._p = (TMP_20 = function(row) {

        var self = TMP_20._s || this, $a, $b, TMP_21;
        if (row == null) row = nil;
        
        row = row.$to_ary();
        ((($a = max) !== false && $a !== nil) ? $a : max = row.$size());
        if (($a = ($b = row.$length()['$=='](max), ($b === nil || $b === false))) !== false && $a !== nil) {
          self.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "element size differs (" + (row.$length()) + " should be " + (max))
        };
        return ($a = ($b = row.$length()).$times, $a._p = (TMP_21 = function(i) {

          var self = TMP_21._s || this, $a, $b, $c, entry = nil;
          if (i == null) i = nil;
          
          entry = ($a = i, $b = result, ((($c = $b['$[]']($a)) !== false && $c !== nil) ? $c : $b['$[]=']($a, [])));
          return entry['$<<'](row.$at(i));
        }, TMP_21._s = self, TMP_21), $a).call($b);
      }, TMP_20._s = this, TMP_20), $a).call($b);
      return result;
    };

    def.$uniq = function() {
      
      
      var result = [],
          seen   = {};
   
      for (var i = 0, length = this.length, item, hash; i < length; i++) {
        item = this[i];
        hash = item;
   
        if (!seen[hash]) {
          seen[hash] = true;
   
          result.push(item);
        }
      }
   
      return result;
    
    };

    def['$uniq!'] = function() {
      
      
      var original = this.length,
          seen     = {};

      for (var i = 0, length = original, item, hash; i < length; i++) {
        item = this[i];
        hash = item;

        if (!seen[hash]) {
          seen[hash] = true;
        }
        else {
          this.splice(i, 1);

          length--;
          i--;
        }
      }

      return this.length === original ? nil : this;
    ;
    };

    def.$unshift = function(objects) {
      objects = $slice.call(arguments, 0);
      
      for (var i = objects.length - 1; i >= 0; i--) {
        this.unshift(objects[i]);
      }

      return this;
    
    };

    def.$zip = TMP_22 = function(others) {
      var $iter = TMP_22._p, block = $iter || nil;TMP_22._p = null;others = $slice.call(arguments, 0);
      
      var result = [], size = this.length, part, o;

      for (var i = 0; i < size; i++) {
        part = [this[i]];

        for (var j = 0, jj = others.length; j < jj; j++) {
          o = others[j][i];

          if (o == null) {
            o = nil;
          }

          part[j + 1] = o;
        }

        result[i] = part;
      }

      if (block !== nil) {
        for (var i = 0; i < size; i++) {
          block(result[i]);
        }

        return nil;
      }

      return result;
    ;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/array.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$==', '$call', '$enum_for', '$raise', '$flatten', '$inspect', '$to_n']);
  return (function($base, $super){
    function Hash() {};
    Hash = $klass($base, $super, "Hash", Hash);

    var def = Hash._proto, $scope = Hash._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6, TMP_7, TMP_8, TMP_9, TMP_10, TMP_11, TMP_12;
    def.proc = def.none = nil;

    Hash.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    
    var $hash = Opal.hash = function() {
      if (arguments.length == 1 && arguments[0]._klass == Hash) {
        return arguments[0];
      }

      var hash   = new Hash._alloc,
          args   = $slice.call(arguments),
          keys   = [],
          assocs = {};

      hash.map   = assocs;
      hash.keys  = keys;

      for (var i = 0, length = args.length, key; i < length; i++) {
        var key = args[i], obj = args[++i];

        if (assocs[key] == null) {
          keys.push(key);
        }

        assocs[key] = obj;
      }

      return hash;
    };
  

    
    var $hash2 = Opal.hash2 = function(keys, map) {
      var hash = new Hash._alloc;
      hash.keys = keys;
      hash.map = map;
      return hash;
    };
  

    var $hasOwn = {}.hasOwnProperty;

    Hash.constructor.prototype['$[]'] = function(objs) {
      objs = $slice.call(arguments, 0);
      return $hash.apply(null, objs);
    };

    Hash.constructor.prototype['$allocate'] = function() {
      
      
      var hash = new this._alloc;
      hash.map = {};
      hash.keys = [];
      return hash;
    ;
    };

    def.$initialize = TMP_1 = function(defaults) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      
      if (defaults != null) {
        if (defaults.constructor == Object) {
          var map = this.map, keys = this.keys;

          for (var key in defaults) {
            keys.push(key);
            map[key] = defaults[key];
          }
        }
        else {
          this.none = defaults;
        }
      }
      else if (block !== nil) {
          this.proc = block;
      }

      return this;
    ;
    };

    def['$=='] = function(other) {
      var $a;
      
      if (this === other) {
        return true;
      }

      if (!other.map || !other.keys) {
        return false;
      }

      if (this.keys.length !== other.keys.length) {
        return false;
      }

      var map  = this.map,
          map2 = other.map;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        var key = this.keys[i], obj = map[key], obj2 = map2[key];

        if (($a = (obj)['$=='](obj2), ($a === nil || $a === false))) {
          return false;
        }
      }

      return true;
    ;
    };

    def['$[]'] = function(key) {
      
      
      var bucket = this.map[key];

      if (bucket != null) {
        return bucket;
      }

      var proc = this.proc;

      if (proc !== nil) {
        return (proc).$call(this, key);
      }

      return this.none;
    ;
    };

    def['$[]='] = function(key, value) {
      
      
      var map = this.map;

      if (!$hasOwn.call(map, key)) {
        this.keys.push(key);
      }

      map[key] = value;

      return value;
    ;
    };

    def.$assoc = function(object) {
      
      
      var keys = this.keys, key;

      for (var i = 0, length = keys.length; i < length; i++) {
        key = keys[i];

        if ((key)['$=='](object)) {
          return [key, this.map[key]];
        }
      }

      return nil;
    ;
    };

    def.$clear = function() {
      
      
      this.map = {};
      this.keys = [];
      return this;
    ;
    };

    def.$clone = function() {
      
      
      var result = $hash(),
          map    = this.map,
          map2   = result.map,
          keys2  = result.keys;

      for (var i = 0, length = this.keys.length; i < length; i++) {
        keys2.push(this.keys[i]);
        map2[this.keys[i]] = map[this.keys[i]];
      }

      return result;
    ;
    };

    def.$default = function(val) {
      
      return this.none;
    };

    def['$default='] = function(object) {
      
      return this.none = object;
    };

    def.$default_proc = function() {
      
      return this.proc;
    };

    def['$default_proc='] = function(proc) {
      
      return this.proc = proc;
    };

    def.$delete = function(key) {
      
      
      var map  = this.map, result = map[key];

      if (result != null) {
        delete map[key];
        this.keys.$delete(key);

        return result;
      }

      return nil;
    ;
    };

    def.$delete_if = TMP_2 = function() {
      var $a, $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("delete_if")
      };
      
      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;
    ;
    };

    def.$dup = def.$clone;

    def.$each = TMP_3 = function() {
      var $a, $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each")
      };
      
      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if ($opal.$yield1(block, [key, map[key]]) === $breaker) return $breaker.$v;
      }

      return this;
    ;
    };

    def.$each_key = TMP_4 = function() {
      var $a, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each_key")
      };
      
      var keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (block(key) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def.$each_pair = def.$each;

    def.$each_value = TMP_5 = function() {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("each_value")
      };
      
      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        if (block(map[keys[i]]) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$empty?'] = function() {
      
      return this.keys.length === 0;
    };

    def['$eql?'] = def['$=='];

    def.$fetch = TMP_6 = function(key, defaults) {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      
      var value = this.map[key];

      if (value != null) {
        return value;
      }

      if (block !== nil) {
        var value;

        if ((value = block(key)) === $breaker) {
          return $breaker.$v;
        }

        return value;
      }

      if (defaults != null) {
        return defaults;
      }

      this.$raise((($a = $scope.KeyError) == null ? $opal.cm("KeyError") : $a), "key not found");
    ;
    };

    def.$flatten = function(level) {
      
      
      var map = this.map, keys = this.keys, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], value = map[key];

        result.push(key);

        if (value._isArray) {
          if (level == null || level === 1) {
            result.push(value);
          }
          else {
            result = result.concat((value).$flatten(level - 1));
          }
        }
        else {
          result.push(value);
        }
      }

      return result;
    ;
    };

    def['$has_key?'] = function(key) {
      
      return $hasOwn.call(this.map, key);
    };

    def['$has_value?'] = function(value) {
      
      
      for (var assoc in this.map) {
        if ((this.map[assoc])['$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$hash = function() {
      
      return this._id;
    };

    def['$include?'] = def['$has_key?'];

    def.$index = function(object) {
      
      
      var map = this.map, keys = this.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        if (object['$=='](map[key])) {
          return key;
        }
      }

      return nil;
    ;
    };

    def.$indexes = function(keys) {
      keys = $slice.call(arguments, 0);
      
      var result = [], map = this.map, val;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val != null) {
          result.push(val);
        }
        else {
          result.push(this.none);
        }
      }

      return result;
    ;
    };

    def.$indices = def.$indexes;

    def.$inspect = function() {
      
      
      var inspect = [], keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], val = map[key];

        if (val === this) {
          inspect.push((key).$inspect() + '=>' + '{...}');
        } else {
          inspect.push((key).$inspect() + '=>' + (map[key]).$inspect());
        }
      }

      return '{' + inspect.join(', ') + '}';
    ;
    };

    def.$invert = function() {
      
      
      var result = $hash(), keys = this.keys, map = this.map,
          keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        keys2.push(obj);
        map2[obj] = key;
      }

      return result;
    ;
    };

    def.$keep_if = TMP_7 = function() {
      var $a, $iter = TMP_7._p, block = $iter || nil;TMP_7._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("keep_if")
      };
      
      var map = this.map, keys = this.keys, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
        }
      }

      return this;
    ;
    };

    def.$key = def.$index;

    def['$key?'] = def['$has_key?'];

    def.$keys = function() {
      
      
      return this.keys.slice(0);
    ;
    };

    def.$length = function() {
      
      
      return this.keys.length;
    ;
    };

    def['$member?'] = def['$has_key?'];

    def.$merge = TMP_8 = function(other) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;
      
      var keys = this.keys, map = this.map,
          result = $hash(), keys2 = result.keys, map2 = result.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];

        keys2.push(key);
        map2[key] = map[key];
      }

      var keys = other.keys, map = other.map;

      if (block === nil) {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
          }

          map2[key] = map[key];
        }
      }
      else {
        for (var i = 0, length = keys.length; i < length; i++) {
          var key = keys[i];

          if (map2[key] == null) {
            keys2.push(key);
            map2[key] = map[key];
          }
          else {
            map2[key] = block(key, map2[key], map[key]);
          }
        }
      }

      return result;
    ;
    };

    def['$merge!'] = TMP_9 = function(other) {
      var $iter = TMP_9._p, block = $iter || nil;TMP_9._p = null;
      
      var keys = this.keys, map = this.map,
          keys2 = other.keys, map2 = other.map;

      if (block === nil) {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
          }

          map[key] = map2[key];
        }
      }
      else {
        for (var i = 0, length = keys2.length; i < length; i++) {
          var key = keys2[i];

          if (map[key] == null) {
            keys.push(key);
            map[key] = map2[key];
          }
          else {
            map[key] = block(key, map[key], map2[key]);
          }
        }
      }

      return this;
    ;
    };

    def.$rassoc = function(object) {
      
      
      var keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((obj)['$=='](object)) {
          return [key, obj];
        }
      }

      return nil;
    ;
    };

    def.$reject = TMP_10 = function() {
      var $a, $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("reject")
      };
      
      var keys = this.keys, map = this.map,
          result = $hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    ;
    };

    def.$replace = function(other) {
      
      
      var map = this.map = {}, keys = this.keys = [];

      for (var i = 0, length = other.keys.length; i < length; i++) {
        var key = other.keys[i];
        keys.push(key);
        map[key] = other.map[key];
      }

      return this;
    ;
    };

    def.$select = TMP_11 = function() {
      var $a, $iter = TMP_11._p, block = $iter || nil;TMP_11._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("select")
      };
      
      var keys = this.keys, map = this.map,
          result = $hash(), map2 = result.map, keys2 = result.keys;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key], value;

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value !== false && value !== nil) {
          keys2.push(key);
          map2[key] = obj;
        }
      }

      return result;
    ;
    };

    def['$select!'] = TMP_12 = function() {
      var $a, $iter = TMP_12._p, block = $iter || nil;TMP_12._p = null;
      if (($a = block) === false || $a === nil) {
        return this.$enum_for("select!")
      };
      
      var map = this.map, keys = this.keys, value, result = nil;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if ((value = block(key, obj)) === $breaker) {
          return $breaker.$v;
        }

        if (value === false || value === nil) {
          keys.splice(i, 1);
          delete map[key];

          length--;
          i--;
          result = this
        }
      }

      return result;
    ;
    };

    def.$shift = function() {
      
      
      var keys = this.keys, map = this.map;

      if (keys.length) {
        var key = keys[0], obj = map[key];

        delete map[key];
        keys.splice(0, 1);

        return [key, obj];
      }

      return nil;
    ;
    };

    def.$size = def.$length;

    def.$to_a = function() {
      
      
      var keys = this.keys, map = this.map, result = [];

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        result.push([key, map[key]]);
      }

      return result;
    ;
    };

    def.$to_hash = function() {
      
      return this;
    };

    def.$to_n = function() {
      
      
      var result = {}, keys = this.keys, map = this.map, bucket, value;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i], obj = map[key];

        if (obj.$to_n) {
          result[key] = (obj).$to_n();
        }
        else {
          result[key] = obj;
        }
      }

      return result;
    ;
    };

    def.$to_s = def.$inspect;

    def.$update = def['$merge!'];

    def['$value?'] = function(value) {
      
      
      var map = this.map;

      for (var assoc in map) {
        var v = map[assoc];
        if ((v)['$=='](value)) {
          return true;
        }
      }

      return false;
    ;
    };

    def.$values_at = def.$indexes;

    def.$values = function() {
      
      
      var map    = this.map,
          result = [];

      for (var key in map) {
        result.push(map[key]);
      }

      return result;
    ;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/hash.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars;

  $opal.add_stubs(['$include', '$to_str', '$is_a?', '$format', '$raise', '$=~', '$ljust', '$floor', '$/', '$+', '$size', '$rjust', '$ceil', '$each', '$split', '$chomp', '$block_given?', '$escape', '$to_i', '$match', '$to_proc', '$new', '$[]', '$str', '$to_s', '$value', '$try_convert', '$class', '$attr_reader']);
  (function($base, $super){
    function String() {};
    String = $klass($base, $super, "String", String);

    var def = String._proto, $scope = String._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6;

    String.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    def._isString = true;

    var native_string = "".constructor;

    String.constructor.prototype['$try_convert'] = function(what) {
      
      try {
        return what.$to_str()
      } catch ($err) {
      if (true){
        return nil}else { throw $err; }
      }
    };

    String.constructor.prototype['$new'] = function(str) {
      if (str == null) {
        str = ""
      }
      
      return new native_string(str)
    ;
    };

    def['$%'] = function(data) {
      var $a, $b;
      if (($a = data['$is_a?']((($b = $scope.Array) == null ? $opal.cm("Array") : $b))) !== false && $a !== nil) {
        return ($a = this).$format.apply($a, [this].concat(data))
      } else {
        return this.$format(this, data)
      };
    };

    def['$*'] = function(count) {
      
      
      if (count < 1) {
        return '';
      }

      var result  = '',
          pattern = this.valueOf();

      while (count > 0) {
        if (count & 1) {
          result += pattern;
        }

        count >>= 1, pattern += pattern;
      }

      return result;
    
    };

    def['$+'] = function(other) {
      
      return this.toString() + other;
    };

    def['$<=>'] = function(other) {
      
      
      if (typeof other !== 'string') {
        return nil;
      }

      return this > other ? 1 : (this < other ? -1 : 0);
    ;
    };

    def['$<'] = function(other) {
      
      return this < other;
    };

    def['$<='] = function(other) {
      
      return this <= other;
    };

    def['$>'] = function(other) {
      
      return this > other;
    };

    def['$>='] = function(other) {
      
      return this >= other;
    };

    def['$=='] = function(other) {
      
      return other == native_string(this);
    };

    def['$==='] = def['$=='];

    def['$=~'] = function(other) {
      
      
      if (typeof other === 'string') {
        this.$raise("string given");
      }

      return other['$=~'](this);
    ;
    };

    def['$[]'] = function(index, length) {
      
      
      var size = this.length;

      if (index._isRange) {
        var exclude = index.exclude,
            length  = index.end,
            index   = index.begin;

        if (index < 0) {
          index += size;
        }

        if (length < 0) {
          length += size;
        }

        if (!exclude) {
          length += 1;
        }

        if (index > size) {
          return nil;
        }

        length = length - index;

        if (length < 0) {
          length = 0;
        }

        return this.substr(index, length);
      }

      if (index < 0) {
        index += this.length;
      }

      if (length == null) {
        if (index >= this.length || index < 0) {
          return nil;
        }

        return this.substr(index, 1);
      }

      if (index > this.length || index < 0) {
        return nil;
      }

      return this.substr(index, length);
    ;
    };

    def.$capitalize = function() {
      
      return this.charAt(0).toUpperCase() + this.substr(1).toLowerCase();
    };

    def.$casecmp = function(other) {
      
      
      if (typeof other !== 'string') {
        return other;
      }

      var a = this.toLowerCase(),
          b = other.toLowerCase();

      return a > b ? 1 : (a < b ? -1 : 0);
    
    };

    def.$center = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }
      
      if (width <= this.length) {
        return this;
      }
      else {
        var ljustified = this.$ljust(width['$+'](this.$size())['$/'](2).$floor(), padstr);
        var rjustified = this.$rjust(width['$+'](this.$size())['$/'](2).$ceil(), padstr);
        return ljustified + rjustified.slice(this.length);
      }
    ;
    };

    def.$chars = TMP_1 = function() {
      var $iter = TMP_1._p, $yield = $iter || nil;TMP_1._p = null;
      
      for (var i = 0, length = this.length; i < length; i++) {
        if ($opal.$yield1($yield, this.charAt(i)) === $breaker) return $breaker.$v
      }
    ;
    };

    def.$chomp = function(separator) {
      if (separator == null) {
        separator = $gvars["/"]
      }
      
      var strlen = this.length;
      var seplen = separator.length;
      if (strlen > 0) {
        if (separator === "\n") {
          var last = this.charAt(strlen - 1);
          if (last === "\n" || last == "\r") {
            var result = this.substr(0, strlen - 1);
            if (strlen > 1 && this.charAt(strlen - 2) === "\r") {
              result = this.substr(0, strlen - 2);
            }
            return result;
          }
        }
        else if (separator === "") {
          return this.replace(/(?:\n|\r\n)+$/, '');
        }
        else if (strlen >= seplen) {
          var tail = this.substr(-1 * seplen);
          if (tail === separator) {
            return this.substr(0, strlen - seplen);
          }
        }
      }
      return this
    ;
    };

    def.$chop = function() {
      
      return this.substr(0, this.length - 1);
    };

    def.$chr = function() {
      
      return this.charAt(0);
    };

    def.$clone = function() {
      
      return this.slice();
    };

    def.$count = function(str) {
      
      return (this.length - this.replace(new RegExp(str,"g"), '').length) / str.length;
    };

    def.$dup = def.$clone;

    def.$downcase = function() {
      
      return this.toLowerCase();
    };

    def.$each_char = def.$chars;

    def.$each_line = TMP_2 = function(separator) {
      var $iter = TMP_2._p, $yield = $iter || nil;TMP_2._p = null;if (separator == null) {
        separator = $gvars["/"]
      }
      if ($yield === nil) {
        return this.$split(separator).$each()
      };
      
      var chomped = this.$chomp();
      var trailing_separator = this.length != chomped.length
      var splitted = chomped.split(separator);

      if (!($yield !== nil)) {
        result = []
        for (var i = 0, length = splitted.length; i < length; i++) {
          if (i < length - 1 || trailing_separator) {
            result.push(splitted[i] + separator);
          }
          else {
            result.push(splitted[i]);
          }
        }

        return (result).$each();
      }

      for (var i = 0, length = splitted.length; i < length; i++) {
        if (i < length - 1 || trailing_separator) {
          if ($opal.$yield1($yield, splitted[i] + separator) === $breaker) return $breaker.$v
        }
        else {
          if ($opal.$yield1($yield, splitted[i]) === $breaker) return $breaker.$v
        }
      }
    ;
    };

    def['$empty?'] = function() {
      
      return this.length === 0;
    };

    def['$end_with?'] = function(suffixes) {
      suffixes = $slice.call(arguments, 0);
      
      for (var i = 0, length = suffixes.length; i < length; i++) {
        var suffix = suffixes[i];

        if (this.length >= suffix.length && this.substr(0 - suffix.length) === suffix) {
          return true;
        }
      }

      return false;
    ;
    };

    def['$eql?'] = def['$=='];

    def['$equal?'] = function(val) {
      
      return this.toString() === val.toString();
    };

    def.$getbyte = function(idx) {
      
      return this.charCodeAt(idx);
    };

    def.$gsub = TMP_3 = function(pattern, replace) {
      var $a, $b, $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      if (($a = pattern['$is_a?']((($b = $scope.String) == null ? $opal.cm("String") : $b))) !== false && $a !== nil) {
        pattern = (new RegExp("" + (($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a).$escape(pattern)))
      };
      
      var pattern = pattern.toString(),
          options = pattern.substr(pattern.lastIndexOf('/') + 1) + 'g',
          regexp  = pattern.substr(1, pattern.lastIndexOf('/') - 1);

      this.$sub._p = block;
      return this.$sub(new RegExp(regexp, options), replace);
    
    };

    def.$hash = function() {
      
      return this.toString();
    };

    def.$hex = function() {
      
      return this.$to_i(16);
    };

    def['$include?'] = function(other) {
      
      return this.indexOf(other) !== -1;
    };

    def.$index = function(what, offset) {
      var $a;if (offset == null) {
        offset = nil
      }
      
      if ( !(what != null && (what._isString || what._isRegexp)) ) {
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "type mismatch");
      }

      var result = -1;

      if (offset != null) {
        if (offset < 0) {
          offset = offset + this.length;
        }

        if (offset > this.length) {
          return nil;
        }

        if (what['$is_a?']((($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a))) {
          result = ((($a = what['$=~'](this.substr(offset))) !== false && $a !== nil) ? $a : -1)
        } else {
          result = this.substr(offset).indexOf(what);
        }

        if (result !== -1) {
          result += offset;
        }
      } else {
        if (what['$is_a?']((($a = $scope.Regexp) == null ? $opal.cm("Regexp") : $a))) {
          result = ((($a = what['$=~'](this)) !== false && $a !== nil) ? $a : -1)
        } else {
          result = this.indexOf(what);
        }
      }

      return result === -1 ? nil : result;
    ;
    };

    def.$inspect = function() {
      
      
      var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
          meta      = {
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
          };

      escapable.lastIndex = 0;

      return escapable.test(this) ? '"' + this.replace(escapable, function(a) {
        var c = meta[a];

        return typeof c === 'string' ? c :
          '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
      }) + '"' : '"' + this + '"';
  ;
    };

    def.$intern = function() {
      
      return this;
    };

    def.$lines = def.$each_line;

    def.$length = function() {
      
      return this.length;
    };

    def.$ljust = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }
      
      var length = this.length;

      if (width <= length) {
        return this;
      }
      else {
        var index = -1, result = "";

        while (++index < (width - length)) {
          result += padstr;
        }

        return this + result.slice(0, width - length);
      }
    ;
    };

    def.$lstrip = function() {
      
      return this.replace(/^\s*/, '');
    };

    def.$match = TMP_4 = function(pattern, pos) {
      var $a, $b, $c, $d, $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      return ($a = ($b = (function() { if (($c = pattern['$is_a?']((($d = $scope.Regexp) == null ? $opal.cm("Regexp") : $d))) !== false && $c !== nil) {
        return pattern
      } else {
        return (new RegExp("" + (($c = $scope.Regexp) == null ? $opal.cm("Regexp") : $c).$escape(pattern)))
      }; return nil; }).call(this)).$match, $a._p = block.$to_proc(), $a).call($b, this, pos);
    };

    def.$next = function() {
      
      
      if (this.length === 0) {
        return "";
      }

      var initial = this.substr(0, this.length - 1);
      var last    = native_string.fromCharCode(this.charCodeAt(this.length - 1) + 1);

      return initial + last;
    ;
    };

    def.$ord = function() {
      
      return this.charCodeAt(0);
    };

    def.$partition = function(str) {
      
      
      var result = this.split(str);
      var splitter = (result[0].length === this.length ? "" : str);

      return [result[0], splitter, result.slice(1).join(str.toString())];
    ;
    };

    def.$reverse = function() {
      
      return this.split('').reverse().join('');
    };

    def.$rindex = function(search, offset) {
      var $a;
      
      var search_type = (search == null ? Opal.NilClass : search.constructor);
      if (search_type != native_string && search_type != RegExp) {
        var msg = "type mismatch: " + search_type + " given";
        this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a).$new(msg));
      }

      if (this.length == 0) {
        return search.length == 0 ? 0 : nil;
      }

      var result = -1;
      if (offset != null) {
        if (offset < 0) {
          offset = this.length + offset;
        }

        if (search_type == native_string) {
          result = this.lastIndexOf(search, offset);
        }
        else {
          result = this.substr(0, offset + 1).$reverse().search(search);
          if (result !== -1) {
            result = offset - result;
          }
        }
      }
      else {
        if (search_type == native_string) {
          result = this.lastIndexOf(search);
        }
        else {
          result = this.$reverse().search(search);
          if (result !== -1) {
            result = this.length - 1 - result;
          }
        }
      }

      return result === -1 ? nil : result;
    
    };

    def.$rjust = function(width, padstr) {
      if (padstr == null) {
        padstr = " "
      }
      
      if (width <= this.length) {
          return this;
      }
      else {
        var n_chars = Math.floor(width - this.length)
        var n_patterns = Math.floor(n_chars/padstr.length);
        var result = Array(n_patterns + 1).join(padstr);
        var remaining = n_chars - result.length;
        return result + padstr.slice(0, remaining) + this;
      }
    ;
    };

    def.$rstrip = function() {
      
      return this.replace(/\s*$/, '');
    };

    def.$scan = TMP_5 = function(pattern) {
      var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      
      if (pattern.global) {
        // should we clear it afterwards too?
        pattern.lastIndex = 0;
      }
      else {
        // rewrite regular expression to add the global flag to capture pre/post match
        pattern = new RegExp(pattern.source, 'g' + (pattern.multiline ? 'm' : '') + (pattern.ignoreCase ? 'i' : ''));
      }

      var result = [];
      var match;

      while ((match = pattern.exec(this)) != null) {
        var match_data = (($a = $scope.MatchData) == null ? $opal.cm("MatchData") : $a).$new(pattern, match);
        if (block === nil) {
          match.length == 1 ? result.push(match[0]) : result.push(match.slice(1));
        }
        else {
          match.length == 1 ? block(match[0]) : block.apply(this, match.slice(1));
        }
      }

      return (block !== nil ? this : result);
    ;
    };

    def.$size = def.$length;

    def.$slice = def['$[]'];

    def.$split = function(pattern, limit) {
      var $a;if (pattern == null) {
        pattern = ((($a = $gvars[";"]) !== false && $a !== nil) ? $a : " ")
      }
      return this.split(pattern, limit);
    };

    def['$start_with?'] = function(prefixes) {
      prefixes = $slice.call(arguments, 0);
      
      for (var i = 0, length = prefixes.length; i < length; i++) {
        if (this.indexOf(prefixes[i]) === 0) {
          return true;
        }
      }

      return false;
    
    };

    def.$strip = function() {
      
      return this.replace(/^\s*/, '').replace(/\s*$/, '');
    };

    def.$sub = TMP_6 = function(pattern, replace) {
      var $a, $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      
      if (typeof(replace) === 'string') {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.replace(/\\([1-9])/g, '$$$1')
        return this.replace(pattern, replace);
      }
      if (block !== nil) {
        return this.replace(pattern, function() {
          // FIXME: this should be a formal MatchData object with all the goodies
          var match_data = []
          for (var i = 0, len = arguments.length; i < len; i++) {
            var arg = arguments[i];
            if (arg == undefined) {
              match_data.push(nil);
            }
            else {
              match_data.push(arg);
            }
          }

          var str = match_data.pop();
          var offset = match_data.pop();
          var match_len = match_data.length;

          // $1, $2, $3 not being parsed correctly in Ruby code
          //for (var i = 1; i < match_len; i++) {
          //  __gvars[String(i)] = match_data[i];
          //}
          $gvars["&"] = match_data[0];
          $gvars["~"] = match_data;
          return block(match_data[0]);
        });
      }
      else if (replace !== undefined) {
        if (replace['$is_a?']((($a = $scope.Hash) == null ? $opal.cm("Hash") : $a))) {
          return this.replace(pattern, function(str) {
            var value = replace['$[]'](this.$str());

            return (value == null) ? nil : this.$value().$to_s();
          });
        }
        else {
          replace = (($a = $scope.String) == null ? $opal.cm("String") : $a).$try_convert(replace);

          if (replace == null) {
            this.$raise((($a = $scope.TypeError) == null ? $opal.cm("TypeError") : $a), "can't convert " + (replace.$class()) + " into String");
          }

          return this.replace(pattern, replace);
        }
      }
      else {
        // convert Ruby back reference to JavaScript back reference
        replace = replace.toString().replace(/\\([1-9])/g, '$$$1')
        return this.replace(pattern, replace);
      }
    ;
    };

    def.$succ = def.$next;

    def.$sum = function(n) {
      if (n == null) {
        n = 16
      }
      
      var result = 0;

      for (var i = 0, length = this.length; i < length; i++) {
        result += (this.charCodeAt(i) % ((1 << n) - 1));
      }

      return result;
    
    };

    def.$swapcase = function() {
      
      
      var str = this.replace(/([a-z]+)|([A-Z]+)/g, function($0,$1,$2) {
        return $1 ? $0.toUpperCase() : $0.toLowerCase();
      });

      if (this.constructor === native_string) {
        return str;
      }

      return this.$class().$new(str);
    ;
    };

    def.$to_a = function() {
      
      
      if (this.length === 0) {
        return [];
      }

      return [this];
    ;
    };

    def.$to_f = function() {
      
      
      var result = parseFloat(this);

      return isNaN(result) ? 0 : result;
    ;
    };

    def.$to_i = function(base) {
      if (base == null) {
        base = 10
      }
      
      var result = parseInt(this, base);

      if (isNaN(result)) {
        return 0;
      }

      return result;
    ;
    };

    def.$to_proc = function() {
      
      
      var name = '$' + this;

      return function(arg) {
        var meth = arg[name];
        return meth ? meth.call(arg) : arg.$method_missing(name);
      };
    ;
    };

    def.$to_s = function() {
      
      return this.toString();
    };

    def.$to_str = def.$to_s;

    def.$to_sym = def.$intern;

    def.$to_n = function() {
      
      return this.valueOf();
    };

    def.$tr = function(from, to) {
      
      
      if (from.length == 0 || from === to) {
        return this;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var char = from_chars[i];
        if (last_from == null) {
          last_from = char;
          from_chars_expanded.push(char);
        }
        else if (char === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = char.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(native_string.fromCharCode(c));
          }
          from_chars_expanded.push(char);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(char);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var char = to_chars[i];
            if (last_from == null) {
              last_from = char;
              to_chars_expanded.push(char);
            }
            else if (char === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = char.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(native_string.fromCharCode(c));
              }
              to_chars_expanded.push(char);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(char);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }

      var new_str = ''
      for (var i = 0, length = this.length; i < length; i++) {
        var char = this.charAt(i);
        var sub = subs[char];
        if (inverse) {
          new_str += (sub == null ? global_sub : char);
        }
        else {
          new_str += (sub != null ? sub : char);
        }
      }
      return new_str;
    ;
    };

    def.$tr_s = function(from, to) {
      
      
      if (from.length == 0) {
        return this;
      }

      var subs = {};
      var from_chars = from.split('');
      var from_length = from_chars.length;
      var to_chars = to.split('');
      var to_length = to_chars.length;

      var inverse = false;
      var global_sub = null;
      if (from_chars[0] === '^') {
        inverse = true;
        from_chars.shift();
        global_sub = to_chars[to_length - 1]
        from_length -= 1;
      }

      var from_chars_expanded = [];
      var last_from = null;
      var in_range = false;
      for (var i = 0; i < from_length; i++) {
        var char = from_chars[i];
        if (last_from == null) {
          last_from = char;
          from_chars_expanded.push(char);
        }
        else if (char === '-') {
          if (last_from === '-') {
            from_chars_expanded.push('-');
            from_chars_expanded.push('-');
          }
          else if (i == from_length - 1) {
            from_chars_expanded.push('-');
          }
          else {
            in_range = true;
          }
        }
        else if (in_range) {
          var start = last_from.charCodeAt(0) + 1;
          var end = char.charCodeAt(0);
          for (var c = start; c < end; c++) {
            from_chars_expanded.push(native_string.fromCharCode(c));
          }
          from_chars_expanded.push(char);
          in_range = null;
          last_from = null;
        }
        else {
          from_chars_expanded.push(char);
        }
      }

      from_chars = from_chars_expanded;
      from_length = from_chars.length;

      if (inverse) {
        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = true;
        }
      }
      else {
        if (to_length > 0) {
          var to_chars_expanded = [];
          var last_to = null;
          var in_range = false;
          for (var i = 0; i < to_length; i++) {
            var char = to_chars[i];
            if (last_from == null) {
              last_from = char;
              to_chars_expanded.push(char);
            }
            else if (char === '-') {
              if (last_to === '-') {
                to_chars_expanded.push('-');
                to_chars_expanded.push('-');
              }
              else if (i == to_length - 1) {
                to_chars_expanded.push('-');
              }
              else {
                in_range = true;
              }
            }
            else if (in_range) {
              var start = last_from.charCodeAt(0) + 1;
              var end = char.charCodeAt(0);
              for (var c = start; c < end; c++) {
                to_chars_expanded.push(native_string.fromCharCode(c));
              }
              to_chars_expanded.push(char);
              in_range = null;
              last_from = null;
            }
            else {
              to_chars_expanded.push(char);
            }
          }

          to_chars = to_chars_expanded;
          to_length = to_chars.length;
        }

        var length_diff = from_length - to_length;
        if (length_diff > 0) {
          var pad_char = (to_length > 0 ? to_chars[to_length - 1] : '');
          for (var i = 0; i < length_diff; i++) {
            to_chars.push(pad_char);
          }
        }

        for (var i = 0; i < from_length; i++) {
          subs[from_chars[i]] = to_chars[i];
        }
      }
      var new_str = ''
      var last_substitute = null
      for (var i = 0, length = this.length; i < length; i++) {
        var char = this.charAt(i);
        var sub = subs[char]
        if (inverse) {
          if (sub == null) {
            if (last_substitute == null) {
              new_str += global_sub;
              last_substitute = true;
            }
          }
          else {
            new_str += char;
            last_substitute = null;
          }
        }
        else {
          if (sub != null) {
            if (last_substitute == null || last_substitute !== sub) {
              new_str += sub;
              last_substitute = sub;
            }
          }
          else {
            new_str += char;
            last_substitute = null;
          }
        }
      }
      return new_str;
    ;
    };

    def.$upcase = function() {
      
      return this.toUpperCase();
    };

    def.$freeze = function() {
      
      return this;
    };

    def['$frozen?'] = function() {
      
      return true;
    };

    return nil;
  })(self, null);
  $scope.Symbol = (($a = $scope.String) == null ? $opal.cm("String") : $a);
  return (function($base, $super){
    function MatchData() {};
    MatchData = $klass($base, $super, "MatchData", MatchData);

    var def = MatchData._proto, $scope = MatchData._scope;

    MatchData.$attr_reader("post_match", "pre_match", "regexp", "string");

    MatchData.constructor.prototype['$new'] = function(regexp, match_groups) {
      
      
      var instance = new Opal.MatchData._alloc;
      for (var i = 0, len = match_groups.length; i < len; i++) {
        var group = match_groups[i];
        if (group == undefined) {
          instance.push(nil);
        }
        else {
          instance.push(group);
        }
      }
      instance._begin = match_groups.index;
      instance.regexp = regexp;
      instance.string = match_groups.input;
      instance.pre_match = $gvars["`"] = instance.string.substr(0, regexp.lastIndex - instance[0].length);
      instance.post_match = $gvars["'"] = instance.string.substr(regexp.lastIndex);
      return $gvars["~"] = instance;
    
    };

    def.$begin = function(pos) {
      var $a;
      
      if (pos == 0 || pos == 1) {
        return this._begin;
      }
      else {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "MatchData#begin only supports 0th element");
      }
    ;
    };

    def.$captures = function() {
      
      return this.slice(1);
    };

    def.$inspect = function() {
      
      
      var str = "<#MatchData " + this[0].$inspect()
      for (var i = 1, len = this.length; i < len; i++) {
        str += " " + i + ":" + this[i].$inspect();
      }
      str += ">";
      return str;
    ;
    };

    def.$to_s = function() {
      
      return this[0];
    };

    def.$to_n = function() {
      
      return this.valueOf();
    };

    def.$values_at = function(indexes) {
      indexes = $slice.call(arguments, 0);
      
      var vals = [];
      var match_length = this.length;
      for (var i = 0, length = indexes.length; i < length; i++) {
        var pos = indexes[i];
        if (pos >= 0) {
          vals.push(this[pos]);
        }
        else {
          pos = match_length + pos;
          if (pos > 0) {
            vals.push(this[pos]);
          }
          else {
            vals.push(nil);
          }
        }
      }

      return vals;
    
    };

    return nil;
  })(self, (($a = $scope.Array) == null ? $opal.cm("Array") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/string.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$<', '$>', '$raise', '$new', '$floor', '$/', '$%', '$enum_for', '$is_a?']);
  (function($base, $super){
    function Numeric() {};
    Numeric = $klass($base, $super, "Numeric", Numeric);

    var def = Numeric._proto, $scope = Numeric._scope, $a, TMP_1, TMP_2, TMP_3, TMP_4;

    Numeric.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    def._isNumber = true;

    def['$+'] = function(other) {
      
      return this + other;
    };

    def['$-'] = function(other) {
      
      return this - other;
    };

    def['$*'] = function(other) {
      
      return this * other;
    };

    def['$/'] = function(other) {
      
      return this / other;
    };

    def['$%'] = function(other) {
      var $a, $b;
      if (($a = ((($b = other['$<'](0)) !== false && $b !== nil) ? $b : this['$<'](0))) !== false && $a !== nil) {
        return (this % other + other) % other;
      } else {
        return this % other;
      };
    };

    def['$&'] = function(other) {
      
      return this & other;
    };

    def['$|'] = function(other) {
      
      return this | other;
    };

    def['$^'] = function(other) {
      
      return this ^ other;
    };

    def['$<'] = function(other) {
      
      return this < other;
    };

    def['$<='] = function(other) {
      
      return this <= other;
    };

    def['$>'] = function(other) {
      
      return this > other;
    };

    def['$>='] = function(other) {
      
      return this >= other;
    };

    def['$<<'] = function(count) {
      
      return this << count;
    };

    def['$>>'] = function(count) {
      
      return this >> count;
    };

    def['$+@'] = function() {
      
      return +this;
    };

    def['$-@'] = function() {
      
      return -this;
    };

    def['$~'] = function() {
      
      return ~this;
    };

    def['$**'] = function(other) {
      
      return Math.pow(this, other);
    };

    def['$=='] = function(other) {
      
      return !!(other._isNumber) && this == Number(other);
    };

    def['$<=>'] = function(other) {
      
      
      if (typeof(other) !== 'number') {
        return nil;
      }

      return this < other ? -1 : (this > other ? 1 : 0);
    ;
    };

    def.$abs = function() {
      
      return Math.abs(this);
    };

    def.$ceil = function() {
      
      return Math.ceil(this);
    };

    def.$chr = function() {
      
      return String.fromCharCode(this);
    };

    def.$conj = function() {
      
      return this;
    };

    def.$conjugate = def.$conj;

    def.$downto = TMP_1 = function(finish) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      
      for (var i = this; i >= finish; i--) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$eql?'] = def['$=='];

    def['$even?'] = function() {
      
      return this % 2 === 0;
    };

    def.$floor = function() {
      
      return Math.floor(this);
    };

    def.$hash = function() {
      
      return this.toString();
    };

    def['$integer?'] = function() {
      
      return this % 1 === 0;
    };

    def.$magnitude = def.$abs;

    def.$modulo = def['$%'];

    def.$next = function() {
      
      return this + 1;
    };

    def['$nonzero?'] = function() {
      
      return this === 0 ? nil : this;
    };

    def['$odd?'] = function() {
      
      return this % 2 !== 0;
    };

    def.$ord = function() {
      
      return this;
    };

    def.$pred = function() {
      
      return this - 1;
    };

    def.$step = TMP_2 = function(limit, step) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;if (step == null) {
        step = 1
      }
      
      var working = this;

      if (step > 0) {
        while (working <= limit) {
          block(working);
          working += step;
        }
      }
      else {
        while (working >= limit) {
          block(working);
          working += step;
        }
      }

      return this;
    ;
    };

    def.$succ = def.$next;

    def.$times = TMP_3 = function() {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;
      
      for (var i = 0; i < this; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    
    };

    def.$to_f = function() {
      
      return parseFloat(this);
    };

    def.$to_i = function() {
      
      return parseInt(this);
    };

    def.$to_int = def.$to_i;

    def.$to_s = function(base) {
      var $a, $b;if (base == null) {
        base = 10
      }
      if (($a = ((($b = base['$<'](2)) !== false && $b !== nil) ? $b : base['$>'](36))) !== false && $a !== nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a).$new("base must be between 2 and 36"))
      };
      return this.toString(base);
    };

    def.$divmod = function(rhs) {
      var q = nil, r = nil;
      q = this['$/'](rhs).$floor();
      r = this['$%'](rhs);
      return [q, r];
    };

    def.$to_n = function() {
      
      return this.valueOf();
    };

    def.$upto = TMP_4 = function(finish) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;
      if (block === nil) {
        return this.$enum_for("upto", finish)
      };
      
      for (var i = this; i <= finish; i++) {
        if (block(i) === $breaker) {
          return $breaker.$v;
        }
      }

      return this;
    ;
    };

    def['$zero?'] = function() {
      
      return this == 0;
    };

    def.$size = function() {
      
      return 4;
    };

    return nil;
  })(self, null);
  $scope.Fixnum = (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a);
  (function($base, $super){
    function Integer() {};
    Integer = $klass($base, $super, "Integer", Integer);

    var def = Integer._proto, $scope = Integer._scope;

    Integer.constructor.prototype['$==='] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a)), $a !== false && $a !== nil ? (other % 1) == 0 : $a)
    };

    return nil;
  })(self, (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a));
  return (function($base, $super){
    function Float() {};
    Float = $klass($base, $super, "Float", Float);

    var def = Float._proto, $scope = Float._scope;

    Float.constructor.prototype['$==='] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a)), $a !== false && $a !== nil ? (other % 1) != 0 : $a)
    };

    return nil;
  })(self, (($a = $scope.Numeric) == null ? $opal.cm("Numeric") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/numeric.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs([]);
  (function($base, $super){
    function Proc() {};
    Proc = $klass($base, $super, "Proc", Proc);

    var def = Proc._proto, $scope = Proc._scope, TMP_1, TMP_2;

    def._isProc = true;

    def.is_lambda = true;

    Proc.constructor.prototype['$new'] = TMP_1 = function() {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
      if (block === nil) { throw new Error("no block given"); }
      block.is_lambda = false;
      return block;
    };

    def.$call = TMP_2 = function(args) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;args = $slice.call(arguments, 0);
      
      if (block !== nil) {
        this._p = block;
      }

      var result = this.apply(null, args);

      if (result === $breaker) {
        return $breaker.$v;
      }

      return result;
    ;
    };

    def['$[]'] = def.$call;

    def.$to_proc = function() {
      
      return this;
    };

    def['$lambda?'] = function() {
      
      return !!this.is_lambda;
    };

    def.$arity = function() {
      
      return this.length;
    };

    def.$to_n = function() {
      
      return this;
    };

    return nil;
  })(self, null);
  return (function($base, $super){
    function Method() {};
    Method = $klass($base, $super, "Method", Method);

    var def = Method._proto, $scope = Method._scope;

    return nil
  })(self, (($a = $scope.Proc) == null ? $opal.cm("Proc") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/proc.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$attr_reader', '$include?', '$<=', '$<', '$end', '$enum_for', '$succ', '$==', '$===', '$eql?', '$begin', '$cover?', '$block_given?', '$raise', '$inspect']);
  return (function($base, $super){
    function Range() {};
    Range = $klass($base, $super, "Range", Range);

    var def = Range._proto, $scope = Range._scope, $a, TMP_1, TMP_2, super_TMP_3, TMP_4, super_TMP_5;

    Range.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    
    Range._proto._isRange = true;

    Opal.range = function(first, last, exc) {
      var range         = new Range._alloc;
          range.begin   = first;
          range.end     = last;
          range.exclude = exc;

      return range;
    };
  

    Range.$attr_reader("begin");

    Range.$attr_reader("end");

    def.$initialize = function(first, last, exclude) {
      if (exclude == null) {
        exclude = false
      }
      this.begin = first;
      this.end = last;
      return this.exclude = exclude;
    };

    def['$=='] = function(other) {
      
      
      if (!other._isRange) {
        return false;
      }

      return this.exclude === other.exclude && this.begin == other.begin && this.end == other.end;
    ;
    };

    def['$==='] = function(obj) {
      
      return this['$include?'](obj);
    };

    def['$cover?'] = function(value) {
      var $a, $b;
      return (($a = (this.begin)['$<='](value)) ? (function() { if (($b = this.exclude) !== false && $b !== nil) {
        return value['$<'](this.end)
      } else {
        return value['$<='](this.end)
      }; return nil; }).call(this) : $a);
    };

    def.$last = function() {
      
      return this.$end();
    };

    def.$each = TMP_1 = function() {
      var $a, $b, $iter = TMP_1._p, block = $iter || nil, current = nil, last = nil;TMP_1._p = null;
      if (block === nil) {
        return this.$enum_for("each")
      };
      current = this.begin;
      last = this.end;
      while (current['$<'](last)){if ($opal.$yield1(block, current) === $breaker) return $breaker.$v;
      current = current.$succ();};
      if (($a = ($b = !this.exclude, $b !== false && $b !== nil ? current['$=='](last) : $b)) !== false && $a !== nil) {
        if ($opal.$yield1(block, current) === $breaker) return $breaker.$v
      };
      return this;
    };

    def['$eql?'] = function(other) {
      var $a, $b;
      if (($a = (($b = $scope.Range) == null ? $opal.cm("Range") : $b)['$==='](other)) === false || $a === nil) {
        return false
      };
      return ($a = ($a = this.exclude === other.exclude, $a !== false && $a !== nil ? (this.begin)['$eql?'](other.$begin()) : $a), $a !== false && $a !== nil ? (this.end)['$eql?'](other.$end()) : $a);
    };

    def['$exclude_end?'] = function() {
      
      return this.exclude;
    };

    def['$include?'] = function(obj) {
      
      return this['$cover?'](obj);
    };

    super_TMP_3 = def.$max;
    def.$max = TMP_2 = function() {
var $zuper = $slice.call(arguments, 0);      var $iter = TMP_2._p, $yield = $iter || nil;TMP_2._p = null;
      if (($yield !== nil)) {
        return (super_TMP_3._p = $iter, super_TMP_3.apply(this, $zuper))
      } else {
        return this.exclude ? this.end - 1 : this.end;
      };
    };

    super_TMP_5 = def.$min;
    def.$min = TMP_4 = function() {
var $zuper = $slice.call(arguments, 0);      var $iter = TMP_4._p, $yield = $iter || nil;TMP_4._p = null;
      if (($yield !== nil)) {
        return (super_TMP_5._p = $iter, super_TMP_5.apply(this, $zuper))
      } else {
        return this.begin;
      };
    };

    def['$member?'] = def['$include?'];

    def.$step = function(n) {
      var $a;if (n == null) {
        n = 1
      }
      return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
    };

    def.$to_s = function() {
      
      return this.$begin().$inspect() + (this.exclude ? '...' : '..') + this.$end().$inspect();
    };

    return def.$inspect = def.$to_s;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/range.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, days_of_week = nil, short_days = nil, short_months = nil, long_months = nil;

  $opal.add_stubs(['$include', '$allocate', '$+', '$to_f', '$-', '$<=>', '$is_a?', '$zero?']);
  days_of_week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  short_days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  short_months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  long_months = ["January", "Febuary", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (function($base, $super){
    function Time() {};
    Time = $klass($base, $super, "Time", Time);

    var def = Time._proto, $scope = Time._scope, $a;

    Time.$include((($a = $scope.Comparable) == null ? $opal.cm("Comparable") : $a));

    Time.constructor.prototype['$at'] = function(seconds, frac) {
      if (frac == null) {
        frac = 0
      }
      return new Date(seconds * 1000 + frac);
    };

    Time.constructor.prototype['$new'] = function(year, month, day, hour, minute, second, millisecond) {
      
      
      switch (arguments.length) {
        case 1:
          return new Date(year);
        case 2:
          return new Date(year, month - 1);
        case 3:
          return new Date(year, month - 1, day);
        case 4:
          return new Date(year, month - 1, day, hour);
        case 5:
          return new Date(year, month - 1, day, hour, minute);
        case 6:
          return new Date(year, month - 1, day, hour, minute, second);
        case 7:
          return new Date(year, month - 1, day, hour, minute, second, millisecond);
        default:
          return new Date();
      }
    
    };

    Time.constructor.prototype['$now'] = function() {
      
      return new Date();
    };

    Time.constructor.prototype['$parse'] = function(str) {
      
      return Date.parse(str);
    };

    def['$+'] = function(other) {
      var $a;
      return (($a = $scope.Time) == null ? $opal.cm("Time") : $a).$allocate(this.$to_f()['$+'](other.$to_f()));
    };

    def['$-'] = function(other) {
      var $a;
      return (($a = $scope.Time) == null ? $opal.cm("Time") : $a).$allocate(this.$to_f()['$-'](other.$to_f()));
    };

    def['$<=>'] = function(other) {
      
      return this.$to_f()['$<=>'](other.$to_f());
    };

    def.$day = function() {
      
      return this.getDate();
    };

    def['$eql?'] = function(other) {
      var $a;
      return ($a = other['$is_a?']((($a = $scope.Time) == null ? $opal.cm("Time") : $a)), $a !== false && $a !== nil ? this['$<=>'](other)['$zero?']() : $a);
    };

    def['$friday?'] = function() {
      
      return this.getDay() === 5;
    };

    def.$hour = function() {
      
      return this.getHours();
    };

    def.$inspect = function() {
      
      return this.toString();
    };

    def.$mday = def.$day;

    def.$min = function() {
      
      return this.getMinutes();
    };

    def.$mon = function() {
      
      return this.getMonth() + 1;
    };

    def['$monday?'] = function() {
      
      return this.getDay() === 1;
    };

    def.$month = def.$mon;

    def['$saturday?'] = function() {
      
      return this.getDay() === 6;
    };

    def.$sec = function() {
      
      return this.getSeconds();
    };

    def.$strftime = function(format) {
      if (format == null) {
        format = ""
      }
      
      var d = this;

      return format.replace(/%(-?.)/g, function(full, m) {
        switch (m) {
          case 'a': return short_days[d.getDay()];
          case '^a': return short_days[d.getDay()].toUpperCase();
          case 'A': return days_of_week[d.getDay()];
          case '^A': return days_of_week[d.getDay()].toUpperCase();
          case 'b': return short_months[d.getMonth()];
          case '^b': return short_months[d.getMonth()].toUpperCase();
          case 'h': return short_months[d.getMonth()];
          case 'B': return long_months[d.getMonth()];
          case '^B': return long_months[d.getMonth()].toUpperCase();
          case 'u': return d.getDay() + 1;
          case 'w': return d.getDay();
          case 'm':
            var month = d.getMonth() + 1;
            return month < 10 ? '0' + month : month;
          case '-m': return d.getMonth() + 1
          case 'd': return (d.getDate() < 10 ? '0' + d.getDate() : d.getDate());
          case '-d': return d.getDate();
          case 'e': return (d.getDate() < 10 ? ' ' + d.getDate() : d.getDate());
          case 'Y': return d.getFullYear();
          case 'C': return Math.round(d.getFullYear() / 100);
          case 'y': return d.getFullYear() % 100;
          case 'H': return (d.getHours() < 10 ? '0' + d.getHours() : d.getHours());
          case 'k': return (d.getHours() < 10 ? ' ' + d.getHours() : d.getHours());
          case 'M': return (d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes());
          case 'S': return (d.getSeconds() < 10 ? '0' + d.getSeconds() : d.getSeconds());
          case 's': return d.getTime();
          case 'n': return "\n";
          case 't': return "\t";
          case '%': return "%";
          default: return m ;
        }
      });
    ;
    };

    def['$sunday?'] = function() {
      
      return this.getDay() === 0;
    };

    def['$thursday?'] = function() {
      
      return this.getDay() === 4;
    };

    def.$to_f = function() {
      
      return this.getTime() / 1000;
    };

    def.$to_i = function() {
      
      return parseInt(this.getTime() / 1000);
    };

    def.$to_s = def.$inspect;

    def['$tuesday?'] = function() {
      
      return this.getDay() === 2;
    };

    def.$wday = function() {
      
      return this.getDay();
    };

    def['$wednesday?'] = function() {
      
      return this.getDay() === 3;
    };

    def.$year = function() {
      
      return this.getFullYear();
    };

    def.$to_n = function() {
      
      return this;
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/time.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$==', '$[]', '$upcase', '$const_set', '$new', '$unshift', '$define_struct_attribute', '$each', '$raise', '$<<', '$members', '$instance_variable_get', '$define_method', '$instance_variable_set', '$include', '$length', '$native?', '$Native', '$each_with_index', '$class', '$===', '$>=', '$size', '$include?', '$to_sym', '$enum_for', '$hash', '$all?', '$map', '$to_n', '$each_pair', '$+', '$name', '$join', '$inspect']);
  return (function($base, $super){
    function Struct() {};
    Struct = $klass($base, $super, "Struct", Struct);

    var def = Struct._proto, $scope = Struct._scope, TMP_1, $a, TMP_8, TMP_10;

    Struct.constructor.prototype['$new'] = TMP_1 = function(name, args) {
var $zuper = $slice.call(arguments, 0);      var $a, $b, TMP_2, $c, $d, $iter = TMP_1._p, $yield = $iter || nil;TMP_1._p = null;args = $slice.call(arguments, 1);
      if (($a = this['$==']((($b = $scope.Struct) == null ? $opal.cm("Struct") : $b))) === false || $a === nil) {
        return $opal.dispatch_super(this, "new",$zuper, $iter, Struct)
      };
      if (name['$[]'](0)['$=='](name['$[]'](0).$upcase())) {
        return (($a = $scope.Struct) == null ? $opal.cm("Struct") : $a).$const_set(name, ($a = this).$new.apply($a, [].concat(args)))
      } else {
        args.$unshift(name);
        return ($b = ($c = (($d = $scope.Class) == null ? $opal.cm("Class") : $d)).$new, $b._p = (TMP_2 = function() {

          var self = TMP_2._s || this, TMP_3, $a, $b;
          
          return ($a = ($b = args).$each, $a._p = (TMP_3 = function(arg) {

            var self = TMP_3._s || this;
            if (arg == null) arg = nil;
            
            return self.$define_struct_attribute(arg)
          }, TMP_3._s = self, TMP_3), $a).call($b)
        }, TMP_2._s = this, TMP_2), $b).call($c, this);
      };
    };

    Struct.constructor.prototype['$define_struct_attribute'] = function(name) {
      var $a, TMP_4, $b, TMP_5, $c;
      if (this['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "you cannot define attributes to the Struct class")
      };
      this.$members()['$<<'](name);
      ($a = ($b = this).$define_method, $a._p = (TMP_4 = function() {

        var self = TMP_4._s || this;
        
        return self.$instance_variable_get("@" + (name))
      }, TMP_4._s = this, TMP_4), $a).call($b, name);
      return ($a = ($c = this).$define_method, $a._p = (TMP_5 = function(value) {

        var self = TMP_5._s || this;
        if (value == null) value = nil;
        
        return self.$instance_variable_set("@" + (name), value)
      }, TMP_5._s = this, TMP_5), $a).call($c, "" + (name) + "=");
    };

    Struct.constructor.prototype['$members'] = function() {
      var $a;
      if (this.members == null) this.members = nil;

      if (this['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the Struct class has no members")
      };
      return ((($a = this.members) !== false && $a !== nil) ? $a : this.members = []);
    };

    Struct.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    def.$initialize = function(args) {
      var $a, $b, TMP_6, TMP_7, $c, object = nil;args = $slice.call(arguments, 0);
      if (($a = (($b = args.$length()['$=='](1)) ? this['$native?'](args['$[]'](0)) : $b)) !== false && $a !== nil) {
        object = args['$[]'](0);
        return ($a = ($b = this.$members()).$each, $a._p = (TMP_6 = function(name) {

          var self = TMP_6._s || this;
          if (name == null) name = nil;
          
          return self.$instance_variable_set("@" + (name), self.$Native(object[name]))
        }, TMP_6._s = this, TMP_6), $a).call($b);
      } else {
        return ($a = ($c = this.$members()).$each_with_index, $a._p = (TMP_7 = function(name, index) {

          var self = TMP_7._s || this;
          if (name == null) name = nil;
          if (index == null) index = nil;
          
          return self.$instance_variable_set("@" + (name), args['$[]'](index))
        }, TMP_7._s = this, TMP_7), $a).call($c)
      };
    };

    def.$members = function() {
      
      return this.$class().$members();
    };

    def['$[]'] = function(name) {
      var $a, $b;
      if (($a = (($b = $scope.Integer) == null ? $opal.cm("Integer") : $b)['$==='](name)) !== false && $a !== nil) {
        if (name['$>='](this.$members().$size())) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "offset " + (name) + " too large for struct(size:" + (this.$members().$size()) + ")")
        };
        name = this.$members()['$[]'](name);
      } else {
        if (($a = this.$members()['$include?'](name.$to_sym())) === false || $a === nil) {
          this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "no member '" + (name) + "' in struct")
        }
      };
      return this.$instance_variable_get("@" + (name));
    };

    def['$[]='] = function(name, value) {
      var $a, $b;
      if (($a = (($b = $scope.Integer) == null ? $opal.cm("Integer") : $b)['$==='](name)) !== false && $a !== nil) {
        if (name['$>='](this.$members().$size())) {
          this.$raise((($a = $scope.IndexError) == null ? $opal.cm("IndexError") : $a), "offset " + (name) + " too large for struct(size:" + (this.$members().$size()) + ")")
        };
        name = this.$members()['$[]'](name);
      } else {
        if (($a = this.$members()['$include?'](name.$to_sym())) === false || $a === nil) {
          this.$raise((($a = $scope.NameError) == null ? $opal.cm("NameError") : $a), "no member '" + (name) + "' in struct")
        }
      };
      return this.$instance_variable_set("@" + (name), value);
    };

    def.$each = TMP_8 = function() {
      var TMP_9, $a, $b, $iter = TMP_8._p, $yield = $iter || nil;TMP_8._p = null;
      if ($yield === nil) {
        return this.$enum_for("each")
      };
      return ($a = ($b = this.$members()).$each, $a._p = (TMP_9 = function(name) {

        var self = TMP_9._s || this, $a;
        if (name == null) name = nil;
        
        return $a = $opal.$yield1($yield, self['$[]'](name)), $a === $breaker ? $a : $a
      }, TMP_9._s = this, TMP_9), $a).call($b);
    };

    def.$each_pair = TMP_10 = function() {
      var TMP_11, $a, $b, $iter = TMP_10._p, $yield = $iter || nil;TMP_10._p = null;
      if ($yield === nil) {
        return this.$enum_for("each_pair")
      };
      return ($a = ($b = this.$members()).$each, $a._p = (TMP_11 = function(name) {

        var self = TMP_11._s || this, $a;
        if (name == null) name = nil;
        
        return $a = $opal.$yieldX($yield, [name, self['$[]'](name)]), $a === $breaker ? $a : $a
      }, TMP_11._s = this, TMP_11), $a).call($b);
    };

    def['$eql?'] = function(other) {
      var $a, TMP_12, $b, $c;
      return ((($a = this.$hash()['$=='](other.$hash())) !== false && $a !== nil) ? $a : ($b = ($c = other.$each_with_index())['$all?'], $b._p = (TMP_12 = function(object, index) {

        var self = TMP_12._s || this;
        if (object == null) object = nil;
        if (index == null) index = nil;
        
        return self['$[]'](self.$members()['$[]'](index))['$=='](object)
      }, TMP_12._s = this, TMP_12), $b).call($c));
    };

    def.$length = function() {
      
      return this.$members().$length();
    };

    def.$size = def.$length;

    def.$to_a = function() {
      var TMP_13, $a, $b;
      return ($a = ($b = this.$members()).$map, $a._p = (TMP_13 = function(name) {

        var self = TMP_13._s || this;
        if (name == null) name = nil;
        
        return self['$[]'](name)
      }, TMP_13._s = this, TMP_13), $a).call($b);
    };

    def.$values = def.$to_a;

    def.$to_n = function() {
      var TMP_14, $a, $b, result = nil;
      result = {};
      ($a = ($b = this).$each_pair, $a._p = (TMP_14 = function(name, value) {

        var self = TMP_14._s || this;
        if (name == null) name = nil;
        if (value == null) value = nil;
        
        return result[name] = value.$to_n();
      }, TMP_14._s = this, TMP_14), $a).call($b);
      return result;
    };

    def.$inspect = function() {
      var $a, TMP_15, $b, result = nil;
      result = "#<struct ";
      if (this.$class()['$==']((($a = $scope.Struct) == null ? $opal.cm("Struct") : $a))) {
        result = result['$+']("" + (this.$class().$name()) + " ")
      };
      result = result['$+'](($a = ($b = this.$each_pair()).$map, $a._p = (TMP_15 = function(name, value) {

        var self = TMP_15._s || this;
        if (name == null) name = nil;
        if (value == null) value = nil;
        
        return "" + (name) + "=" + (value.$inspect())
      }, TMP_15._s = this, TMP_15), $a).call($b).$join(", "));
      result = result['$+'](">");
      return result;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/struct.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $range = $opal.range, $hash2 = $opal.hash2;

  $opal.add_stubs(['$native?', '$new', '$end_with?', '$[]', '$convert', '$define_method', '$call', '$to_proc', '$to_n', '$extend', '$instance_eval', '$raise', '$include', '$length', '$enum_for', '$<', '$+', '$===', '$Native', '$-', '$>=', '$<<', '$respond_to?', '$try_convert', '$block_given?', '$method_missing', '$[]=', '$slice']);
  (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope;

    def['$native?'] = function(value) {
      
      return value == null || !value._klass;
    };

    def.$Native = function(obj) {
      var $a;
      if (($a = obj == null) !== false && $a !== nil) {
        return nil
      } else {
        if (($a = this['$native?'](obj)) !== false && $a !== nil) {
          return (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$new(obj)
        } else {
          return obj
        }
      };
    };
    ;$opal.donate(Kernel, ["$native?", "$Native"]);
  })(self);
  return (function($base, $super){
    function Native() {};
    Native = $klass($base, $super, "Native", Native);

    var def = Native._proto, $scope = Native._scope, TMP_8, $a, TMP_9, TMP_10;
    def['native'] = nil;

    (function($base){
      function Base() {};
      Base = $module($base, "Base", Base);
      var def = Base._proto, $scope = Base._scope;

      (function($base){
        function Helpers() {};
        Helpers = $module($base, "Helpers", Helpers);
        var def = Helpers._proto, $scope = Helpers._scope;

        def.$alias_native = function(new$, old, options) {
          var $a, TMP_1, $b, TMP_2, $c, TMP_3, $d, as = nil;if (old == null) {
            old = new$
          }if (options == null) {
            options = $hash2([], {})
          }
          if (($a = old['$end_with?']("=")) !== false && $a !== nil) {
            return ($a = ($b = this).$define_method, $a._p = (TMP_1 = function(value) {

              var self = TMP_1._s || this, $a;
              if (self['native'] == null) self['native'] = nil;

              if (value == null) value = nil;
              
              self['native'][old['$[]']($range(0, -2, false))] = (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$convert(value);
              return value;
            }, TMP_1._s = this, TMP_1), $a).call($b, new$)
          } else {
            if (($a = as = options['$[]']("as")) !== false && $a !== nil) {
              return ($a = ($c = this).$define_method, $a._p = (TMP_2 = function(args) {

                var self = TMP_2._s || this, block, $a, $b, $c, $d, value = nil;
                if (self['native'] == null) self['native'] = nil;

                
                block = TMP_2._p || nil, TMP_2._p = null;
                args = $slice.call(arguments, 0);
                if (($a = value = ($b = ($c = (($d = $scope.Native) == null ? $opal.cm("Native") : $d)).$call, $b._p = block.$to_proc(), $b).apply($c, [self['native'], old].concat(args))) !== false && $a !== nil) {
                  return as.$new(value.$to_n())
                } else {
                  return nil
                }
              }, TMP_2._s = this, TMP_2), $a).call($c, new$)
            } else {
              return ($a = ($d = this).$define_method, $a._p = (TMP_3 = function(args) {

                var self = TMP_3._s || this, block, $a, $b, $c;
                if (self['native'] == null) self['native'] = nil;

                
                block = TMP_3._p || nil, TMP_3._p = null;
                args = $slice.call(arguments, 0);
                return ($a = ($b = (($c = $scope.Native) == null ? $opal.cm("Native") : $c)).$call, $a._p = block.$to_proc(), $a).apply($b, [self['native'], old].concat(args))
              }, TMP_3._s = this, TMP_3), $a).call($d, new$)
            }
          };
        }
        ;$opal.donate(Helpers, ["$alias_native"]);
      })(Base);

      Base.constructor.prototype['$included'] = function(klass) {
        var TMP_4, $a, $b;
        return ($a = ($b = klass).$instance_eval, $a._p = (TMP_4 = function() {

          var self = TMP_4._s || this, $a;
          
          return self.$extend((($a = $scope.Helpers) == null ? $opal.cm("Helpers") : $a))
        }, TMP_4._s = this, TMP_4), $a).call($b)
      };

      def.$initialize = function(native$) {
        var $a, $b;
        if (($a = (($b = $scope.Kernel) == null ? $opal.cm("Kernel") : $b)['$native?'](native$)) === false || $a === nil) {
          (($a = $scope.Kernel) == null ? $opal.cm("Kernel") : $a).$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the passed value isn't native")
        };
        return this['native'] = native$;
      };

      def.$to_n = function() {
        
        if (this['native'] == null) this['native'] = nil;

        return this['native'];
      };
      ;$opal.donate(Base, ["$initialize", "$to_n"]);
    })(Native);

    (function($base, $super){
      function Array() {};
      Array = $klass($base, $super, "Array", Array);

      var def = Array._proto, $scope = Array._scope, $a, TMP_5, super_TMP_6, TMP_7;
      def.named = def['native'] = def.get = def.block = def.set = def.length = nil;

      Array.$include((($a = $scope.Base) == null ? $opal.cm("Base") : $a));

      Array.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

      super_TMP_6 = def.$initialize;
      def.$initialize = TMP_5 = function(native$, options) {
        var $a, $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;if (options == null) {
          options = $hash2([], {})
        }
        super_TMP_6.apply(this, [native$]);
        this.get = ((($a = options['$[]']("get")) !== false && $a !== nil) ? $a : options['$[]']("access"));
        this.named = options['$[]']("named");
        this.set = ((($a = options['$[]']("set")) !== false && $a !== nil) ? $a : options['$[]']("access"));
        this.length = ((($a = options['$[]']("length")) !== false && $a !== nil) ? $a : "length");
        this.block = block;
        if (($a = this.$length() == null) !== false && $a !== nil) {
          return this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "no length found on the array-like object")
        } else {
          return nil
        };
      };

      def.$each = TMP_7 = function() {
        var $a, $iter = TMP_7._p, block = $iter || nil, index = nil, length = nil;TMP_7._p = null;
        if (($a = block) === false || $a === nil) {
          return this.$enum_for("each")
        };
        index = 0;
        length = this.$length();
        while (index['$<'](length)){block.$call(this['$[]'](index));
        index = index['$+'](1);};
        return this;
      };

      def['$[]'] = function(index) {
        var $a, result = nil, $case = nil;
        result = (function() { $case = index;if ((($a = $scope.String) == null ? $opal.cm("String") : $a)['$===']($case) || (($a = $scope.Symbol) == null ? $opal.cm("Symbol") : $a)['$===']($case)) {
        if (($a = this.named) !== false && $a !== nil) {
          return this['native'][this.named](index);
        } else {
          return this['native'][index];
        }
        }else if ((($a = $scope.Integer) == null ? $opal.cm("Integer") : $a)['$===']($case)) {
        if (($a = this.get) !== false && $a !== nil) {
          return this['native'][this.get](index);
        } else {
          return this['native'][index];
        }
        }else { return nil } }).call(this);
        if (result !== false && result !== nil) {
          if (($a = this.block) !== false && $a !== nil) {
            return this.block.$call(result)
          } else {
            return this.$Native(result)
          }
        } else {
          return nil
        };
      };

      def['$[]='] = function(index, value) {
        var $a;
        if (($a = this.set) !== false && $a !== nil) {
          return this['native'][this.set](index, value);
        } else {
          return this['native'][index] = value;
        };
      };

      def.$last = function(count) {
        var $a, index = nil, result = nil;if (count == null) {
          count = nil
        }
        if (count !== false && count !== nil) {
          index = this.$length()['$-'](1);
          result = [];
          while (index['$>='](0)){result['$<<'](this['$[]'](index));
          index = index['$-'](1);};
          return result;
        } else {
          return this['$[]'](this.$length()['$-'](1))
        };
      };

      def.$length = function() {
        
        return this['native'][this.length];
      };

      return def.$to_ary = def.$to_a;
    })(Native, null);

    Native.constructor.prototype['$try_convert'] = function(value) {
      
      
      if (this['$native?'](value)) {
        return value.valueOf();
      }
      else if (value['$respond_to?']("to_n")) {
        return value.$to_n();
      }
      else {
        return nil;
      }
    ;
    };

    Native.constructor.prototype['$convert'] = function(value) {
      var $a, native$ = nil;
      native$ = this.$try_convert(value);
      if (($a = native$ === nil) !== false && $a !== nil) {
        this.$raise((($a = $scope.ArgumentError) == null ? $opal.cm("ArgumentError") : $a), "the passed value isn't a native")
      };
      return native$;
    };

    Native.constructor.prototype['$call'] = TMP_8 = function(obj, key, args) {
      var $iter = TMP_8._p, block = $iter || nil;TMP_8._p = null;args = $slice.call(arguments, 2);
      if (block !== false && block !== nil) {
        args['$<<'](block)
      };
      
      var prop = obj[key];

      if (prop == null) {
        return nil;
      }
      else if (prop instanceof Function) {
        var result = prop.apply(obj, args);

        return result == null ? nil : result;
      }
      else if (this['$native?'](prop)) {
        return this.$Native(prop);
      }
      else {
        return prop;
      }
    ;
    };

    Native.$include((($a = $scope.Base) == null ? $opal.cm("Base") : $a));

    def['$has_key?'] = function(name) {
      
      return this['native'].hasOwnProperty(name);
    };

    def['$key?'] = def['$has_key?'];

    def['$include?'] = def['$has_key?'];

    def['$member?'] = def['$has_key?'];

    def.$each = TMP_9 = function(args) {
      var $a, $iter = TMP_9._p, $yield = $iter || nil;TMP_9._p = null;args = $slice.call(arguments, 0);
      if (($yield !== nil)) {
        
        for (var key in this['native']) {
          if ($opal.$yieldX($yield, [key, this['native'][key]]) === $breaker) return $breaker.$v
        }
      ;
        return this;
      } else {
        return ($a = this).$method_missing.apply($a, ["each"].concat(args))
      };
    };

    def['$[]'] = function(key) {
      var $a;
      
      var prop = this['native'][key];

      if (prop instanceof Function) {
        return prop;
      }
      else {
        return (($a = $opal.Object._scope.Native) == null ? $opal.cm('Native') : $a).$call(this['native'], key)
      }
    ;
    };

    def['$[]='] = function(key, value) {
      var $a, native$ = nil;
      native$ = (($a = $scope.Native) == null ? $opal.cm("Native") : $a).$try_convert(value);
      if (($a = native$ === nil) !== false && $a !== nil) {
        return this['native'][key] = value;
      } else {
        return this['native'][key] = native$;
      };
    };

    def.$method_missing = TMP_10 = function(mid, args) {
      var $a, $b, $c, $iter = TMP_10._p, block = $iter || nil;TMP_10._p = null;args = $slice.call(arguments, 1);
      
      if (mid.charAt(mid.length - 1) === '=') {
        return this['$[]='](mid.$slice(0, mid.$length()['$-'](1)), args['$[]'](0));
      }
      else {
        return ($a = ($b = (($c = $opal.Object._scope.Native) == null ? $opal.cm('Native') : $c)).$call, $a._p = block.$to_proc(), $a).apply($b, [this['native'], mid].concat(args));
      }
    ;
    };

    def['$nil?'] = function() {
      
      return false;
    };

    return nil;
  })(self, (($a = $scope.BasicObject) == null ? $opal.cm("BasicObject") : $a));
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/native.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $module = $opal.module, $gvars = $opal.gvars;

  $opal.add_stubs(['$write', '$join', '$String', '$map', '$getbyte', '$getc', '$raise']);
  return (function($base, $super){
    function IO() {};
    IO = $klass($base, $super, "IO", IO);

    var def = IO._proto, $scope = IO._scope;

    $scope.SEEK_SET = 0;

    $scope.SEEK_CUR = 1;

    $scope.SEEK_END = 2;

    (function($base){
      function Writable() {};
      Writable = $module($base, "Writable", Writable);
      var def = Writable._proto, $scope = Writable._scope;

      def['$<<'] = function(string) {
        
        this.$write(string);
        return this;
      };

      def.$print = function(args) {
        var TMP_1, $a, $b;args = $slice.call(arguments, 0);
        return this.$write(($a = ($b = args).$map, $a._p = (TMP_1 = function(arg) {

          var self = TMP_1._s || this;
          if (arg == null) arg = nil;
          
          return self.$String(arg)
        }, TMP_1._s = this, TMP_1), $a).call($b).$join($gvars[","]));
      };

      def.$puts = function(args) {
        var TMP_2, $a, $b;args = $slice.call(arguments, 0);
        return this.$write(($a = ($b = args).$map, $a._p = (TMP_2 = function(arg) {

          var self = TMP_2._s || this;
          if (arg == null) arg = nil;
          
          return self.$String(arg)
        }, TMP_2._s = this, TMP_2), $a).call($b).$join($gvars["/"]));
      };
      ;$opal.donate(Writable, ["$<<", "$print", "$puts"]);
    })(IO);

    return (function($base){
      function Readable() {};
      Readable = $module($base, "Readable", Readable);
      var def = Readable._proto, $scope = Readable._scope;

      def.$readbyte = function() {
        
        return this.$getbyte();
      };

      def.$readchar = function() {
        
        return this.$getc();
      };

      def.$readline = function(sep) {
        var $a;if (sep == null) {
          sep = $gvars["/"]
        }
        return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
      };

      def.$readpartial = function(integer, outbuf) {
        var $a;if (outbuf == null) {
          outbuf = nil
        }
        return this.$raise((($a = $scope.NotImplementedError) == null ? $opal.cm("NotImplementedError") : $a));
      };
      ;$opal.donate(Readable, ["$readbyte", "$readchar", "$readline", "$readpartial"]);
    })(IO);
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/io.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $gvars = $opal.gvars, $hash2 = $opal.hash2;

  $opal.add_stubs(['$Native', '$new', '$puts', '$to_s', '$include']);
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  ;
  $gvars["&"] = $gvars["~"] = $gvars["`"] = $gvars["'"] = nil;
  $gvars[":"] = [];
  $gvars["/"] = "\n";
  $gvars[","] = " ";
  $gvars["$"] = $gvars["global"] = self.$Native(Opal.global);
  $scope.ARGV = [];
  $scope.ARGF = (($a = $scope.Object) == null ? $opal.cm("Object") : $a).$new();
  $scope.ENV = $hash2([], {});
  $scope.TRUE = true;
  $scope.FALSE = false;
  $scope.NIL = nil;
  $scope.STDERR = $gvars["stderr"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $scope.STDIN = $gvars["stdin"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $scope.STDOUT = $gvars["stdout"] = (($a = $scope.IO) == null ? $opal.cm("IO") : $a).$new();
  $gvars["stdout"].$puts = function(strs) {
    var $a;strs = $slice.call(arguments, 0);
    
    for (var i = 0; i < strs.length; i++) {
      if(strs[i] instanceof Array) {
        ($a = this).$puts.apply($a, [].concat((strs[i])))
      } else {
        $opal.puts((strs[i]).$to_s());
      }
    }
  ;
    return nil;
  };
  $scope.RUBY_PLATFORM = "opal";
  $scope.RUBY_ENGINE = "opal";
  $scope.RUBY_VERSION = "1.9.3";
  $scope.RUBY_ENGINE_VERSION = "0.4.4";
  $scope.RUBY_RELEASE_DATE = "2013-08-13";
  self.$to_s = function() {
    
    return "main"
  };
  return self.$include = function(mod) {
    var $a;
    return (($a = $scope.Object) == null ? $opal.cm("Object") : $a).$include(mod)
  };
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$attr_reader', '$expose', '$alias_native', '$[]=', '$nil?', '$is_a?', '$to_n', '$has_key?', '$delete', '$block_given?', '$call', '$upcase', '$[]', '$gsub', '$compact', '$respond_to?', '$map', '$<<', '$from_native']);
  return (function($base, $super){
    function Element() {};
    Element = $klass($base, $super, "Element", Element);

    var def = Element._proto, $scope = Element._scope, $a, TMP_1, TMP_2, TMP_5, TMP_6;

    
    var root = $opal.global, dom_class;

    if (root.jQuery) {
      dom_class = jQuery
    }
    else if (root.Zepto) {
      dom_class = Zepto.zepto.Z;
    }
    else {
      throw new Error("jQuery must be included before opal-jquery");
    }

    Element._proto = dom_class.prototype, def = Element._proto;
    dom_class.prototype._klass = Element;
  ;

    Element.$include((($a = $scope.Kernel) == null ? $opal.cm("Kernel") : $a));

    Element.$include((($a = $scope.Enumerable) == null ? $opal.cm("Enumerable") : $a));

    Element.constructor.prototype['$find'] = function(selector) {
      
      return $(selector);
    };

    Element.constructor.prototype['$[]'] = function(selector) {
      
      return $(selector);
    };

    Element.constructor.prototype['$id'] = function(id) {
      
      
      var el = document.getElementById(id);

      if (!el) {
        return nil;
      }

      return $(el);
    
    };

    Element.constructor.prototype['$new'] = function(tag) {
      if (tag == null) {
        tag = "div"
      }
      return $(document.createElement(tag));
    };

    Element.constructor.prototype['$parse'] = function(str) {
      
      return $(str);
    };

    Element.constructor.prototype['$expose'] = function(methods) {
      methods = $slice.call(arguments, 0);
      
      for (var i = 0, length = methods.length, method; i < length; i++) {
        method = methods[i];
        this._proto['$' + method] = this._proto[method];
      }

      return nil;
    ;
    };

    Element.$attr_reader("selector");

    Element.$expose("after", "before", "parent", "parents", "prepend", "prev", "remove");

    Element.$expose("hide", "show", "toggle", "children", "blur", "closest", "data");

    Element.$expose("focus", "find", "next", "siblings", "text", "trigger", "append");

    Element.$expose("height", "width", "serialize", "is", "filter", "last", "first");

    Element.$expose("wrap", "stop", "clone");

    def.$succ = def.$next;

    def['$<<'] = def.$append;

    Element.$alias_native("[]=", "attr");

    Element.$alias_native("add_class", "addClass");

    Element.$alias_native("append_to", "appendTo");

    Element.$alias_native("has_class?", "hasClass");

    Element.$alias_native("html=", "html");

    Element.$alias_native("remove_attr", "removeAttr");

    Element.$alias_native("remove_class", "removeClass");

    Element.$alias_native("text=", "text");

    Element.$alias_native("toggle_class", "toggleClass");

    Element.$alias_native("value=", "val");

    Element.$alias_native("scroll_left=", "scrollLeft");

    Element.$alias_native("scroll_left", "scrollLeft");

    Element.$alias_native("remove_attribute", "removeAttr");

    Element.$alias_native("slide_down", "slideDown");

    Element.$alias_native("slide_up", "slideUp");

    Element.$alias_native("slide_toggle", "slideToggle");

    Element.$alias_native("fade_toggle", "fadeToggle");

    def.$to_n = function() {
      
      return this;
    };

    def['$[]'] = function(name) {
      
      return this.attr(name) || "";
    };

    def.$add_attribute = function(name) {
      
      return this['$[]='](name, "");
    };

    def['$has_attribute?'] = function(name) {
      
      return !!this.attr(name);
    };

    def.$append_to_body = function() {
      
      return this.appendTo(document.body);
    };

    def.$append_to_head = function() {
      
      return this.appendTo(document.head);
    };

    def.$at = function(index) {
      
      
      var length = this.length;

      if (index < 0) {
        index += length;
      }

      if (index < 0 || index >= length) {
        return nil;
      }

      return $(this[index]);
    ;
    };

    def.$class_name = function() {
      
      
      var first = this[0];
      return (first && first.className) || "";
    ;
    };

    def['$class_name='] = function(name) {
      
      
      for (var i = 0, length = this.length; i < length; i++) {
        this[i].className = name;
      }
    ;
      return this;
    };

    def.$css = function(name, value) {
      var $a, $b;if (value == null) {
        value = nil
      }
      if (($a = ($b = value['$nil?'](), $b !== false && $b !== nil ? name['$is_a?']((($b = $scope.String) == null ? $opal.cm("String") : $b)) : $b)) !== false && $a !== nil) {
        return this.css(name)
      } else {
        if (($a = name['$is_a?']((($b = $scope.Hash) == null ? $opal.cm("Hash") : $b))) !== false && $a !== nil) {
          this.css(name.$to_n());
        } else {
          this.css(name, value);
        }
      };
      return this;
    };

    def.$animate = TMP_1 = function(params) {
      var $a, $iter = TMP_1._p, block = $iter || nil, speed = nil;TMP_1._p = null;
      speed = (function() { if (($a = params['$has_key?']("speed")) !== false && $a !== nil) {
        return params.$delete("speed")
      } else {
        return 400
      }; return nil; }).call(this);
      
      this.animate(params.$to_n(), speed, function() {
        if ((block !== nil)) {
        block.$call()
      }
      })
    ;
    };

    def.$effect = TMP_2 = function(name, args) {
      var TMP_3, $a, $b, TMP_4, $c, $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;args = $slice.call(arguments, 1);
      name = ($a = ($b = name).$gsub, $a._p = (TMP_3 = function(match) {

        var self = TMP_3._s || this;
        if (match == null) match = nil;
        
        return match['$[]'](1).$upcase()
      }, TMP_3._s = this, TMP_3), $a).call($b, /_\w/);
      args = ($a = ($c = args).$map, $a._p = (TMP_4 = function(a) {

        var self = TMP_4._s || this, $a;
        if (a == null) a = nil;
        
        if (($a = a['$respond_to?']("to_n")) !== false && $a !== nil) {
          return a.$to_n()
        } else {
          return nil
        }
      }, TMP_4._s = this, TMP_4), $a).call($c).$compact();
      args['$<<'](function() { if ((block !== nil)) {
        block.$call()
      } });
      return this[name].apply(this, args);
    };

    def['$visible?'] = function() {
      
      return this.is(':visible');
    };

    def.$offset = function() {
      var $a;
      return (($a = $scope.Hash) == null ? $opal.cm("Hash") : $a).$from_native(this.offset());
    };

    def.$each = TMP_5 = function() {
      var $iter = TMP_5._p, $yield = $iter || nil;TMP_5._p = null;
      for (var i = 0, length = this.length; i < length; i++) {;
      if ($opal.$yield1($yield, $(this[i])) === $breaker) return $breaker.$v;
      };
      return this;
    };

    def.$first = function() {
      
      return this.length ? this.first() : nil;
    };

    def.$html = function() {
      
      return this.html() || "";
    };

    def.$id = function() {
      
      
      var first = this[0];
      return (first && first.id) || "";
    ;
    };

    def['$id='] = function(id) {
      
      
      var first = this[0];

      if (first) {
        first.id = id;
      }

      return this;
    ;
    };

    def.$tag_name = function() {
      
      return this.length > 0 ? this[0].tagName.toLowerCase() : nil;
    };

    def.$inspect = function() {
      
      
      var val, el, str, result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        el  = this[i];
        str = "<" + el.tagName.toLowerCase();

        if (val = el.id) str += (' id="' + val + '"');
        if (val = el.className) str += (' class="' + val + '"');

        result.push(str + '>');
      }

      return '#<Element [' + result.join(', ') + ']>';
    
    };

    def.$length = function() {
      
      return this.length;
    };

    def['$any?'] = function() {
      
      return this.length > 0;
    };

    def['$empty?'] = function() {
      
      return this.length === 0;
    };

    def['$empty?'] = def['$none?'];

    def.$on = TMP_6 = function(name, sel) {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;if (sel == null) {
        sel = nil
      }
      sel == nil ? this.on(name, block) : this.on(name, sel, block);
      return block;
    };

    def.$off = function(name, sel, block) {
      if (block == null) {
        block = nil
      }
      return block == nil ? this.off(name, sel) : this.off(name, sel, block);
    };

    def.$size = def.$length;

    def.$value = function() {
      
      return this.val() || "";
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal-jquery/element.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var $a, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $gvars = $opal.gvars;

  $opal.add_stubs(['$find']);
  ;
  $scope.Document = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find(document);
  (function(){var $scope = this._scope, def = this._proto;def['$ready?'] = TMP_1 = function() {
    var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;
    if (block !== false && block !== nil) {
      return $(block);
    } else {
      return nil
    };
  };
  def.$title = function() {
    
    return document.title;
  };
  return def['$title='] = function(title) {
    
    return document.title = title;
  };}).call((($a = $scope.Document) == null ? $opal.cm("Document") : $a).$singleton_class());
  return $gvars["document"] = (($a = $scope.Document) == null ? $opal.cm("Document") : $a);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal-jquery/document.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$include', '$stop_propagation', '$prevent_default', '$alias_native']);
  return (function($base, $super){
    function Event() {};
    Event = $klass($base, $super, "Event", Event);

    var def = Event._proto, $scope = Event._scope, $a;
    def.type = def.pageX = def.pageY = def.ctrlKey = def.keyCode = def.which = nil;

    
    var bridge_class = $.Event;

    Event._proto = bridge_class.prototype, def = Event._proto;
    bridge_class.prototype._klass = Event;
  ;

    Event.$include((($a = $scope.Kernel) == null ? $opal.cm("Kernel") : $a));

    def['$[]'] = function(name) {
      
      return this[name];
    };

    def.$type = function() {
      
      return this.type;
    };

    def.$current_target = function() {
      
      return $(this.currentTarget);
    };

    def.$target = function() {
      
      return $(this.target);
    };

    def['$default_prevented?'] = function() {
      
      return this.isDefaultPrevented();
    };

    def.$kill = function() {
      
      this.$stop_propagation();
      return this.$prevent_default();
    };

    Event.$alias_native("prevent_default", "preventDefault");

    Event.$alias_native("propagation_stopped?", "propagationStopped");

    Event.$alias_native("stop_propagation", "stopPropagation");

    Event.$alias_native("stop_immediate_propagation", "stopImmediatePropagation");

    def.$page_x = function() {
      
      return this.pageX;
    };

    def.$page_y = function() {
      
      return this.pageY;
    };

    def.$touch_x = function() {
      
      return this.originalEvent.touches[0].pageX;
    };

    def.$touch_y = function() {
      
      return this.originalEvent.touches[0].pageY;
    };

    def.$ctrl_key = function() {
      
      return this.ctrlKey;
    };

    def.$key_code = function() {
      
      return this.keyCode;
    };

    def.$which = function() {
      
      return this.which;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal-jquery/event.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $hash2 = $opal.hash2, $klass = $opal.klass;

  $opal.add_stubs(['$to_json', '$to_s']);
  var json_parse = JSON.parse, __hasOwn = Object.prototype.hasOwnProperty;
  (function($base){
    function JSON() {};
    JSON = $module($base, "JSON", JSON);
    var def = JSON._proto, $scope = JSON._scope;

    JSON.constructor.prototype['$parse'] = function(source) {
      
      return to_opal(json_parse(source));
    };

    JSON.constructor.prototype['$from_object'] = function(js_object) {
      
      return to_opal(js_object);
    };

    
    function to_opal(value) {
      switch (typeof value) {
        case 'string':
          return value;

        case 'number':
          return value;

        case 'boolean':
          return !!value;

        case 'null':
          return nil;

        case 'object':
          if (!value) return nil;

          if (value._isArray) {
            var arr = [];

            for (var i = 0, ii = value.length; i < ii; i++) {
              arr.push(to_opal(value[i]));
            }

            return arr;
          }
          else {
            var hash = $hash2([], {}), v, map = hash.map, keys = hash.keys;

            for (var k in value) {
              if (__hasOwn.call(value, k)) {
                v = to_opal(value[k]);
                keys.push(k);
                map[k] = v;
              }
            }
          }

          return hash;
      }
    };
  

  })(self);
  (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope;

    def.$to_json = function() {
      
      return this.$to_s().$to_json();
    };

    def.$as_json = function() {
      
      return nil;
    };
    ;$opal.donate(Kernel, ["$to_json", "$as_json"]);
  })(self);
  (function($base, $super){
    function Array() {};
    Array = $klass($base, $super, "Array", Array);

    var def = Array._proto, $scope = Array._scope;

    def.$to_json = function() {
      
      
      var result = [];

      for (var i = 0, length = this.length; i < length; i++) {
        result.push((this[i]).$to_json());
      }

      return '[' + result.join(', ') + ']';
    
    };

    return nil;
  })(self, null);
  (function($base, $super){
    function Boolean() {};
    Boolean = $klass($base, $super, "Boolean", Boolean);

    var def = Boolean._proto, $scope = Boolean._scope;

    def.$as_json = function() {
      
      return this;
    };

    def.$to_json = function() {
      
      return (this == true) ? 'true' : 'false';
    };

    return nil;
  })(self, null);
  (function($base, $super){
    function Hash() {};
    Hash = $klass($base, $super, "Hash", Hash);

    var def = Hash._proto, $scope = Hash._scope;

    def.$to_json = function() {
      
      
      var inspect = [], keys = this.keys, map = this.map;

      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        inspect.push((key).$to_json() + ': ' + (map[key]).$to_json());
      }

      return '{' + inspect.join(', ') + '}';
    ;
    };

    return nil;
  })(self, null);
  (function($base, $super){
    function NilClass() {};
    NilClass = $klass($base, $super, "NilClass", NilClass);

    var def = NilClass._proto, $scope = NilClass._scope;

    def.$as_json = function() {
      
      return this;
    };

    def.$to_json = function() {
      
      return "null";
    };

    return nil;
  })(self, null);
  (function($base, $super){
    function Numeric() {};
    Numeric = $klass($base, $super, "Numeric", Numeric);

    var def = Numeric._proto, $scope = Numeric._scope;

    def.$as_json = function() {
      
      return this;
    };

    def.$to_json = function() {
      
      return this.toString();
    };

    return nil;
  })(self, null);
  return (function($base, $super){
    function String() {};
    String = $klass($base, $super, "String", String);

    var def = String._proto, $scope = String._scope;

    def.$as_json = function() {
      
      return this;
    };

    return def.$to_json = def.$inspect;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/json.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $hash2 = $opal.hash2;

  $opal.add_stubs(['$attr_reader', '$send!', '$new', '$delete', '$to_n', '$from_object', '$succeed', '$fail', '$call', '$parse', '$xhr']);
  ;
  return (function($base, $super){
    function HTTP() {};
    HTTP = $klass($base, $super, "HTTP", HTTP);

    var def = HTTP._proto, $scope = HTTP._scope, TMP_1, TMP_2, TMP_3, TMP_4, TMP_5, TMP_6;
    def.errback = def.json = def.body = def.ok = def.settings = def.callback = nil;

    HTTP.$attr_reader("body", "error_message", "method", "status_code", "url", "xhr");

    HTTP.constructor.prototype['$get'] = TMP_1 = function(url, opts) {
      var $iter = TMP_1._p, block = $iter || nil;TMP_1._p = null;if (opts == null) {
        opts = $hash2([], {})
      }
      return this.$new(url, "GET", opts, block)['$send!']()
    };

    HTTP.constructor.prototype['$post'] = TMP_2 = function(url, opts) {
      var $iter = TMP_2._p, block = $iter || nil;TMP_2._p = null;if (opts == null) {
        opts = $hash2([], {})
      }
      return this.$new(url, "POST", opts, block)['$send!']()
    };

    HTTP.constructor.prototype['$put'] = TMP_3 = function(url, opts) {
      var $iter = TMP_3._p, block = $iter || nil;TMP_3._p = null;if (opts == null) {
        opts = $hash2([], {})
      }
      return this.$new(url, "PUT", opts, block)['$send!']()
    };

    HTTP.constructor.prototype['$delete'] = TMP_4 = function(url, opts) {
      var $iter = TMP_4._p, block = $iter || nil;TMP_4._p = null;if (opts == null) {
        opts = $hash2([], {})
      }
      return this.$new(url, "DELETE", opts, block)['$send!']()
    };

    def.$initialize = function(url, method, options, handler) {
      var $a, http = nil, payload = nil, settings = nil;if (handler == null) {
        handler = nil
      }
      this.url = url;
      this.method = method;
      this.ok = true;
      this.xhr = nil;
      http = this;
      payload = options.$delete("payload");
      settings = options.$to_n();
      if (handler !== false && handler !== nil) {
        this.callback = this.errback = handler
      };
      
      if (typeof(payload) === 'string') {
        settings.data = payload;
      }
      else if (payload != nil) {
        settings.data = payload.$to_json();
        settings.contentType = 'application/json';
      }

      settings.url  = url;
      settings.type = method;

      settings.success = function(data, status, xhr) {
        http.body = data;
        http.xhr = xhr;

        if (typeof(data) === 'object') {
          http.json = (($a = $scope.JSON) == null ? $opal.cm("JSON") : $a).$from_object(data);
        }

        return http.$succeed();
      };

      settings.error = function(xhr, status, error) {
        http.body = xhr.responseText;
        http.xhr = xhr;

        return http.$fail();
      };
    
      return this.settings = settings;
    };

    def.$callback = TMP_5 = function() {
      var $iter = TMP_5._p, block = $iter || nil;TMP_5._p = null;
      this.callback = block;
      return this;
    };

    def.$errback = TMP_6 = function() {
      var $iter = TMP_6._p, block = $iter || nil;TMP_6._p = null;
      this.errback = block;
      return this;
    };

    def.$fail = function() {
      var $a;
      this.ok = false;
      if (($a = this.errback) !== false && $a !== nil) {
        return this.errback.$call(this)
      } else {
        return nil
      };
    };

    def.$json = function() {
      var $a, $b;
      return ((($a = this.json) !== false && $a !== nil) ? $a : (($b = $scope.JSON) == null ? $opal.cm("JSON") : $b).$parse(this.body));
    };

    def['$ok?'] = function() {
      
      return this.ok;
    };

    def['$send!'] = function() {
      
      $.ajax(this.settings);
      return this;
    };

    def.$succeed = function() {
      var $a;
      if (($a = this.callback) !== false && $a !== nil) {
        return this.callback.$call(this)
      } else {
        return nil
      };
    };

    def.$get_header = function(key) {
      
      return this.$xhr().getResponseHeader(key);;
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal-jquery/http.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs([]);
  return (function($base){
    function Kernel() {};
    Kernel = $module($base, "Kernel", Kernel);
    var def = Kernel._proto, $scope = Kernel._scope;

    def.$alert = function(msg) {
      
      alert(msg);
      return nil;
    }
    ;$opal.donate(Kernel, ["$alert"]);
  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal-jquery/kernel.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice;

  $opal.add_stubs([]);
  ;
  ;
  ;
  ;
  return ;
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal-jquery.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass;

  $opal.add_stubs(['$class', '$_racc_do_parse_rb', '$_racc_setup', '$[]', '$==', '$next_token', '$racc_read_token', '$+', '$<', '$nil?', '$puts', '$>', '$-', '$push', '$<<', '$racc_shift', '$-@', '$*', '$last', '$pop', '$__send__', '$raise', '$racc_reduce', '$>=', '$inspect', '$racc_next_state', '$racc_token2str', '$racc_print_stacks', '$empty?', '$map', '$racc_print_states', '$each_index', '$each']);
  return (function($base){
    function Racc() {};
    Racc = $module($base, "Racc", Racc);
    var def = Racc._proto, $scope = Racc._scope;

    (function($base, $super){
      function Parser() {};
      Parser = $klass($base, $super, "Parser", Parser);

      var def = Parser._proto, $scope = Parser._scope;
      def.yydebug = nil;

      def.$_racc_setup = function() {
        var $a;
        return (($a = (this.$class())._scope).Racc_arg == null ? $a.cm('Racc_arg') : $a.Racc_arg);
      };

      def.$do_parse = function() {
        
        return this.$_racc_do_parse_rb(this.$_racc_setup(), false);
      };

      def.$_racc_do_parse_rb = function(arg, in_debug) {
        var $a, $b, $c, $d, action_table = nil, action_check = nil, action_default = nil, action_pointer = nil, goto_table = nil, goto_check = nil, goto_default = nil, goto_pointer = nil, nt_base = nil, reduce_table = nil, token_table = nil, shift_n = nil, reduce_n = nil, use_result = nil, racc_state = nil, racc_tstack = nil, racc_vstack = nil, racc_t = nil, racc_tok = nil, racc_val = nil, racc_read_next = nil, racc_user_yyerror = nil, racc_error_status = nil, token = nil, act = nil, i = nil, nerr = nil, custate = nil, curstate = nil, reduce_i = nil, reduce_len = nil, reduce_to = nil, method_id = nil, tmp_t = nil, tmp_v = nil, reduce_call_result = nil, k1 = nil;
        action_table = arg['$[]'](0);
        action_check = arg['$[]'](1);
        action_default = arg['$[]'](2);
        action_pointer = arg['$[]'](3);
        goto_table = arg['$[]'](4);
        goto_check = arg['$[]'](5);
        goto_default = arg['$[]'](6);
        goto_pointer = arg['$[]'](7);
        nt_base = arg['$[]'](8);
        reduce_table = arg['$[]'](9);
        token_table = arg['$[]'](10);
        shift_n = arg['$[]'](11);
        reduce_n = arg['$[]'](12);
        use_result = arg['$[]'](13);
        racc_state = [0];
        racc_tstack = [];
        racc_vstack = [];
        racc_t = nil;
        racc_tok = nil;
        racc_val = nil;
        racc_read_next = true;
        racc_user_yyerror = false;
        racc_error_status = 0;
        token = nil;
        act = nil;
        i = nil;
        nerr = nil;
        custate = nil;
        while (($b = true) !== false && $b !== nil){i = action_pointer['$[]'](racc_state['$[]'](-1));
        if (i !== false && i !== nil) {
          if (racc_read_next !== false && racc_read_next !== nil) {
            if (($b = ($c = racc_t['$=='](0), ($c === nil || $c === false))) !== false && $b !== nil) {
              token = this.$next_token();
              racc_tok = token['$[]'](0);
              racc_val = token['$[]'](1);
              if (racc_tok['$=='](false)) {
                racc_t = 0
              } else {
                racc_t = token_table['$[]'](racc_tok);
                if (($b = racc_t) === false || $b === nil) {
                  racc_t = 1
                };
              };
              if (($b = this.yydebug) !== false && $b !== nil) {
                this.$racc_read_token(racc_t, racc_tok, racc_val)
              };
              racc_read_next = false;
            }
          };
          i = i['$+'](racc_t);
          if (($b = ((($c = ((($d = i['$<'](0)) !== false && $d !== nil) ? $d : (act = action_table['$[]'](i))['$nil?']())) !== false && $c !== nil) ? $c : ($d = action_check['$[]'](i)['$=='](racc_state['$[]'](-1)), ($d === nil || $d === false)))) !== false && $b !== nil) {
            act = action_default['$[]'](racc_state['$[]'](-1))
          };
        } else {
          act = action_default['$[]'](racc_state['$[]'](-1))
        };
        if (($b = this.yydebug) !== false && $b !== nil) {
          this.$puts("(act: " + (act) + ", shift_n: " + (shift_n) + ", reduce_n: " + (reduce_n) + ")")
        };
        if (($b = (($c = act['$>'](0)) ? act['$<'](shift_n) : $c)) !== false && $b !== nil) {
          if (racc_error_status['$>'](0)) {
            if (($b = ($c = racc_t['$=='](1), ($c === nil || $c === false))) !== false && $b !== nil) {
              racc_error_status = racc_error_status['$-'](1)
            }
          };
          racc_vstack.$push(racc_val);
          curstate = act;
          racc_state['$<<'](act);
          racc_read_next = true;
          if (($b = this.yydebug) !== false && $b !== nil) {
            racc_tstack.$push(racc_t);
            this.$racc_shift(racc_t, racc_tstack, racc_vstack);
          };
        } else {
          if (($b = (($c = act['$<'](0)) ? act['$>'](reduce_n['$-@']()) : $c)) !== false && $b !== nil) {
            reduce_i = act['$*'](-3);
            reduce_len = reduce_table['$[]'](reduce_i);
            reduce_to = reduce_table['$[]'](reduce_i['$+'](1));
            method_id = reduce_table['$[]'](reduce_i['$+'](2));
            tmp_t = racc_tstack.$last(reduce_len);
            tmp_v = racc_vstack.$last(reduce_len);
            racc_state.$pop(reduce_len);
            racc_vstack.$pop(reduce_len);
            racc_tstack.$pop(reduce_len);
            if (use_result !== false && use_result !== nil) {
              reduce_call_result = this.$__send__(method_id, tmp_v, nil, tmp_v['$[]'](0));
              racc_vstack.$push(reduce_call_result);
            } else {
              this.$raise("not using result??")
            };
            racc_tstack.$push(reduce_to);
            if (($b = this.yydebug) !== false && $b !== nil) {
              this.$racc_reduce(tmp_t, reduce_to, racc_tstack, racc_vstack)
            };
            k1 = reduce_to['$-'](nt_base);
            if (($b = ($c = (reduce_i = goto_pointer['$[]'](k1))['$=='](nil), ($c === nil || $c === false))) !== false && $b !== nil) {
              reduce_i = reduce_i['$+'](racc_state['$[]'](-1));
              if (($b = ($c = (($c = reduce_i['$>='](0)) ? ($d = (curstate = goto_table['$[]'](reduce_i))['$=='](nil), ($d === nil || $d === false)) : $c), $c !== false && $c !== nil ? goto_check['$[]'](reduce_i)['$=='](k1) : $c)) !== false && $b !== nil) {
                racc_state.$push(curstate)
              } else {
                racc_state.$push(goto_default['$[]'](k1))
              };
            } else {
              racc_state.$push(goto_default['$[]'](k1))
            };
          } else {
            if (act['$=='](shift_n)) {
              return racc_vstack['$[]'](0)
            } else {
              if (act['$=='](reduce_n['$-@']())) {
                this.$raise((($b = $scope.SyntaxError) == null ? $opal.cm("SyntaxError") : $b), "unexpected '" + (racc_tok.$inspect()) + "'")
              } else {
                this.$raise("Rac: unknown action: " + (act))
              }
            }
          }
        };
        if (($b = this.yydebug) !== false && $b !== nil) {
          this.$racc_next_state(racc_state['$[]'](-1), racc_state)
        };};
      };

      def.$racc_read_token = function(t, tok, val) {
        
        this.$puts("read    " + (tok) + "(" + (this.$racc_token2str(t)) + ") " + (val.$inspect()));
        return this.$puts("\n");
      };

      def.$racc_shift = function(tok, tstack, vstack) {
        
        this.$puts("shift  " + (this.$racc_token2str(tok)));
        this.$racc_print_stacks(tstack, vstack);
        return this.$puts("\n");
      };

      def.$racc_reduce = function(toks, sim, tstack, vstack) {
        var $a, TMP_1, $b;
        this.$puts("reduce " + ((function() { if (($a = toks['$empty?']()) !== false && $a !== nil) {
          return "<none>"
        } else {
          return ($a = ($b = toks).$map, $a._p = (TMP_1 = function(t) {

            var self = TMP_1._s || this;
            if (t == null) t = nil;
            
            return self.$racc_token2str(t)
          }, TMP_1._s = this, TMP_1), $a).call($b)
        }; return nil; }).call(this)));
        this.$puts("  --> " + (this.$racc_token2str(sim)));
        return this.$racc_print_stacks(tstack, vstack);
      };

      def.$racc_next_state = function(curstate, state) {
        
        this.$puts("goto  " + (curstate));
        this.$racc_print_states(state);
        return this.$puts("\n");
      };

      def.$racc_token2str = function(tok) {
        var $a;
        return (($a = (this.$class())._scope).Racc_token_to_s_table == null ? $a.cm('Racc_token_to_s_table') : $a.Racc_token_to_s_table)['$[]'](tok);
      };

      def.$racc_print_stacks = function(t, v) {
        var TMP_2, $a, $b;
        this.$puts("  [");
        ($a = ($b = t).$each_index, $a._p = (TMP_2 = function(i) {

          var self = TMP_2._s || this;
          if (i == null) i = nil;
          
          return self.$puts("    (" + (self.$racc_token2str(t['$[]'](i))) + " " + (v['$[]'](i).$inspect()) + ")")
        }, TMP_2._s = this, TMP_2), $a).call($b);
        return this.$puts("  ]");
      };

      def.$racc_print_states = function(s) {
        var TMP_3, $a, $b;
        this.$puts("  [");
        ($a = ($b = s).$each, $a._p = (TMP_3 = function(st) {

          var self = TMP_3._s || this;
          if (st == null) st = nil;
          
          return self.$puts("   " + (st))
        }, TMP_3._s = this, TMP_3), $a).call($b);
        return this.$puts("  ]");
      };

      return nil;
    })(Racc, null)

  })(self)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/racc.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$length']);
  return (function($base, $super){
    function StringScanner() {};
    StringScanner = $klass($base, $super, "StringScanner", StringScanner);

    var def = StringScanner._proto, $scope = StringScanner._scope;
    def.working = def.pos = def.matched = def.match = def.string = nil;

    StringScanner.$attr_reader("pos");

    StringScanner.$attr_reader("matched");

    def.$initialize = function(string) {
      
      this.string = string;
      this.pos = 0;
      this.matched = nil;
      this.working = string;
      return this.match = [];
    };

    def.$scan = function(regex) {
      
      
      var regex  = new RegExp('^' + regex.toString().substring(1, regex.toString().length - 1)),
          result = regex.exec(this.working);

      if (result == null) {
        return this.matched = nil;
      }
      else if (typeof(result) === 'object') {
        this.pos      += result[0].length;
        this.working  = this.working.substring(result[0].length);
        this.matched  = result[0];
        this.match    = result;

        return result[0];
      }
      else if (typeof(result) === 'string') {
        this.pos     += result.length;
        this.working  = this.working.substring(result.length);

        return result;
      }
      else {
        return nil;
      }
    ;
    };

    def['$[]'] = function(idx) {
      
      
      var match = this.match;

      if (idx < 0) {
        idx += match.length;
      }

      if (idx < 0 || idx >= match.length) {
        return nil;
      }

      return match[idx];
    ;
    };

    def.$check = function(regex) {
      
      
      var regexp = new RegExp('^' + regex.toString().substring(1, regex.toString().length - 1)),
          result = regexp.exec(this.working);

      if (result == null) {
        return this.matched = nil;
      }

      return this.matched = result[0];
    ;
    };

    def.$peek = function(length) {
      
      return this.working.substring(0, length);
    };

    def['$eos?'] = function() {
      
      return this.working.length === 0;
    };

    def.$skip = function(re) {
      
      
      re = new RegExp('^' + re.source)
      var result = re.exec(this.working);

      if (result == null) {
        return this.matched = nil;
      }
      else {
        var match_str = result[0];
        var match_len = match_str.length;
        this.matched = match_str;
        this.pos += match_len;
        this.working = this.working.substring(match_len);
        return match_len;
      }
    ;
    };

    def.$get_byte = function() {
      
      
      var result = nil;
      if (this.pos < this.string.length) {
        this.pos += 1;
        result = this.matched = this.working.substring(0, 1);
        this.working = this.working.substring(1);
      }
      else {
        this.matched = nil;
      }

      return result;
    ;
    };

    def.$getch = def.$get_byte;

    def['$pos='] = function(pos) {
      
      
      if (pos < 0) {
        pos += this.string.$length();
      }
    ;
      this.pos = pos;
      return this.working = this.string.slice(pos);
    };

    def.$rest = function() {
      
      return this.working;
    };

    return nil;
  })(self, null)
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/strscan.js.map
;

// We need (some) of the libs from our real ruby parser (not in sprockets load path)
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module;

  $opal.add_stubs([]);
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    $scope.VERSION = "0.4.4"

  })(self)
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $hash = $opal.hash;

  $opal.add_stubs(['$new', '$empty?', '$[]=', '$to_i', '$+', '$each', '$split', '$[]', '$new_body', '$new_compstmt', '$==', '$size', '$line=', '$line', '$new_block', '$<<', '$s', '$intern', '$new_if', '$new_assign', '$new_op_asgn', '$new_call', '$new_super', '$new_yield', '$new_assignable', '$include?', '$-@', '$to_f', '$add_block_pass', '$cmdarg_push', '$cmdarg_pop', '$cond_push', '$cond_pop', '$new_class', '$end_line=', '$new_sclass', '$new_module', '$push_scope', '$new_defn', '$pop_scope', '$new_defs', '$new_iter', '$new_block_args', '$push', '$first', '$nil?', '$new_str', '$new_xstr', '$new_regexp', '$concat', '$str_append', '$cond_lexpop', '$cmdarg_lexpop', '$new_dsym', '$new_var_ref', '$new_args', '$raise', '$add_local']);
  ;
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function Grammar() {};
      Grammar = $klass($base, $super, "Grammar", Grammar);

      var def = Grammar._proto, $scope = Grammar._scope, $a, TMP_1, $b, TMP_3, $c, TMP_5, $d, TMP_7, $e, clist = nil, racc_action_table = nil, arr = nil, idx = nil, racc_action_check = nil, racc_action_pointer = nil, racc_action_default = nil, racc_goto_table = nil, racc_goto_check = nil, racc_goto_pointer = nil, racc_goto_default = nil, racc_reduce_table = nil, racc_reduce_n = nil, racc_shift_n = nil, racc_token_table = nil, racc_nt_base = nil, racc_use_result_var = nil;
      def.line = def.scope_line = def.string_parse = def.file = def.scope = def.line_number = nil;

      clist = ["63,64,65,7,51,-85,568,682,57,58,197,198,800,61,580,59,60,62,23,24,66", "67,196,-492,264,610,22,28,27,89,88,90,91,264,697,17,775,756,197,198", "424,6,41,8,9,93,92,83,50,85,84,86,87,94,95,751,81,82,609,38,39,37,-264", "-82,73,682,570,569,566,-264,-90,-428,74,-426,-87,544,579,756,-428,551", "-426,36,544,544,30,-492,259,52,-90,544,462,-59,32,197,198,544,40,297", "568,-435,460,573,-86,100,18,681,-492,263,99,79,73,75,76,77,78,-85,263", "-85,74,80,-85,-264,63,64,65,297,51,56,-70,682,57,58,-426,53,54,61,696", "59,60,62,23,24,66,67,197,198,606,-83,22,28,27,89,88,90,91,100,259,17", "570,569,99,100,511,681,41,513,99,93,92,83,50,85,84,86,87,94,95,-494", "81,82,813,38,39,37,-87,100,-87,543,457,-87,99,499,100,100,543,543,469", "99,99,100,550,543,551,202,99,100,206,543,836,52,99,259,-86,-79,-86,747", "-77,-86,40,-78,197,198,627,264,746,100,18,681,-84,628,99,79,73,75,76", "77,78,100,100,-89,74,80,99,99,63,64,65,219,51,56,568,729,57,58,610,53", "54,61,219,59,60,62,250,251,66,67,-58,499,756,297,249,280,284,89,88,90", "91,-79,730,211,-77,568,-494,-78,568,259,41,609,207,93,92,83,50,85,84", "86,87,94,95,-85,81,82,693,38,39,37,263,100,-81,765,570,569,99,100,-79", "-89,-265,-77,99,713,-78,-79,568,-265,-77,202,-87,-78,206,-311,420,52", "491,610,741,511,-311,421,513,492,40,570,569,581,570,569,575,610,210", "762,197,198,-263,79,73,75,76,77,78,-263,-514,692,74,80,-495,100,609", "-514,-514,-514,99,56,-514,-514,-514,-265,-514,53,54,763,609,527,570", "569,571,-514,-514,-514,-311,422,511,490,530,515,219,-514,-514,-263,-514", "-514,-514,-514,-514,753,-263,511,766,-257,510,-495,-433,-263,194,693", "-257,502,-434,-433,511,195,691,513,503,-434,-514,-514,-514,-514,-514", "-514,-514,-514,-514,-514,-514,-514,-514,-514,767,881,-514,-514,-514", "627,-257,-514,882,259,-514,100,628,-257,530,-514,99,-514,-263,-514,770", "-514,-514,-514,-514,-514,-514,-514,-257,-514,-514,-514,719,193,692,-264", "422,-434,290,291,740,-263,-264,484,-514,-514,-514,-514,-263,-514,-498", "664,297,-495,-264,756,-514,-498,-498,-498,880,-264,664,-498,-498,-257", "-498,197,198,-423,-434,-432,-431,-76,-265,-498,-423,-434,-432,-431,-84", "-265,520,521,779,-498,-498,780,-498,-498,-498,-498,-498,426,-264,563", "329,328,332,331,-263,425,564,219,-429,-430,219,329,328,332,331,-429", "-430,-264,-498,-498,-498,-498,-498,-498,-498,-498,-498,-498,-498,-498", "-498,-498,-263,-434,-498,-498,-498,-265,596,-263,-263,-263,-498,256", "850,-263,-263,462,-263,-498,257,-498,219,-498,-498,-498,-498,-498,-498", "-498,386,-498,-498,-498,388,387,423,-263,-263,590,-263,-263,-263,-263", "-263,-426,-498,-498,-435,-78,591,-498,-426,495,496,485,-86,219,-498", "329,328,332,331,775,756,462,-263,-263,-263,-263,-263,-263,-263,-263", "-263,-263,-263,-263,-263,-263,-77,460,-263,-263,-263,850,599,-85,216", "-75,-263,-79,218,217,214,215,-83,-263,-87,-263,486,-263,-263,-263,-263", "-263,-263,-263,732,-263,493,-263,219,795,316,797,324,322,321,323,332", "331,332,331,-263,-263,800,-80,801,-263,329,328,332,331,-88,469,-263", "63,64,65,7,51,803,216,268,57,58,218,217,469,61,326,59,60,62,23,24,66", "67,329,328,332,331,22,28,27,89,88,90,91,734,532,17,324,322,321,323,586", "6,41,8,9,93,92,83,50,85,84,86,87,94,95,219,81,82,297,38,39,37,219,223", "228,229,230,225,227,235,236,231,232,-245,212,213,389,259,233,234,379", "36,552,-244,30,715,216,52,377,368,218,217,32,216,365,222,40,218,217", "214,215,226,224,220,18,221,500,689,814,79,73,75,76,77,78,815,816,259", "74,80,259,237,63,64,65,501,51,56,238,685,57,58,819,53,54,61,820,59,60", "62,250,251,66,67,649,551,822,344,249,280,284,89,88,90,91,-243,532,211", "324,322,321,323,586,826,41,219,677,93,92,83,50,85,84,86,87,94,95,674", "81,82,831,38,39,37,219,223,228,229,230,225,227,235,236,231,232,833,212", "213,672,662,233,234,259,202,514,517,206,805,806,52,807,94,95,-494,248", "216,839,222,40,218,217,214,215,226,224,220,210,221,297,657,843,79,73", "75,76,77,78,844,297,656,74,80,655,237,540,-217,539,854,253,56,63,64", "65,7,51,53,54,-246,57,58,524,289,855,61,857,59,60,62,23,24,66,67,527", "288,649,-495,22,28,27,89,88,90,91,589,505,17,102,103,104,105,106,6,41", "8,9,93,92,83,50,85,84,86,87,94,95,867,81,82,868,38,39,37,219,223,228", "229,230,225,227,235,236,231,232,238,212,213,-243,871,233,234,624,36", "873,874,30,800,649,52,801,297,528,588,32,216,641,222,40,218,217,214", "215,226,224,220,18,221,585,883,584,79,73,75,76,77,78,192,530,191,74", "80,889,237,63,64,65,7,51,56,639,190,57,58,655,53,54,61,189,59,60,62", "23,24,66,67,-70,638,578,188,22,28,27,89,88,90,91,899,800,17,102,103", "104,105,106,6,41,8,9,93,92,83,50,85,84,86,87,94,95,901,81,82,902,38", "39,37,219,223,228,229,230,225,227,235,236,231,232,637,212,213,238,96", "233,234,574,36,629,530,30,,,52,,,,,32,216,,222,40,218,217,214,215,226", "224,220,18,221,,,,79,73,75,76,77,78,,,,74,80,,237,-496,-496,-496,219", "-496,56,,,-496,-496,,53,54,-496,,-496,-496,-496,-496,-496,-496,-496", ",,,,-496,-496,-496,-496,-496,-496,-496,,216,-496,,,218,217,214,215,-496", ",,-496,-496,-496,-496,-496,-496,-496,-496,-496,-496,,-496,-496,,-496", "-496,-496,219,223,228,229,230,225,227,235,236,231,232,,212,213,,,233", "234,,-496,,,-496,-496,,-496,,,,,-496,216,-496,222,-496,218,217,214,215", "226,224,220,-496,221,,,,-496,-496,-496,-496,-496,-496,,,,-496,-496,", "237,,-217,,,-496,-496,63,64,65,7,51,-496,-496,,57,58,,,,61,,59,60,62", "23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230,225,227,235,236", "231,232,,212,213,,,233,234,,36,,,30,,,52,,,,,32,216,,222,40,218,217", "214,215,226,224,220,18,221,,,,79,73,75,76,77,78,,,,74,80,,237,63,64", "65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284", "89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,219,223,228,229,230,225,227,235,236,231,232,,212,213,,,233,234", ",202,,,206,,,52,,,,,615,216,246,222,40,218,217,214,215,226,224,220,210", "221,,,,79,73,75,76,77,78,,,,74,80,,237,63,64,65,7,51,56,,,57,58,,53", "54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41", "8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230", "225,227,235,236,231,232,,212,213,,,233,234,,36,,,30,,,52,,,,,32,216", ",222,40,218,217,214,215,226,224,220,18,221,,,,79,73,75,76,77,78,,,,74", "80,,237,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,", "22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,219,223,228,229,230,225,227,235,236,231,232,,212,213", ",,233,234,,202,,,206,207,,52,,,,,,216,,222,40,218,217,214,215,226,224", "220,18,221,,,,79,73,75,76,77,78,,,,74,80,,237,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,211,,,,,", ",41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229", "230,225,227,235,236,231,232,,212,213,,,233,234,,202,,,206,,,52,,,,,", "216,,222,40,218,217,214,215,226,224,220,210,221,,,,79,73,75,76,77,78", ",,,74,80,,237,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,219,223,228,229,230,225,227,235,236,231,232", ",212,213,,,233,234,,36,,,30,,,52,,,,,32,216,,222,40,218,217,214,215", "226,224,220,18,221,,,,79,73,75,76,77,78,,,,74,80,,237,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91", ",,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219", "223,228,229,230,225,227,235,236,231,232,,212,213,,,233,234,,202,,,206", ",,52,,,,,615,216,,222,40,218,217,214,215,226,224,220,210,221,,,,79,73", "75,76,77,78,,,,74,80,,237,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "250,251,66,67,,,,,249,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230,225,227,235,236", "231,232,,212,213,,,233,234,,202,,,206,,532,52,324,322,321,323,248,216", "246,222,40,218,217,214,215,226,224,220,210,221,,,,79,73,75,76,77,78", ",,,74,80,,237,607,535,,,253,56,63,64,65,538,51,53,54,,57,58,,,,61,,59", "60,62,250,251,66,67,,,,,249,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230,225,227", "235,236,231,232,,212,213,,,233,234,,202,,,206,,532,52,324,322,321,323", "248,216,246,222,40,218,217,214,215,226,224,220,210,221,,,,79,73,75,76", "77,78,,,,74,80,,237,,535,,,253,56,63,64,65,538,51,53,54,,57,58,,,,61", ",59,60,62,250,251,66,67,,,,,249,28,27,89,88,90,91,,,211,,,,,,,41,,,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230,225", "227,235,236,231,232,,212,213,,,233,234,,202,,,206,,532,52,324,322,321", "323,248,216,246,222,40,218,217,214,215,226,224,220,210,221,,,,79,73", "75,76,77,78,,,,74,80,,237,,535,,,253,56,63,64,65,772,51,53,54,,57,58", ",,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230", "225,227,235,236,231,232,,212,213,,,233,234,,202,,,206,,,52,,,,,,216", ",222,40,218,217,214,215,226,224,220,18,221,,,,79,73,75,76,77,78,,,,74", "80,,237,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,", ",,249,280,284,89,88,90,91,,,211,,,,,,,281,,,93,92,83,50,85,84,86,87", "94,95,,81,82,219,,,285,,,,,,,,,,,,,233,234,,,,,,862,,,206,,,52,,216", "-361,,,218,217,214,215,-361,-361,-361,,,-361,-361,-361,219,-361,,,79", "73,75,76,77,78,-361,-361,-361,74,80,,233,234,,,-361,-361,56,-361,-361", "-361,-361,-361,53,54,,216,,222,,218,217,214,215,,,220,,221,,,,,,-361", "-361,-361,-361,-361,-361,-361,-361,-361,-361,-361,-361,-361,-361,,,-361", "-361,-361,,,-361,,259,-361,,,,,-361,,-361,,-361,,-361,-361,-361,-361", "-361,-361,-361,,-361,-361,-361,,707,,324,322,321,323,,,,,,-361,-361", "-361,-361,,-361,-271,,,,,,-361,-271,-271,-271,,,-271,-271,-271,,-271", "219,,,326,701,,,,,-271,-271,329,328,332,331,,233,234,-271,-271,,-271", "-271,-271,-271,-271,,,,,,216,,222,,218,217,214,215,,,220,,221,,,,-271", "-271,-271,-271,-271,-271,-271,-271,-271,-271,-271,-271,-271,-271,,,-271", "-271,-271,,,-271,,268,-271,,,,,-271,,-271,,-271,,-271,-271,-271,-271", "-271,-271,-271,,-271,,-271,,,,,,,,,,,,,-271,-271,-271,-271,,-271,63", "64,65,7,51,,-271,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89", "88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,219,223,228,229,230,225,227,235,236,231,232,,212,213,,,233,234", ",36,,,270,,,52,,,,,32,216,,222,40,218,217,214,215,226,224,220,18,221", ",,,79,73,75,76,77,78,,,,74,80,,237,63,64,65,,51,56,,,57,58,,53,54,61", ",59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,281", ",,93,92,83,50,85,84,86,87,94,95,,81,82,219,,316,285,324,322,321,323", ",,,,,,,,233,234,,,,,,278,,,275,,,52,,216,,222,274,218,217,214,215,326", ",707,,324,322,321,323,329,328,332,331,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,326,59,60,62,250,251,66,67,329,328,332", "331,249,280,284,89,88,90,91,,,211,,,,,,,281,,,93,92,83,50,85,84,86,87", "94,95,,81,82,219,,707,285,324,322,321,323,,,,,,,,,233,234,,,,,,278,", ",206,,,52,,216,,222,,218,217,214,215,326,701,220,,221,,,,329,328,332", "331,79,73,75,76,77,78,,,,74,80,,,,287,,,,56,-497,-497,-497,,-497,53", "54,,-497,-497,,,,-497,,-497,-497,-497,-497,-497,-497,-497,,,,,-497,-497", "-497,-497,-497,-497,-497,,,-497,,,,,,,-497,,,-497,-497,-497,-497,-497", "-497,-497,-497,-497,-497,,-497,-497,,-497,-497,-497,219,-516,-516,-516", "-516,225,227,,,-516,-516,,,,,,233,234,,-497,,,-497,-497,,-497,,,,,-497", "216,-497,222,-497,218,217,214,215,226,224,220,-497,221,,,,-497,-497", "-497,-497,-497,-497,,,,-497,-497,,,,,,,-497,-497,63,64,65,7,51,-497", "-497,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17", ",,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,-516", "-516,-516,-516,225,227,,,-516,-516,,,,,,233,234,,36,,,30,,,52,,,,,32", "216,,222,40,218,217,214,215,226,224,220,18,221,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67", ",,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,219,-516,-516,-516,-516,225,227,,,-516,-516,", ",,,,233,234,,202,,,206,,,52,,,,,,216,,222,40,218,217,214,215,226,224", "220,210,221,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,-516,-516", "-516,-516,225,227,,,-516,-516,,,,,,233,234,,202,,,206,,,52,,,,,,216", ",222,40,218,217,214,215,226,224,220,210,221,,,,79,73,75,76,77,78,,,", "74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,", ",,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,219,,,,,,,,,,,,,,,,233,234,,202,,,206,,,52,,,,,", "216,,222,40,218,217,214,215,,,220,210,221,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,219,223,228,229,230,225,227,235,236,231,232,,-516,-516", ",,233,234,,202,,,206,,,52,,,,,,216,,222,40,218,217,214,215,226,224,220", "210,221,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,", ",,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229", "230,225,227,,,231,232,,,,,,233,234,,202,,,206,,,52,,,,,,216,,222,40", "218,217,214,215,226,224,220,210,221,,,,79,73,75,76,77,78,,,,74,80,,", "63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27", "89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82", ",38,39,37,219,223,228,229,230,225,227,235,236,231,232,,-516,-516,,,233", "234,,36,,,30,,,52,,,,,32,216,,222,40,218,217,214,215,226,224,220,18", "221,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61", ",59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,219,223,228,229,230", "225,227,235,,231,232,,,,,,233,234,,202,,,206,,,52,,,,,248,216,,222,40", "218,217,214,215,226,224,220,210,221,,,,79,73,75,76,77,78,,-258,,74,80", ",,,-258,-258,-258,253,56,-258,-258,-258,219,-258,53,54,,,,,,,,-258,-258", ",,,233,234,,,-258,-258,,-258,-258,-258,-258,-258,,,,216,,222,,218,217", "214,215,,,,,,,,,,,-258,-258,-258,-258,-258,-258,-258,-258,-258,-258", "-258,-258,-258,-258,,,-258,-258,-258,,,-258,,,-258,,,-258,,-258,,-258", ",-258,,-258,-258,-258,-258,-258,-258,-258,,-258,,-258,,,707,,324,322", "321,323,,,,,-258,-258,-258,-258,,-258,,,-258,-258,,,-258,63,64,65,,51", ",,,57,58,,,,61,326,59,60,62,23,24,66,67,329,328,332,331,22,28,27,89", "88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,219,-516,-516,-516,-516,225,227,,,-516,-516,,,,,,233,234,,202,,,206", ",,52,,,,,,216,,222,40,218,217,214,215,226,224,220,18,221,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250", "251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,219,-516,-516,-516,-516,225,227,,,-516", "-516,,,,,,233,234,,202,,,206,,,52,,,,,248,216,,222,40,218,217,214,215", "226,224,220,210,221,,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64", "65,,51,53,54,,57,58,,,,61,,59,60,62,250,251,66,67,,,,,249,280,284,89", "88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,248,,,,40,,,,,,,,210,,,,,79", "73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64,65,7,51,53,54,,57,58,,,,61", ",59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,", "30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64", "65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88", "90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23", "24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,", ",,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,", ",,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,", ",,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22", "28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18", ",,,,79,73,75,76,77,78,,,,74,80,100,,63,64,65,99,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,281", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,,316,285,324,322,321,323,,,", ",,,,,,,,,,,,278,,,30,,,52,,,,,32,,,,,326,,523,,,,,,329,328,332,331,79", "73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60", "62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52", ",,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51", "56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90", "91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,", ",,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250", "251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,248,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51", "56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90", "91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,", ",,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250", "251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91", ",,211,,,,,,,281,,,93,92,83,50,85,84,553,87,94,95,,81,82,,,316,285,324", "322,321,323,,,,,,,,,,,,,,,,554,,,206,,,52,,,,,,,,,,326,311,,,,,,,329", "328,332,331,79,73,75,76,77,78,,,,74,80,,,-491,-491,-491,,-491,56,,,-491", "-491,,53,54,-491,,-491,-491,-491,-491,-491,-491,-491,,-491,,,-491,-491", "-491,-491,-491,-491,-491,,,-491,,,,,,,-491,,,-491,-491,-491,-491,-491", "-491,-491,-491,-491,-491,,-491,-491,,-491,-491,-491,,,,,,,,,,,,,,,,", ",,,-491,,,-491,-491,,-491,,,,,-491,,-491,,-491,,,,,,,,-491,,-491,,,-491", "-491,-491,-491,-491,-491,,,,-491,-491,,,,,,,-491,-491,-492,-492,-492", ",-492,-491,-491,,-492,-492,,,,-492,,-492,-492,-492,-492,-492,-492,-492", ",-492,,,-492,-492,-492,-492,-492,-492,-492,,,-492,,,,,,,-492,,,-492", "-492,-492,-492,-492,-492,-492,-492,-492,-492,,-492,-492,,-492,-492,-492", ",,,,,,,,,,,,,,,,,,,-492,,,-492,-492,,-492,,,,,-492,,-492,,-492,,,,,", ",,-492,,-492,,,-492,-492,-492,-492,-492,-492,,,,-492,-492,,,,,,,-492", "-492,63,64,65,,51,-492,-492,,57,58,,,,61,,59,60,62,250,251,66,67,,,", ",249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,", ",,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53", "54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41", "8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,", ",,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,379,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22", "28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18", ",,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,", "59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206", ",,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,", ",,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58", ",53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6", "41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,", ",,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22", "28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210", ",,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,", "59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,281,", ",93,92,83,50,85,84,553,87,94,95,,81,82,,,,285,,,,,,,,,,,,,,,,,,,,554", ",,206,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89", "88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62", "23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,", ",,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51", "56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91", ",,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,", ",,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,396,,,", "40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,211,,", ",,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,", ",,,,,,,202,,,206,,,52,,,,,396,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,", ",,,22,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,", ",,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,", ",,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,", ",,,,,202,,,206,,,52,,,,,248,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,", ",,74,80,,,,,,,253,56,63,64,65,7,51,53,54,,57,58,,,,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32", ",,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,", ",,,22,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,", ",,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202", ",,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89", "88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62", "23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50", "85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,", ",,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51", "56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91", ",,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,", ",,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,", "53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,", ",,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,", ",,,,,,,,202,,,206,,,52,,,,,248,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78", ",,,74,80,,,,,,,253,56,63,64,65,,51,53,54,,57,58,,,,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,", "40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,,,52,,,,,248,,,,40,,,,,,,,210,,,,,79,73,75,76,77", "78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66", "67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,", "40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,", "41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,", ",,,202,,,206,,428,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,396,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,", "210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54", "61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,281,,,93,92,83,50,85,84,86,87,94,95", ",81,82,,,,285,,,,,,,,,,,,,,,,,,,,278,,,275,,,52,,,,,,,,,,,,,,,,,,,,", ",79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,", ",206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284", "89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,615,,246,,40,,,,,,,,210", ",,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64,65,,51,53,54,,57,58", ",,,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,", ",,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,", ",,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74", "80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249", "280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,", "81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,246,,40,,,,", ",,,210,,,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64,65,,51,53,54", ",57,58,,,,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67", ",,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,281,,,93,92,83,50,85,84,86,87,94,95,,81,82,,,,285,,,,,,,,,,,,", ",,,,,,,278,,,275,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28", "27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81", "82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18", ",,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61", ",59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,", "30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64", "65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,28,27,89", "88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,248,,246,,40,,,,,,,,210,,,", ",79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64,65,,51,53,54,,57,58,", ",,61,,59,60,62,250,251,66,67,,,,,249,28,27,89,88,90,91,,,211,,,,,,,41", ",,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,", "202,,,206,,,478,,,,,248,,246,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,", ",74,80,,,,,,,253,56,63,64,65,,51,53,54,,57,58,,,,61,,59,60,62,250,251", "66,67,,,,,249,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,482,52,,,,,248", ",246,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64", "65,,51,53,54,,57,58,,,,61,,59,60,62,250,251,66,67,,,,,249,28,27,89,88", "90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,615,,246,,40,,,,,,,,210,,,,,79", "73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64,65,7,51,53,54,,57,58,,,,61", ",59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93", "92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,", "270,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89", "88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,", ",52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", "7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250", "251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,281,,,93,92,83,50", "85,84,86,87,94,95,,81,82,,,,285,,,,,,,,,,,,,,,,,,,,278,,,206,,,52,,", ",,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80,,,,488,,,,56,63,64,65", "7,51,53,54,,57,58,,,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37", ",,,,,,,,,,,,,,,,,,,36,,,270,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250", "251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,-263,,74,80,,,,-263,-263", "-263,,56,-263,-263,-263,,-263,53,54,,,,,,,,-263,-263,,,,,,,,-263,-263", ",-263,-263,-263,-263,-263,,,,,,,,,,,,,,,,,,,,,,-263,-263,-263,-263,-263", "-263,-263,-263,-263,-263,-263,-263,-263,-263,,,-263,-263,-263,,599,-263", ",,-263,,,-263,,-263,,-263,,-263,,-263,-263,-263,-263,-263,-263,-263", ",-263,,-263,,,,,,,,,,,,,-263,-263,-263,-263,,-263,-498,,,,-88,,-263", "-498,-498,-498,,,-498,-498,-498,,-498,,,,,,,,,-498,-498,-498,,,,,,,", "-498,-498,,-498,-498,-498,-498,-498,,,,,,,,,,,,,,,,,,,,,,-498,-498,-498", "-498,-498,-498,-498,-498,-498,-498,-498,-498,-498,-498,,,-498,-498,-498", ",731,-498,,,-498,,,-498,,-498,,-498,,-498,,-498,-498,-498,-498,-498", "-498,-498,,-498,-498,-498,,,,,,,,,,,,,-498,-498,-498,-498,,-498,,63", "64,65,-86,51,-498,,,57,58,,,,61,,59,60,62,250,251,66,67,,,,,249,280", "284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82", ",38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,", ",,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,", ",52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,", ",,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,", "40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57", "58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67", ",,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40", ",,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58", ",53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211", ",,,,,,281,,,93,92,83,50,85,84,86,87,94,95,,81,82,,,,285,,,,,,,,,,,,", ",,,,,,,278,,,275,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80", ",,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28", "27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82", ",38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,", ",79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59", "60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,", ",52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,", "51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90", "91,,,17,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,", ",,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76", "77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84", "86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32", ",,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,", "57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17", ",,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,", ",,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78", ",,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67", ",,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87", "94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,505,,52,,,,,,,,", "40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57", "58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,", ",,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,", ",,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,", ",,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,", ",,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94", "95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,", ",,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53", "54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,", ",,281,,,93,92,83,50,85,84,86,87,94,95,,81,82,,,,285,,,,,,,,,,,,,,,,", ",,,668,,,206,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75,76,77,78,,,,74,80,,", "63,64,65,7,51,56,,,57,58,,53,54,61,,59,60,62,23,24,66,67,,,,,22,28,27", "89,88,90,91,,,17,,,,,,6,41,8,9,93,92,83,50,85,84,86,87,94,95,,81,82", ",38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30,,,52,,,,,32,,,,40,,,,,,,,18,,,", ",79,73,75,76,77,78,,,,74,80,,,63,64,65,7,51,56,,,57,58,,53,54,61,,59", "60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,6,41,8,9,93,92", "83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,36,,,30", ",,52,,,,,32,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89", "88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,615,,,,40,,,,,,,,210,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,", ",52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56", "63,64,65,,51,53,54,,57,58,,,,61,,59,60,62,250,251,66,67,,,,,249,280", "284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82", ",38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,615,,,,40,,,,,,,,210", ",,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63,64,65,,51,53,54,,57,58", ",,,61,,59,60,62,23,24,66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,", ",93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202", ",,206,,,52,,,,,,,,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63", "64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284", "89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38", "39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79", "73,75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62", "250,251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83", "50,85,84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,", ",52,,,,,,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65", ",51,56,,,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89", "88,90,91,,,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39", "37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,,,,,,,,40,,,,,,,,210,,,,,79,73", "75,76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,250", "251,66,67,,,,,249,280,284,89,88,90,91,,,211,,,,,,,41,,,93,92,83,50,85", "84,86,87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,,52,,", ",,248,,,,40,,,,,,,,210,,,,,79,73,75,76,77,78,,,,74,80,,,,,,,253,56,63", "64,65,,51,53,54,,57,58,,,,61,,59,60,62,250,251,66,67,,,,,249,280,284", "89,88,90,91,,,211,,,,,,,281,,,93,92,83,50,85,84,86,87,94,95,,81,82,", ",,285,,,,,,,,,,,,,,,,,,,,278,,,275,,,52,,,,,,,,,,,,,,,,,,,,,,79,73,75", "76,77,78,,,,74,80,,,63,64,65,,51,56,,,57,58,,53,54,61,,59,60,62,23,24", "66,67,,,,,22,28,27,89,88,90,91,,,17,,,,,,,41,,,93,92,83,50,85,84,86", "87,94,95,,81,82,,38,39,37,,,,,,,,,,,,,,,,,,,,202,,,206,,633,52,,,,,", ",246,,40,,,,,,,,18,,,,,79,73,75,76,77,78,,,,74,80,,,63,64,65,,51,56", ",,57,58,,53,54,61,,59,60,62,250,251,66,67,,,,,249,280,284,89,88,90,91", ",,211,,,,,,,41,,,93,92,83,50,85,84,86,87,94,95,,81,82,,38,39,37,,,,", ",,,,,,,,,,,,,,,202,,,206,,,52,,,,,718,,,,40,,,,,,,,210,,,,,79,73,75", "76,77,78,,-514,,74,80,,,,-514,-514,-514,,56,-514,-514,-514,,-514,53", "54,,,,,,,,-514,,,,,,,,,-514,-514,,-514,-514,-514,-514,-514,,,,,,,,,", ",,-514,,,,,,,-514,-514,-514,,,-514,-514,-514,,-514,,,,,-514,,,,,-514", ",-514,,,,,259,-514,-514,-514,,-514,-514,-514,-514,-514,,,,,,,,,,,,,-514", ",,,,,,,,,,,,-514,,-514,,,-514,,-514,,,,,,,-514,,,,,259,-514,,,,,,,,", ",,,,,,,,,,,,-514,,,,,,,,,,,,,-514,,-514,,,-514,153,164,154,177,150,170", "160,159,,,175,158,157,152,178,,,162,151,165,169,171,163,156,,,172,179", "174,173,166,176,161,149,168,167,180,181,182,183,184,148,155,146,147", "144,145,109,111,,,110,,,,,,,,137,138,,135,119,120,121,143,124,126,,", "122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,,,141,185,153,164,154,177,150,170,160,159,,80,175", "158,157,152,178,,,162,151,165,169,171,163,156,,,172,179,174,173,166", "176,161,149,168,167,180,181,182,183,184,148,155,146,147,144,145,109", "111,,,110,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139", "140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116", "142,117,,,141,185,153,164,154,177,150,170,160,159,,80,175,158,157,152", "178,,,162,151,165,169,171,163,156,,,172,179,174,173,166,176,161,149", "168,167,180,181,182,183,184,148,155,146,147,144,145,109,111,,,110,,", ",,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128", ",,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117,,,141", "185,153,164,154,177,150,170,160,159,,80,175,158,157,152,178,,,162,151", "165,169,171,163,156,,,172,179,174,173,166,176,161,149,168,167,180,181", "182,183,184,148,155,146,147,144,145,109,111,108,,110,,,,,,,,137,138", ",135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132", "131,,118,136,134,133,129,130,125,123,116,142,117,,,141,185,153,164,154", "177,150,170,160,159,,80,175,158,157,152,178,,,162,151,165,169,171,163", "156,,,172,179,174,173,166,176,161,149,168,167,180,181,182,183,184,148", "155,146,147,144,145,109,111,,,110,,,,,,,,137,138,,135,119,120,121,143", "124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133", "129,130,125,123,116,142,117,,,141,153,164,154,177,150,170,160,159,,", "175,158,157,152,178,,,162,151,165,169,171,163,156,,,172,179,174,352", "351,353,350,149,168,167,180,181,182,183,184,148,155,146,147,348,349", "346,111,85,84,347,87,,,,,,,137,138,,135,119,120,121,143,124,126,,,122", ",,,,139,140,127,128,,,,,,358,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,,,141,153,164,154,177,150,170,160,159,,,175,158", "157,152,178,,,162,151,165,169,171,163,156,,,172,179,174,173,166,176", "161,149,168,167,180,181,182,183,184,148,155,146,147,144,145,109,111", "375,374,110,376,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,", ",139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123", "116,142,117,,,141,153,164,154,177,150,170,160,159,,,175,158,157,152", "178,,,162,151,165,169,171,163,156,,,172,179,174,173,166,176,161,149", "168,167,180,181,182,183,184,148,155,146,147,144,145,109,111,375,374", "110,376,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140", "127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142", "117,643,408,141,,644,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122", ",,,,139,140,127,128,,,,,,259,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,894,408,141,,895,,,,,,,,137,138,,135,119,120,121", "143,124,126,,,122,,,,,139,140,127,128,,,,,,259,,,,,,,132,131,,118,136", "134,133,129,130,125,123,116,142,117,896,414,141,,897,,,,,,,,137,138", ",135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132", "131,,118,136,134,133,129,130,125,123,116,142,117,404,408,141,,405,,", ",,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128", ",,,,,259,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117", "602,414,141,,603,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,", ",,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125", "123,116,142,117,466,408,141,,467,,,,,,,,137,138,,135,119,120,121,143", "124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134,133", "129,130,125,123,116,142,117,600,408,141,,601,,,,,,,,137,138,,135,119", "120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,259,,,,,,,132,131", ",118,136,134,133,129,130,125,123,116,142,117,785,414,141,,828,,,,,,", ",137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,", ",,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117,466,408", "141,,467,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140", "127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142", "117,600,408,141,,601,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122", ",,,,139,140,127,128,,,,,,259,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,602,414,141,,603,,,,,,,,137,138,,135,119,120,121", "143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134", "133,129,130,125,123,116,142,117,466,408,141,,467,,,,,,,,137,138,,135", "119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131", ",118,136,134,133,129,130,125,123,116,142,117,466,408,141,,467,,,,,,", ",137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,", ",,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142,117,785,414", "141,,783,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122,,,,,139,140", "127,128,,,,,,,,,,,,,132,131,,118,136,134,133,129,130,125,123,116,142", "117,466,408,141,,467,,,,,,,,137,138,,135,119,120,121,143,124,126,,,122", ",,,,139,140,127,128,,,,,,259,,,,,,,132,131,,118,136,134,133,129,130", "125,123,116,142,117,410,414,141,,412,,,,,,,,137,138,,135,119,120,121", "143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131,,118,136,134", "133,129,130,125,123,116,142,117,646,414,141,,647,,,,,,,,137,138,,135", "119,120,121,143,124,126,,,122,,,,,139,140,127,128,,,,,,,,,,,,,132,131", ",118,136,134,133,129,130,125,123,116,142,117,,,141"];

      racc_action_table = arr = (($a = $opal.Object._scope.Array) == null ? $opal.cm('Array') : $a).$new(22164, nil);

      idx = 0;

      ($a = ($b = clist).$each, $a._p = (TMP_1 = function(str) {

        var self = TMP_1._s || this, TMP_2, $a, $b;
        if (str == null) str = nil;
        
        return ($a = ($b = str.$split(",", -1)).$each, $a._p = (TMP_2 = function(i) {

          var self = TMP_2._s || this, $a;
          if (i == null) i = nil;
          
          if (($a = i['$empty?']()) === false || $a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, TMP_2._s = self, TMP_2), $a).call($b)
      }, TMP_1._s = Grammar, TMP_1), $a).call($b);

      clist = ["0,0,0,0,0,894,360,546,0,0,299,299,849,0,369,0,0,0,0,0,0,0,14,553,282", "469,0,0,0,0,0,0,0,55,558,0,676,676,565,565,203,0,0,0,0,0,0,0,0,0,0,0", "0,0,0,642,0,0,469,0,0,0,689,14,71,782,360,360,360,689,14,351,71,553", "895,336,369,869,351,869,553,0,335,825,0,553,282,0,203,866,247,638,0", "427,427,781,0,299,364,201,244,364,896,546,0,546,553,282,546,0,0,0,0", "0,0,894,55,894,0,0,894,689,358,358,358,565,358,0,638,547,358,358,553", "0,0,358,558,358,358,358,358,358,358,358,15,15,427,201,358,358,358,358", "358,358,358,558,645,358,364,364,558,782,307,782,358,307,782,358,358", "358,358,358,358,358,358,358,358,896,358,358,732,358,358,358,895,336", "895,336,243,895,336,423,335,825,335,825,258,335,825,866,340,866,340", "358,866,781,358,781,781,358,781,648,896,644,896,634,643,896,358,646", "698,698,473,26,631,547,358,547,732,473,547,358,358,358,358,358,358,788", "702,423,358,358,788,702,396,396,396,651,396,358,576,600,396,396,479", "358,358,396,652,396,396,396,396,396,396,396,269,289,654,473,396,396", "396,396,396,396,396,644,601,396,643,371,646,646,366,26,396,479,211,396", "396,396,396,396,396,396,396,396,396,600,396,396,667,396,396,396,26,698", "289,667,576,576,698,3,644,289,751,643,3,576,646,644,362,751,643,396", "601,646,396,42,200,396,277,455,626,658,42,200,658,277,396,371,371,371", "366,366,366,480,396,660,653,653,647,396,396,396,396,396,396,647,406", "667,396,396,647,697,455,406,406,406,697,396,406,406,406,751,406,396", "396,661,480,664,362,362,362,406,406,406,42,200,304,277,666,304,436,406", "406,783,406,406,406,406,406,653,783,301,668,279,301,783,348,647,13,556", "279,292,860,348,302,13,556,302,292,860,406,406,406,406,406,406,406,406", "406,406,406,406,406,406,669,861,406,406,406,744,863,406,861,406,406", "339,744,863,670,406,339,406,783,406,673,406,406,406,406,406,406,406", "279,406,406,406,589,13,556,883,292,860,37,37,625,897,883,271,406,406", "406,406,897,406,410,767,744,897,493,678,406,410,410,410,861,493,524", "410,410,863,410,334,334,346,276,349,350,589,902,410,346,276,349,350", "589,902,310,310,684,410,410,686,410,410,410,410,410,205,883,355,767", "767,767,767,897,204,355,435,352,353,434,524,524,524,524,352,353,493", "410,410,410,410,410,410,410,410,410,410,410,410,410,410,412,276,410", "410,410,902,410,412,412,412,410,25,874,412,412,617,412,410,25,410,433", "410,410,410,410,410,410,410,108,410,410,410,108,108,202,412,412,404", "412,412,412,412,412,347,410,410,35,410,405,410,347,285,285,272,410,450", "410,874,874,874,874,898,898,614,412,412,412,412,412,412,412,412,412", "412,412,412,412,412,404,612,412,412,412,797,412,404,450,35,412,405,450", "450,450,450,35,412,405,412,273,412,412,412,412,412,412,412,604,412,278", "412,432,703,609,704,609,609,609,609,530,530,800,800,412,412,705,412", "707,412,797,797,797,797,412,597,412,884,884,884,884,884,710,432,280", "884,884,432,432,592,884,609,884,884,884,884,884,884,884,609,609,609", "609,884,884,884,884,884,884,884,609,772,884,772,772,772,772,605,884", "884,884,884,884,884,884,884,884,884,884,884,884,884,431,884,884,281", "884,884,884,605,605,605,605,605,605,605,605,605,605,605,717,605,605", "186,284,605,605,341,884,342,587,884,580,431,884,96,78,431,431,884,605", "77,605,884,605,605,605,605,605,605,605,884,605,290,554,735,884,884,884", "884,884,884,736,739,742,884,884,743,605,880,880,880,291,880,884,745", "549,880,880,748,884,884,880,749,880,880,880,880,880,880,880,750,548", "754,63,880,880,880,880,880,880,880,757,538,880,538,538,538,538,394,758", "880,294,542,880,880,880,880,880,880,880,880,880,880,537,880,880,773", "880,880,880,394,394,394,394,394,394,394,394,394,394,394,776,394,394", "533,522,394,394,411,880,303,305,880,711,711,880,711,711,711,785,880", "394,786,394,880,394,394,394,394,394,394,394,880,394,41,508,791,880,880", "880,880,880,880,792,793,507,880,880,506,394,333,394,330,809,880,880", "878,878,878,878,878,880,880,810,878,878,315,36,817,878,818,878,878,878", "878,878,878,878,316,34,497,828,878,878,878,878,878,878,878,403,494,878", "5,5,5,5,5,878,878,878,878,878,878,878,878,878,878,878,878,878,878,834", "878,878,835,878,878,878,812,812,812,812,812,812,812,812,812,812,812", "20,812,812,399,840,812,812,471,878,845,846,878,847,640,878,850,472,318", "397,878,812,489,812,878,812,812,812,812,812,812,812,878,812,391,862", "390,878,878,878,878,878,878,12,319,11,878,878,872,812,870,870,870,870", "870,878,487,10,870,870,879,878,878,870,9,870,870,870,870,870,870,870", "484,483,368,8,870,870,870,870,870,870,870,888,890,870,378,378,378,378", "378,870,870,870,870,870,870,870,870,870,870,870,870,870,870,891,870", "870,893,870,870,870,721,721,721,721,721,721,721,721,721,721,721,481", "721,721,475,1,721,721,365,870,474,829,870,,,870,,,,,870,721,,721,870", "721,721,721,721,721,721,721,870,721,,,,870,870,870,870,870,870,,,,870", "870,,721,414,414,414,451,414,870,,,414,414,,870,870,414,,414,414,414", "414,414,414,414,,,,,414,414,414,414,414,414,414,,451,414,,,451,451,451", "451,414,,,414,414,414,414,414,414,414,414,414,414,,414,414,,414,414", "414,630,630,630,630,630,630,630,630,630,630,630,,630,630,,,630,630,", "414,,,414,414,,414,,,,,414,630,414,630,414,630,630,630,630,630,630,630", "414,630,,,,414,414,414,414,414,414,,,,414,414,,630,,630,,,414,414,859", "859,859,859,859,414,414,,859,859,,,,859,,859,859,859,859,859,859,859", ",,,,859,859,859,859,859,859,859,,,859,,,,,,859,859,859,859,859,859,859", "859,859,859,859,859,859,859,,859,859,,859,859,859,723,723,723,723,723", "723,723,723,723,723,723,,723,723,,,723,723,,859,,,859,,,859,,,,,859", "723,,723,859,723,723,723,723,723,723,723,859,723,,,,859,859,859,859", "859,859,,,,859,859,,723,857,857,857,,857,859,,,857,857,,859,859,857", ",857,857,857,857,857,857,857,,,,,857,857,857,857,857,857,857,,,857,", ",,,,,857,,,857,857,857,857,857,857,857,857,857,857,,857,857,,857,857", "857,726,726,726,726,726,726,726,726,726,726,726,,726,726,,,726,726,", "857,,,857,,,857,,,,,857,726,857,726,857,726,726,726,726,726,726,726", "857,726,,,,857,857,857,857,857,857,,,,857,857,,726,842,842,842,842,842", "857,,,842,842,,857,857,842,,842,842,842,842,842,842,842,,,,,842,842", "842,842,842,842,842,,,842,,,,,,842,842,842,842,842,842,842,842,842,842", "842,842,842,842,,842,842,,842,842,842,650,650,650,650,650,650,650,650", "650,650,650,,650,650,,,650,650,,842,,,842,,,842,,,,,842,650,,650,842", "650,650,650,650,650,650,650,842,650,,,,842,842,842,842,842,842,,,,842", "842,,650,17,17,17,,17,842,,,17,17,,842,842,17,,17,17,17,17,17,17,17", ",,,,17,17,17,17,17,17,17,,,17,,,,,,,17,,,17,17,17,17,17,17,17,17,17", "17,,17,17,,17,17,17,241,241,241,241,241,241,241,241,241,241,241,,241", "241,,,241,241,,17,,,17,17,,17,,,,,,241,,241,17,241,241,241,241,241,241", "241,17,241,,,,17,17,17,17,17,17,,,,17,17,,241,18,18,18,,18,17,,,18,18", ",17,17,18,,18,18,18,18,18,18,18,,,,,18,18,18,18,18,18,18,,,18,,,,,,", "18,,,18,18,18,18,18,18,18,18,18,18,,18,18,,18,18,18,728,728,728,728", "728,728,728,728,728,728,728,,728,728,,,728,728,,18,,,18,,,18,,,,,,728", ",728,18,728,728,728,728,728,728,728,18,728,,,,18,18,18,18,18,18,,,,18", "18,,728,837,837,837,837,837,18,,,837,837,,18,18,837,,837,837,837,837", "837,837,837,,,,,837,837,837,837,837,837,837,,,837,,,,,,837,837,837,837", "837,837,837,837,837,837,837,837,837,837,,837,837,,837,837,837,733,733", "733,733,733,733,733,733,733,733,733,,733,733,,,733,733,,837,,,837,,", "837,,,,,837,733,,733,837,733,733,733,733,733,733,733,837,733,,,,837", "837,837,837,837,837,,,,837,837,,733,836,836,836,,836,837,,,836,836,", "837,837,836,,836,836,836,836,836,836,836,,,,,836,836,836,836,836,836", "836,,,836,,,,,,,836,,,836,836,836,836,836,836,836,836,836,836,,836,836", ",836,836,836,417,417,417,417,417,417,417,417,417,417,417,,417,417,,", "417,417,,836,,,836,,,836,,,,,836,417,,417,836,417,417,417,417,417,417", "417,836,417,,,,836,836,836,836,836,836,,,,836,836,,417,22,22,22,,22", "836,,,22,22,,836,836,22,,22,22,22,22,22,22,22,,,,,22,22,22,22,22,22", "22,,,22,,,,,,,22,,,22,22,22,22,22,22,22,22,22,22,,22,22,,22,22,22,454", "454,454,454,454,454,454,454,454,454,454,,454,454,,,454,454,,22,,,22", ",535,22,535,535,535,535,22,454,22,454,22,454,454,454,454,454,454,454", "22,454,,,,22,22,22,22,22,22,,,,22,22,,454,454,535,,,22,22,23,23,23,535", "23,22,22,,23,23,,,,23,,23,23,23,23,23,23,23,,,,,23,23,23,23,23,23,23", ",,23,,,,,,,23,,,23,23,23,23,23,23,23,23,23,23,,23,23,,23,23,23,402,402", "402,402,402,402,402,402,402,402,402,,402,402,,,402,402,,23,,,23,,326", "23,326,326,326,326,23,402,23,402,23,402,402,402,402,402,402,402,23,402", ",,,23,23,23,23,23,23,,,,23,23,,402,,326,,,23,23,24,24,24,326,24,23,23", ",24,24,,,,24,,24,24,24,24,24,24,24,,,,,24,24,24,24,24,24,24,,,24,,,", ",,,24,,,24,24,24,24,24,24,24,24,24,24,,24,24,,24,24,24,19,19,19,19,19", "19,19,19,19,19,19,,19,19,,,19,19,,24,,,24,,674,24,674,674,674,674,24", "19,24,19,24,19,19,19,19,19,19,19,24,19,,,,24,24,24,24,24,24,,,,24,24", ",19,,674,,,24,24,832,832,832,674,832,24,24,,832,832,,,,832,,832,832", "832,832,832,832,832,,,,,832,832,832,832,832,832,832,,,832,,,,,,,832", ",,832,832,832,832,832,832,832,832,832,832,,832,832,,832,832,832,716", "716,716,716,716,716,716,716,716,716,716,,716,716,,,716,716,,832,,,832", ",,832,,,,,,716,,716,832,716,716,716,716,716,716,716,832,716,,,,832,832", "832,832,832,832,,,,832,832,,716,826,826,826,,826,832,,,826,826,,832", "832,826,,826,826,826,826,826,826,826,,,,,826,826,826,826,826,826,826", ",,826,,,,,,,826,,,826,826,826,826,826,826,826,826,826,826,,826,826,439", ",,826,,,,,,,,,,,,,439,439,,,,,,826,,,826,,,826,,439,27,,,439,439,439", "439,27,27,27,,,27,27,27,443,27,,,826,826,826,826,826,826,27,27,27,826", "826,,443,443,,,27,27,826,27,27,27,27,27,826,826,,443,,443,,443,443,443", "443,,,443,,443,,,,,,27,27,27,27,27,27,27,27,27,27,27,27,27,27,,,27,27", "27,,,27,,27,27,,,,,27,,27,,27,,27,27,27,27,27,27,27,,27,27,27,,561,", "561,561,561,561,,,,,,27,27,27,27,,27,28,,,,,,27,28,28,28,,,28,28,28", ",28,444,,,561,561,,,,,28,28,561,561,561,561,,444,444,28,28,,28,28,28", "28,28,,,,,,444,,444,,444,444,444,444,,,444,,444,,,,28,28,28,28,28,28", "28,28,28,28,28,28,28,28,,,28,28,28,,,28,,28,28,,,,,28,,28,,28,,28,28", "28,28,28,28,28,,28,,28,,,,,,,,,,,,,28,28,28,28,,28,30,30,30,30,30,,28", ",30,30,,,,30,,30,30,30,30,30,30,30,,,,,30,30,30,30,30,30,30,,,30,,,", ",,30,30,30,30,30,30,30,30,30,30,30,30,30,30,,30,30,,30,30,30,504,504", "504,504,504,504,504,504,504,504,504,,504,504,,,504,504,,30,,,30,,,30", ",,,,30,504,,504,30,504,504,504,504,504,504,504,30,504,,,,30,30,30,30", "30,30,,,,30,30,,504,31,31,31,,31,30,,,31,31,,30,30,31,,31,31,31,31,31", "31,31,,,,,31,31,31,31,31,31,31,,,31,,,,,,,31,,,31,31,31,31,31,31,31", "31,31,31,,31,31,438,,528,31,528,528,528,528,,,,,,,,,438,438,,,,,,31", ",,31,,,31,,438,,438,31,438,438,438,438,528,,701,,701,701,701,701,528", "528,528,528,31,31,31,31,31,31,,,,31,31,,,32,32,32,,32,31,,,32,32,,31", "31,32,701,32,32,32,32,32,32,32,701,701,701,701,32,32,32,32,32,32,32", ",,32,,,,,,,32,,,32,32,32,32,32,32,32,32,32,32,,32,32,442,,853,32,853", "853,853,853,,,,,,,,,442,442,,,,,,32,,,32,,,32,,442,,442,,442,442,442", "442,853,853,442,,442,,,,853,853,853,853,32,32,32,32,32,32,,,,32,32,", ",,32,,,,32,415,415,415,,415,32,32,,415,415,,,,415,,415,415,415,415,415", "415,415,,,,,415,415,415,415,415,415,415,,,415,,,,,,,415,,,415,415,415", "415,415,415,415,415,415,415,,415,415,,415,415,415,445,445,445,445,445", "445,445,,,445,445,,,,,,445,445,,415,,,415,415,,415,,,,,415,445,415,445", "415,445,445,445,445,445,445,445,415,445,,,,415,415,415,415,415,415,", ",,415,415,,,,,,,415,415,822,822,822,822,822,415,415,,822,822,,,,822", ",822,822,822,822,822,822,822,,,,,822,822,822,822,822,822,822,,,822,", ",,,,822,822,822,822,822,822,822,822,822,822,822,822,822,822,,822,822", ",822,822,822,449,449,449,449,449,449,449,,,449,449,,,,,,449,449,,822", ",,822,,,822,,,,,822,449,,449,822,449,449,449,449,449,449,449,822,449", ",,,822,822,822,822,822,822,,,,822,822,,,813,813,813,,813,822,,,813,813", ",822,822,813,,813,813,813,813,813,813,813,,,,,813,813,813,813,813,813", "813,,,813,,,,,,,813,,,813,813,813,813,813,813,813,813,813,813,,813,813", ",813,813,813,446,446,446,446,446,446,446,,,446,446,,,,,,446,446,,813", ",,813,,,813,,,,,,446,,446,813,446,446,446,446,446,446,446,813,446,,", ",813,813,813,813,813,813,,,,813,813,,,801,801,801,,801,813,,,801,801", ",813,813,801,,801,801,801,801,801,801,801,,,,,801,801,801,801,801,801", "801,,,801,,,,,,,801,,,801,801,801,801,801,801,801,801,801,801,,801,801", ",801,801,801,447,447,447,447,447,447,447,,,447,447,,,,,,447,447,,801", ",,801,,,801,,,,,,447,,447,801,447,447,447,447,447,447,447,801,447,,", ",801,801,801,801,801,801,,,,801,801,,,38,38,38,,38,801,,,38,38,,801", "801,38,,38,38,38,38,38,38,38,,,,,38,38,38,38,38,38,38,,,38,,,,,,,38", ",,38,38,38,38,38,38,38,38,38,38,,38,38,,38,38,38,441,,,,,,,,,,,,,,,", "441,441,,38,,,38,,,38,,,,,,441,,441,38,441,441,441,441,,,441,38,441", ",,,38,38,38,38,38,38,,,,38,38,,,39,39,39,,39,38,,,39,39,,38,38,39,,39", "39,39,39,39,39,39,,,,,39,39,39,39,39,39,39,,,39,,,,,,,39,,,39,39,39", "39,39,39,39,39,39,39,,39,39,,39,39,39,429,429,429,429,429,429,429,429", "429,429,429,,429,429,,,429,429,,39,,,39,,,39,,,,,,429,,429,39,429,429", "429,429,429,429,429,39,429,,,,39,39,39,39,39,39,,,,39,39,,,40,40,40", ",40,39,,,40,40,,39,39,40,,40,40,40,40,40,40,40,,,,,40,40,40,40,40,40", "40,,,40,,,,,,,40,,,40,40,40,40,40,40,40,40,40,40,,40,40,,40,40,40,452", "452,452,452,452,452,452,,,452,452,,,,,,452,452,,40,,,40,,,40,,,,,,452", ",452,40,452,452,452,452,452,452,452,40,452,,,,40,40,40,40,40,40,,,,40", "40,,,787,787,787,787,787,40,,,787,787,,40,40,787,,787,787,787,787,787", "787,787,,,,,787,787,787,787,787,787,787,,,787,,,,,,787,787,787,787,787", "787,787,787,787,787,787,787,787,787,,787,787,,787,787,787,430,430,430", "430,430,430,430,430,430,430,430,,430,430,,,430,430,,787,,,787,,,787", ",,,,787,430,,430,787,430,430,430,430,430,430,430,787,430,,,,787,787", "787,787,787,787,,,,787,787,,,422,422,422,,422,787,,,422,422,,787,787", "422,,422,422,422,422,422,422,422,,,,,422,422,422,422,422,422,422,,,422", ",,,,,,422,,,422,422,422,422,422,422,422,422,422,422,,422,422,,422,422", "422,453,453,453,453,453,453,453,453,,453,453,,,,,,453,453,,422,,,422", ",,422,,,,,422,453,,453,422,453,453,453,453,453,453,453,422,453,,,,422", "422,422,422,422,422,,50,,422,422,,,,50,50,50,422,422,50,50,50,437,50", "422,422,,,,,,,,50,50,,,,437,437,,,50,50,,50,50,50,50,50,,,,437,,437", ",437,437,437,437,,,,,,,,,,,50,50,50,50,50,50,50,50,50,50,50,50,50,50", ",,50,50,50,,,50,,,50,,,50,,50,,50,,50,,50,50,50,50,50,50,50,,50,,50", ",,795,,795,795,795,795,,,,,50,50,50,50,,50,,,50,50,,,50,52,52,52,,52", ",,,52,52,,,,52,795,52,52,52,52,52,52,52,795,795,795,795,52,52,52,52", "52,52,52,,,52,,,,,,,52,,,52,52,52,52,52,52,52,52,52,52,,52,52,,52,52", "52,448,448,448,448,448,448,448,,,448,448,,,,,,448,448,,52,,,52,,,52", ",,,,,448,,448,52,448,448,448,448,448,448,448,52,448,,,,52,52,52,52,52", "52,,,,52,52,,,53,53,53,,53,52,,,53,53,,52,52,53,,53,53,53,53,53,53,53", ",,,,53,53,53,53,53,53,53,,,53,,,,,,,53,,,53,53,53,53,53,53,53,53,53", "53,,53,53,,53,53,53,440,440,440,440,440,440,440,,,440,440,,,,,,440,440", ",53,,,53,,,53,,,,,53,440,,440,53,440,440,440,440,440,440,440,53,440", ",,,53,53,53,53,53,53,,,,53,53,,,,,,,53,53,54,54,54,,54,53,53,,54,54", ",,,54,,54,54,54,54,54,54,54,,,,,54,54,54,54,54,54,54,,,54,,,,,,,54,", ",54,54,54,54,54,54,54,54,54,54,,54,54,,54,54,54,,,,,,,,,,,,,,,,,,,,54", ",,54,,,54,,,,,54,,,,54,,,,,,,,54,,,,,54,54,54,54,54,54,,,,54,54,,,,", ",,54,54,778,778,778,778,778,54,54,,778,778,,,,778,,778,778,778,778,778", "778,778,,,,,778,778,778,778,778,778,778,,,778,,,,,,778,778,778,778,778", "778,778,778,778,778,778,778,778,778,,778,778,,778,778,778,,,,,,,,,,", ",,,,,,,,,778,,,778,,,778,,,,,778,,,,778,,,,,,,,778,,,,,778,778,778,778", "778,778,,,,778,778,,,777,777,777,777,777,778,,,777,777,,778,778,777", ",777,777,777,777,777,777,777,,,,,777,777,777,777,777,777,777,,,777,", ",,,,777,777,777,777,777,777,777,777,777,777,777,777,777,777,,777,777", ",777,777,777,,,,,,,,,,,,,,,,,,,,777,,,777,,,777,,,,,777,,,,777,,,,,", ",,777,,,,,777,777,777,777,777,777,,,,777,777,,,57,57,57,,57,777,,,57", "57,,777,777,57,,57,57,57,57,57,57,57,,,,,57,57,57,57,57,57,57,,,57,", ",,,,,57,,,57,57,57,57,57,57,57,57,57,57,,57,57,,57,57,57,,,,,,,,,,,", ",,,,,,,,57,,,57,,,57,,,,,,,,,57,,,,,,,,57,,,,,57,57,57,57,57,57,,,,57", "57,,,58,58,58,,58,57,,,58,58,,57,57,58,,58,58,58,58,58,58,58,,,,,58", "58,58,58,58,58,58,,,58,,,,,,,58,,,58,58,58,58,58,58,58,58,58,58,,58", "58,,58,58,58,,,,,,,,,,,,,,,,,,,,58,,,58,,,58,,,,,,,,,58,,,,,,,,58,,", ",,58,58,58,58,58,58,,,,58,58,,,61,61,61,,61,58,,,61,61,,58,58,61,,61", "61,61,61,61,61,61,,,,,61,61,61,61,61,61,61,,,61,,,,,,,61,,,61,61,61", "61,61,61,61,61,61,61,,61,61,,61,61,61,,,,,,,,,,,,,,,,,,,,61,,,61,,,61", ",,,,,,,,61,,,,,,,,61,,,,,61,61,61,61,61,61,,,,61,61,61,,62,62,62,61", "62,61,,,62,62,,61,61,62,,62,62,62,62,62,62,62,,,,,62,62,62,62,62,62", "62,,,62,,,,,,,62,,,62,62,62,62,62,62,62,62,62,62,,62,62,,,311,62,311", "311,311,311,,,,,,,,,,,,,,,,62,,,62,,,62,,,,,62,,,,,311,,311,,,,,,311", "311,311,311,62,62,62,62,62,62,,,,62,62,,,756,756,756,756,756,62,,,756", "756,,62,62,756,,756,756,756,756,756,756,756,,,,,756,756,756,756,756", "756,756,,,756,,,,,,756,756,756,756,756,756,756,756,756,756,756,756,756", "756,,756,756,,756,756,756,,,,,,,,,,,,,,,,,,,,756,,,756,,,756,,,,,756", ",,,756,,,,,,,,756,,,,,756,756,756,756,756,756,,,,756,756,,,424,424,424", ",424,756,,,424,424,,756,756,424,,424,424,424,424,424,424,424,,,,,424", "424,424,424,424,424,424,,,424,,,,,,,424,,,424,424,424,424,424,424,424", "424,424,424,,424,424,,424,424,424,,,,,,,,,,,,,,,,,,,,424,,,424,,,424", ",,,,,,,,424,,,,,,,,424,,,,,424,424,424,424,424,424,,,,424,424,,,746", "746,746,,746,424,,,746,746,,424,424,746,,746,746,746,746,746,746,746", ",,,,746,746,746,746,746,746,746,,,746,,,,,,,746,,,746,746,746,746,746", "746,746,746,746,746,,746,746,,746,746,746,,,,,,,,,,,,,,,,,,,,746,,,746", ",,746,,,,,746,,,,746,,,,,,,,746,,,,,746,746,746,746,746,746,,,,746,746", ",,731,731,731,,731,746,,,731,731,,746,746,731,,731,731,731,731,731,731", "731,,,,,731,731,731,731,731,731,731,,,731,,,,,,,731,,,731,731,731,731", "731,731,731,731,731,731,,731,731,,731,731,731,,,,,,,,,,,,,,,,,,,,731", ",,731,,,731,,,,,,,,,731,,,,,,,,731,,,,,731,731,731,731,731,731,,,,731", "731,,,730,730,730,,730,731,,,730,730,,731,731,730,,730,730,730,730,730", "730,730,,,,,730,730,730,730,730,730,730,,,730,,,,,,,730,,,730,730,730", "730,730,730,730,730,730,730,,730,730,,730,730,730,,,,,,,,,,,,,,,,,,", ",730,,,730,,,730,,,,,,,,,730,,,,,,,,730,,,,,730,730,730,730,730,730", ",,,730,730,,,345,345,345,,345,730,,,345,345,,730,730,345,,345,345,345", "345,345,345,345,,,,,345,345,345,345,345,345,345,,,345,,,,,,,345,,,345", "345,345,345,345,345,345,345,345,345,,345,345,,,56,345,56,56,56,56,,", ",,,,,,,,,,,,,345,,,345,,,345,,,,,,,,,,56,56,,,,,,,56,56,56,56,345,345", "345,345,345,345,,,,345,345,,,83,83,83,,83,345,,,83,83,,345,345,83,,83", "83,83,83,83,83,83,,83,,,83,83,83,83,83,83,83,,,83,,,,,,,83,,,83,83,83", "83,83,83,83,83,83,83,,83,83,,83,83,83,,,,,,,,,,,,,,,,,,,,83,,,83,83", ",83,,,,,83,,83,,83,,,,,,,,83,,83,,,83,83,83,83,83,83,,,,83,83,,,,,,", "83,83,86,86,86,,86,83,83,,86,86,,,,86,,86,86,86,86,86,86,86,,86,,,86", "86,86,86,86,86,86,,,86,,,,,,,86,,,86,86,86,86,86,86,86,86,86,86,,86", "86,,86,86,86,,,,,,,,,,,,,,,,,,,,86,,,86,86,,86,,,,,86,,86,,86,,,,,,", ",86,,86,,,86,86,86,86,86,86,,,,86,86,,,,,,,86,86,729,729,729,,729,86", "86,,729,729,,,,729,,729,729,729,729,729,729,729,,,,,729,729,729,729", "729,729,729,,,729,,,,,,,729,,,729,729,729,729,729,729,729,729,729,729", ",729,729,,729,729,729,,,,,,,,,,,,,,,,,,,,729,,,729,,,729,,,,,,,,,729", ",,,,,,,729,,,,,729,729,729,729,729,729,,,,729,729,,,98,98,98,98,98,729", ",,98,98,,729,729,98,,98,98,98,98,98,98,98,,,,,98,98,98,98,98,98,98,", ",98,,,,,,98,98,98,98,98,98,98,98,98,98,98,98,98,98,,98,98,,98,98,98", ",,,,,,,,,,,,,,,,,,,98,,,98,,,98,,,,,98,,,,98,,,,,,,,98,,,,,98,98,98", "98,98,98,,,,98,98,,,102,102,102,98,102,98,,,102,102,,98,98,102,,102", "102,102,102,102,102,102,,,,,102,102,102,102,102,102,102,,,102,,,,,,", "102,,,102,102,102,102,102,102,102,102,102,102,,102,102,,102,102,102", ",,,,,,,,,,,,,,,,,,,102,,,102,,,102,,,,,,,,,102,,,,,,,,102,,,,,102,102", "102,102,102,102,,,,102,102,,,103,103,103,,103,102,,,103,103,,102,102", "103,,103,103,103,103,103,103,103,,,,,103,103,103,103,103,103,103,,,103", ",,,,,,103,,,103,103,103,103,103,103,103,103,103,103,,103,103,,103,103", "103,,,,,,,,,,,,,,,,,,,,103,,,103,,,103,,,,,,,,,103,,,,,,,,103,,,,,103", "103,103,103,103,103,,,,103,103,,,104,104,104,,104,103,,,104,104,,103", "103,104,,104,104,104,104,104,104,104,,,,,104,104,104,104,104,104,104", ",,104,,,,,,,104,,,104,104,104,104,104,104,104,104,104,104,,104,104,", "104,104,104,,,,,,,,,,,,,,,,,,,,104,,,104,,,104,,,,,,,,,104,,,,,,,,104", ",,,,104,104,104,104,104,104,,,,104,104,,,105,105,105,,105,104,,,105", "105,,104,104,105,,105,105,105,105,105,105,105,,,,,105,105,105,105,105", "105,105,,,105,,,,,,,105,,,105,105,105,105,105,105,105,105,105,105,,105", "105,,105,105,105,,,,,,,,,,,,,,,,,,,,105,,,105,,,105,,,,,,,,,105,,,,", ",,,105,,,,,105,105,105,105,105,105,,,,105,105,,,106,106,106,106,106", "105,,,106,106,,105,105,106,,106,106,106,106,106,106,106,,,,,106,106", "106,106,106,106,106,,,106,,,,,,106,106,106,106,106,106,106,106,106,106", "106,106,106,106,,106,106,,106,106,106,,,,,,,,,,,,,,,,,,,,106,,,106,", ",106,,,,,106,,,,106,,,,,,,,106,,,,,106,106,106,106,106,106,,,,106,106", ",,719,719,719,,719,106,,,719,719,,106,106,719,,719,719,719,719,719,719", "719,,,,,719,719,719,719,719,719,719,,,719,,,,,,,719,,,719,719,719,719", "719,719,719,719,719,719,,719,719,,719,719,719,,,,,,,,,,,,,,,,,,,,719", ",,719,,,719,,,,,,,,,719,,,,,,,,719,,,,,719,719,719,719,719,719,,,,719", "719,,,343,343,343,,343,719,,,343,343,,719,719,343,,343,343,343,343,343", "343,343,,,,,343,343,343,343,343,343,343,,,343,,,,,,,343,,,343,343,343", "343,343,343,343,343,343,343,,343,343,,,,343,,,,,,,,,,,,,,,,,,,,343,", ",343,,,343,,,,,,,,,,,,,,,,,,,,,,343,343,343,343,343,343,,,,343,343,", ",718,718,718,,718,343,,,718,718,,343,343,718,,718,718,718,718,718,718", "718,,,,,718,718,718,718,718,718,718,,,718,,,,,,,718,,,718,718,718,718", "718,718,718,718,718,718,,718,718,,718,718,718,,,,,,,,,,,,,,,,,,,,718", ",,718,,,718,,,,,,,,,718,,,,,,,,718,,,,,718,718,718,718,718,718,,,,718", "718,,,188,188,188,188,188,718,,,188,188,,718,718,188,,188,188,188,188", "188,188,188,,,,,188,188,188,188,188,188,188,,,188,,,,,,188,188,188,188", "188,188,188,188,188,188,188,188,188,188,,188,188,,188,188,188,,,,,,", ",,,,,,,,,,,,,188,,,188,,,188,,,,,188,,,,188,,,,,,,,188,,,,,188,188,188", "188,188,188,,,,188,188,,,189,189,189,189,189,188,,,189,189,,188,188", "189,,189,189,189,189,189,189,189,,,,,189,189,189,189,189,189,189,,,189", ",,,,,189,189,189,189,189,189,189,189,189,189,189,189,189,189,,189,189", ",189,189,189,,,,,,,,,,,,,,,,,,,,189,,,189,,,189,,,,,189,,,,189,,,,,", ",,189,,,,,189,189,189,189,189,189,,,,189,189,,,190,190,190,,190,189", ",,190,190,,189,189,190,,190,190,190,190,190,190,190,,,,,190,190,190", "190,190,190,190,,,190,,,,,,,190,,,190,190,190,190,190,190,190,190,190", "190,,190,190,,190,190,190,,,,,,,,,,,,,,,,,,,,190,,,190,,,190,,,,,190", ",,,190,,,,,,,,190,,,,,190,190,190,190,190,190,,,,190,190,,,191,191,191", ",191,190,,,191,191,,190,190,191,,191,191,191,191,191,191,191,,,,,191", "191,191,191,191,191,191,,,191,,,,,,,191,,,191,191,191,191,191,191,191", "191,191,191,,191,191,,191,191,191,,,,,,,,,,,,,,,,,,,,191,,,191,,,191", ",,,,191,,,,191,,,,,,,,191,,,,,191,191,191,191,191,191,,,,191,191,,,192", "192,192,,192,191,,,192,192,,191,191,192,,192,192,192,192,192,192,192", ",,,,192,192,192,192,192,192,192,,,192,,,,,,,192,,,192,192,192,192,192", "192,192,192,192,192,,192,192,,192,192,192,,,,,,,,,,,,,,,,,,,,192,,,192", ",,192,,,,,,,,,192,,,,,,,,192,,,,,192,192,192,192,192,192,,,,192,192", ",,193,193,193,,193,192,,,193,193,,192,192,193,,193,193,193,193,193,193", "193,,,,,193,193,193,193,193,193,193,,,193,,,,,,,193,,,193,193,193,193", "193,193,193,193,193,193,,193,193,,193,193,193,,,,,,,,,,,,,,,,,,,,193", ",,193,,,193,,,,,193,,,,193,,,,,,,,193,,,,,193,193,193,193,193,193,,", ",193,193,,,,,,,193,193,712,712,712,712,712,193,193,,712,712,,,,712,", "712,712,712,712,712,712,712,,,,,712,712,712,712,712,712,712,,,712,,", ",,,712,712,712,712,712,712,712,712,712,712,712,712,712,712,,712,712", ",712,712,712,,,,,,,,,,,,,,,,,,,,712,,,712,,,712,,,,,712,,,,712,,,,,", ",,712,,,,,712,712,712,712,712,712,,,,712,712,,,425,425,425,,425,712", ",,425,425,,712,712,425,,425,425,425,425,425,425,425,,,,,425,425,425", "425,425,425,425,,,425,,,,,,,425,,,425,425,425,425,425,425,425,425,425", "425,,425,425,,425,425,425,,,,,,,,,,,,,,,,,,,,425,,,425,,,425,,,,,,,", ",425,,,,,,,,425,,,,,425,425,425,425,425,425,,,,425,425,,,196,196,196", ",196,425,,,196,196,,425,425,196,,196,196,196,196,196,196,196,,,,,196", "196,196,196,196,196,196,,,196,,,,,,,196,,,196,196,196,196,196,196,196", "196,196,196,,196,196,,196,196,196,,,,,,,,,,,,,,,,,,,,196,,,196,,,196", ",,,,,,,,196,,,,,,,,196,,,,,196,196,196,196,196,196,,,,196,196,,,197", "197,197,,197,196,,,197,197,,196,196,197,,197,197,197,197,197,197,197", ",,,,197,197,197,197,197,197,197,,,197,,,,,,,197,,,197,197,197,197,197", "197,197,197,197,197,,197,197,,197,197,197,,,,,,,,,,,,,,,,,,,,197,,,197", ",,197,,,,,,,,,197,,,,,,,,197,,,,,197,197,197,197,197,197,,,,197,197", ",,198,198,198,,198,197,,,198,198,,197,197,198,,198,198,198,198,198,198", "198,,,,,198,198,198,198,198,198,198,,,198,,,,,,,198,,,198,198,198,198", "198,198,198,198,198,198,,198,198,,198,198,198,,,,,,,,,,,,,,,,,,,,198", ",,198,,,198,,,,,,,,,198,,,,,,,,198,,,,,198,198,198,198,198,198,,,,198", "198,,,700,700,700,700,700,198,,,700,700,,198,198,700,,700,700,700,700", "700,700,700,,,,,700,700,700,700,700,700,700,,,700,,,,,,700,700,700,700", "700,700,700,700,700,700,700,700,700,700,,700,700,,700,700,700,,,,,,", ",,,,,,,,,,,,,700,,,700,,,700,,,,,700,,,,700,,,,,,,,700,,,,,700,700,700", "700,700,700,,,,700,700,,,699,699,699,699,699,700,,,699,699,,700,700", "699,,699,699,699,699,699,699,699,,,,,699,699,699,699,699,699,699,,,699", ",,,,,699,699,699,699,699,699,699,699,699,699,699,699,699,699,,699,699", ",699,699,699,,,,,,,,,,,,,,,,,,,,699,,,699,,,699,,,,,699,,,,699,,,,,", ",,699,,,,,699,699,699,699,699,699,,,,699,699,,,696,696,696,,696,699", ",,696,696,,699,699,696,,696,696,696,696,696,696,696,,,,,696,696,696", "696,696,696,696,,,696,,,,,,,696,,,696,696,696,696,696,696,696,696,696", "696,,696,696,,696,696,696,,,,,,,,,,,,,,,,,,,,696,,,696,,,696,,,,,,,", ",696,,,,,,,,696,,,,,696,696,696,696,696,696,,,,696,696,,,692,692,692", ",692,696,,,692,692,,696,696,692,,692,692,692,692,692,692,692,,,,,692", "692,692,692,692,692,692,,,692,,,,,,,692,,,692,692,692,692,692,692,692", "692,692,692,,692,692,,692,692,692,,,,,,,,,,,,,,,,,,,,692,,,692,,,692", ",,,,692,,,,692,,,,,,,,692,,,,,692,692,692,692,692,692,,,,692,692,,,", ",,,692,692,688,688,688,,688,692,692,,688,688,,,,688,,688,688,688,688", "688,688,688,,,,,688,688,688,688,688,688,688,,,688,,,,,,,688,,,688,688", "688,688,688,688,688,688,688,688,,688,688,,688,688,688,,,,,,,,,,,,,,", ",,,,,688,,,688,,,688,,,,,,,,,688,,,,,,,,688,,,,,688,688,688,688,688", "688,,,,688,688,,,687,687,687,,687,688,,,687,687,,688,688,687,,687,687", "687,687,687,687,687,,,,,687,687,687,687,687,687,687,,,687,,,,,,,687", ",,687,687,687,687,687,687,687,687,687,687,,687,687,,687,687,687,,,,", ",,,,,,,,,,,,,,,687,,,687,,,687,,,,,687,,,,687,,,,,,,,687,,,,,687,687", "687,687,687,687,,,,687,687,,,206,206,206,206,206,687,,,206,206,,687", "687,206,,206,206,206,206,206,206,206,,,,,206,206,206,206,206,206,206", ",,206,,,,,,206,206,206,206,206,206,206,206,206,206,206,206,206,206,", "206,206,,206,206,206,,,,,,,,,,,,,,,,,,,,206,,,206,,,206,,,,,206,,,,206", ",,,,,,,206,,,,,206,206,206,206,206,206,,,,206,206,,,207,207,207,,207", "206,,,207,207,,206,206,207,,207,207,207,207,207,207,207,,,,,207,207", "207,207,207,207,207,,,207,,,,,,,207,,,207,207,207,207,207,207,207,207", "207,207,,207,207,,207,207,207,,,,,,,,,,,,,,,,,,,,207,,,207,,207,207", ",,,,,,,,207,,,,,,,,207,,,,,207,207,207,207,207,207,,,,207,207,,,210", "210,210,,210,207,,,210,210,,207,207,210,,210,210,210,210,210,210,210", ",,,,210,210,210,210,210,210,210,,,210,,,,,,,210,,,210,210,210,210,210", "210,210,210,210,210,,210,210,,210,210,210,,,,,,,,,,,,,,,,,,,,210,,,210", ",,210,,,,,,,,,210,,,,,,,,210,,,,,210,210,210,210,210,210,,,,210,210", ",,655,655,655,,655,210,,,655,655,,210,210,655,,655,655,655,655,655,655", "655,,,,,655,655,655,655,655,655,655,,,655,,,,,,,655,,,655,655,655,655", "655,655,655,655,655,655,,655,655,,655,655,655,,,,,,,,,,,,,,,,,,,,655", ",,655,,,655,,,,,655,,,,655,,,,,,,,655,,,,,655,655,655,655,655,655,,", ",655,655,,,212,212,212,,212,655,,,212,212,,655,655,212,,212,212,212", "212,212,212,212,,,,,212,212,212,212,212,212,212,,,212,,,,,,,212,,,212", "212,212,212,212,212,212,212,212,212,,212,212,,212,212,212,,,,,,,,,,", ",,,,,,,,,212,,,212,,,212,,,,,,,,,212,,,,,,,,212,,,,,212,212,212,212", "212,212,,,,212,212,,,213,213,213,,213,212,,,213,213,,212,212,213,,213", "213,213,213,213,213,213,,,,,213,213,213,213,213,213,213,,,213,,,,,,", "213,,,213,213,213,213,213,213,213,213,213,213,,213,213,,213,213,213", ",,,,,,,,,,,,,,,,,,,213,,,213,,,213,,,,,,,,,213,,,,,,,,213,,,,,213,213", "213,213,213,213,,,,213,213,,,214,214,214,,214,213,,,214,214,,213,213", "214,,214,214,214,214,214,214,214,,,,,214,214,214,214,214,214,214,,,214", ",,,,,,214,,,214,214,214,214,214,214,214,214,214,214,,214,214,,214,214", "214,,,,,,,,,,,,,,,,,,,,214,,,214,,,214,,,,,,,,,214,,,,,,,,214,,,,,214", "214,214,214,214,214,,,,214,214,,,215,215,215,,215,214,,,215,215,,214", "214,215,,215,215,215,215,215,215,215,,,,,215,215,215,215,215,215,215", ",,215,,,,,,,215,,,215,215,215,215,215,215,215,215,215,215,,215,215,", "215,215,215,,,,,,,,,,,,,,,,,,,,215,,,215,,,215,,,,,,,,,215,,,,,,,,215", ",,,,215,215,215,215,215,215,,,,215,215,,,216,216,216,,216,215,,,216", "216,,215,215,216,,216,216,216,216,216,216,216,,,,,216,216,216,216,216", "216,216,,,216,,,,,,,216,,,216,216,216,216,216,216,216,216,216,216,,216", "216,,216,216,216,,,,,,,,,,,,,,,,,,,,216,,,216,,,216,,,,,,,,,216,,,,", ",,,216,,,,,216,216,216,216,216,216,,,,216,216,,,217,217,217,,217,216", ",,217,217,,216,216,217,,217,217,217,217,217,217,217,,,,,217,217,217", "217,217,217,217,,,217,,,,,,,217,,,217,217,217,217,217,217,217,217,217", "217,,217,217,,217,217,217,,,,,,,,,,,,,,,,,,,,217,,,217,,,217,,,,,,,", ",217,,,,,,,,217,,,,,217,217,217,217,217,217,,,,217,217,,,218,218,218", ",218,217,,,218,218,,217,217,218,,218,218,218,218,218,218,218,,,,,218", "218,218,218,218,218,218,,,218,,,,,,,218,,,218,218,218,218,218,218,218", "218,218,218,,218,218,,218,218,218,,,,,,,,,,,,,,,,,,,,218,,,218,,,218", ",,,,,,,,218,,,,,,,,218,,,,,218,218,218,218,218,218,,,,218,218,,,219", "219,219,,219,218,,,219,219,,218,218,219,,219,219,219,219,219,219,219", ",,,,219,219,219,219,219,219,219,,,219,,,,,,,219,,,219,219,219,219,219", "219,219,219,219,219,,219,219,,219,219,219,,,,,,,,,,,,,,,,,,,,219,,,219", ",,219,,,,,,,,,219,,,,,,,,219,,,,,219,219,219,219,219,219,,,,219,219", ",,220,220,220,,220,219,,,220,220,,219,219,220,,220,220,220,220,220,220", "220,,,,,220,220,220,220,220,220,220,,,220,,,,,,,220,,,220,220,220,220", "220,220,220,220,220,220,,220,220,,220,220,220,,,,,,,,,,,,,,,,,,,,220", ",,220,,,220,,,,,,,,,220,,,,,,,,220,,,,,220,220,220,220,220,220,,,,220", "220,,,221,221,221,,221,220,,,221,221,,220,220,221,,221,221,221,221,221", "221,221,,,,,221,221,221,221,221,221,221,,,221,,,,,,,221,,,221,221,221", "221,221,221,221,221,221,221,,221,221,,221,221,221,,,,,,,,,,,,,,,,,,", ",221,,,221,,,221,,,,,,,,,221,,,,,,,,221,,,,,221,221,221,221,221,221", ",,,221,221,,,222,222,222,,222,221,,,222,222,,221,221,222,,222,222,222", "222,222,222,222,,,,,222,222,222,222,222,222,222,,,222,,,,,,,222,,,222", "222,222,222,222,222,222,222,222,222,,222,222,,222,222,222,,,,,,,,,,", ",,,,,,,,,222,,,222,,,222,,,,,,,,,222,,,,,,,,222,,,,,222,222,222,222", "222,222,,,,222,222,,,223,223,223,,223,222,,,223,223,,222,222,223,,223", "223,223,223,223,223,223,,,,,223,223,223,223,223,223,223,,,223,,,,,,", "223,,,223,223,223,223,223,223,223,223,223,223,,223,223,,223,223,223", ",,,,,,,,,,,,,,,,,,,223,,,223,,,223,,,,,,,,,223,,,,,,,,223,,,,,223,223", "223,223,223,223,,,,223,223,,,224,224,224,,224,223,,,224,224,,223,223", "224,,224,224,224,224,224,224,224,,,,,224,224,224,224,224,224,224,,,224", ",,,,,,224,,,224,224,224,224,224,224,224,224,224,224,,224,224,,224,224", "224,,,,,,,,,,,,,,,,,,,,224,,,224,,,224,,,,,,,,,224,,,,,,,,224,,,,,224", "224,224,224,224,224,,,,224,224,,,225,225,225,,225,224,,,225,225,,224", "224,225,,225,225,225,225,225,225,225,,,,,225,225,225,225,225,225,225", ",,225,,,,,,,225,,,225,225,225,225,225,225,225,225,225,225,,225,225,", "225,225,225,,,,,,,,,,,,,,,,,,,,225,,,225,,,225,,,,,,,,,225,,,,,,,,225", ",,,,225,225,225,225,225,225,,,,225,225,,,226,226,226,,226,225,,,226", "226,,225,225,226,,226,226,226,226,226,226,226,,,,,226,226,226,226,226", "226,226,,,226,,,,,,,226,,,226,226,226,226,226,226,226,226,226,226,,226", "226,,226,226,226,,,,,,,,,,,,,,,,,,,,226,,,226,,,226,,,,,,,,,226,,,,", ",,,226,,,,,226,226,226,226,226,226,,,,226,226,,,227,227,227,,227,226", ",,227,227,,226,226,227,,227,227,227,227,227,227,227,,,,,227,227,227", "227,227,227,227,,,227,,,,,,,227,,,227,227,227,227,227,227,227,227,227", "227,,227,227,,227,227,227,,,,,,,,,,,,,,,,,,,,227,,,227,,,227,,,,,,,", ",227,,,,,,,,227,,,,,227,227,227,227,227,227,,,,227,227,,,228,228,228", ",228,227,,,228,228,,227,227,228,,228,228,228,228,228,228,228,,,,,228", "228,228,228,228,228,228,,,228,,,,,,,228,,,228,228,228,228,228,228,228", "228,228,228,,228,228,,228,228,228,,,,,,,,,,,,,,,,,,,,228,,,228,,,228", ",,,,,,,,228,,,,,,,,228,,,,,228,228,228,228,228,228,,,,228,228,,,229", "229,229,,229,228,,,229,229,,228,228,229,,229,229,229,229,229,229,229", ",,,,229,229,229,229,229,229,229,,,229,,,,,,,229,,,229,229,229,229,229", "229,229,229,229,229,,229,229,,229,229,229,,,,,,,,,,,,,,,,,,,,229,,,229", ",,229,,,,,,,,,229,,,,,,,,229,,,,,229,229,229,229,229,229,,,,229,229", ",,230,230,230,,230,229,,,230,230,,229,229,230,,230,230,230,230,230,230", "230,,,,,230,230,230,230,230,230,230,,,230,,,,,,,230,,,230,230,230,230", "230,230,230,230,230,230,,230,230,,230,230,230,,,,,,,,,,,,,,,,,,,,230", ",,230,,,230,,,,,,,,,230,,,,,,,,230,,,,,230,230,230,230,230,230,,,,230", "230,,,231,231,231,,231,230,,,231,231,,230,230,231,,231,231,231,231,231", "231,231,,,,,231,231,231,231,231,231,231,,,231,,,,,,,231,,,231,231,231", "231,231,231,231,231,231,231,,231,231,,231,231,231,,,,,,,,,,,,,,,,,,", ",231,,,231,,,231,,,,,,,,,231,,,,,,,,231,,,,,231,231,231,231,231,231", ",,,231,231,,,232,232,232,,232,231,,,232,232,,231,231,232,,232,232,232", "232,232,232,232,,,,,232,232,232,232,232,232,232,,,232,,,,,,,232,,,232", "232,232,232,232,232,232,232,232,232,,232,232,,232,232,232,,,,,,,,,,", ",,,,,,,,,232,,,232,,,232,,,,,,,,,232,,,,,,,,232,,,,,232,232,232,232", "232,232,,,,232,232,,,233,233,233,,233,232,,,233,233,,232,232,233,,233", "233,233,233,233,233,233,,,,,233,233,233,233,233,233,233,,,233,,,,,,", "233,,,233,233,233,233,233,233,233,233,233,233,,233,233,,233,233,233", ",,,,,,,,,,,,,,,,,,,233,,,233,,,233,,,,,,,,,233,,,,,,,,233,,,,,233,233", "233,233,233,233,,,,233,233,,,234,234,234,,234,233,,,234,234,,233,233", "234,,234,234,234,234,234,234,234,,,,,234,234,234,234,234,234,234,,,234", ",,,,,,234,,,234,234,234,234,234,234,234,234,234,234,,234,234,,234,234", "234,,,,,,,,,,,,,,,,,,,,234,,,234,,,234,,,,,,,,,234,,,,,,,,234,,,,,234", "234,234,234,234,234,,,,234,234,,,235,235,235,,235,234,,,235,235,,234", "234,235,,235,235,235,235,235,235,235,,,,,235,235,235,235,235,235,235", ",,235,,,,,,,235,,,235,235,235,235,235,235,235,235,235,235,,235,235,", "235,235,235,,,,,,,,,,,,,,,,,,,,235,,,235,,,235,,,,,,,,,235,,,,,,,,235", ",,,,235,235,235,235,235,235,,,,235,235,,,236,236,236,,236,235,,,236", "236,,235,235,236,,236,236,236,236,236,236,236,,,,,236,236,236,236,236", "236,236,,,236,,,,,,,236,,,236,236,236,236,236,236,236,236,236,236,,236", "236,,236,236,236,,,,,,,,,,,,,,,,,,,,236,,,236,,,236,,,,,,,,,236,,,,", ",,,236,,,,,236,236,236,236,236,236,,,,236,236,,,237,237,237,,237,236", ",,237,237,,236,236,237,,237,237,237,237,237,237,237,,,,,237,237,237", "237,237,237,237,,,237,,,,,,,237,,,237,237,237,237,237,237,237,237,237", "237,,237,237,,237,237,237,,,,,,,,,,,,,,,,,,,,237,,,237,,,237,,,,,,,", ",237,,,,,,,,237,,,,,237,237,237,237,237,237,,,,237,237,,,649,649,649", ",649,237,,,649,649,,237,237,649,,649,649,649,649,649,649,649,,,,,649", "649,649,649,649,649,649,,,649,,,,,,,649,,,649,649,649,649,649,649,649", "649,649,649,,649,649,,,,649,,,,,,,,,,,,,,,,,,,,649,,,649,,,649,,,,,", ",,,,,,,,,,,,,,,,649,649,649,649,649,649,,,,649,649,,,426,426,426,,426", "649,,,426,426,,649,649,426,,426,426,426,426,426,426,426,,,,,426,426", "426,426,426,426,426,,,426,,,,,,,426,,,426,426,426,426,426,426,426,426", "426,426,,426,426,,426,426,426,,,,,,,,,,,,,,,,,,,,426,,,426,,,426,,,", ",,,,,426,,,,,,,,426,,,,,426,426,426,426,426,426,,,,426,426,,,457,457", "457,,457,426,,,457,457,,426,426,457,,457,457,457,457,457,457,457,,,", ",457,457,457,457,457,457,457,,,457,,,,,,,457,,,457,457,457,457,457,457", "457,457,457,457,,457,457,,457,457,457,,,,,,,,,,,,,,,,,,,,457,,,457,", ",457,,,,,457,,457,,457,,,,,,,,457,,,,,457,457,457,457,457,457,,,,457", "457,,,,,,,457,457,246,246,246,,246,457,457,,246,246,,,,246,,246,246", "246,246,246,246,246,,,,,246,246,246,246,246,246,246,,,246,,,,,,,246", ",,246,246,246,246,246,246,246,246,246,246,,246,246,,246,246,246,,,,", ",,,,,,,,,,,,,,,246,,,246,,,246,,,,,,,,,246,,,,,,,,246,,,,,246,246,246", "246,246,246,,,,246,246,,,460,460,460,,460,246,,,460,460,,246,246,460", ",460,460,460,460,460,460,460,,,,,460,460,460,460,460,460,460,,,460,", ",,,,,460,,,460,460,460,460,460,460,460,460,460,460,,460,460,,460,460", "460,,,,,,,,,,,,,,,,,,,,460,,,460,,,460,,,,,,,460,,460,,,,,,,,460,,,", ",460,460,460,460,460,460,,,,460,460,,,,,,,460,460,248,248,248,,248,460", "460,,248,248,,,,248,,248,248,248,248,248,248,248,,,,,248,248,248,248", "248,248,248,,,248,,,,,,,248,,,248,248,248,248,248,248,248,248,248,248", ",248,248,,248,248,248,,,,,,,,,,,,,,,,,,,,248,,,248,,,248,,,,,,,,,248", ",,,,,,,248,,,,,248,248,248,248,248,248,,,,248,248,,,253,253,253,,253", "248,,,253,253,,248,248,253,,253,253,253,253,253,253,253,,,,,253,253", "253,253,253,253,253,,,253,,,,,,,253,,,253,253,253,253,253,253,253,253", "253,253,,253,253,,253,253,253,,,,,,,,,,,,,,,,,,,,253,,,253,,,253,,,", ",,,,,253,,,,,,,,253,,,,,253,253,253,253,253,253,,,,253,253,,,639,639", "639,,639,253,,,639,639,,253,253,639,,639,639,639,639,639,639,639,,,", ",639,639,639,639,639,639,639,,,639,,,,,,,639,,,639,639,639,639,639,639", "639,639,639,639,,639,639,,,,639,,,,,,,,,,,,,,,,,,,,639,,,639,,,639,", ",,,,,,,,,,,,,,,,,,,,639,639,639,639,639,639,,,,639,639,,,636,636,636", "636,636,639,,,636,636,,639,639,636,,636,636,636,636,636,636,636,,,,", "636,636,636,636,636,636,636,,,636,,,,,,636,636,636,636,636,636,636,636", "636,636,636,636,636,636,,636,636,,636,636,636,,,,,,,,,,,,,,,,,,,,636", ",,636,,,636,,,,,636,,,,636,,,,,,,,636,,,,,636,636,636,636,636,636,,", ",636,636,,,635,635,635,635,635,636,,,635,635,,636,636,635,,635,635,635", "635,635,635,635,,,,,635,635,635,635,635,635,635,,,635,,,,,,635,635,635", "635,635,635,635,635,635,635,635,635,635,635,,635,635,,635,635,635,,", ",,,,,,,,,,,,,,,,,635,,,635,,,635,,,,,635,,,,635,,,,,,,,635,,,,,635,635", "635,635,635,635,,,,635,635,,,259,259,259,,259,635,,,259,259,,635,635", "259,,259,259,259,259,259,259,259,,,,,259,259,259,259,259,259,259,,,259", ",,,,,,259,,,259,259,259,259,259,259,259,259,259,259,,259,259,,259,259", "259,,,,,,,,,,,,,,,,,,,,259,,,259,,,259,,,,,259,,259,,259,,,,,,,,259", ",,,,259,259,259,259,259,259,,,,259,259,,,,,,,259,259,260,260,260,,260", "259,259,,260,260,,,,260,,260,260,260,260,260,260,260,,,,,260,260,260", "260,260,260,260,,,260,,,,,,,260,,,260,260,260,260,260,260,260,260,260", "260,,260,260,,260,260,260,,,,,,,,,,,,,,,,,,,,260,,,260,,,260,,,,,260", ",260,,260,,,,,,,,260,,,,,260,260,260,260,260,260,,,,260,260,,,,,,,260", "260,268,268,268,,268,260,260,,268,268,,,,268,,268,268,268,268,268,268", "268,,,,,268,268,268,268,268,268,268,,,268,,,,,,,268,,,268,268,268,268", "268,268,268,268,268,268,,268,268,,268,268,268,,,,,,,,,,,,,,,,,,,,268", ",,268,,268,268,,,,,268,,268,,268,,,,,,,,268,,,,,268,268,268,268,268", "268,,,,268,268,,,,,,,268,268,629,629,629,,629,268,268,,629,629,,,,629", ",629,629,629,629,629,629,629,,,,,629,629,629,629,629,629,629,,,629,", ",,,,,629,,,629,629,629,629,629,629,629,629,629,629,,629,629,,629,629", "629,,,,,,,,,,,,,,,,,,,,629,,,629,,,629,,,,,629,,629,,629,,,,,,,,629", ",,,,629,629,629,629,629,629,,,,629,629,,,,,,,629,629,270,270,270,270", "270,629,629,,270,270,,,,270,,270,270,270,270,270,270,270,,,,,270,270", "270,270,270,270,270,,,270,,,,,,270,270,270,270,270,270,270,270,270,270", "270,270,270,270,,270,270,,270,270,270,,,,,,,,,,,,,,,,,,,,270,,,270,", ",270,,,,,270,,,,270,,,,,,,,270,,,,,270,270,270,270,270,270,,,,270,270", ",,623,623,623,623,623,270,,,623,623,,270,270,623,,623,623,623,623,623", "623,623,,,,,623,623,623,623,623,623,623,,,623,,,,,,623,623,623,623,623", "623,623,623,623,623,623,623,623,623,,623,623,,623,623,623,,,,,,,,,,", ",,,,,,,,,623,,,623,,,623,,,,,623,,,,623,,,,,,,,623,,,,,623,623,623,623", "623,623,,,,623,623,,,615,615,615,,615,623,,,615,615,,623,623,615,,615", "615,615,615,615,615,615,,,,,615,615,615,615,615,615,615,,,615,,,,,,", "615,,,615,615,615,615,615,615,615,615,615,615,,615,615,,615,615,615", ",,,,,,,,,,,,,,,,,,,615,,,615,,,615,,,,,,,,,615,,,,,,,,615,,,,,615,615", "615,615,615,615,,,,615,615,,,611,611,611,611,611,615,,,611,611,,615", "615,611,,611,611,611,611,611,611,611,,,,,611,611,611,611,611,611,611", ",,611,,,,,,611,611,611,611,611,611,611,611,611,611,611,611,611,611,", "611,611,,611,611,611,,,,,,,,,,,,,,,,,,,,611,,,611,,,611,,,,,611,,,,611", ",,,,,,,611,,,,,611,611,611,611,611,611,,,,611,611,,,274,274,274,,274", "611,,,274,274,,611,611,274,,274,274,274,274,274,274,274,,,,,274,274", "274,274,274,274,274,,,274,,,,,,,274,,,274,274,274,274,274,274,274,274", "274,274,,274,274,,,,274,,,,,,,,,,,,,,,,,,,,274,,,274,,,274,,,,,,,,,", ",,,,,,,,,,,,274,274,274,274,274,274,,,,274,274,,,,274,,,,274,275,275", "275,275,275,274,274,,275,275,,,,275,,275,275,275,275,275,275,275,,,", ",275,275,275,275,275,275,275,,,275,,,,,,275,275,275,275,275,275,275", "275,275,275,275,275,275,275,,275,275,,275,275,275,,,,,,,,,,,,,,,,,,", ",275,,,275,,,275,,,,,275,,,,275,,,,,,,,275,,,,,275,275,275,275,275,275", ",,,275,275,,,607,607,607,,607,275,,,607,607,,275,275,607,,607,607,607", "607,607,607,607,,,,,607,607,607,607,607,607,607,,,607,,,,,,,607,,,607", "607,607,607,607,607,607,607,607,607,,607,607,,607,607,607,,,,,,,,,,", ",,,,,,,,,607,,,607,,,607,,,,,,,,,607,,,,,,,,607,,,,,607,607,607,607", "607,607,,603,,607,607,,,,603,603,603,,607,603,603,603,,603,607,607,", ",,,,,,603,603,,,,,,,,603,603,,603,603,603,603,603,,,,,,,,,,,,,,,,,,", ",,,603,603,603,603,603,603,603,603,603,603,603,603,603,603,,,603,603", "603,,603,603,,,603,,,603,,603,,603,,603,,603,603,603,603,603,603,603", ",603,,603,,,,,,,,,,,,,603,603,603,603,,603,602,,,,603,,603,602,602,602", ",,602,602,602,,602,,,,,,,,,602,602,602,,,,,,,,602,602,,602,602,602,602", "602,,,,,,,,,,,,,,,,,,,,,,602,602,602,602,602,602,602,602,602,602,602", "602,602,602,,,602,602,602,,602,602,,,602,,,602,,602,,602,,602,,602,602", "602,602,602,602,602,,602,602,602,,,,,,,,,,,,,602,602,602,602,,602,,599", "599,599,602,599,602,,,599,599,,,,599,,599,599,599,599,599,599,599,,", ",,599,599,599,599,599,599,599,,,599,,,,,,,599,,,599,599,599,599,599", "599,599,599,599,599,,599,599,,599,599,599,,,,,,,,,,,,,,,,,,,,599,,,599", ",,599,,,,,,,,,599,,,,,,,,599,,,,,599,599,599,599,599,599,,,,599,599", ",,596,596,596,,596,599,,,596,596,,599,599,596,,596,596,596,596,596,596", "596,,,,,596,596,596,596,596,596,596,,,596,,,,,,,596,,,596,596,596,596", "596,596,596,596,596,596,,596,596,,596,596,596,,,,,,,,,,,,,,,,,,,,596", ",,596,,,596,,,,,,,,,596,,,,,,,,596,,,,,596,596,596,596,596,596,,,,596", "596,,,591,591,591,,591,596,,,591,591,,596,596,591,,591,591,591,591,591", "591,591,,,,,591,591,591,591,591,591,591,,,591,,,,,,,591,,,591,591,591", "591,591,591,591,591,591,591,,591,591,,591,591,591,,,,,,,,,,,,,,,,,,", ",591,,,591,,,591,,,,,,,,,591,,,,,,,,591,,,,,591,591,591,591,591,591", ",,,591,591,,,590,590,590,,590,591,,,590,590,,591,591,590,,590,590,590", "590,590,590,590,,,,,590,590,590,590,590,590,590,,,590,,,,,,,590,,,590", "590,590,590,590,590,590,590,590,590,,590,590,,590,590,590,,,,,,,,,,", ",,,,,,,,,590,,,590,,,590,,,,,,,,,590,,,,,,,,590,,,,,590,590,590,590", "590,590,,,,590,590,,,462,462,462,,462,590,,,462,462,,590,590,462,,462", "462,462,462,462,462,462,,,,,462,462,462,462,462,462,462,,,462,,,,,,", "462,,,462,462,462,462,462,462,462,462,462,462,,462,462,,462,462,462", ",,,,,,,,,,,,,,,,,,,462,,,462,,,462,,,,,,,,,462,,,,,,,,462,,,,,462,462", "462,462,462,462,,,,462,462,,,586,586,586,,586,462,,,586,586,,462,462", "586,,586,586,586,586,586,586,586,,,,,586,586,586,586,586,586,586,,,586", ",,,,,,586,,,586,586,586,586,586,586,586,586,586,586,,586,586,,586,586", "586,,,,,,,,,,,,,,,,,,,,586,,,586,,,586,,,,,,,,,586,,,,,,,,586,,,,,586", "586,586,586,586,586,,,,586,586,,,287,287,287,,287,586,,,287,287,,586", "586,287,,287,287,287,287,287,287,287,,,,,287,287,287,287,287,287,287", ",,287,,,,,,,287,,,287,287,287,287,287,287,287,287,287,287,,287,287,", ",,287,,,,,,,,,,,,,,,,,,,,287,,,287,,,287,,,,,,,,,,,,,,,,,,,,,,287,287", "287,287,287,287,,,,287,287,,,559,559,559,,559,287,,,559,559,,287,287", "559,,559,559,559,559,559,559,559,,,,,559,559,559,559,559,559,559,,,559", ",,,,,,559,,,559,559,559,559,559,559,559,559,559,559,,559,559,,559,559", "559,,,,,,,,,,,,,,,,,,,,559,,,559,,,559,,,,,,,,,559,,,,,,,,559,,,,,559", "559,559,559,559,559,,,,559,559,,,338,338,338,,338,559,,,338,338,,559", "559,338,,338,338,338,338,338,338,338,,,,,338,338,338,338,338,338,338", ",,338,,,,,,,338,,,338,338,338,338,338,338,338,338,338,338,,338,338,", "338,338,338,,,,,,,,,,,,,,,,,,,,338,,,338,,,338,,,,,,,,,338,,,,,,,,338", ",,,,338,338,338,338,338,338,,,,338,338,,,337,337,337,,337,338,,,337", "337,,338,338,337,,337,337,337,337,337,337,337,,,,,337,337,337,337,337", "337,337,,,337,,,,,,,337,,,337,337,337,337,337,337,337,337,337,337,,337", "337,,337,337,337,,,,,,,,,,,,,,,,,,,,337,,,337,,,337,,,,,,,,,337,,,,", ",,,337,,,,,337,337,337,337,337,337,,,,337,337,,,550,550,550,550,550", "337,,,550,550,,337,337,550,,550,550,550,550,550,550,550,,,,,550,550", "550,550,550,550,550,,,550,,,,,,550,550,550,550,550,550,550,550,550,550", "550,550,550,550,,550,550,,550,550,550,,,,,,,,,,,,,,,,,,,,550,,,550,", ",550,,,,,550,,,,550,,,,,,,,550,,,,,550,550,550,550,550,550,,,,550,550", ",,545,545,545,545,545,550,,,545,545,,550,550,545,,545,545,545,545,545", "545,545,,,,,545,545,545,545,545,545,545,,,545,,,,,,545,545,545,545,545", "545,545,545,545,545,545,545,545,545,,545,545,,545,545,545,,,,,,,,,,", ",,,,,,,,,545,,,545,,,545,,,,,545,,,,545,,,,,,,,545,,,,,545,545,545,545", "545,545,,,,545,545,,,296,296,296,,296,545,,,296,296,,545,545,296,,296", "296,296,296,296,296,296,,,,,296,296,296,296,296,296,296,,,296,,,,,,", "296,,,296,296,296,296,296,296,296,296,296,296,,296,296,,296,296,296", ",,,,,,,,,,,,,,,,,,,296,,,296,296,,296,,,,,,,,,296,,,,,,,,296,,,,,296", "296,296,296,296,296,,,,296,296,,,298,298,298,298,298,296,,,298,298,", "296,296,298,,298,298,298,298,298,298,298,,,,,298,298,298,298,298,298", "298,,,298,,,,,,298,298,298,298,298,298,298,298,298,298,298,298,298,298", ",298,298,,298,298,298,,,,,,,,,,,,,,,,,,,,298,,,298,,,298,,,,,298,,,", "298,,,,,,,,298,,,,,298,298,298,298,298,298,,,,298,298,,,541,541,541", "541,541,298,,,541,541,,298,298,541,,541,541,541,541,541,541,541,,,,", "541,541,541,541,541,541,541,,,541,,,,,,541,541,541,541,541,541,541,541", "541,541,541,541,541,541,,541,541,,541,541,541,,,,,,,,,,,,,,,,,,,,541", ",,541,,,541,,,,,541,,,,541,,,,,,,,541,,,,,541,541,541,541,541,541,,", ",541,541,,,527,527,527,,527,541,,,527,527,,541,541,527,,527,527,527", "527,527,527,527,,,,,527,527,527,527,527,527,527,,,527,,,,,,,527,,,527", "527,527,527,527,527,527,527,527,527,,527,527,,,,527,,,,,,,,,,,,,,,,", ",,,527,,,527,,,527,,,,,,,,,,,,,,,,,,,,,,527,527,527,527,527,527,,,,527", "527,,,521,521,521,521,521,527,,,521,521,,527,527,521,,521,521,521,521", "521,521,521,,,,,521,521,521,521,521,521,521,,,521,,,,,,521,521,521,521", "521,521,521,521,521,521,521,521,521,521,,521,521,,521,521,521,,,,,,", ",,,,,,,,,,,,,521,,,521,,,521,,,,,521,,,,521,,,,,,,,521,,,,,521,521,521", "521,521,521,,,,521,521,,,520,520,520,520,520,521,,,520,520,,521,521", "520,,520,520,520,520,520,520,520,,,,,520,520,520,520,520,520,520,,,520", ",,,,,520,520,520,520,520,520,520,520,520,520,520,520,520,520,,520,520", ",520,520,520,,,,,,,,,,,,,,,,,,,,520,,,520,,,520,,,,,520,,,,520,,,,,", ",,520,,,,,520,520,520,520,520,520,,,,520,520,,,515,515,515,,515,520", ",,515,515,,520,520,515,,515,515,515,515,515,515,515,,,,,515,515,515", "515,515,515,515,,,515,,,,,,,515,,,515,515,515,515,515,515,515,515,515", "515,,515,515,,515,515,515,,,,,,,,,,,,,,,,,,,,515,,,515,,,515,,,,,515", ",,,515,,,,,,,,515,,,,,515,515,515,515,515,515,,,,515,515,,,513,513,513", ",513,515,,,513,513,,515,515,513,,513,513,513,513,513,513,513,,,,,513", "513,513,513,513,513,513,,,513,,,,,,,513,,,513,513,513,513,513,513,513", "513,513,513,,513,513,,513,513,513,,,,,,,,,,,,,,,,,,,,513,,,513,,,513", ",,,,,,,,513,,,,,,,,513,,,,,513,513,513,513,513,513,,,,513,513,,,,,,", "513,513,510,510,510,,510,513,513,,510,510,,,,510,,510,510,510,510,510", "510,510,,,,,510,510,510,510,510,510,510,,,510,,,,,,,510,,,510,510,510", "510,510,510,510,510,510,510,,510,510,,510,510,510,,,,,,,,,,,,,,,,,,", ",510,,,510,,,510,,,,,510,,,,510,,,,,,,,510,,,,,510,510,510,510,510,510", ",,,510,510,,,,,,,510,510,505,505,505,,505,510,510,,505,505,,,,505,,505", "505,505,505,505,505,505,,,,,505,505,505,505,505,505,505,,,505,,,,,,", "505,,,505,505,505,505,505,505,505,505,505,505,,505,505,,505,505,505", ",,,,,,,,,,,,,,,,,,,505,,,505,,,505,,,,,,,,,505,,,,,,,,505,,,,,505,505", "505,505,505,505,,,,505,505,,,501,501,501,,501,505,,,501,501,,505,505", "501,,501,501,501,501,501,501,501,,,,,501,501,501,501,501,501,501,,,501", ",,,,,,501,,,501,501,501,501,501,501,501,501,501,501,,501,501,,501,501", "501,,,,,,,,,,,,,,,,,,,,501,,,501,,,501,,,,,,,,,501,,,,,,,,501,,,,,501", "501,501,501,501,501,,,,501,501,,,500,500,500,,500,501,,,500,500,,501", "501,500,,500,500,500,500,500,500,500,,,,,500,500,500,500,500,500,500", ",,500,,,,,,,500,,,500,500,500,500,500,500,500,500,500,500,,500,500,", "500,500,500,,,,,,,,,,,,,,,,,,,,500,,,500,,,500,,,,,,,,,500,,,,,,,,500", ",,,,500,500,500,500,500,500,,,,500,500,,,499,499,499,,499,500,,,499", "499,,500,500,499,,499,499,499,499,499,499,499,,,,,499,499,499,499,499", "499,499,,,499,,,,,,,499,,,499,499,499,499,499,499,499,499,499,499,,499", "499,,499,499,499,,,,,,,,,,,,,,,,,,,,499,,,499,,,499,,,,,,,,,499,,,,", ",,,499,,,,,499,499,499,499,499,499,,,,499,499,,,490,490,490,,490,499", ",,490,490,,499,499,490,,490,490,490,490,490,490,490,,,,,490,490,490", "490,490,490,490,,,490,,,,,,,490,,,490,490,490,490,490,490,490,490,490", "490,,490,490,,490,490,490,,,,,,,,,,,,,,,,,,,,490,,,490,,,490,,,,,490", ",,,490,,,,,,,,490,,,,,490,490,490,490,490,490,,,,490,490,,,,,,,490,490", "488,488,488,,488,490,490,,488,488,,,,488,,488,488,488,488,488,488,488", ",,,,488,488,488,488,488,488,488,,,488,,,,,,,488,,,488,488,488,488,488", "488,488,488,488,488,,488,488,,,,488,,,,,,,,,,,,,,,,,,,,488,,,488,,,488", ",,,,,,,,,,,,,,,,,,,,,488,488,488,488,488,488,,,,488,488,,,478,478,478", ",478,488,,,478,478,,488,488,478,,478,478,478,478,478,478,478,,,,,478", "478,478,478,478,478,478,,,478,,,,,,,478,,,478,478,478,478,478,478,478", "478,478,478,,478,478,,478,478,478,,,,,,,,,,,,,,,,,,,,478,,,478,,478", "478,,,,,,,478,,478,,,,,,,,478,,,,,478,478,478,478,478,478,,,,478,478", ",,588,588,588,,588,478,,,588,588,,478,478,588,,588,588,588,588,588,588", "588,,,,,588,588,588,588,588,588,588,,,588,,,,,,,588,,,588,588,588,588", "588,588,588,588,588,588,,588,588,,588,588,588,,,,,,,,,,,,,,,,,,,,588", ",,588,,,588,,,,,588,,,,588,,,,,,,,588,,,,,588,588,588,588,588,588,,465", ",588,588,,,,465,465,465,,588,465,465,465,,465,588,588,,,,,,,,465,,,", ",,,,,465,465,,465,465,465,465,465,,,,,,,,,,,,468,,,,,,,468,468,468,", ",468,468,468,,468,,,,,465,,,,,468,,465,,,,,465,465,468,468,,468,468", "468,468,468,,,,,,,,,,,,,465,,,,,,,,,,,,,465,,465,,,465,,468,,,,,,,468", ",,,,468,468,,,,,,,,,,,,,,,,,,,,,468,,,,,,,,,,,,,468,,468,,,468,7,7,7", "7,7,7,7,7,,,7,7,7,7,7,,,7,7,7,7,7,7,7,,,7,7,7,7,7,7,7,7,7,7,7,7,7,7", "7,7,7,7,7,7,7,7,7,,,7,,,,,,,,7,7,,7,7,7,7,7,7,7,,,7,,,,,7,7,7,7,,,,", ",,,,,,,,7,7,,7,7,7,7,7,7,7,7,7,7,7,,,7,7,389,389,389,389,389,389,389", "389,,7,389,389,389,389,389,,,389,389,389,389,389,389,389,,,389,389,389", "389,389,389,389,389,389,389,389,389,389,389,389,389,389,389,389,389", "389,389,389,,,389,,,,,,,,389,389,,389,389,389,389,389,389,389,,,389", ",,,,389,389,389,389,,,,,,,,,,,,,389,389,,389,389,389,389,389,389,389", "389,389,389,389,,,389,389,385,385,385,385,385,385,385,385,,389,385,385", "385,385,385,,,385,385,385,385,385,385,385,,,385,385,385,385,385,385", "385,385,385,385,385,385,385,385,385,385,385,385,385,385,385,385,385", ",,385,,,,,,,,385,385,,385,385,385,385,385,385,385,,,385,,,,,385,385", "385,385,,,,,,,,,,,,,385,385,,385,385,385,385,385,385,385,385,385,385", "385,,,385,385,6,6,6,6,6,6,6,6,,385,6,6,6,6,6,,,6,6,6,6,6,6,6,,,6,6,6", "6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,,6,,,,,,,,6,6,,6,6,6,6,6,6", "6,,,6,,,,,6,6,6,6,,,,,,,,,,,,,6,6,,6,6,6,6,6,6,6,6,6,6,6,,,6,6,709,709", "709,709,709,709,709,709,,6,709,709,709,709,709,,,709,709,709,709,709", "709,709,,,709,709,709,709,709,709,709,709,709,709,709,709,709,709,709", "709,709,709,709,709,709,709,709,,,709,,,,,,,,709,709,,709,709,709,709", "709,709,709,,,709,,,,,709,709,709,709,,,,,,,,,,,,,709,709,,709,709,709", "709,709,709,709,709,709,709,709,,,709,65,65,65,65,65,65,65,65,,,65,65", "65,65,65,,,65,65,65,65,65,65,65,,,65,65,65,65,65,65,65,65,65,65,65,65", "65,65,65,65,65,65,65,65,65,65,65,65,65,65,65,,,,,,,65,65,,65,65,65,65", "65,65,65,,,65,,,,,65,65,65,65,,,,,,65,,,,,,,65,65,,65,65,65,65,65,65", "65,65,65,65,65,,,65,79,79,79,79,79,79,79,79,,,79,79,79,79,79,,,79,79", "79,79,79,79,79,,,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79,79", "79,79,79,79,79,79,79,79,79,79,,,,,,,79,79,,79,79,79,79,79,79,79,,,79", ",,,,79,79,79,79,,,,,,,,,,,,,79,79,,79,79,79,79,79,79,79,79,79,79,79", ",,79,185,185,185,185,185,185,185,185,,,185,185,185,185,185,,,185,185", "185,185,185,185,185,,,185,185,185,185,185,185,185,185,185,185,185,185", "185,185,185,185,185,185,185,185,185,185,185,185,185,185,185,,,,,,,185", "185,,185,185,185,185,185,185,185,,,185,,,,,185,185,185,185,,,,,,,,,", ",,,185,185,,185,185,185,185,185,185,185,185,185,185,185,491,491,185", ",491,,,,,,,,491,491,,491,491,491,491,491,491,491,,,491,,,,,491,491,491", "491,,,,,,491,,,,,,,491,491,,491,491,491,491,491,491,491,491,491,491", "491,881,881,491,,881,,,,,,,,881,881,,881,881,881,881,881,881,881,,,881", ",,,,881,881,881,881,,,,,,881,,,,,,,881,881,,881,881,881,881,881,881", "881,881,881,881,881,882,882,881,,882,,,,,,,,882,882,,882,882,882,882", "882,882,882,,,882,,,,,882,882,882,882,,,,,,,,,,,,,882,882,,882,882,882", "882,882,882,882,882,882,882,882,194,194,882,,194,,,,,,,,194,194,,194", "194,194,194,194,194,194,,,194,,,,,194,194,194,194,,,,,,194,,,,,,,194", "194,,194,194,194,194,194,194,194,194,194,194,194,503,503,194,,503,,", ",,,,,503,503,,503,503,503,503,503,503,503,,,503,,,,,503,503,503,503", ",,,,,,,,,,,,503,503,,503,503,503,503,503,503,503,503,503,503,503,627", "627,503,,627,,,,,,,,627,627,,627,627,627,627,627,627,627,,,627,,,,,627", "627,627,627,,,,,,,,,,,,,627,627,,627,627,627,627,627,627,627,627,627", "627,627,502,502,627,,502,,,,,,,,502,502,,502,502,502,502,502,502,502", ",,502,,,,,502,502,502,502,,,,,,502,,,,,,,502,502,,502,502,502,502,502", "502,502,502,502,502,502,765,765,502,,765,,,,,,,,765,765,,765,765,765", "765,765,765,765,,,765,,,,,765,765,765,765,,,,,,,,,,,,,765,765,,765,765", "765,765,765,765,765,765,765,765,765,628,628,765,,628,,,,,,,,628,628", ",628,628,628,628,628,628,628,,,628,,,,,628,628,628,628,,,,,,,,,,,,,628", "628,,628,628,628,628,628,628,628,628,628,628,628,420,420,628,,420,,", ",,,,,420,420,,420,420,420,420,420,420,420,,,420,,,,,420,420,420,420", ",,,,,420,,,,,,,420,420,,420,420,420,420,420,420,420,420,420,420,420", "421,421,420,,421,,,,,,,,421,421,,421,421,421,421,421,421,421,,,421,", ",,,421,421,421,421,,,,,,,,,,,,,421,421,,421,421,421,421,421,421,421", "421,421,421,421,257,257,421,,257,,,,,,,,257,257,,257,257,257,257,257", "257,257,,,257,,,,,257,257,257,257,,,,,,,,,,,,,257,257,,257,257,257,257", "257,257,257,257,257,257,257,256,256,257,,256,,,,,,,,256,256,,256,256", "256,256,256,256,256,,,256,,,,,256,256,256,256,,,,,,,,,,,,,256,256,,256", "256,256,256,256,256,256,256,256,256,256,691,691,256,,691,,,,,,,,691", "691,,691,691,691,691,691,691,691,,,691,,,,,691,691,691,691,,,,,,,,,", ",,,691,691,,691,691,691,691,691,691,691,691,691,691,691,693,693,691", ",693,,,,,,,,693,693,,693,693,693,693,693,693,693,,,693,,,,,693,693,693", "693,,,,,,693,,,,,,,693,693,,693,693,693,693,693,693,693,693,693,693", "693,195,195,693,,195,,,,,,,,195,195,,195,195,195,195,195,195,195,,,195", ",,,,195,195,195,195,,,,,,,,,,,,,195,195,,195,195,195,195,195,195,195", "195,195,195,195,492,492,195,,492,,,,,,,,492,492,,492,492,492,492,492", "492,492,,,492,,,,,492,492,492,492,,,,,,,,,,,,,492,492,,492,492,492,492", "492,492,492,492,492,492,492,,,492"];

      racc_action_check = arr = (($a = $opal.Object._scope.Array) == null ? $opal.cm('Array') : $a).$new(22164, nil);

      idx = 0;

      ($a = ($c = clist).$each, $a._p = (TMP_3 = function(str) {

        var self = TMP_3._s || this, TMP_4, $a, $b;
        if (str == null) str = nil;
        
        return ($a = ($b = str.$split(",", -1)).$each, $a._p = (TMP_4 = function(i) {

          var self = TMP_4._s || this, $a;
          if (i == null) i = nil;
          
          if (($a = i['$empty?']()) === false || $a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, TMP_4._s = self, TMP_4), $a).call($b)
      }, TMP_3._s = Grammar, TMP_3), $a).call($c);

      racc_action_pointer = [-2, 1150, nil, 191, nil, 949, 20613, 20283, 990, 979, 948, 936, 982, 337, -62, 109, nil, 1687, 1809, 2431, 997, nil, 2175, 2303, 2431, 502, 198, 2773, 2901, nil, 3027, 3149, 3271, nil, 849, 528, 909, 418, 3893, 4015, 4137, 807, 254, nil, nil, nil, nil, nil, nil, nil, 4499, nil, 4632, 4754, 4882, 8, 6365, 5254, 5376, nil, nil, 5498, 5620, 768, nil, 20832, nil, nil, nil, nil, nil, -48, nil, nil, nil, nil, nil, 669, 664, 20941, nil, nil, nil, 6474, nil, nil, 6602, nil, nil, nil, nil, nil, nil, nil, nil, nil, 789, nil, 6852, nil, nil, nil, 6974, 7096, 7218, 7340, 7462, nil, 543, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, 21050, 652, nil, 7950, 8072, 8194, 8316, 8438, 8560, 21286, 21994, 8932, 9054, 9176, nil, 255, 15, 547, -44, 407, 447, 10036, 10158, nil, nil, 10280, 201, 10524, 10646, 10768, 10890, 11012, 11134, 11256, 11378, 11500, 11622, 11744, 11866, 11988, 12110, 12232, 12354, 12476, 12598, 12720, 12842, 12964, 13086, 13208, 13330, 13452, 13574, nil, nil, nil, 1687, nil, 63, -25, nil, 14068, 5, 14318, nil, nil, nil, nil, 14440, nil, nil, 21817, 21758, 103, 14928, 15056, nil, nil, nil, nil, nil, nil, nil, 15184, 178, 15440, 393, 531, 539, 15928, 16056, 433, 257, 621, 332, 621, 637, -1, nil, 691, 559, nil, 17283, nil, 183, 743, 762, 340, nil, 802, nil, 18015, nil, 18137, -25, nil, 283, 296, 814, 268, 797, nil, 40, nil, nil, 390, 5633, nil, nil, nil, 836, 841, nil, 916, 942, nil, nil, nil, nil, nil, nil, 2342, nil, nil, nil, 898, nil, nil, 896, 470, 70, 63, 17649, 17527, 327, 186, 654, 759, 7706, nil, 6352, 432, 534, 335, 434, 435, -4, 467, 468, nil, 458, nil, nil, 120, nil, -51, nil, 265, nil, 41, 1034, 227, nil, 978, -43, nil, 224, nil, nil, nil, nil, nil, nil, 1071, nil, nil, nil, nil, nil, nil, 20503, nil, nil, nil, 20393, 950, 948, nil, nil, 821, nil, 242, 917, nil, 902, nil, nil, 2303, 893, 519, 530, 360, nil, nil, nil, 488, 816, 566, nil, 1193, 3399, nil, 2053, nil, nil, 21640, 21699, 4381, 107, 5864, 8810, 13818, 58, nil, 4015, 4259, 692, 612, 522, 480, 477, 330, 4450, 3145, 2677, 4754, 3893, 3267, 2724, 2854, 3399, 3649, 3771, 4632, 3527, 557, 1134, 4137, 4381, 2175, 261, nil, 13940, nil, nil, 14190, nil, 17039, nil, nil, 20103, nil, nil, 20157, -47, nil, 943, 918, 147, 1030, 1122, nil, nil, 19863, 182, 275, 1058, nil, 1008, 970, nil, nil, 954, 19741, 957, 19613, 21109, 22053, 417, 898, nil, nil, 850, nil, 19491, 19369, 19247, 21463, 21345, 3027, 19125, 936, 931, 842, nil, 18997, nil, nil, 18869, nil, 18747, nil, nil, nil, nil, 18625, 18503, 812, nil, 451, nil, nil, 18381, 3162, nil, 588, nil, nil, 811, nil, 2214, nil, 753, 808, nil, nil, 18259, 855, nil, nil, 17893, -19, 103, 830, 821, 17771, nil, nil, -2, 755, nil, 338, nil, 33, 17405, nil, 2835, nil, nil, nil, 3, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, 193, nil, nil, nil, 660, nil, nil, nil, nil, nil, 17161, 659, 19985, 386, 16917, 16795, 620, nil, nil, nil, 16673, 606, nil, 16551, 167, 194, 16424, 16296, 581, 699, nil, 16178, nil, 629, nil, 15806, 520, nil, 544, 15684, nil, 496, nil, nil, nil, nil, nil, 15562, nil, 390, 246, 21404, 21581, 15312, 1193, 99, nil, nil, 127, 14806, 14684, nil, 3, 14562, 912, nil, -36, 192, 189, 69, 195, 277, 124, 13696, 1565, 183, 194, 315, 254, 10402, nil, nil, 213, nil, 240, 370, nil, nil, 249, nil, 267, 227, 353, 313, 327, nil, nil, 370, 2470, nil, 23, nil, 479, nil, nil, nil, nil, nil, 513, nil, 516, 9914, 9792, -13, nil, 21876, 9664, 21935, nil, nil, 9542, 243, 185, 9420, 9298, 3201, 116, 552, 554, 565, nil, 560, nil, 20723, 618, 857, 8688, nil, nil, nil, 2559, 649, 7828, 7584, nil, 1071, nil, 1321, nil, nil, 1443, nil, 1809, 6730, 6230, 6108, 96, 1931, nil, 704, 807, nil, nil, 708, nil, nil, 731, 734, 368, 802, 5986, nil, 724, 828, 720, 241, nil, nil, 839, nil, 5742, 731, 779, nil, nil, nil, nil, nil, nil, 21522, nil, 440, nil, nil, nil, nil, 686, 872, nil, nil, 887, 5132, 5010, nil, nil, 83, 39, 322, nil, 827, 826, 4259, 115, nil, nil, 922, 929, 817, nil, 4562, nil, 600, nil, nil, 590, 3771, nil, nil, nil, nil, nil, nil, nil, 839, 833, nil, 949, 3649, nil, nil, nil, 875, 840, nil, nil, nil, 3527, nil, nil, 71, 2681, nil, 889, 1031, nil, nil, 2559, nil, 997, 1000, 2053, 1931, nil, nil, 1019, nil, 1565, nil, nil, 945, 909, 911, nil, -113, 907, nil, nil, 3284, nil, nil, nil, 1443, nil, 1321, 341, 364, 1005, 369, nil, nil, 77, nil, nil, 63, 1071, nil, 1062, nil, 529, nil, nil, nil, 949, 1076, 821, 21168, 21227, 398, 699, nil, nil, nil, 1097, nil, 982, 1119, nil, 1040, -7, 62, 90, 404, 614, nil, nil, nil, 437, nil];

      racc_action_default = [-514, -516, -1, -503, -4, -5, -516, -516, -516, -516, -516, -516, -516, -516, -257, -31, -32, -516, -516, -37, -39, -40, -268, -307, -308, -44, -235, -235, -235, -56, -514, -60, -67, -69, -516, -434, -516, -516, -516, -516, -516, -505, -216, -250, -251, -252, -253, -254, -255, -256, -493, -259, -516, -514, -514, -276, -514, -516, -516, -281, -284, -503, -516, -293, -299, -516, -309, -310, -379, -380, -381, -382, -383, -514, -386, -514, -514, -514, -514, -514, -413, -419, -420, -423, -424, -425, -426, -427, -428, -429, -430, -431, -432, -433, -436, -437, -516, -3, -504, -510, -511, -512, -516, -516, -516, -516, -516, -7, -516, -95, -96, -97, -98, -99, -100, -101, -104, -105, -106, -107, -108, -109, -110, -111, -112, -113, -114, -115, -116, -117, -118, -119, -120, -121, -122, -123, -124, -125, -126, -127, -128, -129, -130, -131, -132, -133, -134, -135, -136, -137, -138, -139, -140, -141, -142, -143, -144, -145, -146, -147, -148, -149, -150, -151, -152, -153, -154, -155, -156, -157, -158, -159, -160, -161, -162, -163, -164, -165, -166, -167, -168, -169, -170, -171, -172, -516, -12, -102, -514, -514, -516, -516, -516, -514, -516, -516, -516, -516, -516, -35, -516, -434, -516, -257, -516, -516, -514, -516, -36, -208, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -516, -350, -352, -41, -217, -228, -515, -515, -232, -516, -243, -516, -268, -307, -308, -487, -516, -42, -43, -516, -516, -48, -514, -516, -275, -355, -362, -364, -54, -360, -55, -516, -56, -514, -516, -516, -61, -64, -514, -75, -516, -516, -82, -271, -505, -516, -311, -361, -516, -66, -516, -71, -264, -421, -422, -516, -193, -194, -209, -516, -506, -514, -505, -218, -507, -507, -516, -507, -516, -484, -507, -277, -278, -516, -516, -322, -323, -331, -514, -456, -338, -514, -514, -349, -452, -453, -454, -455, -457, -516, -468, -473, -474, -476, -477, -478, -516, -38, -516, -516, -516, -516, -503, -516, -504, -516, -516, -296, -516, -95, -96, -132, -133, -149, -154, -161, -164, -302, -516, -434, -482, -516, -384, -516, -399, -516, -401, -516, -516, -516, -391, -516, -516, -397, -516, -412, -414, -415, -416, -417, 904, -6, -513, -13, -14, -15, -16, -17, -516, -9, -10, -11, -516, -516, -516, -20, -28, -173, -243, -516, -516, -21, -29, -30, -22, -175, -516, -494, -495, -235, -357, -496, -497, -494, -235, -495, -359, -499, -500, -27, -182, -33, -34, -516, -516, -514, -264, -516, -516, -516, -516, -274, -183, -184, -185, -186, -187, -188, -189, -190, -195, -196, -197, -198, -199, -200, -201, -202, -203, -204, -205, -206, -207, -210, -211, -212, -213, -516, -514, -229, -516, -242, -230, -516, -240, -516, -244, -490, -235, -494, -495, -235, -514, -49, -516, -505, -505, -515, -228, -236, -237, -516, -514, -514, -516, -270, -516, -57, -262, -72, -62, -516, -516, -514, -516, -516, -81, -516, -421, -422, -68, -73, -516, -516, -516, -516, -516, -214, -516, -371, -516, -516, -219, -509, -508, -221, -509, -266, -509, -486, -267, -485, -319, -514, -514, -516, -321, -516, -340, -347, -516, -344, -345, -516, -348, -456, -516, -459, -516, -461, -463, -467, -475, -479, -514, -312, -313, -314, -514, -516, -516, -516, -516, -514, -366, -290, -91, -516, -93, -516, -257, -516, -516, -300, -451, -304, -501, -502, -505, -385, -400, -403, -404, -406, -387, -402, -388, -389, -390, -516, -393, -395, -396, -516, -418, -8, -103, -18, -19, -516, -249, -516, -265, -516, -516, -50, -226, -227, -356, -516, -52, -358, -516, -494, -495, -494, -495, -516, -173, -273, -516, -334, -516, -336, -514, -515, -241, -245, -516, -488, -516, -489, -45, -353, -46, -354, -514, -222, -516, -516, -516, -516, -516, -37, -516, -234, -238, -516, -514, -514, -269, -57, -516, -65, -70, -516, -494, -495, -514, -498, -80, -516, -516, -181, -191, -192, -516, -514, -514, -260, -261, -507, -245, -516, -516, -320, -332, -516, -339, -514, -333, -516, -514, -514, -469, -458, -516, -516, -466, -514, -315, -514, -282, -316, -317, -318, -285, -516, -288, -516, -516, -516, -91, -92, -516, -514, -516, -294, -438, -516, -516, -516, -514, -514, -451, -516, -481, -481, -481, -450, -456, -471, -516, -516, -516, -514, -392, -394, -398, -174, -247, -516, -516, -24, -177, -25, -178, -51, -26, -179, -53, -180, -516, -516, -516, -265, -215, -335, -516, -516, -231, -246, -516, -223, -224, -514, -514, -505, -516, -516, -239, -516, -516, -63, -76, -74, -272, -514, -329, -514, -372, -514, -373, -374, -220, -324, -325, -346, -516, -264, -516, -342, -343, -460, -462, -465, -516, -326, -327, -516, -514, -514, -287, -289, -516, -516, -91, -94, -498, -516, -514, -516, -440, -297, -516, -516, -505, -442, -516, -446, -516, -448, -449, -516, -516, -305, -483, -405, -408, -409, -410, -411, -516, -248, -23, -176, -516, -337, -351, -47, -516, -515, -363, -365, -2, -514, -378, -330, -516, -516, -376, -263, -514, -464, -279, -516, -280, -516, -516, -516, -514, -291, -265, -516, -439, -514, -301, -303, -516, -481, -481, -480, -481, -516, -472, -470, -451, -407, -225, -233, -516, -377, -514, -83, -516, -516, -90, -375, -341, -516, -283, -286, -514, -514, -295, -516, -441, -516, -444, -445, -447, -514, -371, -514, -516, -516, -89, -514, -367, -368, -369, -516, -298, -481, -516, -370, -516, -494, -495, -498, -88, -514, -292, -443, -306, -84, -328];

      clist = ["10,296,2,303,354,302,307,112,112,262,266,459,283,283,654,335,336,549", "373,339,406,411,470,101,507,541,545,208,534,473,10,320,272,273,393,400", "107,187,14,312,671,115,115,283,497,700,243,243,243,773,663,679,683,242", "242,242,258,265,267,97,380,381,382,383,613,271,112,613,14,279,279,666", "199,509,512,670,516,703,304,518,112,101,465,468,690,632,620,286,567", "622,851,754,526,533,577,529,531,616,10,706,279,269,240,254,255,611,10", "299,705,558,378,560,334,334,634,776,334,340,384,623,337,362,364,777", "373,371,338,778,688,635,636,870,343,787,559,842,14,345,699,561,709,853", "310,403,14,302,519,308,832,669,616,305,357,476,298,694,562,334,334,334", "334,455,479,480,885,687,758,851,825,359,360,355,366,576,385,369,804", "711,712,793,846,342,12,186,98,309,112,771,10,10,390,391,821,1,,,415", ",,392,398,401,,,,416,10,,272,,,,12,,397,397,,703,,,,784,,,,684,14,14", ",,,,,,,,613,534,,706,675,494,,,14,640,406,411,705,,,,418,419,,283,,", ",508,,,427,,,262,,266,283,,10,903,272,,,10,,272,,,12,,,474,243,,320", "838,12,498,475,242,243,663,522,546,547,,10,242,35,,673,,714,483,886", "671,14,,489,,279,14,829,,,645,,,,,,,283,279,283,,645,487,35,276,276", "848,,848,14,878,848,472,477,269,847,,849,,269,,481,,,,,,,,724,,,101", ",727,276,620,622,356,796,798,799,703,12,12,604,,302,,534,,,737,,557", ",557,,,112,892,12,594,112,706,334,334,598,548,750,,35,744,705,,,,,,35", ",,612,,,848,565,,582,,,,583,115,890,415,,115,791,792,,,,761,,625,626", ",,592,,,,642,597,302,764,,,768,769,594,,,594,12,742,743,,,12,,,,,658", ",613,,,,,283,,837,,,830,,,,,,12,,,,,,,,35,35,498,,,415,,619,,,621,759", ",,,,415,,35,,283,875,876,,877,840,,859,,,,645,10,10,660,661,,710,279", ",,,,,,299,,,,,,,,10,,676,,10,887,678,,,10,,686,900,,,884,,14,14,653", ",,,,557,680,680,872,,35,,,,276,35,,,695,14,,612,,14,320,856,,276,14", ",,,735,,,,,,35,720,722,,,,891,725,865,,,,,10,,736,698,,,,,,283,,,10", ",739,,,594,,283,598,,,,10,10,748,749,,,498,786,356,302,356,782,,802", "14,,752,,,788,,,,,,745,14,,,,,,,,,,,,14,14,,,279,,397,,,,,,,,279,,,", ",415,,,,,,,10,10,,12,12,817,,,645,,,112,781,10,,809,,,789,790,,,,794", "12,,594,594,12,811,,,,12,,,,,14,14,,,,,334,,,,,,808,14,334,,845,,,10", ",824,,,,,,,,415,,,,818,,,,,,,10,10,834,835,,,,,,,10,276,,866,,,12,14", ",,,,,,,680,,,12,,283,841,,,,,,,14,14,12,12,,35,35,10,,858,14,864,356", ",,893,,302,,,,,10,,869,,35,10,,,35,,,,,35,,,,,,,,,10,14,879,,,863,,", ",,,10,,888,,,14,,,10,,14,12,12,415,10,,898,334,,,,,,,12,,,14,,,,,,,", ",,,14,,,35,,,,,14,,,,,,14,35,,,,,,,,,,,,35,35,,12,276,,,,,,,,,,276,", ",,,,,,,,12,12,,,,,13,,,,12,,,,,,,,,,,,,200,200,,,,200,200,200,,,,,,13", "277,277,,35,35,,,,12,,,,,,,,35,,,,,200,,12,,,200,200,12,,200,277,,,", ",,,,,,395,399,,,12,,,,,,,,,,,12,,,,35,,,,12,,,13,,,12,200,200,200,200", "13,,,,,,35,35,,,,,,,,,35,,,,,,461,,463,,,,,464,,,,,,,,,,,,,,,,,,,,,", "35,,,,860,,,,,,,,,,,35,,,,,35,,,,,,,,,,,13,13,200,200,200,,35,,200,200", "200,,,,,,,35,13,200,,,,,,35,,,,,,35,,,,,,26,,,,,,,,,,,,,,,,,26,26,,", ",26,26,26,,,,,,26,,,,200,200,,,,,,,,200,,13,,,,277,13,,26,587,,,,26", "26,,,26,277,,,,,,,,,,,13,,,,,,,,,,,,,,,,,,,,,,,,,26,,,,26,26,26,26,26", ",,,,,200,200,614,,,617,556,618,556,,,,,,,,,,,,,200,,631,,,,,,,,,,,,", ",,,,,,,,,,,,,,,,,,,614,,,617,,659,,,,,,,,,,,,,,,,26,26,26,26,26,,,,26", "26,26,,,,,,,,26,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,717,,,,,,,,200", ",,,,,26,26,,,277,,,,,26,,26,,738,,,26,,,,,200,,,,,,614,,,,,,,,,13,13", ",26,,,,667,,,,,,,,,,757,,,,13,,,,13,,,,,13,,,,,,,,,200,,,26,26,,,,,", "395,,,,,,,,,,,,,,26,,,,,,,200,200,,,,,200,,,,810,,,,,,,,,,,13,,,,,,", ",,,,,13,,,,,395,200,,,,,,13,13,,,277,,,,,,,,,,277,,,,,,,,,,,,,,,,,,", ",,,,,,,,,,,,,,,852,,,,,200,,,,,,,,200,,,13,13,,,26,,,,,,,,,13,,,,,,659", "200,,,,,,,,,,,26,,,,,,,,,659,,,,,,26,26,,,,,,,,,,13,,,,,,,,,,26,,,,26", ",,,,26,,13,13,,,,,,26,,,13,,,,,,,,,,,,,,,,,,,,,,,,,,,,26,26,,,,,26,13", ",,,861,,,,,,200,,,,26,13,,,,,13,,,,,,26,300,306,,313,,26,,,,,13,26,26", ",,,,,,,361,13,363,363,367,370,363,,,13,,,,,,13,,,,,,,,,,,,,,,,,,,,,", ",,,,,,,26,,,,,,,,26,,,26,26,209,,,,241,241,241,,,,,26,,,,,,,26,,293", "294,295,,,,,,,,,,,,,241,241,,,,,,,,,,,,,,,,,,,26,,,,,,,,300,,,,,,,,", ",,,,26,26,,,,,,,,,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,26,,,,,,,,471", ",26,,,,,26,,,,,26,,,,,,,,,,,,,,,,,26,,,,,,,,,,,26,,,394,241,402,241", ",26,417,,,,,26,,525,,,525,525,,,209,,429,430,431,432,433,434,435,436", "437,438,439,440,441,442,443,444,445,446,447,448,449,450,451,452,453", "454,,,,,,,,,241,,241,,,,,241,,,,,,241,241,,,,,,,,241,,,,,,,,,,,,,,,", ",,,,,,,,,,593,,504,,,,,,,,,,,,,,300,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,", "608,,,,,,,,,,593,,,593,608,,,,,,,,,,608,608,,,,,,,,,,300,,,,,,,,,,,", ",,,,,,241,,,,,,,,,,,,,,,,,,,,,,,,,,241,,417,605,402,,,,,,,,,,,,,,,,", ",,,,,,,,,,,,,,241,,,241,,241,,,,,,,,,,,,,,,,630,,,,,,,,,,,,241,,,,,", ",,,650,651,652,,,,,,,,,241,,,241,,241,,,,,,,,,,,,,,,,,,593,,,,,,,,,755", "760,,,,,,,,,,,525,,,525,525,,,,,,755,,755,,,,,,,,,,,,,,300,,,,,,716", ",241,,721,723,,,,,726,,,728,,,,,,,,733,,,,,,,,241,,,,,,,,,,,,,,241,593", "593,,,,,,,,,,,823,,,,827,,,,,,,,,241,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,", "241,,,,,241,,,,,,,,,,,,,,,,,,,,,,,,,525,241,812,,,,,,,,,,721,723,726", ",,,,,,,,,,,,,,241,,,,,,,,,,,755,,,,,,,,,,,300,,,,,,,,,,,,,,,,,,755,", ",,,,,,,,,,,,,241,,,,,,,,,,,,812,,,,,,,,,,,,,,,,,,,,,,,241,,,,,,,,,,", ",,,,,,,,,,241,,,,,,,,,,,,,,,,,,,,,,,241"];

      racc_goto_table = arr = (($a = $opal.Object._scope.Array) == null ? $opal.cm('Array') : $a).$new(2754, nil);

      idx = 0;

      ($a = ($d = clist).$each, $a._p = (TMP_5 = function(str) {

        var self = TMP_5._s || this, TMP_6, $a, $b;
        if (str == null) str = nil;
        
        return ($a = ($b = str.$split(",", -1)).$each, $a._p = (TMP_6 = function(i) {

          var self = TMP_6._s || this, $a;
          if (i == null) i = nil;
          
          if (($a = i['$empty?']()) === false || $a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, TMP_6._s = self, TMP_6), $a).call($b)
      }, TMP_5._s = Grammar, TMP_5), $a).call($d);

      clist = ["15,49,2,20,45,53,53,46,46,54,54,56,50,50,4,14,14,76,45,14,31,31,33,78", "3,73,73,16,135,30,15,104,2,39,22,22,12,12,21,100,136,48,48,50,41,79", "51,51,51,74,103,75,75,27,27,27,32,32,32,8,14,14,14,14,57,37,46,57,21", "21,21,108,24,52,52,108,52,107,51,52,46,78,31,31,43,57,55,40,126,55,140", "5,106,137,126,106,106,143,15,105,21,36,29,29,29,34,15,24,108,44,10,44", "24,24,58,5,24,8,10,34,83,123,123,84,45,123,85,86,87,34,34,88,89,90,91", "92,21,93,94,95,96,97,98,20,21,53,99,70,101,102,143,69,68,59,82,77,81", "24,24,24,24,110,112,113,114,115,116,140,117,121,122,80,124,125,25,127", "128,129,130,132,133,17,18,13,11,72,46,138,15,15,2,2,6,1,,,46,,,16,16", "16,,,,16,15,,2,,,,18,,51,51,,107,,,,43,,,,76,21,21,,,,,,,,,57,135,,105", "135,49,,,21,41,31,31,108,,,,24,24,,50,,,,49,,,24,,,54,,54,50,,15,74", "2,,,15,,2,,,18,,,51,51,,104,75,18,39,27,27,51,103,100,14,14,,15,27,42", ",137,,126,37,5,136,21,,37,,21,21,108,,,31,,,,,,,50,21,50,,31,40,42,42", "42,105,,105,21,79,105,29,29,36,108,,108,,36,,29,,,,,,,,33,,,78,,33,42", "55,55,42,134,134,134,107,18,18,20,,53,,135,,,56,,21,,21,,,46,4,18,54", "46,105,24,24,54,8,41,,42,30,108,,,,,,42,,,53,,,105,24,,12,,,,12,48,108", "46,,48,3,3,,,,52,,49,49,,,32,,,,20,32,53,106,,,106,106,54,,,54,18,31", "31,,,18,,,,,53,,57,,,,,50,,73,,,135,,,,,,18,,,,,,,,42,42,39,,,46,,32", ",,32,22,,,,,46,,42,,50,134,134,,134,3,,73,,,,31,15,15,2,2,,49,21,,,", ",,,24,,,,,,,,15,,2,,15,76,2,,,15,,2,134,,,73,,21,21,24,,,,,21,78,78", "3,,42,,,,42,42,,,78,21,,53,,21,104,56,,42,21,,,,100,,,,,,42,16,16,,", ",3,16,106,,,,,15,,2,24,,,,,,50,,,15,,2,,,54,,50,54,,,,15,15,2,2,,,39", "20,42,53,42,14,,45,21,,39,,,14,,,,,,27,21,,,,,,,,,,,,21,21,,,21,,51", ",,,,,,,21,,,,,46,,,,,,,15,15,,18,18,49,,,31,,,46,51,15,,2,,,78,78,,", ",78,18,,54,54,18,16,,,,18,,,,,21,21,,,,,24,,,,,,21,21,24,,49,,,15,,2", ",,,,,,,46,,,,51,,,,,,,15,15,2,2,,,,,,,15,42,,14,,,18,21,,,,,,,,78,,", "18,,50,78,,,,,,,21,21,18,18,,42,42,15,,2,21,15,42,,,20,,53,,,,,15,,2", ",42,15,,,42,,,,,42,,,,,,,,,15,21,2,,,21,,,,,,15,,2,,,21,,,15,,21,18", "18,46,15,,2,24,,,,,,,18,,,21,,,,,,,,,,,21,,,42,,,,,21,,,,,,21,42,,,", ",,,,,,,,42,42,,18,42,,,,,,,,,,42,,,,,,,,,,18,18,,,,,19,,,,18,,,,,,,", ",,,,,19,19,,,,19,19,19,,,,,,19,19,19,,42,42,,,,18,,,,,,,,42,,,,,19,", "18,,,19,19,18,,19,19,,,,,,,,,,23,23,,,18,,,,,,,,,,,18,,,,42,,,,18,,", "19,,,18,19,19,19,19,19,,,,,,42,42,,,,,,,,,42,,,,,,23,,23,,,,,23,,,,", ",,,,,,,,,,,,,,,,,42,,,,42,,,,,,,,,,,42,,,,,42,,,,,,,,,,,19,19,19,19", "19,,42,,19,19,19,,,,,,,42,19,19,,,,,,42,,,,,,42,,,,,,35,,,,,,,,,,,,", ",,,,35,35,,,,35,35,35,,,,,,35,,,,19,19,,,,,,,,19,,19,,,,19,19,,35,23", ",,,35,35,,,35,19,,,,,,,,,,,19,,,,,,,,,,,,,,,,,,,,,,,,,35,,,,35,35,35", "35,35,,,,,,19,19,23,,,23,19,23,19,,,,,,,,,,,,,19,,23,,,,,,,,,,,,,,,", ",,,,,,,,,,,,,,,,23,,,23,,23,,,,,,,,,,,,,,,,35,35,35,35,35,,,,35,35,35", ",,,,,,,35,35,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,23,,,,,,,,19,,,,,", "35,35,,,19,,,,,35,,35,,23,,,35,,,,,19,,,,,,23,,,,,,,,,19,19,,35,,,,19", ",,,,,,,,,23,,,,19,,,,19,,,,,19,,,,,,,,,19,,,35,35,,,,,,23,,,,,,,,,,", ",,,35,,,,,,,19,19,,,,,19,,,,23,,,,,,,,,,,19,,,,,,,,,,,,19,,,,,23,19", ",,,,,19,19,,,19,,,,,,,,,,19,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,23,,,,", "19,,,,,,,,19,,,19,19,,,35,,,,,,,,,19,,,,,,23,19,,,,,,,,,,,35,,,,,,,", ",23,,,,,,35,35,,,,,,,,,,19,,,,,,,,,,35,,,,35,,,,,35,,19,19,,,,,,35,", ",19,,,,,,,,,,,,,,,,,,,,,,,,,,,,35,35,,,,,35,19,,,,19,,,,,,19,,,,35,19", ",,,,19,,,,,,35,9,9,,9,,35,,,,,19,35,35,,,,,,,,9,19,9,9,9,9,9,,,19,,", ",,,19,,,,,,,,,,,,,,,,,,,,,,,,,,,,,35,,,,,,,,35,,,35,35,26,,,,26,26,26", ",,,,35,,,,,,,35,,26,26,26,,,,,,,,,,,,,26,26,,,,,,,,,,,,,,,,,,,35,,,", ",,,,9,,,,,,,,,,,,,35,35,,,,,,,,,35,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,", ",35,,,,,,,,9,,35,,,,,35,,,,,35,,,,,,,,,,,,,,,,,35,,,,,,,,,,,35,,,26", "26,26,26,,35,26,,,,,35,,9,,,9,9,,,26,,26,26,26,26,26,26,26,26,26,26", "26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,26,,,,,,,,,26,,26,,,,,26", ",,,,,26,26,,,,,,,,26,,,,,,,,,,,,,,,,,,,,,,,,,,9,,26,,,,,,,,,,,,,,9,", ",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,9,,,,,,,,,,9,,,9,9,,,,,,,,,,9,9,,,,,", ",,,,9,,,,,,,,,,,,,,,,,,26,,,,,,,,,,,,,,,,,,,,,,,,,,26,,26,26,26,,,,", ",,,,,,,,,,,,,,,,,,,,,,,,,,26,,,26,,26,,,,,,,,,,,,,,,,26,,,,,,,,,,,,26", ",,,,,,,,26,26,26,,,,,,,,,26,,,26,,26,,,,,,,,,,,,,,,,,,9,,,,,,,,,9,9", ",,,,,,,,,,9,,,9,9,,,,,,9,,9,,,,,,,,,,,,,,9,,,,,,26,,26,,26,26,,,,,26", ",,26,,,,,,,,26,,,,,,,,26,,,,,,,,,,,,,,26,9,9,,,,,,,,,,,9,,,,9,,,,,,", ",,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,26,,,,,26,,,,,,,,,,,,,,,,,,,,,,", ",,9,26,26,,,,,,,,,,26,26,26,,,,,,,,,,,,,,,26,,,,,,,,,,,9,,,,,,,,,,,9", ",,,,,,,,,,,,,,,,,9,,,,,,,,,,,,,,,26,,,,,,,,,,,,26,,,,,,,,,,,,,,,,,,", ",,,,26,,,,,,,,,,,,,,,,,,,,,26,,,,,,,,,,,,,,,,,,,,,,,26"];

      racc_goto_check = arr = (($a = $opal.Object._scope.Array) == null ? $opal.cm('Array') : $a).$new(2754, nil);

      idx = 0;

      ($a = ($e = clist).$each, $a._p = (TMP_7 = function(str) {

        var self = TMP_7._s || this, TMP_8, $a, $b;
        if (str == null) str = nil;
        
        return ($a = ($b = str.$split(",", -1)).$each, $a._p = (TMP_8 = function(i) {

          var self = TMP_8._s || this, $a;
          if (i == null) i = nil;
          
          if (($a = i['$empty?']()) === false || $a === nil) {
            arr['$[]='](idx, i.$to_i())
          };
          return idx = idx['$+'](1);
        }, TMP_8._s = self, TMP_8), $a).call($b)
      }, TMP_7._s = Grammar, TMP_7), $a).call($e);

      racc_goto_pointer = [nil, 193, 2, -274, -492, -563, -562, nil, 56, 1761, 12, 181, 30, 176, -42, 0, 9, 119, 182, 965, -50, 38, -156, 847, 55, 67, 1873, 31, nil, 80, -230, -174, 30, -236, -350, 1190, 71, 35, nil, 2, 55, -243, 300, -470, -234, -61, 1, nil, 35, -40, -19, 24, -228, -48, -17, -379, -233, -393, -364, -107, nil, nil, nil, nil, nil, nil, nil, nil, 87, 97, 92, nil, 129, -310, -627, -495, -323, -403, 20, -516, 106, -199, 103, 61, -556, 66, -556, -424, -707, 69, -561, -210, -655, 73, -422, -215, -422, -661, 86, -164, -17, -627, -379, -474, -25, -462, -223, -484, -453, nil, -77, nil, -101, -101, -705, -386, -489, -590, nil, nil, nil, 98, 97, 46, 95, -193, -272, 97, -535, -392, -392, nil, -522, -615, -337, -298, -488, -233, -487, nil, -707, nil, nil, -363];

      racc_goto_default = [nil, nil, 506, nil, nil, 774, nil, 3, nil, 4, 5, 341, nil, nil, nil, 204, 16, 11, 205, 292, nil, 203, nil, 247, 15, nil, 19, 20, 21, nil, 25, 648, nil, nil, nil, 282, 29, nil, 31, 34, 33, nil, 201, 555, nil, 114, 409, 113, 69, nil, 42, 301, nil, 244, 407, 595, 456, 245, nil, nil, 260, 458, 43, 44, 45, 46, 47, 48, 49, nil, 261, 55, nil, nil, nil, nil, nil, nil, 542, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, 315, 314, 665, 317, nil, 318, 319, 239, nil, 413, nil, nil, nil, nil, nil, nil, 68, 70, 71, 72, nil, nil, nil, nil, 572, nil, nil, nil, nil, 372, 702, 704, nil, 325, 327, nil, 536, 537, 708, 330, 333, 252];

      racc_reduce_table = [0, 0, "racc_error", 1, 138, "_reduce_1", 4, 140, "_reduce_2", 2, 139, "_reduce_3", 1, 144, "_reduce_4", 1, 144, "_reduce_5", 3, 144, "_reduce_6", 0, 162, "_reduce_7", 4, 147, "_reduce_8", 3, 147, "_reduce_9", 3, 147, "_reduce_none", 3, 147, "_reduce_11", 2, 147, "_reduce_12", 3, 147, "_reduce_13", 3, 147, "_reduce_14", 3, 147, "_reduce_15", 3, 147, "_reduce_16", 3, 147, "_reduce_none", 4, 147, "_reduce_none", 4, 147, "_reduce_none", 3, 147, "_reduce_20", 3, 147, "_reduce_21", 3, 147, "_reduce_22", 6, 147, "_reduce_none", 5, 147, "_reduce_24", 5, 147, "_reduce_none", 5, 147, "_reduce_none", 3, 147, "_reduce_none", 3, 147, "_reduce_28", 3, 147, "_reduce_29", 3, 147, "_reduce_30", 1, 147, "_reduce_none", 1, 161, "_reduce_none", 3, 161, "_reduce_33", 3, 161, "_reduce_34", 2, 161, "_reduce_35", 2, 161, "_reduce_36", 1, 161, "_reduce_none", 1, 151, "_reduce_none", 1, 153, "_reduce_none", 1, 153, "_reduce_none", 2, 153, "_reduce_41", 2, 153, "_reduce_42", 2, 153, "_reduce_43", 1, 165, "_reduce_none", 4, 165, "_reduce_none", 4, 165, "_reduce_none", 4, 170, "_reduce_none", 2, 164, "_reduce_48", 3, 164, "_reduce_none", 4, 164, "_reduce_50", 5, 164, "_reduce_none", 4, 164, "_reduce_52", 5, 164, "_reduce_none", 2, 164, "_reduce_54", 2, 164, "_reduce_55", 1, 154, "_reduce_56", 3, 154, "_reduce_57", 1, 174, "_reduce_58", 3, 174, "_reduce_59", 1, 173, "_reduce_60", 2, 173, "_reduce_61", 3, 173, "_reduce_62", 5, 173, "_reduce_none", 2, 173, "_reduce_64", 4, 173, "_reduce_none", 2, 173, "_reduce_66", 1, 173, "_reduce_67", 3, 173, "_reduce_none", 1, 176, "_reduce_69", 3, 176, "_reduce_70", 2, 175, "_reduce_71", 3, 175, "_reduce_72", 1, 178, "_reduce_none", 3, 178, "_reduce_none", 1, 177, "_reduce_75", 4, 177, "_reduce_76", 3, 177, "_reduce_77", 3, 177, "_reduce_none", 3, 177, "_reduce_none", 3, 177, "_reduce_none", 2, 177, "_reduce_none", 1, 177, "_reduce_none", 1, 152, "_reduce_83", 4, 152, "_reduce_84", 3, 152, "_reduce_85", 3, 152, "_reduce_86", 3, 152, "_reduce_87", 3, 152, "_reduce_88", 2, 152, "_reduce_none", 1, 152, "_reduce_none", 1, 180, "_reduce_none", 2, 181, "_reduce_92", 1, 181, "_reduce_93", 3, 181, "_reduce_94", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_none", 1, 182, "_reduce_98", 1, 182, "_reduce_99", 1, 149, "_reduce_100", 1, 149, "_reduce_none", 1, 150, "_reduce_102", 3, 150, "_reduce_103", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 183, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 1, 184, "_reduce_none", 3, 163, "_reduce_173", 5, 163, "_reduce_none", 3, 163, "_reduce_175", 6, 163, "_reduce_176", 5, 163, "_reduce_177", 5, 163, "_reduce_none", 5, 163, "_reduce_none", 5, 163, "_reduce_none", 4, 163, "_reduce_none", 3, 163, "_reduce_none", 3, 163, "_reduce_183", 3, 163, "_reduce_184", 3, 163, "_reduce_185", 3, 163, "_reduce_186", 3, 163, "_reduce_187", 3, 163, "_reduce_188", 3, 163, "_reduce_189", 3, 163, "_reduce_190", 4, 163, "_reduce_none", 4, 163, "_reduce_none", 2, 163, "_reduce_193", 2, 163, "_reduce_194", 3, 163, "_reduce_195", 3, 163, "_reduce_196", 3, 163, "_reduce_197", 3, 163, "_reduce_198", 3, 163, "_reduce_199", 3, 163, "_reduce_200", 3, 163, "_reduce_201", 3, 163, "_reduce_202", 3, 163, "_reduce_203", 3, 163, "_reduce_204", 3, 163, "_reduce_205", 3, 163, "_reduce_206", 3, 163, "_reduce_207", 2, 163, "_reduce_208", 2, 163, "_reduce_209", 3, 163, "_reduce_210", 3, 163, "_reduce_211", 3, 163, "_reduce_212", 3, 163, "_reduce_213", 3, 163, "_reduce_214", 5, 163, "_reduce_215", 1, 163, "_reduce_none", 1, 160, "_reduce_none", 1, 157, "_reduce_218", 2, 157, "_reduce_219", 4, 157, "_reduce_220", 2, 157, "_reduce_221", 3, 191, "_reduce_222", 4, 191, "_reduce_223", 4, 191, "_reduce_none", 6, 191, "_reduce_none", 1, 192, "_reduce_none", 1, 192, "_reduce_none", 1, 166, "_reduce_228", 2, 166, "_reduce_229", 2, 166, "_reduce_230", 4, 166, "_reduce_231", 1, 166, "_reduce_232", 4, 195, "_reduce_none", 1, 195, "_reduce_none", 0, 197, "_reduce_235", 2, 169, "_reduce_236", 1, 196, "_reduce_none", 2, 196, "_reduce_238", 3, 196, "_reduce_239", 2, 194, "_reduce_240", 2, 193, "_reduce_241", 1, 193, "_reduce_242", 1, 188, "_reduce_243", 2, 188, "_reduce_244", 3, 188, "_reduce_245", 4, 188, "_reduce_246", 3, 159, "_reduce_247", 4, 159, "_reduce_none", 2, 159, "_reduce_249", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 1, 187, "_reduce_none", 0, 219, "_reduce_259", 4, 187, "_reduce_260", 4, 187, "_reduce_261", 3, 187, "_reduce_262", 3, 187, "_reduce_263", 2, 187, "_reduce_264", 4, 187, "_reduce_265", 3, 187, "_reduce_266", 3, 187, "_reduce_267", 1, 187, "_reduce_268", 4, 187, "_reduce_269", 3, 187, "_reduce_270", 1, 187, "_reduce_271", 5, 187, "_reduce_272", 4, 187, "_reduce_273", 3, 187, "_reduce_274", 2, 187, "_reduce_275", 1, 187, "_reduce_none", 2, 187, "_reduce_277", 2, 187, "_reduce_278", 6, 187, "_reduce_279", 6, 187, "_reduce_280", 0, 220, "_reduce_281", 0, 221, "_reduce_282", 7, 187, "_reduce_283", 0, 222, "_reduce_284", 0, 223, "_reduce_285", 7, 187, "_reduce_286", 5, 187, "_reduce_287", 4, 187, "_reduce_288", 5, 187, "_reduce_289", 0, 224, "_reduce_290", 0, 225, "_reduce_291", 9, 187, "_reduce_none", 0, 226, "_reduce_293", 0, 227, "_reduce_294", 7, 187, "_reduce_295", 0, 228, "_reduce_296", 0, 229, "_reduce_297", 8, 187, "_reduce_298", 0, 230, "_reduce_299", 0, 231, "_reduce_300", 6, 187, "_reduce_301", 0, 232, "_reduce_302", 6, 187, "_reduce_303", 0, 233, "_reduce_304", 0, 234, "_reduce_305", 9, 187, "_reduce_306", 1, 187, "_reduce_307", 1, 187, "_reduce_308", 1, 187, "_reduce_309", 1, 187, "_reduce_none", 1, 156, "_reduce_none", 1, 210, "_reduce_none", 1, 210, "_reduce_none", 1, 210, "_reduce_none", 2, 210, "_reduce_none", 1, 212, "_reduce_none", 1, 212, "_reduce_none", 1, 212, "_reduce_none", 2, 209, "_reduce_319", 3, 235, "_reduce_320", 2, 235, "_reduce_321", 1, 235, "_reduce_none", 1, 235, "_reduce_none", 3, 236, "_reduce_324", 3, 236, "_reduce_325", 1, 211, "_reduce_326", 0, 238, "_reduce_327", 6, 211, "_reduce_328", 1, 142, "_reduce_none", 2, 142, "_reduce_330", 1, 239, "_reduce_331", 3, 239, "_reduce_332", 3, 240, "_reduce_333", 1, 171, "_reduce_none", 2, 171, "_reduce_335", 1, 171, "_reduce_336", 3, 171, "_reduce_337", 1, 241, "_reduce_338", 2, 243, "_reduce_339", 1, 243, "_reduce_340", 6, 237, "_reduce_341", 4, 237, "_reduce_342", 4, 237, "_reduce_343", 2, 237, "_reduce_344", 2, 237, "_reduce_345", 4, 237, "_reduce_346", 2, 237, "_reduce_347", 2, 237, "_reduce_348", 1, 237, "_reduce_349", 0, 247, "_reduce_350", 5, 246, "_reduce_351", 2, 167, "_reduce_352", 4, 167, "_reduce_none", 4, 167, "_reduce_none", 2, 208, "_reduce_355", 4, 208, "_reduce_356", 3, 208, "_reduce_357", 4, 208, "_reduce_358", 3, 208, "_reduce_359", 2, 208, "_reduce_360", 1, 208, "_reduce_361", 0, 249, "_reduce_362", 5, 207, "_reduce_363", 0, 250, "_reduce_364", 5, 207, "_reduce_365", 0, 252, "_reduce_366", 6, 213, "_reduce_367", 1, 251, "_reduce_368", 1, 251, "_reduce_none", 6, 141, "_reduce_370", 0, 141, "_reduce_371", 1, 253, "_reduce_372", 1, 253, "_reduce_none", 1, 253, "_reduce_none", 2, 254, "_reduce_375", 1, 254, "_reduce_376", 2, 143, "_reduce_377", 1, 143, "_reduce_none", 1, 199, "_reduce_none", 1, 199, "_reduce_none", 1, 199, "_reduce_none", 1, 200, "_reduce_382", 1, 257, "_reduce_none", 2, 257, "_reduce_none", 3, 258, "_reduce_385", 1, 258, "_reduce_386", 3, 201, "_reduce_387", 3, 202, "_reduce_388", 3, 203, "_reduce_389", 3, 203, "_reduce_390", 1, 261, "_reduce_391", 3, 261, "_reduce_392", 1, 262, "_reduce_393", 2, 262, "_reduce_394", 3, 204, "_reduce_395", 3, 204, "_reduce_396", 1, 264, "_reduce_397", 3, 264, "_reduce_398", 1, 259, "_reduce_399", 2, 259, "_reduce_400", 1, 260, "_reduce_401", 2, 260, "_reduce_402", 1, 263, "_reduce_403", 0, 266, "_reduce_404", 3, 263, "_reduce_405", 0, 267, "_reduce_406", 4, 263, "_reduce_407", 1, 265, "_reduce_408", 1, 265, "_reduce_409", 1, 265, "_reduce_410", 1, 265, "_reduce_none", 2, 185, "_reduce_412", 1, 185, "_reduce_413", 1, 268, "_reduce_none", 1, 268, "_reduce_none", 1, 268, "_reduce_none", 1, 268, "_reduce_none", 3, 256, "_reduce_418", 1, 255, "_reduce_419", 1, 255, "_reduce_420", 2, 255, "_reduce_none", 2, 255, "_reduce_none", 1, 179, "_reduce_423", 1, 179, "_reduce_424", 1, 179, "_reduce_425", 1, 179, "_reduce_426", 1, 179, "_reduce_427", 1, 179, "_reduce_428", 1, 179, "_reduce_429", 1, 179, "_reduce_430", 1, 179, "_reduce_431", 1, 179, "_reduce_432", 1, 179, "_reduce_433", 1, 205, "_reduce_434", 1, 155, "_reduce_435", 1, 158, "_reduce_436", 1, 158, "_reduce_none", 1, 214, "_reduce_438", 3, 214, "_reduce_439", 2, 214, "_reduce_440", 4, 216, "_reduce_441", 2, 216, "_reduce_442", 6, 269, "_reduce_443", 4, 269, "_reduce_444", 4, 269, "_reduce_445", 2, 269, "_reduce_446", 4, 269, "_reduce_447", 2, 269, "_reduce_448", 2, 269, "_reduce_449", 1, 269, "_reduce_450", 0, 269, "_reduce_451", 1, 272, "_reduce_452", 1, 272, "_reduce_453", 1, 272, "_reduce_454", 1, 272, "_reduce_455", 1, 272, "_reduce_456", 1, 273, "_reduce_457", 3, 273, "_reduce_458", 1, 275, "_reduce_459", 3, 275, "_reduce_none", 1, 276, "_reduce_461", 3, 276, "_reduce_462", 1, 274, "_reduce_none", 4, 274, "_reduce_none", 3, 274, "_reduce_none", 2, 274, "_reduce_none", 1, 274, "_reduce_none", 1, 244, "_reduce_468", 3, 244, "_reduce_469", 3, 277, "_reduce_470", 1, 270, "_reduce_471", 3, 270, "_reduce_472", 1, 278, "_reduce_none", 1, 278, "_reduce_none", 2, 245, "_reduce_475", 1, 245, "_reduce_476", 1, 279, "_reduce_none", 1, 279, "_reduce_none", 2, 242, "_reduce_479", 2, 271, "_reduce_480", 0, 271, "_reduce_481", 1, 217, "_reduce_482", 4, 217, "_reduce_483", 1, 206, "_reduce_484", 2, 206, "_reduce_485", 2, 206, "_reduce_486", 1, 190, "_reduce_487", 3, 190, "_reduce_488", 3, 280, "_reduce_489", 2, 280, "_reduce_490", 1, 172, "_reduce_none", 1, 172, "_reduce_none", 1, 172, "_reduce_none", 1, 168, "_reduce_none", 1, 168, "_reduce_none", 1, 168, "_reduce_none", 1, 168, "_reduce_none", 1, 248, "_reduce_none", 1, 248, "_reduce_none", 1, 248, "_reduce_none", 1, 218, "_reduce_none", 1, 218, "_reduce_none", 0, 145, "_reduce_none", 1, 145, "_reduce_none", 0, 186, "_reduce_none", 1, 186, "_reduce_none", 0, 189, "_reduce_none", 1, 189, "_reduce_none", 1, 189, "_reduce_none", 1, 215, "_reduce_none", 1, 215, "_reduce_none", 1, 148, "_reduce_none", 2, 148, "_reduce_none", 0, 146, "_reduce_none", 0, 198, "_reduce_none"];

      racc_reduce_n = 516;

      racc_shift_n = 904;

      racc_token_table = $hash(false, 0, "error", 1, "CLASS", 2, "MODULE", 3, "DEF", 4, "UNDEF", 5, "BEGIN", 6, "RESCUE", 7, "ENSURE", 8, "END", 9, "IF", 10, "UNLESS", 11, "THEN", 12, "ELSIF", 13, "ELSE", 14, "CASE", 15, "WHEN", 16, "WHILE", 17, "UNTIL", 18, "FOR", 19, "BREAK", 20, "NEXT", 21, "REDO", 22, "RETRY", 23, "IN", 24, "DO", 25, "DO_COND", 26, "DO_BLOCK", 27, "RETURN", 28, "YIELD", 29, "SUPER", 30, "SELF", 31, "NIL", 32, "TRUE", 33, "FALSE", 34, "AND", 35, "OR", 36, "NOT", 37, "IF_MOD", 38, "UNLESS_MOD", 39, "WHILE_MOD", 40, "UNTIL_MOD", 41, "RESCUE_MOD", 42, "ALIAS", 43, "DEFINED", 44, "klBEGIN", 45, "klEND", 46, "LINE", 47, "FILE", 48, "IDENTIFIER", 49, "FID", 50, "GVAR", 51, "IVAR", 52, "CONSTANT", 53, "CVAR", 54, "NTH_REF", 55, "BACK_REF", 56, "STRING_CONTENT", 57, "INTEGER", 58, "FLOAT", 59, "REGEXP_END", 60, "+@", 61, "-@", 62, "-@NUM", 63, "**", 64, "<=>", 65, "==", 66, "===", 67, "!=", 68, ">=", 69, "<=", 70, "&&", 71, "||", 72, "=~", 73, "!~", 74, ".", 75, "..", 76, "...", 77, "[]", 78, "[]=", 79, "<<", 80, ">>", 81, "::", 82, "::@", 83, "OP_ASGN", 84, "=>", 85, "PAREN_BEG", 86, "(", 87, ")", 88, "tLPAREN_ARG", 89, "ARRAY_BEG", 90, "]", 91, "tLBRACE", 92, "tLBRACE_ARG", 93, "SPLAT", 94, "*", 95, "&@", 96, "&", 97, "~", 98, "%", 99, "/", 100, "+", 101, "-", 102, "<", 103, ">", 104, "|", 105, "!", 106, "^", 107, "LCURLY", 108, "}", 109, "BACK_REF2", 110, "SYMBOL_BEG", 111, "STRING_BEG", 112, "XSTRING_BEG", 113, "REGEXP_BEG", 114, "WORDS_BEG", 115, "AWORDS_BEG", 116, "STRING_DBEG", 117, "STRING_DVAR", 118, "STRING_END", 119, "STRING", 120, "SYMBOL", 121, "\\n", 122, "?", 123, ":", 124, ",", 125, "SPACE", 126, ";", 127, "LABEL", 128, "LAMBDA", 129, "LAMBEG", 130, "DO_LAMBDA", 131, "=", 132, "LOWEST", 133, "[@", 134, "[", 135, "{", 136);

      racc_nt_base = 137;

      racc_use_result_var = true;

      $scope.Racc_arg = [racc_action_table, racc_action_check, racc_action_default, racc_action_pointer, racc_goto_table, racc_goto_check, racc_goto_default, racc_goto_pointer, racc_nt_base, racc_reduce_table, racc_token_table, racc_shift_n, racc_reduce_n, racc_use_result_var];

      $scope.Racc_token_to_s_table = ["$end", "error", "CLASS", "MODULE", "DEF", "UNDEF", "BEGIN", "RESCUE", "ENSURE", "END", "IF", "UNLESS", "THEN", "ELSIF", "ELSE", "CASE", "WHEN", "WHILE", "UNTIL", "FOR", "BREAK", "NEXT", "REDO", "RETRY", "IN", "DO", "DO_COND", "DO_BLOCK", "RETURN", "YIELD", "SUPER", "SELF", "NIL", "TRUE", "FALSE", "AND", "OR", "NOT", "IF_MOD", "UNLESS_MOD", "WHILE_MOD", "UNTIL_MOD", "RESCUE_MOD", "ALIAS", "DEFINED", "klBEGIN", "klEND", "LINE", "FILE", "IDENTIFIER", "FID", "GVAR", "IVAR", "CONSTANT", "CVAR", "NTH_REF", "BACK_REF", "STRING_CONTENT", "INTEGER", "FLOAT", "REGEXP_END", "\"+@\"", "\"-@\"", "\"-@NUM\"", "\"**\"", "\"<=>\"", "\"==\"", "\"===\"", "\"!=\"", "\">=\"", "\"<=\"", "\"&&\"", "\"||\"", "\"=~\"", "\"!~\"", "\".\"", "\"..\"", "\"...\"", "\"[]\"", "\"[]=\"", "\"<<\"", "\">>\"", "\"::\"", "\"::@\"", "OP_ASGN", "\"=>\"", "PAREN_BEG", "\"(\"", "\")\"", "tLPAREN_ARG", "ARRAY_BEG", "\"]\"", "tLBRACE", "tLBRACE_ARG", "SPLAT", "\"*\"", "\"&@\"", "\"&\"", "\"~\"", "\"%\"", "\"/\"", "\"+\"", "\"-\"", "\"<\"", "\">\"", "\"|\"", "\"!\"", "\"^\"", "LCURLY", "\"}\"", "BACK_REF2", "SYMBOL_BEG", "STRING_BEG", "XSTRING_BEG", "REGEXP_BEG", "WORDS_BEG", "AWORDS_BEG", "STRING_DBEG", "STRING_DVAR", "STRING_END", "STRING", "SYMBOL", "\"\\\\n\"", "\"?\"", "\":\"", "\",\"", "SPACE", "\";\"", "LABEL", "LAMBDA", "LAMBEG", "DO_LAMBDA", "\"=\"", "LOWEST", "\"[@\"", "\"[\"", "\"{\"", "$start", "target", "compstmt", "bodystmt", "opt_rescue", "opt_else", "opt_ensure", "stmts", "opt_terms", "none", "stmt", "terms", "fitem", "undef_list", "expr_value", "lhs", "command_call", "mlhs", "var_lhs", "primary_value", "aref_args", "backref", "mrhs", "arg_value", "expr", "@1", "arg", "command", "block_command", "call_args", "block_call", "operation2", "command_args", "cmd_brace_block", "opt_block_var", "operation", "mlhs_basic", "mlhs_entry", "mlhs_head", "mlhs_item", "mlhs_node", "mlhs_post", "variable", "cname", "cpath", "fname", "op", "reswords", "symbol", "opt_nl", "primary", "args", "trailer", "assocs", "paren_args", "opt_paren_args", "opt_block_arg", "block_arg", "call_args2", "open_args", "@2", "none_block_pass", "literal", "strings", "xstring", "regexp", "words", "awords", "var_ref", "assoc_list", "brace_block", "method_call", "lambda", "then", "if_tail", "do", "case_body", "superclass", "term", "f_arglist", "singleton", "dot_or_colon", "@3", "@4", "@5", "@6", "@7", "@8", "@9", "@10", "@11", "@12", "@13", "@14", "@15", "@16", "@17", "@18", "f_larglist", "lambda_body", "block_param", "@19", "f_block_optarg", "f_block_opt", "block_args_tail", "f_block_arg", "opt_block_args_tail", "f_arg", "f_rest_arg", "do_block", "@20", "operation3", "@21", "@22", "cases", "@23", "exc_list", "exc_var", "numeric", "dsym", "string", "string1", "string_contents", "xstring_contents", "word_list", "word", "string_content", "qword_list", "string_dvar", "@24", "@25", "sym", "f_args", "f_optarg", "opt_f_block_arg", "f_norm_arg", "f_arg_item", "f_margs", "f_marg", "f_marg_list", "f_opt", "restarg_mark", "blkarg_mark", "assoc"];

      $scope.Racc_debug_parser = false;

      def.$_reduce_1 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_2 = function(val, _values, result) {
        
        result = this.$new_body(val['$[]'](0), val['$[]'](1), val['$[]'](2), val['$[]'](3));
        return result;
      };

      def.$_reduce_3 = function(val, _values, result) {
        var $a, $b, comp = nil;
        comp = this.$new_compstmt(val['$[]'](0));
        if (($a = ($b = (($b = comp !== false && comp !== nil) ? comp['$[]'](0)['$==']("begin") : $b), $b !== false && $b !== nil ? comp.$size()['$=='](2) : $b)) !== false && $a !== nil) {
          result = comp['$[]'](1);
          result['$line='](comp.$line());
        } else {
          result = comp
        };
        return result;
      };

      def.$_reduce_4 = function(val, _values, result) {
        
        result = this.$new_block();
        return result;
      };

      def.$_reduce_5 = function(val, _values, result) {
        
        result = this.$new_block(val['$[]'](0));
        return result;
      };

      def.$_reduce_6 = function(val, _values, result) {
        
        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_7 = function(val, _values, result) {
        
        this.lex_state = "expr_fname";
        return result;
      };

      def.$_reduce_8 = function(val, _values, result) {
        
        result = this.$s("alias", val['$[]'](1), val['$[]'](3));
        return result;
      };

      def.$_reduce_9 = function(val, _values, result) {
        
        result = this.$s("valias", val['$[]'](1).$intern(), val['$[]'](2).$intern());
        return result;
      };

      def.$_reduce_11 = function(val, _values, result) {
        
        result = this.$s("valias", val['$[]'](1).$intern(), val['$[]'](2).$intern());
        return result;
      };

      def.$_reduce_12 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_13 = function(val, _values, result) {
        
        result = this.$new_if(val['$[]'](2), val['$[]'](0), nil);
        return result;
      };

      def.$_reduce_14 = function(val, _values, result) {
        
        result = this.$new_if(val['$[]'](2), nil, val['$[]'](0));
        return result;
      };

      def.$_reduce_15 = function(val, _values, result) {
        
        result = this.$s("while", val['$[]'](2), val['$[]'](0), true);
        return result;
      };

      def.$_reduce_16 = function(val, _values, result) {
        
        result = this.$s("until", val['$[]'](2), val['$[]'](0), true);
        return result;
      };

      def.$_reduce_20 = function(val, _values, result) {
        
        result = this.$new_assign(val['$[]'](0), val['$[]'](2));
        return result;
      };

      def.$_reduce_21 = function(val, _values, result) {
        
        result = this.$s("masgn", val['$[]'](0), this.$s("to_ary", val['$[]'](2)));
        return result;
      };

      def.$_reduce_22 = function(val, _values, result) {
        
        result = this.$new_op_asgn(val['$[]'](1).$intern(), val['$[]'](0), val['$[]'](2));
        return result;
      };

      def.$_reduce_24 = function(val, _values, result) {
        
        result = this.$s("op_asgn2", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), val['$[]'](3).$intern(), val['$[]'](4));
        return result;
      };

      def.$_reduce_28 = function(val, _values, result) {
        
        result = this.$new_assign(val['$[]'](0), this.$s("svalue", val['$[]'](2)));
        return result;
      };

      def.$_reduce_29 = function(val, _values, result) {
        
        result = this.$s("masgn", val['$[]'](0), this.$s("to_ary", val['$[]'](2)));
        return result;
      };

      def.$_reduce_30 = function(val, _values, result) {
        
        result = this.$s("masgn", val['$[]'](0), val['$[]'](2));
        return result;
      };

      def.$_reduce_33 = function(val, _values, result) {
        
        result = this.$s("and", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_34 = function(val, _values, result) {
        
        result = this.$s("or", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_35 = function(val, _values, result) {
        
        result = this.$s("not", val['$[]'](1));
        result['$line='](val['$[]'](1).$line());
        return result;
      };

      def.$_reduce_36 = function(val, _values, result) {
        
        result = this.$s("not", val['$[]'](1));
        return result;
      };

      def.$_reduce_41 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](1);
        if (args.$size()['$=='](2)) {
          args = args['$[]'](1)
        };
        result = this.$s("return", args);
        return result;
      };

      def.$_reduce_42 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](1);
        if (args.$size()['$=='](2)) {
          args = args['$[]'](1)
        };
        result = this.$s("break", args);
        return result;
      };

      def.$_reduce_43 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](1);
        if (args.$size()['$=='](2)) {
          args = args['$[]'](1)
        };
        result = this.$s("next", args);
        return result;
      };

      def.$_reduce_48 = function(val, _values, result) {
        
        result = this.$new_call(nil, val['$[]'](0).$intern(), val['$[]'](1));
        return result;
      };

      def.$_reduce_50 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), val['$[]'](3));
        return result;
      };

      def.$_reduce_52 = function(val, _values, result) {
        
        result = "result = ['call', val[0], val[2], val[3]];";
        return result;
      };

      def.$_reduce_54 = function(val, _values, result) {
        
        result = this.$new_super(val['$[]'](1));
        return result;
      };

      def.$_reduce_55 = function(val, _values, result) {
        
        result = this.$new_yield(val['$[]'](1));
        return result;
      };

      def.$_reduce_56 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_57 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_58 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_59 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_60 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_61 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](val['$[]'](1));
        return result;
      };

      def.$_reduce_62 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](this.$s("splat", val['$[]'](2)));
        return result;
      };

      def.$_reduce_64 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](this.$s("splat"));
        return result;
      };

      def.$_reduce_66 = function(val, _values, result) {
        
        result = this.$s("array", this.$s("splat", val['$[]'](1)));
        return result;
      };

      def.$_reduce_67 = function(val, _values, result) {
        
        result = this.$s("array", this.$s("splat"));
        return result;
      };

      def.$_reduce_69 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_70 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_71 = function(val, _values, result) {
        
        result = this.$s("array", val['$[]'](0));
        return result;
      };

      def.$_reduce_72 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](val['$[]'](1));
        return result;
      };

      def.$_reduce_75 = function(val, _values, result) {
        
        result = this.$new_assignable(val['$[]'](0));
        return result;
      };

      def.$_reduce_76 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](2);
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        result = this.$s("attrasgn", val['$[]'](0), "[]=", args);
        return result;
      };

      def.$_reduce_77 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), this.$s("arglist"));
        return result;
      };

      def.$_reduce_83 = function(val, _values, result) {
        
        result = this.$new_assignable(val['$[]'](0));
        return result;
      };

      def.$_reduce_84 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](2);
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        result = this.$s("attrasgn", val['$[]'](0), "[]=", args);
        return result;
      };

      def.$_reduce_85 = function(val, _values, result) {
        
        result = this.$s("attrasgn", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), this.$s("arglist"));
        return result;
      };

      def.$_reduce_86 = function(val, _values, result) {
        
        result = this.$s("attrasgn", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), this.$s("arglist"));
        return result;
      };

      def.$_reduce_87 = function(val, _values, result) {
        
        result = this.$s("attrasgn", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), this.$s("arglist"));
        return result;
      };

      def.$_reduce_88 = function(val, _values, result) {
        
        result = this.$s("colon2", val['$[]'](0), val['$[]'](2).$intern());
        return result;
      };

      def.$_reduce_92 = function(val, _values, result) {
        
        result = this.$s("colon3", val['$[]'](1).$intern());
        return result;
      };

      def.$_reduce_93 = function(val, _values, result) {
        
        result = val['$[]'](0).$intern();
        return result;
      };

      def.$_reduce_94 = function(val, _values, result) {
        
        result = this.$s("colon2", val['$[]'](0), val['$[]'](2).$intern());
        return result;
      };

      def.$_reduce_98 = function(val, _values, result) {
        
        this.lex_state = "expr_end";
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_99 = function(val, _values, result) {
        
        this.lex_state = "expr_end";
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_100 = function(val, _values, result) {
        
        result = this.$s("sym", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_102 = function(val, _values, result) {
        
        result = this.$s("undef", val['$[]'](0));
        return result;
      };

      def.$_reduce_103 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](val['$[]'](2));
        return result;
      };

      def.$_reduce_173 = function(val, _values, result) {
        
        result = this.$new_assign(val['$[]'](0), val['$[]'](2));
        return result;
      };

      def.$_reduce_175 = function(val, _values, result) {
        
        result = this.$new_op_asgn(val['$[]'](1).$intern(), val['$[]'](0), val['$[]'](2));
        return result;
      };

      def.$_reduce_176 = function(val, _values, result) {
        var args = nil;
        args = val['$[]'](2);
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        result = this.$s("op_asgn1", val['$[]'](0), val['$[]'](2), val['$[]'](4).$intern(), val['$[]'](5));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_177 = function(val, _values, result) {
        
        result = this.$s("op_asgn2", val['$[]'](0), ("" + (val['$[]'](2)) + "=").$intern(), val['$[]'](3).$intern(), val['$[]'](4));
        return result;
      };

      def.$_reduce_183 = function(val, _values, result) {
        
        result = this.$s("dot2", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_184 = function(val, _values, result) {
        
        result = this.$s("dot3", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_185 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "+", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_186 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "-", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_187 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "*", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_188 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "/", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_189 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "%", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_190 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "**", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_193 = function(val, _values, result) {
        var $a;
        result = this.$new_call(val['$[]'](1), "+@", this.$s("arglist"));
        if (($a = ["int", "float"]['$include?'](val['$[]'](1)['$[]'](0))) !== false && $a !== nil) {
          result = val['$[]'](1)
        };
        return result;
      };

      def.$_reduce_194 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](1), "-@", this.$s("arglist"));
        if (val['$[]'](1)['$[]'](0)['$==']("int")) {
          val['$[]'](1)['$[]='](1, val['$[]'](1)['$[]'](1)['$-@']());
          result = val['$[]'](1);
        } else {
          if (val['$[]'](1)['$[]'](0)['$==']("float")) {
            val['$[]'](1)['$[]='](1, val['$[]'](1)['$[]'](1).$to_f()['$-@']());
            result = val['$[]'](1);
          }
        };
        return result;
      };

      def.$_reduce_195 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "|", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_196 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "^", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_197 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "&", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_198 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "<=>", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_199 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), ">", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_200 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), ">=", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_201 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "<", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_202 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "<=", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_203 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "==", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_204 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "===", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_205 = function(val, _values, result) {
        
        result = this.$s("not", this.$new_call(val['$[]'](0), "==", this.$s("arglist", val['$[]'](2))));
        return result;
      };

      def.$_reduce_206 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "=~", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_207 = function(val, _values, result) {
        
        result = this.$s("not", this.$new_call(val['$[]'](0), "=~", this.$s("arglist", val['$[]'](2))));
        return result;
      };

      def.$_reduce_208 = function(val, _values, result) {
        
        result = this.$s("not", val['$[]'](1));
        return result;
      };

      def.$_reduce_209 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](1), "~", this.$s("arglist"));
        return result;
      };

      def.$_reduce_210 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "<<", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_211 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), ">>", this.$s("arglist", val['$[]'](2)));
        return result;
      };

      def.$_reduce_212 = function(val, _values, result) {
        
        result = this.$s("and", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_213 = function(val, _values, result) {
        
        result = this.$s("or", val['$[]'](0), val['$[]'](2));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_214 = function(val, _values, result) {
        
        result = this.$s("defined", val['$[]'](2));
        return result;
      };

      def.$_reduce_215 = function(val, _values, result) {
        
        result = this.$s("if", val['$[]'](0), val['$[]'](2), val['$[]'](4));
        result['$line='](val['$[]'](0).$line());
        return result;
      };

      def.$_reduce_218 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_219 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_220 = function(val, _values, result) {
        var $a;
        val['$[]'](0)['$<<'](($a = this).$s.apply($a, ["hash"].concat(val['$[]'](2))));
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_221 = function(val, _values, result) {
        var $a;
        result = this.$s("array", ($a = this).$s.apply($a, ["hash"].concat(val['$[]'](0))));
        return result;
      };

      def.$_reduce_222 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_223 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_228 = function(val, _values, result) {
        
        result = this.$s("array", val['$[]'](0));
        return result;
      };

      def.$_reduce_229 = function(val, _values, result) {
        
        result = val['$[]'](0);
        this.$add_block_pass(val['$[]'](0), val['$[]'](1));
        return result;
      };

      def.$_reduce_230 = function(val, _values, result) {
        var $a;
        result = this.$s("arglist", ($a = this).$s.apply($a, ["hash"].concat(val['$[]'](0))));
        this.$add_block_pass(result, val['$[]'](1));
        return result;
      };

      def.$_reduce_231 = function(val, _values, result) {
        var $a;
        result = val['$[]'](0);
        result['$<<'](($a = this).$s.apply($a, ["hash"].concat(val['$[]'](2))));
        return result;
      };

      def.$_reduce_232 = function(val, _values, result) {
        
        result = this.$s("arglist");
        this.$add_block_pass(result, val['$[]'](0));
        return result;
      };

      def.$_reduce_235 = function(val, _values, result) {
        
        this.$cmdarg_push(1);
        return result;
      };

      def.$_reduce_236 = function(val, _values, result) {
        
        this.$cmdarg_pop();
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_238 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_239 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_240 = function(val, _values, result) {
        
        result = this.$s("block_pass", val['$[]'](1));
        return result;
      };

      def.$_reduce_241 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_242 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_243 = function(val, _values, result) {
        
        result = this.$s("array", val['$[]'](0));
        return result;
      };

      def.$_reduce_244 = function(val, _values, result) {
        
        result = this.$s("array", this.$s("splat", val['$[]'](1)));
        return result;
      };

      def.$_reduce_245 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](val['$[]'](2));
        return result;
      };

      def.$_reduce_246 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](this.$s("splat", val['$[]'](3)));
        return result;
      };

      def.$_reduce_247 = function(val, _values, result) {
        
        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_249 = function(val, _values, result) {
        
        result = this.$s("splat", val['$[]'](1));
        return result;
      };

      def.$_reduce_259 = function(val, _values, result) {
        
        result = this.line;
        return result;
      };

      def.$_reduce_260 = function(val, _values, result) {
        
        result = this.$s("begin", val['$[]'](2));
        result['$line='](val['$[]'](1));
        return result;
      };

      def.$_reduce_261 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_262 = function(val, _values, result) {
        var $a;
        result = ((($a = val['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("nil"));
        return result;
      };

      def.$_reduce_263 = function(val, _values, result) {
        
        result = this.$s("colon2", val['$[]'](0), val['$[]'](2).$intern());
        return result;
      };

      def.$_reduce_264 = function(val, _values, result) {
        
        result = this.$s("colon3", val['$[]'](1));
        return result;
      };

      def.$_reduce_265 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "[]", val['$[]'](2));
        return result;
      };

      def.$_reduce_266 = function(val, _values, result) {
        var $a;
        result = ((($a = val['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("array"));
        return result;
      };

      def.$_reduce_267 = function(val, _values, result) {
        var $a;
        result = ($a = this).$s.apply($a, ["hash"].concat(val['$[]'](1)));
        return result;
      };

      def.$_reduce_268 = function(val, _values, result) {
        
        result = this.$s("return");
        return result;
      };

      def.$_reduce_269 = function(val, _values, result) {
        
        result = this.$new_yield(val['$[]'](2));
        return result;
      };

      def.$_reduce_270 = function(val, _values, result) {
        
        result = this.$s("yield");
        return result;
      };

      def.$_reduce_271 = function(val, _values, result) {
        
        result = this.$s("yield");
        return result;
      };

      def.$_reduce_272 = function(val, _values, result) {
        
        result = this.$s("defined", val['$[]'](3));
        return result;
      };

      def.$_reduce_273 = function(val, _values, result) {
        
        result = this.$s("not", val['$[]'](2));
        result['$line='](val['$[]'](2).$line());
        return result;
      };

      def.$_reduce_274 = function(val, _values, result) {
        
        result = this.$s("not", this.$s("nil"));
        return result;
      };

      def.$_reduce_275 = function(val, _values, result) {
        
        result = val['$[]'](1);
        result['$[]='](1, this.$new_call(nil, val['$[]'](0).$intern(), this.$s("arglist")));
        return result;
      };

      def.$_reduce_277 = function(val, _values, result) {
        
        result = val['$[]'](1);
        result['$[]='](1, val['$[]'](0));
        return result;
      };

      def.$_reduce_278 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_279 = function(val, _values, result) {
        
        result = this.$new_if(val['$[]'](1), val['$[]'](3), val['$[]'](4));
        return result;
      };

      def.$_reduce_280 = function(val, _values, result) {
        
        result = this.$new_if(val['$[]'](1), val['$[]'](4), val['$[]'](3));
        return result;
      };

      def.$_reduce_281 = function(val, _values, result) {
        
        this.$cond_push(1);
        result = this.line;
        return result;
      };

      def.$_reduce_282 = function(val, _values, result) {
        
        this.$cond_pop();
        return result;
      };

      def.$_reduce_283 = function(val, _values, result) {
        
        result = this.$s("while", val['$[]'](2), val['$[]'](5), true);
        result['$line='](val['$[]'](1));
        return result;
      };

      def.$_reduce_284 = function(val, _values, result) {
        
        this.$cond_push(1);
        result = this.line;
        return result;
      };

      def.$_reduce_285 = function(val, _values, result) {
        
        this.$cond_pop();
        return result;
      };

      def.$_reduce_286 = function(val, _values, result) {
        
        result = this.$s("until", val['$[]'](2), val['$[]'](5), true);
        result['$line='](val['$[]'](1));
        return result;
      };

      def.$_reduce_287 = function(val, _values, result) {
        var $a;
        result = ($a = this).$s.apply($a, ["case", val['$[]'](1)].concat(val['$[]'](3)));
        result['$line='](val['$[]'](1).$line());
        return result;
      };

      def.$_reduce_288 = function(val, _values, result) {
        var $a;
        result = ($a = this).$s.apply($a, ["case", nil].concat(val['$[]'](2)));
        result['$line='](val['$[]'](2).$line());
        return result;
      };

      def.$_reduce_289 = function(val, _values, result) {
        
        result = this.$s("case", nil, val['$[]'](3));
        result['$line='](val['$[]'](3).$line());
        return result;
      };

      def.$_reduce_290 = function(val, _values, result) {
        
        result = "this.cond_push(1);";
        return result;
      };

      def.$_reduce_291 = function(val, _values, result) {
        
        result = "this.cond_pop();";
        return result;
      };

      def.$_reduce_293 = function(val, _values, result) {
        
        result = this.line;
        return result;
      };

      def.$_reduce_294 = function(val, _values, result) {
        
        return result;
      };

      def.$_reduce_295 = function(val, _values, result) {
        
        result = this.$new_class(val['$[]'](2), val['$[]'](3), val['$[]'](5));
        result['$line='](val['$[]'](1));
        result['$end_line='](this.line);
        return result;
      };

      def.$_reduce_296 = function(val, _values, result) {
        
        result = this.line;
        return result;
      };

      def.$_reduce_297 = function(val, _values, result) {
        
        return result;
      };

      def.$_reduce_298 = function(val, _values, result) {
        
        result = this.$new_sclass(val['$[]'](3), val['$[]'](6));
        result['$line='](val['$[]'](2));
        return result;
      };

      def.$_reduce_299 = function(val, _values, result) {
        
        result = this.line;
        return result;
      };

      def.$_reduce_300 = function(val, _values, result) {
        
        return result;
      };

      def.$_reduce_301 = function(val, _values, result) {
        
        result = this.$new_module(val['$[]'](2), val['$[]'](4));
        result['$line='](val['$[]'](1));
        result['$end_line='](this.line);
        return result;
      };

      def.$_reduce_302 = function(val, _values, result) {
        
        result = this.scope_line;
        this.$push_scope();
        return result;
      };

      def.$_reduce_303 = function(val, _values, result) {
        
        result = this.$new_defn(val['$[]'](2), val['$[]'](1), val['$[]'](3), val['$[]'](4));
        this.$pop_scope();
        return result;
      };

      def.$_reduce_304 = function(val, _values, result) {
        
        return result;
      };

      def.$_reduce_305 = function(val, _values, result) {
        
        result = this.scope_line;
        this.$push_scope();
        return result;
      };

      def.$_reduce_306 = function(val, _values, result) {
        
        result = this.$new_defs(val['$[]'](5), val['$[]'](1), val['$[]'](4), val['$[]'](6), val['$[]'](7));
        this.$pop_scope();
        return result;
      };

      def.$_reduce_307 = function(val, _values, result) {
        
        result = this.$s("break");
        return result;
      };

      def.$_reduce_308 = function(val, _values, result) {
        
        result = this.$s("next");
        return result;
      };

      def.$_reduce_309 = function(val, _values, result) {
        
        result = this.$s("redo");
        return result;
      };

      def.$_reduce_319 = function(val, _values, result) {
        var call = nil;
        call = this.$new_call(nil, "lambda", this.$s("arglist"));
        result = this.$new_iter(call, val['$[]'](0), val['$[]'](1));
        return result;
      };

      def.$_reduce_320 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_321 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_324 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_325 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_326 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_327 = function(val, _values, result) {
        
        result = this.line;
        return result;
      };

      def.$_reduce_328 = function(val, _values, result) {
        
        result = this.$s("if", val['$[]'](2), val['$[]'](4), val['$[]'](5));
        result['$line='](val['$[]'](1));
        return result;
      };

      def.$_reduce_330 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_331 = function(val, _values, result) {
        
        result = this.$s("block", val['$[]'](0));
        return result;
      };

      def.$_reduce_332 = function(val, _values, result) {
        
        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_333 = function(val, _values, result) {
        
        result = this.$new_assign(this.$new_assignable(this.$s("identifier", val['$[]'](0).$intern())), val['$[]'](2));
        return result;
      };

      def.$_reduce_335 = function(val, _values, result) {
        
        result = 0;
        return result;
      };

      def.$_reduce_336 = function(val, _values, result) {
        
        result = 0;
        return result;
      };

      def.$_reduce_337 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_338 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_339 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_340 = function(val, _values, result) {
        
        nil;
        return result;
      };

      def.$_reduce_341 = function(val, _values, result) {
        
        result = this.$new_block_args(val['$[]'](0), val['$[]'](2), val['$[]'](4), val['$[]'](5));
        return result;
      };

      def.$_reduce_342 = function(val, _values, result) {
        
        result = this.$new_block_args(val['$[]'](0), val['$[]'](2), nil, val['$[]'](3));
        return result;
      };

      def.$_reduce_343 = function(val, _values, result) {
        
        result = this.$new_block_args(val['$[]'](0), nil, val['$[]'](2), val['$[]'](3));
        return result;
      };

      def.$_reduce_344 = function(val, _values, result) {
        
        result = this.$new_block_args(val['$[]'](0), nil, nil, nil);
        return result;
      };

      def.$_reduce_345 = function(val, _values, result) {
        
        result = this.$new_block_args(val['$[]'](0), nil, nil, val['$[]'](1));
        return result;
      };

      def.$_reduce_346 = function(val, _values, result) {
        
        result = this.$new_block_args(nil, val['$[]'](0), val['$[]'](2), val['$[]'](3));
        return result;
      };

      def.$_reduce_347 = function(val, _values, result) {
        
        result = this.$new_block_args(nil, val['$[]'](0), nil, val['$[]'](1));
        return result;
      };

      def.$_reduce_348 = function(val, _values, result) {
        
        result = this.$new_block_args(nil, nil, val['$[]'](0), val['$[]'](1));
        return result;
      };

      def.$_reduce_349 = function(val, _values, result) {
        
        result = this.$new_block_args(nil, nil, nil, val['$[]'](0));
        return result;
      };

      def.$_reduce_350 = function(val, _values, result) {
        
        this.$push_scope("block");
        result = this.line;
        return result;
      };

      def.$_reduce_351 = function(val, _values, result) {
        
        result = this.$new_iter(nil, val['$[]'](2), val['$[]'](3));
        result['$line='](val['$[]'](1));
        this.$pop_scope();
        return result;
      };

      def.$_reduce_352 = function(val, _values, result) {
        
        result = val['$[]'](1);
        result['$[]='](1, val['$[]'](0));
        return result;
      };

      def.$_reduce_355 = function(val, _values, result) {
        
        result = this.$new_call(nil, val['$[]'](0).$intern(), val['$[]'](1));
        return result;
      };

      def.$_reduce_356 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), val['$[]'](3));
        return result;
      };

      def.$_reduce_357 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), "call", val['$[]'](2));
        return result;
      };

      def.$_reduce_358 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), val['$[]'](3));
        return result;
      };

      def.$_reduce_359 = function(val, _values, result) {
        
        result = this.$new_call(val['$[]'](0), val['$[]'](2).$intern(), this.$s("arglist"));
        return result;
      };

      def.$_reduce_360 = function(val, _values, result) {
        
        result = this.$new_super(val['$[]'](1));
        return result;
      };

      def.$_reduce_361 = function(val, _values, result) {
        
        result = this.$s("zsuper");
        return result;
      };

      def.$_reduce_362 = function(val, _values, result) {
        
        this.$push_scope("block");
        result = this.line;
        return result;
      };

      def.$_reduce_363 = function(val, _values, result) {
        
        result = this.$new_iter(nil, val['$[]'](2), val['$[]'](3));
        result['$line='](val['$[]'](1));
        this.$pop_scope();
        return result;
      };

      def.$_reduce_364 = function(val, _values, result) {
        
        this.$push_scope("block");
        result = this.line;
        return result;
      };

      def.$_reduce_365 = function(val, _values, result) {
        
        result = this.$new_iter(nil, val['$[]'](2), val['$[]'](3));
        result['$line='](val['$[]'](1));
        this.$pop_scope();
        return result;
      };

      def.$_reduce_366 = function(val, _values, result) {
        
        result = this.line;
        return result;
      };

      def.$_reduce_367 = function(val, _values, result) {
        var $a, part = nil;
        part = this.$s("when", val['$[]'](2), val['$[]'](4));
        part['$line='](val['$[]'](2).$line());
        result = [part];
        if (($a = val['$[]'](5)) !== false && $a !== nil) {
          ($a = result).$push.apply($a, [].concat(val['$[]'](5)))
        };
        return result;
      };

      def.$_reduce_368 = function(val, _values, result) {
        
        result = [val['$[]'](0)];
        return result;
      };

      def.$_reduce_370 = function(val, _values, result) {
        var $a, exc = nil;
        exc = ((($a = val['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("array"));
        if (($a = val['$[]'](2)) !== false && $a !== nil) {
          exc['$<<'](this.$new_assign(val['$[]'](2), this.$s("gvar", "$!".$intern())))
        };
        result = [this.$s("resbody", exc, val['$[]'](4))];
        if (($a = val['$[]'](5)) !== false && $a !== nil) {
          result.$push(val['$[]'](5).$first())
        };
        return result;
      };

      def.$_reduce_371 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_372 = function(val, _values, result) {
        
        result = this.$s("array", val['$[]'](0));
        return result;
      };

      def.$_reduce_375 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_376 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_377 = function(val, _values, result) {
        var $a;
        result = (function() { if (($a = val['$[]'](1)['$nil?']()) !== false && $a !== nil) {
          return this.$s("nil")
        } else {
          return val['$[]'](1)
        }; return nil; }).call(this);
        return result;
      };

      def.$_reduce_382 = function(val, _values, result) {
        
        result = this.$new_str(val['$[]'](0));
        return result;
      };

      def.$_reduce_385 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_386 = function(val, _values, result) {
        
        result = this.$s("str", val['$[]'](0));
        return result;
      };

      def.$_reduce_387 = function(val, _values, result) {
        
        result = this.$new_xstr(val['$[]'](1));
        return result;
      };

      def.$_reduce_388 = function(val, _values, result) {
        
        result = this.$new_regexp(val['$[]'](1), val['$[]'](2));
        return result;
      };

      def.$_reduce_389 = function(val, _values, result) {
        
        result = this.$s("array");
        return result;
      };

      def.$_reduce_390 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_391 = function(val, _values, result) {
        
        result = this.$s("array");
        return result;
      };

      def.$_reduce_392 = function(val, _values, result) {
        var part = nil;
        part = val['$[]'](1);
        if (part['$[]'](0)['$==']("evstr")) {
          part = this.$s("dstr", "", val['$[]'](1))
        };
        result = val['$[]'](0)['$<<'](part);
        return result;
      };

      def.$_reduce_393 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_394 = function(val, _values, result) {
        
        result = val['$[]'](0).$concat([val['$[]'](1)]);
        return result;
      };

      def.$_reduce_395 = function(val, _values, result) {
        
        result = this.$s("array");
        return result;
      };

      def.$_reduce_396 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_397 = function(val, _values, result) {
        
        result = this.$s("array");
        return result;
      };

      def.$_reduce_398 = function(val, _values, result) {
        
        result = val['$[]'](0)['$<<'](this.$s("str", val['$[]'](1)));
        return result;
      };

      def.$_reduce_399 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_400 = function(val, _values, result) {
        
        result = this.$str_append(val['$[]'](0), val['$[]'](1));
        return result;
      };

      def.$_reduce_401 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_402 = function(val, _values, result) {
        
        result = this.$str_append(val['$[]'](0), val['$[]'](1));
        return result;
      };

      def.$_reduce_403 = function(val, _values, result) {
        
        result = this.$s("str", val['$[]'](0));
        return result;
      };

      def.$_reduce_404 = function(val, _values, result) {
        
        result = this.string_parse;
        this.string_parse = nil;
        return result;
      };

      def.$_reduce_405 = function(val, _values, result) {
        
        this.string_parse = val['$[]'](1);
        result = this.$s("evstr", val['$[]'](2));
        return result;
      };

      def.$_reduce_406 = function(val, _values, result) {
        
        this.$cond_push(0);
        this.$cmdarg_push(0);
        result = this.string_parse;
        this.string_parse = nil;
        this.lex_state = "expr_beg";
        return result;
      };

      def.$_reduce_407 = function(val, _values, result) {
        
        this.string_parse = val['$[]'](1);
        this.$cond_lexpop();
        this.$cmdarg_lexpop();
        result = this.$s("evstr", val['$[]'](2));
        return result;
      };

      def.$_reduce_408 = function(val, _values, result) {
        
        result = this.$s("gvar", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_409 = function(val, _values, result) {
        
        result = this.$s("ivar", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_410 = function(val, _values, result) {
        
        result = this.$s("cvar", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_412 = function(val, _values, result) {
        
        result = this.$s("sym", val['$[]'](1).$intern());
        this.lex_state = "expr_end";
        return result;
      };

      def.$_reduce_413 = function(val, _values, result) {
        
        result = this.$s("sym", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_418 = function(val, _values, result) {
        
        result = this.$new_dsym(val['$[]'](1));
        return result;
      };

      def.$_reduce_419 = function(val, _values, result) {
        
        result = this.$s("int", val['$[]'](0));
        return result;
      };

      def.$_reduce_420 = function(val, _values, result) {
        
        result = this.$s("float", val['$[]'](0));
        return result;
      };

      def.$_reduce_423 = function(val, _values, result) {
        
        result = this.$s("identifier", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_424 = function(val, _values, result) {
        
        result = this.$s("ivar", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_425 = function(val, _values, result) {
        
        result = this.$s("gvar", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_426 = function(val, _values, result) {
        
        result = this.$s("const", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_427 = function(val, _values, result) {
        
        result = this.$s("cvar", val['$[]'](0).$intern());
        return result;
      };

      def.$_reduce_428 = function(val, _values, result) {
        
        result = this.$s("nil");
        return result;
      };

      def.$_reduce_429 = function(val, _values, result) {
        
        result = this.$s("self");
        return result;
      };

      def.$_reduce_430 = function(val, _values, result) {
        
        result = this.$s("true");
        return result;
      };

      def.$_reduce_431 = function(val, _values, result) {
        
        result = this.$s("false");
        return result;
      };

      def.$_reduce_432 = function(val, _values, result) {
        
        result = this.$s("str", this.file);
        return result;
      };

      def.$_reduce_433 = function(val, _values, result) {
        
        result = this.$s("int", this.line);
        return result;
      };

      def.$_reduce_434 = function(val, _values, result) {
        
        result = this.$new_var_ref(val['$[]'](0));
        return result;
      };

      def.$_reduce_435 = function(val, _values, result) {
        
        result = this.$new_assignable(val['$[]'](0));
        return result;
      };

      def.$_reduce_436 = function(val, _values, result) {
        
        result = this.$s("nth_ref", val['$[]'](0));
        return result;
      };

      def.$_reduce_438 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_439 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_440 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_441 = function(val, _values, result) {
        
        result = val['$[]'](1);
        this.lex_state = "expr_beg";
        return result;
      };

      def.$_reduce_442 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_443 = function(val, _values, result) {
        
        result = this.$new_args(val['$[]'](0), val['$[]'](2), val['$[]'](4), val['$[]'](5));
        return result;
      };

      def.$_reduce_444 = function(val, _values, result) {
        
        result = this.$new_args(val['$[]'](0), val['$[]'](2), nil, val['$[]'](3));
        return result;
      };

      def.$_reduce_445 = function(val, _values, result) {
        
        result = this.$new_args(val['$[]'](0), nil, val['$[]'](2), val['$[]'](3));
        return result;
      };

      def.$_reduce_446 = function(val, _values, result) {
        
        result = this.$new_args(val['$[]'](0), nil, nil, val['$[]'](1));
        return result;
      };

      def.$_reduce_447 = function(val, _values, result) {
        
        result = this.$new_args(nil, val['$[]'](0), val['$[]'](2), val['$[]'](3));
        return result;
      };

      def.$_reduce_448 = function(val, _values, result) {
        
        result = this.$new_args(nil, val['$[]'](0), nil, val['$[]'](1));
        return result;
      };

      def.$_reduce_449 = function(val, _values, result) {
        
        result = this.$new_args(nil, nil, val['$[]'](0), val['$[]'](1));
        return result;
      };

      def.$_reduce_450 = function(val, _values, result) {
        
        result = this.$new_args(nil, nil, nil, val['$[]'](0));
        return result;
      };

      def.$_reduce_451 = function(val, _values, result) {
        
        result = this.$s("args");
        return result;
      };

      def.$_reduce_452 = function(val, _values, result) {
        
        this.$raise("formal argument cannot be a constant");
        return result;
      };

      def.$_reduce_453 = function(val, _values, result) {
        
        this.$raise("formal argument cannot be an instance variable");
        return result;
      };

      def.$_reduce_454 = function(val, _values, result) {
        
        this.$raise("formal argument cannot be a class variable");
        return result;
      };

      def.$_reduce_455 = function(val, _values, result) {
        
        this.$raise("formal argument cannot be a global variable");
        return result;
      };

      def.$_reduce_456 = function(val, _values, result) {
        
        result = val['$[]'](0).$intern();
        this.scope.$add_local(result);
        return result;
      };

      def.$_reduce_457 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_458 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_459 = function(val, _values, result) {
        
        result = this.$s("lasgn", val['$[]'](0));
        return result;
      };

      def.$_reduce_461 = function(val, _values, result) {
        
        result = this.$s("array", val['$[]'](0));
        return result;
      };

      def.$_reduce_462 = function(val, _values, result) {
        
        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_468 = function(val, _values, result) {
        
        result = [val['$[]'](0)];
        return result;
      };

      def.$_reduce_469 = function(val, _values, result) {
        
        val['$[]'](0)['$<<'](val['$[]'](2));
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_470 = function(val, _values, result) {
        
        result = this.$new_assign(this.$new_assignable(this.$s("identifier", val['$[]'](0).$intern())), val['$[]'](2));
        return result;
      };

      def.$_reduce_471 = function(val, _values, result) {
        
        result = this.$s("block", val['$[]'](0));
        return result;
      };

      def.$_reduce_472 = function(val, _values, result) {
        
        result = val['$[]'](0);
        val['$[]'](0)['$<<'](val['$[]'](2));
        return result;
      };

      def.$_reduce_475 = function(val, _values, result) {
        
        result = ("*" + (val['$[]'](1))).$intern();
        return result;
      };

      def.$_reduce_476 = function(val, _values, result) {
        
        result = "*";
        return result;
      };

      def.$_reduce_479 = function(val, _values, result) {
        
        result = ("&" + (val['$[]'](1))).$intern();
        return result;
      };

      def.$_reduce_480 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_481 = function(val, _values, result) {
        
        result = nil;
        return result;
      };

      def.$_reduce_482 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_483 = function(val, _values, result) {
        
        result = val['$[]'](1);
        return result;
      };

      def.$_reduce_484 = function(val, _values, result) {
        
        result = [];
        return result;
      };

      def.$_reduce_485 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_486 = function(val, _values, result) {
        
        this.$raise("unsupported assoc list type (" + (this.line_number) + ")");
        return result;
      };

      def.$_reduce_487 = function(val, _values, result) {
        
        result = val['$[]'](0);
        return result;
      };

      def.$_reduce_488 = function(val, _values, result) {
        var $a;
        result = ($a = val['$[]'](0)).$push.apply($a, [].concat(val['$[]'](2)));
        return result;
      };

      def.$_reduce_489 = function(val, _values, result) {
        
        result = [val['$[]'](0), val['$[]'](2)];
        return result;
      };

      def.$_reduce_490 = function(val, _values, result) {
        
        result = [this.$s("sym", val['$[]'](0).$intern()), val['$[]'](1)];
        return result;
      };

      def.$_reduce_none = function(val, _values, result) {
        
        return val['$[]'](0);
      };

      return nil;
    })(Opal, ($scope.Racc)._scope.Parser)

  })(self);
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $hash2 = $opal.hash2;

  $opal.add_stubs(['$attr_reader', '$new', '$line=', '$push_scope', '$do_parse', '$pop_scope', '$raise', '$inspect', '$token_to_str', '$last', '$parent=', '$<<', '$pop', '$|', '$&', '$>>', '$==', '$include?', '$arg?', '$space?', '$check', '$[]', '$scan', '$escape', '$[]=', '$pos=', '$-', '$pos', '$matched', '$add_string_content', '$join', '$+', '$count', '$eos?', '$next_string_token', '$length', '$empty?', '$after_operator?', '$next_token', '$spcarg?', '$beg?', '$end_with?', '$cond_push', '$cmdarg_push', '$cond_lexpop', '$cmdarg_lexpop', '$end?', '$sub', '$peek', '$to_i', '$to_f', '$gsub', '$===', '$cond?', '$cmdarg?', '$to_s', '$=~']);
  ;
  ;
  ;
  ;
  ;
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function Grammar() {};
      Grammar = $klass($base, $super, "Grammar", Grammar);

      var def = Grammar._proto, $scope = Grammar._scope;
      def.line = def.file = def.scopes = def.cond = def.cmdarg = def.lex_state = def.space_seen = def.scanner = def.string_parse = def.start_of_lambda = nil;

      Grammar.$attr_reader("line");

      def.$initialize = function() {
        
        this.lex_state = "expr_beg";
        this.cond = 0;
        this.cmdarg = 0;
        this.line = 1;
        this.scopes = [];
        return this.string_parse_stack = [];
      };

      def.$s = function(parts) {
        var sexp = nil;parts = $slice.call(arguments, 0);
        sexp = $scope.Array.$new(parts);
        sexp['$line='](this.line);
        return sexp;
      };

      def.$parse = function(source, file) {
        var result = nil;if (file == null) {
          file = "(string)"
        }
        this.file = file;
        this.scanner = $scope.StringScanner.$new(source);
        this.$push_scope();
        result = this.$do_parse();
        this.$pop_scope();
        return result;
      };

      def.$on_error = function(t, val, vstack) {
        var $a;
        return this.$raise("parse error on value " + (val.$inspect()) + " (" + (((($a = this.$token_to_str(t)) !== false && $a !== nil) ? $a : "?")) + ") :" + (this.file) + ":" + (this.line));
      };

      def.$push_scope = function(type) {
        var top = nil, scope = nil;if (type == null) {
          type = nil
        }
        top = this.scopes.$last();
        scope = $scope.LexerScope.$new(type);
        scope['$parent='](top);
        this.scopes['$<<'](scope);
        return this.scope = scope;
      };

      def.$pop_scope = function() {
        
        this.scopes.$pop();
        return this.scope = this.scopes.$last();
      };

      def.$cond_push = function(n) {
        
        return this.cond = this.cond['$<<'](1)['$|'](n['$&'](1));
      };

      def.$cond_pop = function() {
        
        return this.cond = this.cond['$>>'](1);
      };

      def.$cond_lexpop = function() {
        
        return this.cond = this.cond['$>>'](1)['$|'](this.cond['$&'](1));
      };

      def['$cond?'] = function() {
        var $a;
        return ($a = this.cond['$&'](1)['$=='](0), ($a === nil || $a === false));
      };

      def.$cmdarg_push = function(n) {
        
        return this.cmdarg = this.cmdarg['$<<'](1)['$|'](n['$&'](1));
      };

      def.$cmdarg_pop = function() {
        
        return this.cmdarg = this.cmdarg['$>>'](1);
      };

      def.$cmdarg_lexpop = function() {
        
        return this.cmdarg = this.cmdarg['$>>'](1)['$|'](this.cmdarg['$&'](1));
      };

      def['$cmdarg?'] = function() {
        var $a;
        return ($a = this.cmdarg['$&'](1)['$=='](0), ($a === nil || $a === false));
      };

      def['$arg?'] = function() {
        
        return ["expr_arg", "expr_cmdarg"]['$include?'](this.lex_state);
      };

      def['$end?'] = function() {
        
        return ["expr_end", "expr_endarg", "expr_endfn"]['$include?'](this.lex_state);
      };

      def['$beg?'] = function() {
        
        return ["expr_beg", "expr_value", "expr_mid", "expr_class"]['$include?'](this.lex_state);
      };

      def['$after_operator?'] = function() {
        
        return ["expr_fname", "expr_dot"]['$include?'](this.lex_state);
      };

      def['$spcarg?'] = function() {
        var $a;
        return ($a = ($a = this['$arg?'](), $a !== false && $a !== nil ? this.space_seen : $a), $a !== false && $a !== nil ? ($a = this['$space?'](), ($a === nil || $a === false)) : $a);
      };

      def['$space?'] = function() {
        
        return this.scanner.$check(/\s/);
      };

      def.$next_string_token = function() {
        var $a, $b, $c, str_parse = nil, scanner = nil, space = nil, interpolate = nil, words = nil, str_buffer = nil, result = nil, complete_str = nil;
        str_parse = this.string_parse;
        scanner = this.scanner;
        space = false;
        interpolate = str_parse['$[]']("interpolate");
        words = ["w", "W"]['$include?'](str_parse['$[]']("beg"));
        if (($a = ($b = ["w", "W"]['$include?'](str_parse['$[]']("beg")), $b !== false && $b !== nil ? scanner.$scan(/\s+/) : $b)) !== false && $a !== nil) {
          space = true
        };
        str_buffer = [];
        if (($a = scanner.$scan($scope.Regexp.$new($scope.Regexp.$escape(str_parse['$[]']("end"))))) !== false && $a !== nil) {
          if (($a = (($b = words !== false && words !== nil) ? ($c = str_parse['$[]']("done_last_space"), ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
            str_parse['$[]=']("done_last_space", true);
            ($a = scanner, $a['$pos=']($a.$pos()['$-'](1)));
            return ["SPACE", " "];
          };
          this.string_parse = nil;
          if (($a = str_parse['$[]']("balance")) !== false && $a !== nil) {
            if (str_parse['$[]']("nesting")['$=='](0)) {
              this.lex_state = "expr_end";
              if (($a = str_parse['$[]']("regexp")) !== false && $a !== nil) {
                result = scanner.$scan(/\w+/);
                return ["REGEXP_END", result];
              };
              return ["STRING_END", scanner.$matched()];
            } else {
              str_buffer['$<<'](scanner.$matched());
              ($a = "nesting", $b = str_parse, ((($c = $b['$[]']($a)) !== false && $c !== nil) ? $c : $b['$[]=']($a, 1)));
              this.string_parse = str_parse;
            }
          } else {
            if (($a = ["\"", "'"]['$include?'](str_parse['$[]']("beg"))) !== false && $a !== nil) {
              this.lex_state = "expr_end";
              return ["STRING_END", scanner.$matched()];
            } else {
              if (str_parse['$[]']("beg")['$==']("`")) {
                this.lex_state = "expr_end";
                return ["STRING_END", scanner.$matched()];
              } else {
                if (($a = ((($b = str_parse['$[]']("beg")['$==']("/")) !== false && $b !== nil) ? $b : str_parse['$[]']("regexp"))) !== false && $a !== nil) {
                  result = scanner.$scan(/\w+/);
                  this.lex_state = "expr_end";
                  return ["REGEXP_END", result];
                } else {
                  this.lex_state = "expr_end";
                  return ["STRING_END", scanner.$matched()];
                }
              }
            }
          };
        };
        if (space !== false && space !== nil) {
          return ["SPACE", " "]
        };
        if (($a = ($b = str_parse['$[]']("balance"), $b !== false && $b !== nil ? scanner.$scan($scope.Regexp.$new($scope.Regexp.$escape(str_parse['$[]']("beg")))) : $b)) !== false && $a !== nil) {
          str_buffer['$<<'](scanner.$matched());
          ($a = "nesting", $b = str_parse, ((($c = $b['$[]']($a)) !== false && $c !== nil) ? $c : $b['$[]=']($a, 1)));
        } else {
          if (($a = scanner.$check(/#[@$]/)) !== false && $a !== nil) {
            scanner.$scan(/#/);
            if (interpolate !== false && interpolate !== nil) {
              return ["STRING_DVAR", scanner.$matched()]
            } else {
              str_buffer['$<<'](scanner.$matched())
            };
          } else {
            if (($a = scanner.$scan(/#\{/)) !== false && $a !== nil) {
              if (interpolate !== false && interpolate !== nil) {
                return ["STRING_DBEG", scanner.$matched()]
              } else {
                str_buffer['$<<'](scanner.$matched())
              }
            } else {
              if (($a = scanner.$scan(/\#/)) !== false && $a !== nil) {
                str_buffer['$<<']("#")
              }
            }
          }
        };
        this.$add_string_content(str_buffer, str_parse);
        complete_str = str_buffer.$join("");
        this.line = this.line['$+'](complete_str.$count("\n"));
        return ["STRING_CONTENT", complete_str];
      };

      def.$add_string_content = function(str_buffer, str_parse) {
        var $a, $b, $c, $d, scanner = nil, end_str_re = nil, interpolate = nil, words = nil, c = nil, handled = nil, reg = nil;
        scanner = this.scanner;
        end_str_re = $scope.Regexp.$new($scope.Regexp.$escape(str_parse['$[]']("end")));
        interpolate = str_parse['$[]']("interpolate");
        words = ["W", "w"]['$include?'](str_parse['$[]']("beg"));
        while (!(($b = scanner['$eos?']()) !== false && $b !== nil)) {c = nil;
        handled = true;
        if (($b = scanner.$check(end_str_re)) !== false && $b !== nil) {
          if (($b = ($c = str_parse['$[]']("balance"), $c !== false && $c !== nil ? ($c = str_parse['$[]']("nesting")['$=='](0), ($c === nil || $c === false)) : $c)) !== false && $b !== nil) {
            scanner.$scan(end_str_re);
            c = scanner.$matched();
            ($b = "nesting", $c = str_parse, ((($d = $c['$[]']($b)) !== false && $d !== nil) ? $d : $c['$[]=']($b, 1)));
          } else {
            break;
          }
        } else {
          if (($b = ($c = str_parse['$[]']("balance"), $c !== false && $c !== nil ? scanner.$scan($scope.Regexp.$new($scope.Regexp.$escape(str_parse['$[]']("beg")))) : $c)) !== false && $b !== nil) {
            ($b = "nesting", $c = str_parse, ((($d = $c['$[]']($b)) !== false && $d !== nil) ? $d : $c['$[]=']($b, 1)));
            c = scanner.$matched();
          } else {
            if (($b = (($c = words !== false && words !== nil) ? scanner.$scan(/\s/) : $c)) !== false && $b !== nil) {
              ($b = scanner, $b['$pos=']($b.$pos()['$-'](1)));
              break;;
            } else {
              if (($b = (($c = interpolate !== false && interpolate !== nil) ? scanner.$check(/#(?=[\$\@\{])/) : $c)) !== false && $b !== nil) {
                break;
              } else {
                if (($b = scanner.$scan(/\\/)) !== false && $b !== nil) {
                  if (($b = str_parse['$[]']("regexp")) !== false && $b !== nil) {
                    if (($b = scanner.$scan(/(.)/)) !== false && $b !== nil) {
                      c = "\\"['$+'](scanner.$matched())
                    }
                  } else {
                    c = (function() { if (($b = scanner.$scan(/n/)) !== false && $b !== nil) {
                      return "\n"
                    } else {
                      if (($b = scanner.$scan(/r/)) !== false && $b !== nil) {
                        return "\r"
                      } else {
                        if (($b = scanner.$scan(/\n/)) !== false && $b !== nil) {
                          return "\n"
                        } else {
                          if (($b = scanner.$scan(/t/)) !== false && $b !== nil) {
                            return "\t"
                          } else {
                            scanner.$scan(/./);
                            return scanner.$matched();
                          }
                        }
                      }
                    }; return nil; }).call(this)
                  }
                } else {
                  handled = false
                }
              }
            }
          }
        };
        if (($b = handled) === false || $b === nil) {
          reg = (function() { if (words !== false && words !== nil) {
            return $scope.Regexp.$new("[^" + ($scope.Regexp.$escape(str_parse['$[]']("end"))) + "#0\n \\\\]+|.")
          } else {
            if (($b = str_parse['$[]']("balance")) !== false && $b !== nil) {
              return $scope.Regexp.$new("[^" + ($scope.Regexp.$escape(str_parse['$[]']("end"))) + ($scope.Regexp.$escape(str_parse['$[]']("beg"))) + "#0\\\\]+|.")
            } else {
              return $scope.Regexp.$new("[^" + ($scope.Regexp.$escape(str_parse['$[]']("end"))) + "#0\\\\]+|.")
            }
          }; return nil; }).call(this);
          scanner.$scan(reg);
          c = scanner.$matched();
        };
        ((($b = c) !== false && $b !== nil) ? $b : c = scanner.$matched());
        str_buffer['$<<'](c);};
        if (($a = scanner['$eos?']()) !== false && $a !== nil) {
          return this.$raise("reached EOF while in string")
        } else {
          return nil
        };
      };

      def.$next_token = function() {
        var $a, $b, $c, $d, scanner = nil, cmd_start = nil, c = nil, result = nil, start_word = nil, end_word = nil, interpolate = nil, heredoc = nil, sign = nil, matched = nil, $case = nil;
        if (($a = this.string_parse) !== false && $a !== nil) {
          return this.$next_string_token()
        };
        scanner = this.scanner;
        this.space_seen = false;
        cmd_start = false;
        c = "";
        while (($b = true) !== false && $b !== nil){if (($b = scanner.$scan(/\ |\t|\r/)) !== false && $b !== nil) {
          this.space_seen = true;
          continue;;
        } else {
          if (($b = scanner.$scan(/(\n|#)/)) !== false && $b !== nil) {
            c = scanner.$matched();
            if (c['$==']("#")) {
              scanner.$scan(/(.*)/)
            } else {
              this.line = this.line['$+'](1)
            };
            scanner.$scan(/(\n+)/);
            if (($b = scanner.$matched()) !== false && $b !== nil) {
              this.line = this.line['$+'](scanner.$matched().$length())
            };
            if (($b = ["expr_beg", "expr_dot"]['$include?'](this.lex_state)) !== false && $b !== nil) {
              continue;
            };
            if (($b = scanner.$scan(/([\ \t\r\f\v]*)\./)) !== false && $b !== nil) {
              if (($b = scanner['$[]'](1)['$empty?']()) === false || $b === nil) {
                this.space_seen = true
              };
              scanner['$pos='](scanner.$pos()['$-'](1));
              if (($b = scanner.$check(/\.\./)) === false || $b === nil) {
                continue;
              };
            };
            cmd_start = true;
            this.lex_state = "expr_beg";
            return ["\\n", "\\n"];
          } else {
            if (($b = scanner.$scan(/\;/)) !== false && $b !== nil) {
              this.lex_state = "expr_beg";
              return [";", ";"];
            } else {
              if (($b = scanner.$scan(/\*/)) !== false && $b !== nil) {
                if (($b = scanner.$scan(/\*/)) !== false && $b !== nil) {
                  if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                    this.lex_state = "expr_beg";
                    return ["OP_ASGN", "**"];
                  };
                  if (($b = ((($c = this.lex_state['$==']("expr_fname")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_dot"))) !== false && $b !== nil) {
                    this.lex_state = "expr_arg"
                  } else {
                    this.lex_state = "expr_beg"
                  };
                  return ["**", "**"];
                } else {
                  if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                    this.lex_state = "expr_beg";
                    return ["OP_ASGN", "*"];
                  }
                };
                if (($b = scanner.$scan(/\*\=/)) !== false && $b !== nil) {
                  this.lex_state = "expr_beg";
                  return ["OP_ASGN", "**"];
                };
                if (($b = scanner.$scan(/\*/)) !== false && $b !== nil) {
                  if (($b = this['$after_operator?']()) !== false && $b !== nil) {
                    this.lex_state = "expr_arg"
                  } else {
                    this.lex_state = "expr_beg"
                  };
                  return ["**", "**"];
                };
                if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                  this.lex_state = "expr_beg";
                  return ["OP_ASGN", "*"];
                } else {
                  result = "*";
                  if (this.lex_state['$==']("expr_fname")) {
                    this.lex_state = "expr_end";
                    return ["*", result];
                  } else {
                    if (($b = ($c = this.space_seen, $c !== false && $c !== nil ? scanner.$check(/\S/) : $c)) !== false && $b !== nil) {
                      this.lex_state = "expr_beg";
                      return ["SPLAT", result];
                    } else {
                      if (($b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                        this.lex_state = "expr_beg";
                        return ["SPLAT", result];
                      } else {
                        this.lex_state = "expr_beg";
                        return ["*", result];
                      }
                    }
                  };
                };
              } else {
                if (($b = scanner.$scan(/\!/)) !== false && $b !== nil) {
                  c = scanner.$scan(/./);
                  if (($b = this['$after_operator?']()) !== false && $b !== nil) {
                    this.lex_state = "expr_arg";
                    if (c['$==']("@")) {
                      return ["!", "!"]
                    };
                  } else {
                    this.lex_state = "expr_beg"
                  };
                  if (c['$==']("=")) {
                    return ["!=", "!="]
                  } else {
                    if (c['$==']("~")) {
                      return ["!~", "!~"]
                    }
                  };
                  scanner['$pos='](scanner.$pos()['$-'](1));
                  return ["!", "!"];
                } else {
                  if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                    if (($b = (($c = this.lex_state['$==']("expr_beg")) ? ($d = this.space_seen, ($d === nil || $d === false)) : $c)) !== false && $b !== nil) {
                      if (($b = ($c = scanner.$scan(/begin/), $c !== false && $c !== nil ? this['$space?']() : $c)) !== false && $b !== nil) {
                        scanner.$scan(/(.*)/);
                        while (($c = true) !== false && $c !== nil){if (($c = scanner['$eos?']()) !== false && $c !== nil) {
                          this.$raise("embedded document meets end of file")
                        };
                        if (($c = ($d = scanner.$scan(/\=end/), $d !== false && $d !== nil ? this['$space?']() : $d)) !== false && $c !== nil) {
                          return this.$next_token()
                        };
                        if (($c = scanner.$scan(/\n/)) !== false && $c !== nil) {
                          continue;
                        };
                        scanner.$scan(/(.*)/);};
                      }
                    };
                    this.lex_state = (function() { if (($b = this['$after_operator?']()) !== false && $b !== nil) {
                      return "expr_arg"
                    } else {
                      return "expr_beg"
                    }; return nil; }).call(this);
                    if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                      if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                        return ["===", "==="]
                      };
                      return ["==", "=="];
                    };
                    if (($b = scanner.$scan(/\~/)) !== false && $b !== nil) {
                      return ["=~", "=~"]
                    } else {
                      if (($b = scanner.$scan(/\>/)) !== false && $b !== nil) {
                        return ["=>", "=>"]
                      }
                    };
                    return ["=", "="];
                  } else {
                    if (($b = scanner.$scan(/\"/)) !== false && $b !== nil) {
                      this.string_parse = $hash2(["beg", "end", "interpolate"], {"beg": "\"", "end": "\"", "interpolate": true});
                      return ["STRING_BEG", scanner.$matched()];
                    } else {
                      if (($b = scanner.$scan(/\'/)) !== false && $b !== nil) {
                        this.string_parse = $hash2(["beg", "end"], {"beg": "'", "end": "'"});
                        return ["STRING_BEG", scanner.$matched()];
                      } else {
                        if (($b = scanner.$scan(/\`/)) !== false && $b !== nil) {
                          this.string_parse = $hash2(["beg", "end", "interpolate"], {"beg": "`", "end": "`", "interpolate": true});
                          return ["XSTRING_BEG", scanner.$matched()];
                        } else {
                          if (($b = scanner.$scan(/\&/)) !== false && $b !== nil) {
                            if (($b = scanner.$scan(/\&/)) !== false && $b !== nil) {
                              this.lex_state = "expr_beg";
                              if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                return ["OP_ASGN", "&&"]
                              };
                              return ["&&", "&&"];
                            } else {
                              if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                this.lex_state = "expr_beg";
                                return ["OP_ASGN", "&"];
                              }
                            };
                            if (($b = this['$spcarg?']()) !== false && $b !== nil) {
                              result = "&@"
                            } else {
                              if (($b = this['$beg?']()) !== false && $b !== nil) {
                                result = "&@"
                              } else {
                                result = "&"
                              }
                            };
                            this.lex_state = (function() { if (($b = this['$after_operator?']()) !== false && $b !== nil) {
                              return "expr_arg"
                            } else {
                              return "expr_beg"
                            }; return nil; }).call(this);
                            return [result, "&"];
                          } else {
                            if (($b = scanner.$scan(/\|/)) !== false && $b !== nil) {
                              if (($b = scanner.$scan(/\|/)) !== false && $b !== nil) {
                                this.lex_state = "expr_beg";
                                if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                  return ["OP_ASGN", "||"]
                                };
                                return ["||", "||"];
                              } else {
                                if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                  return ["OP_ASGN", "|"]
                                }
                              };
                              this.lex_state = (function() { if (($b = this['$after_operator?']()) !== false && $b !== nil) {
                                return "expr_arg"
                              } else {
                                return "expr_beg"
                              }; return nil; }).call(this);
                              return ["|", "|"];
                            } else {
                              if (($b = scanner.$scan(/\%W/)) !== false && $b !== nil) {
                                start_word = scanner.$scan(/./);
                                end_word = ((($b = $hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)) !== false && $b !== nil) ? $b : start_word);
                                this.string_parse = $hash2(["beg", "end", "interpolate"], {"beg": "W", "end": end_word, "interpolate": true});
                                scanner.$scan(/\s*/);
                                return ["WORDS_BEG", scanner.$matched()];
                              } else {
                                if (($b = scanner.$scan(/\%w/)) !== false && $b !== nil) {
                                  start_word = scanner.$scan(/./);
                                  end_word = ((($b = $hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)) !== false && $b !== nil) ? $b : start_word);
                                  this.string_parse = $hash2(["beg", "end"], {"beg": "w", "end": end_word});
                                  scanner.$scan(/\s*/);
                                  return ["AWORDS_BEG", scanner.$matched()];
                                } else {
                                  if (($b = scanner.$scan(/\%[Qq]/)) !== false && $b !== nil) {
                                    interpolate = scanner.$matched()['$end_with?']("Q");
                                    start_word = scanner.$scan(/./);
                                    end_word = ((($b = $hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)) !== false && $b !== nil) ? $b : start_word);
                                    this.string_parse = $hash2(["beg", "end", "balance", "nesting", "interpolate"], {"beg": start_word, "end": end_word, "balance": true, "nesting": 0, "interpolate": interpolate});
                                    return ["STRING_BEG", scanner.$matched()];
                                  } else {
                                    if (($b = scanner.$scan(/\%x/)) !== false && $b !== nil) {
                                      start_word = scanner.$scan(/./);
                                      end_word = ((($b = $hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)) !== false && $b !== nil) ? $b : start_word);
                                      this.string_parse = $hash2(["beg", "end", "balance", "nesting", "interpolate"], {"beg": start_word, "end": end_word, "balance": true, "nesting": 0, "interpolate": true});
                                      return ["XSTRING_BEG", scanner.$matched()];
                                    } else {
                                      if (($b = scanner.$scan(/\%r/)) !== false && $b !== nil) {
                                        start_word = scanner.$scan(/./);
                                        end_word = ((($b = $hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)) !== false && $b !== nil) ? $b : start_word);
                                        this.string_parse = $hash2(["beg", "end", "regexp", "balance", "nesting", "interpolate"], {"beg": start_word, "end": end_word, "regexp": true, "balance": true, "nesting": 0, "interpolate": true});
                                        return ["REGEXP_BEG", scanner.$matched()];
                                      } else {
                                        if (($b = scanner.$scan(/\//)) !== false && $b !== nil) {
                                          if (($b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                            this.string_parse = $hash2(["beg", "end", "interpolate", "regexp"], {"beg": "/", "end": "/", "interpolate": true, "regexp": true});
                                            return ["REGEXP_BEG", scanner.$matched()];
                                          } else {
                                            if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                              this.lex_state = "expr_beg";
                                              return ["OP_ASGN", "/"];
                                            } else {
                                              if (this.lex_state['$==']("expr_fname")) {
                                                this.lex_state = "expr_end"
                                              } else {
                                                if (($b = ((($c = this.lex_state['$==']("expr_cmdarg")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_arg"))) !== false && $b !== nil) {
                                                  if (($b = ($c = ($c = scanner.$check(/\s/), ($c === nil || $c === false)), $c !== false && $c !== nil ? this.space_seen : $c)) !== false && $b !== nil) {
                                                    this.string_parse = $hash2(["beg", "end", "interpolate", "regexp"], {"beg": "/", "end": "/", "interpolate": true, "regexp": true});
                                                    return ["REGEXP_BEG", scanner.$matched()];
                                                  }
                                                } else {
                                                  this.lex_state = "expr_beg"
                                                }
                                              }
                                            }
                                          };
                                          return ["/", "/"];
                                        } else {
                                          if (($b = scanner.$scan(/\%/)) !== false && $b !== nil) {
                                            if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                              this.lex_state = "expr_beg";
                                              return ["OP_ASGN", "%"];
                                            } else {
                                              if (($b = scanner.$check(/[^\s]/)) !== false && $b !== nil) {
                                                if (($b = ((($c = this.lex_state['$==']("expr_beg")) !== false && $c !== nil) ? $c : (($d = this.lex_state['$==']("expr_arg")) ? this.space_seen : $d))) !== false && $b !== nil) {
                                                  interpolate = true;
                                                  start_word = scanner.$scan(/./);
                                                  end_word = ((($b = $hash2(["(", "[", "{"], {"(": ")", "[": "]", "{": "}"})['$[]'](start_word)) !== false && $b !== nil) ? $b : start_word);
                                                  this.string_parse = $hash2(["beg", "end", "balance", "nesting", "interpolate"], {"beg": start_word, "end": end_word, "balance": true, "nesting": 0, "interpolate": interpolate});
                                                  return ["STRING_BEG", scanner.$matched()];
                                                }
                                              }
                                            };
                                            this.lex_state = (function() { if (this.lex_state['$==']("expr_fname")) {
                                              return "expr_end"
                                            } else {
                                              return "expr_beg"
                                            }; return nil; }).call(this);
                                            return ["%", "%"];
                                          } else {
                                            if (($b = scanner.$scan(/\\/)) !== false && $b !== nil) {
                                              if (($b = scanner.$scan(/\r?\n/)) !== false && $b !== nil) {
                                                this.space_seen = true;
                                                continue;;
                                              };
                                              this.$raise($scope.SyntaxError, "backslash must appear before newline :" + (this.file) + ":" + (this.line));
                                            } else {
                                              if (($b = scanner.$scan(/\(/)) !== false && $b !== nil) {
                                                result = scanner.$matched();
                                                if (($b = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                  result = "PAREN_BEG"
                                                } else {
                                                  if (($b = ($c = this.space_seen, $c !== false && $c !== nil ? ["expr_arg", "expr_cmdarg"]['$include?'](this.lex_state) : $c)) !== false && $b !== nil) {
                                                    result = "tLPAREN_ARG"
                                                  } else {
                                                    result = "("
                                                  }
                                                };
                                                this.lex_state = "expr_beg";
                                                this.$cond_push(0);
                                                this.$cmdarg_push(0);
                                                return [result, scanner.$matched()];
                                              } else {
                                                if (($b = scanner.$scan(/\)/)) !== false && $b !== nil) {
                                                  this.$cond_lexpop();
                                                  this.$cmdarg_lexpop();
                                                  this.lex_state = "expr_end";
                                                  return [")", scanner.$matched()];
                                                } else {
                                                  if (($b = scanner.$scan(/\[/)) !== false && $b !== nil) {
                                                    result = scanner.$matched();
                                                    if (($b = ["expr_fname", "expr_dot"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                      this.lex_state = "expr_arg";
                                                      if (($b = scanner.$scan(/\]=/)) !== false && $b !== nil) {
                                                        return ["[]=", "[]="]
                                                      } else {
                                                        if (($b = scanner.$scan(/\]/)) !== false && $b !== nil) {
                                                          return ["[]", "[]"]
                                                        } else {
                                                          this.$raise("Unexpected '[' token")
                                                        }
                                                      };
                                                    } else {
                                                      if (($b = ((($c = ["expr_beg", "expr_mid"]['$include?'](this.lex_state)) !== false && $c !== nil) ? $c : this.space_seen)) !== false && $b !== nil) {
                                                        this.lex_state = "expr_beg";
                                                        this.$cond_push(0);
                                                        this.$cmdarg_push(0);
                                                        return ["[", scanner.$matched()];
                                                      } else {
                                                        this.lex_state = "expr_beg";
                                                        this.$cond_push(0);
                                                        this.$cmdarg_push(0);
                                                        return ["[@", scanner.$matched()];
                                                      }
                                                    };
                                                  } else {
                                                    if (($b = scanner.$scan(/\]/)) !== false && $b !== nil) {
                                                      this.$cond_lexpop();
                                                      this.$cmdarg_lexpop();
                                                      this.lex_state = "expr_end";
                                                      return ["]", scanner.$matched()];
                                                    } else {
                                                      if (($b = scanner.$scan(/\}/)) !== false && $b !== nil) {
                                                        this.$cond_lexpop();
                                                        this.$cmdarg_lexpop();
                                                        this.lex_state = "expr_end";
                                                        return ["}", scanner.$matched()];
                                                      } else {
                                                        if (($b = scanner.$scan(/\.\.\./)) !== false && $b !== nil) {
                                                          this.lex_state = "expr_beg";
                                                          return ["...", scanner.$matched()];
                                                        } else {
                                                          if (($b = scanner.$scan(/\.\./)) !== false && $b !== nil) {
                                                            this.lex_state = "expr_beg";
                                                            return ["..", scanner.$matched()];
                                                          } else {
                                                            if (($b = scanner.$scan(/\./)) !== false && $b !== nil) {
                                                              if (($b = this.lex_state['$==']("expr_fname")) === false || $b === nil) {
                                                                this.lex_state = "expr_dot"
                                                              };
                                                              return [".", scanner.$matched()];
                                                            } else {
                                                              if (($b = scanner.$scan(/\:\:/)) !== false && $b !== nil) {
                                                                if (($b = ["expr_beg", "expr_mid", "expr_class"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                                  this.lex_state = "expr_beg";
                                                                  return ["::@", scanner.$matched()];
                                                                } else {
                                                                  if (($b = ($c = this.space_seen, $c !== false && $c !== nil ? this.lex_state['$==']("expr_arg") : $c)) !== false && $b !== nil) {
                                                                    this.lex_state = "expr_beg";
                                                                    return ["::@", scanner.$matched()];
                                                                  }
                                                                };
                                                                this.lex_state = "expr_dot";
                                                                return ["::", scanner.$matched()];
                                                              } else {
                                                                if (($b = scanner.$scan(/\:/)) !== false && $b !== nil) {
                                                                  if (($b = ((($c = this['$end?']()) !== false && $c !== nil) ? $c : scanner.$check(/\s/))) !== false && $b !== nil) {
                                                                    if (($b = scanner.$check(/\w/)) === false || $b === nil) {
                                                                      this.lex_state = "expr_beg";
                                                                      return [":", ":"];
                                                                    };
                                                                    this.lex_state = "expr_fname";
                                                                    return ["SYMBOL_BEG", ":"];
                                                                  };
                                                                  if (($b = scanner.$scan(/\'/)) !== false && $b !== nil) {
                                                                    this.string_parse = $hash2(["beg", "end"], {"beg": "'", "end": "'"})
                                                                  } else {
                                                                    if (($b = scanner.$scan(/\"/)) !== false && $b !== nil) {
                                                                      this.string_parse = $hash2(["beg", "end", "interpolate"], {"beg": "\"", "end": "\"", "interpolate": true})
                                                                    }
                                                                  };
                                                                  this.lex_state = "expr_fname";
                                                                  return ["SYMBOL_BEG", ":"];
                                                                } else {
                                                                  if (($b = scanner.$scan(/\^\=/)) !== false && $b !== nil) {
                                                                    this.lex_state = "expr_beg";
                                                                    return ["OP_ASGN", "^"];
                                                                  } else {
                                                                    if (($b = scanner.$scan(/\^/)) !== false && $b !== nil) {
                                                                      if (this.lex_state['$==']("expr_fname")) {
                                                                        this.lex_state = "expr_end";
                                                                        return ["^", scanner.$matched()];
                                                                      };
                                                                      this.lex_state = "expr_beg";
                                                                      return ["^", scanner.$matched()];
                                                                    } else {
                                                                      if (($b = scanner.$check(/\</)) !== false && $b !== nil) {
                                                                        if (($b = scanner.$scan(/\<\<\=/)) !== false && $b !== nil) {
                                                                          this.lex_state = "expr_beg";
                                                                          return ["OP_ASGN", "<<"];
                                                                        } else {
                                                                          if (($b = scanner.$scan(/\<\</)) !== false && $b !== nil) {
                                                                            if (this.lex_state['$==']("expr_fname")) {
                                                                              this.lex_state = "expr_end";
                                                                              return ["<<", "<<"];
                                                                            } else {
                                                                              if (($b = ($c = ($c = ["expr_end", "expr_dot", "expr_endarg", "expr_class"]['$include?'](this.lex_state), ($c === nil || $c === false)), $c !== false && $c !== nil ? this.space_seen : $c)) !== false && $b !== nil) {
                                                                                if (($b = scanner.$scan(/(-?)['"]?(\w+)['"]?/)) !== false && $b !== nil) {
                                                                                  heredoc = scanner['$[]'](2);
                                                                                  scanner.$scan(/.*\n/);
                                                                                  this.string_parse = $hash2(["beg", "end", "interpolate"], {"beg": heredoc, "end": heredoc, "interpolate": true});
                                                                                  return ["STRING_BEG", heredoc];
                                                                                };
                                                                                this.lex_state = "expr_beg";
                                                                                return ["<<", "<<"];
                                                                              }
                                                                            };
                                                                            this.lex_state = "expr_beg";
                                                                            return ["<<", "<<"];
                                                                          } else {
                                                                            if (($b = scanner.$scan(/\<\=\>/)) !== false && $b !== nil) {
                                                                              if (($b = this['$after_operator?']()) !== false && $b !== nil) {
                                                                                this.lex_state = "expr_arg"
                                                                              } else {
                                                                                if (this.lex_state['$==']("expr_class")) {
                                                                                  cmd_start = true
                                                                                };
                                                                                this.lex_state = "expr_beg";
                                                                              };
                                                                              return ["<=>", "<=>"];
                                                                            } else {
                                                                              if (($b = scanner.$scan(/\<\=/)) !== false && $b !== nil) {
                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                  this.lex_state = "expr_end"
                                                                                } else {
                                                                                  this.lex_state = "expr_beg"
                                                                                };
                                                                                return ["<=", "<="];
                                                                              } else {
                                                                                if (($b = scanner.$scan(/\</)) !== false && $b !== nil) {
                                                                                  if (this.lex_state['$==']("expr_fname")) {
                                                                                    this.lex_state = "expr_end"
                                                                                  } else {
                                                                                    this.lex_state = "expr_beg"
                                                                                  };
                                                                                  return ["<", "<"];
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      } else {
                                                                        if (($b = scanner.$check(/\>/)) !== false && $b !== nil) {
                                                                          if (($b = scanner.$scan(/\>\>\=/)) !== false && $b !== nil) {
                                                                            return ["OP_ASGN", ">>"]
                                                                          } else {
                                                                            if (($b = scanner.$scan(/\>\>/)) !== false && $b !== nil) {
                                                                              if (($b = ((($c = this.lex_state['$==']("expr_fname")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_dot"))) !== false && $b !== nil) {
                                                                                this.lex_state = "expr_arg"
                                                                              } else {
                                                                                this.lex_state = "expr_beg"
                                                                              };
                                                                              return [">>", ">>"];
                                                                            } else {
                                                                              if (($b = scanner.$scan(/\>\=/)) !== false && $b !== nil) {
                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                  this.lex_state = "expr_end"
                                                                                } else {
                                                                                  this.lex_state = "expr_beg"
                                                                                };
                                                                                return [">=", scanner.$matched()];
                                                                              } else {
                                                                                if (($b = scanner.$scan(/\>/)) !== false && $b !== nil) {
                                                                                  if (this.lex_state['$==']("expr_fname")) {
                                                                                    this.lex_state = "expr_arg"
                                                                                  } else {
                                                                                    this.lex_state = "expr_beg"
                                                                                  };
                                                                                  return [">", ">"];
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        } else {
                                                                          if (($b = scanner.$scan(/->/)) !== false && $b !== nil) {
                                                                            this.lex_state = "expr_end";
                                                                            this.start_of_lambda = true;
                                                                            return ["LAMBDA", scanner.$matched()];
                                                                          } else {
                                                                            if (($b = scanner.$scan(/[+-]/)) !== false && $b !== nil) {
                                                                              result = scanner.$matched();
                                                                              sign = result['$+']("@");
                                                                              if (($b = ((($c = this.lex_state['$==']("expr_beg")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_mid"))) !== false && $b !== nil) {
                                                                                this.lex_state = "expr_mid";
                                                                                return [sign, sign];
                                                                              } else {
                                                                                if (this.lex_state['$==']("expr_fname")) {
                                                                                  this.lex_state = "expr_end";
                                                                                  if (($b = scanner.$scan(/@/)) !== false && $b !== nil) {
                                                                                    return ["IDENTIFIER", result['$+'](scanner.$matched())]
                                                                                  };
                                                                                  return [result, result];
                                                                                }
                                                                              };
                                                                              if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                                                                this.lex_state = "expr_beg";
                                                                                return ["OP_ASGN", result];
                                                                              };
                                                                              if (($b = ((($c = this.lex_state['$==']("expr_cmdarg")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_arg"))) !== false && $b !== nil) {
                                                                                if (($b = ($c = ($c = scanner.$check(/\s/), ($c === nil || $c === false)), $c !== false && $c !== nil ? this.space_seen : $c)) !== false && $b !== nil) {
                                                                                  this.lex_state = "expr_mid";
                                                                                  return [sign, sign];
                                                                                }
                                                                              };
                                                                              this.lex_state = "expr_beg";
                                                                              return [result, result];
                                                                            } else {
                                                                              if (($b = scanner.$scan(/\?/)) !== false && $b !== nil) {
                                                                                if (($b = this['$end?']()) !== false && $b !== nil) {
                                                                                  this.lex_state = "expr_beg";
                                                                                  return ["?", scanner.$matched()];
                                                                                };
                                                                                if (($b = scanner.$check(/\ |\t|\r|\s/)) === false || $b === nil) {
                                                                                  this.lex_state = "expr_end";
                                                                                  return ["STRING", scanner.$scan(/./)];
                                                                                };
                                                                                this.lex_state = "expr_beg";
                                                                                return ["?", scanner.$matched()];
                                                                              } else {
                                                                                if (($b = scanner.$scan(/\~/)) !== false && $b !== nil) {
                                                                                  if (this.lex_state['$==']("expr_fname")) {
                                                                                    this.lex_state = "expr_end";
                                                                                    return ["~", "~"];
                                                                                  };
                                                                                  this.lex_state = "expr_beg";
                                                                                  return ["~", "~"];
                                                                                } else {
                                                                                  if (($b = scanner.$check(/\$/)) !== false && $b !== nil) {
                                                                                    if (($b = scanner.$scan(/\$([1-9]\d*)/)) !== false && $b !== nil) {
                                                                                      this.lex_state = "expr_end";
                                                                                      return ["NTH_REF", scanner.$matched().$sub("$", "")];
                                                                                    } else {
                                                                                      if (($b = scanner.$scan(/(\$_)(\w+)/)) !== false && $b !== nil) {
                                                                                        this.lex_state = "expr_end";
                                                                                        return ["GVAR", scanner.$matched()];
                                                                                      } else {
                                                                                        if (($b = scanner.$scan(/\$[\+\'\`\&!@\"~*$?\/\\:;=.,<>_]/)) !== false && $b !== nil) {
                                                                                          this.lex_state = "expr_end";
                                                                                          return ["GVAR", scanner.$matched()];
                                                                                        } else {
                                                                                          if (($b = scanner.$scan(/\$\w+/)) !== false && $b !== nil) {
                                                                                            this.lex_state = "expr_end";
                                                                                            return ["GVAR", scanner.$matched()];
                                                                                          } else {
                                                                                            this.$raise("Bad gvar name: " + (scanner.$peek(5).$inspect()))
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  } else {
                                                                                    if (($b = scanner.$scan(/\$\w+/)) !== false && $b !== nil) {
                                                                                      this.lex_state = "expr_end";
                                                                                      return ["GVAR", scanner.$matched()];
                                                                                    } else {
                                                                                      if (($b = scanner.$scan(/\@\@\w*/)) !== false && $b !== nil) {
                                                                                        this.lex_state = "expr_end";
                                                                                        return ["CVAR", scanner.$matched()];
                                                                                      } else {
                                                                                        if (($b = scanner.$scan(/\@\w*/)) !== false && $b !== nil) {
                                                                                          this.lex_state = "expr_end";
                                                                                          return ["IVAR", scanner.$matched()];
                                                                                        } else {
                                                                                          if (($b = scanner.$scan(/\,/)) !== false && $b !== nil) {
                                                                                            this.lex_state = "expr_beg";
                                                                                            return [",", scanner.$matched()];
                                                                                          } else {
                                                                                            if (($b = scanner.$scan(/\{/)) !== false && $b !== nil) {
                                                                                              if (($b = this.start_of_lambda) !== false && $b !== nil) {
                                                                                                this.start_of_lambda = false;
                                                                                                this.lex_state = "expr_beg";
                                                                                                return ["LAMBEG", scanner.$matched()];
                                                                                              } else {
                                                                                                if (($b = ["expr_end", "expr_arg", "expr_cmdarg"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                                                                  result = "LCURLY"
                                                                                                } else {
                                                                                                  if (this.lex_state['$==']("expr_endarg")) {
                                                                                                    result = "LBRACE_ARG"
                                                                                                  } else {
                                                                                                    result = "{"
                                                                                                  }
                                                                                                }
                                                                                              };
                                                                                              this.lex_state = "expr_beg";
                                                                                              this.$cond_push(0);
                                                                                              this.$cmdarg_push(0);
                                                                                              return [result, scanner.$matched()];
                                                                                            } else {
                                                                                              if (($b = scanner.$check(/[0-9]/)) !== false && $b !== nil) {
                                                                                                this.lex_state = "expr_end";
                                                                                                if (($b = scanner.$scan(/0b?(0|1|_)+/)) !== false && $b !== nil) {
                                                                                                  return ["INTEGER", scanner.$matched().$to_i(2)]
                                                                                                } else {
                                                                                                  if (($b = scanner.$scan(/0o?([0-7]|_)+/)) !== false && $b !== nil) {
                                                                                                    return ["INTEGER", scanner.$matched().$to_i(8)]
                                                                                                  } else {
                                                                                                    if (($b = scanner.$scan(/[\d_]+\.[\d_]+\b|[\d_]+(\.[\d_]+)?[eE][-+]?[\d_]+\b/)) !== false && $b !== nil) {
                                                                                                      return ["FLOAT", scanner.$matched().$gsub(/_/, "").$to_f()]
                                                                                                    } else {
                                                                                                      if (($b = scanner.$scan(/[\d_]+\b/)) !== false && $b !== nil) {
                                                                                                        return ["INTEGER", scanner.$matched().$gsub(/_/, "").$to_i()]
                                                                                                      } else {
                                                                                                        if (($b = scanner.$scan(/0(x|X)(\d|[a-f]|[A-F]|_)+/)) !== false && $b !== nil) {
                                                                                                          return ["INTEGER", scanner.$matched().$to_i(16)]
                                                                                                        } else {
                                                                                                          this.$raise("Lexing error on numeric type: `" + (scanner.$peek(5)) + "`")
                                                                                                        }
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                };
                                                                                              } else {
                                                                                                if (($b = scanner.$scan(/(\w)+[\?\!]?/)) !== false && $b !== nil) {
                                                                                                  matched = scanner.$matched();
                                                                                                  if (($b = ($c = ($c = scanner.$peek(2)['$==']("::"), ($c === nil || $c === false)), $c !== false && $c !== nil ? scanner.$scan(/:/) : $c)) !== false && $b !== nil) {
                                                                                                    this.lex_state = "expr_beg";
                                                                                                    return ["LABEL", "" + (matched)];
                                                                                                  };
                                                                                                  $case = matched;if ("class"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_dot")) {
                                                                                                    this.lex_state = "expr_end";
                                                                                                    return ["IDENTIFIER", matched];
                                                                                                  };
                                                                                                  this.lex_state = "expr_class";
                                                                                                  return ["CLASS", matched];
                                                                                                  }else if ("module"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_dot")) {
                                                                                                    return ["IDENTIFIER", matched]
                                                                                                  };
                                                                                                  this.lex_state = "expr_class";
                                                                                                  return ["MODULE", matched];
                                                                                                  }else if ("defined?"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_dot")) {
                                                                                                    return ["IDENTIFIER", matched]
                                                                                                  };
                                                                                                  this.lex_state = "expr_arg";
                                                                                                  return ["DEFINED", "defined?"];
                                                                                                  }else if ("def"['$===']($case)) {
                                                                                                  this.lex_state = "expr_fname";
                                                                                                  this.scope_line = this.line;
                                                                                                  return ["DEF", matched];
                                                                                                  }else if ("undef"['$===']($case)) {
                                                                                                  this.lex_state = "expr_fname";
                                                                                                  return ["UNDEF", matched];
                                                                                                  }else if ("end"['$===']($case)) {
                                                                                                  if (($b = ["expr_dot", "expr_fname"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                                                                    this.lex_state = "expr_end";
                                                                                                    return ["IDENTIFIER", matched];
                                                                                                  };
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["END", matched];
                                                                                                  }else if ("do"['$===']($case)) {
                                                                                                  if (($b = this.start_of_lambda) !== false && $b !== nil) {
                                                                                                    this.start_of_lambda = false;
                                                                                                    this.lex_state = "expr_beg";
                                                                                                    return ["DO_LAMBDA", scanner.$matched()];
                                                                                                  } else {
                                                                                                    if (($b = this['$cond?']()) !== false && $b !== nil) {
                                                                                                      this.lex_state = "expr_beg";
                                                                                                      return ["DO_COND", matched];
                                                                                                    } else {
                                                                                                      if (($b = ($c = this['$cmdarg?'](), $c !== false && $c !== nil ? ($c = this.lex_state['$==']("expr_cmdarg"), ($c === nil || $c === false)) : $c)) !== false && $b !== nil) {
                                                                                                        this.lex_state = "expr_beg";
                                                                                                        return ["DO_BLOCK", matched];
                                                                                                      } else {
                                                                                                        if (this.lex_state['$==']("expr_endarg")) {
                                                                                                          return ["DO_BLOCK", matched]
                                                                                                        } else {
                                                                                                          this.lex_state = "expr_beg";
                                                                                                          return ["DO", matched];
                                                                                                        }
                                                                                                      }
                                                                                                    }
                                                                                                  }
                                                                                                  }else if ("if"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_beg")) {
                                                                                                    return ["IF", matched]
                                                                                                  };
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["IF_MOD", matched];
                                                                                                  }else if ("unless"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_beg")) {
                                                                                                    return ["UNLESS", matched]
                                                                                                  };
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["UNLESS_MOD", matched];
                                                                                                  }else if ("else"['$===']($case)) {
                                                                                                  return ["ELSE", matched]
                                                                                                  }else if ("elsif"['$===']($case)) {
                                                                                                  return ["ELSIF", matched]
                                                                                                  }else if ("self"['$===']($case)) {
                                                                                                  if (($b = this.lex_state['$==']("expr_fname")) === false || $b === nil) {
                                                                                                    this.lex_state = "expr_end"
                                                                                                  };
                                                                                                  return ["SELF", matched];
                                                                                                  }else if ("true"['$===']($case)) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["TRUE", matched];
                                                                                                  }else if ("false"['$===']($case)) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["FALSE", matched];
                                                                                                  }else if ("nil"['$===']($case)) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["NIL", matched];
                                                                                                  }else if ("__LINE__"['$===']($case)) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["LINE", this.line.$to_s()];
                                                                                                  }else if ("__FILE__"['$===']($case)) {
                                                                                                  this.lex_state = "expr_end";
                                                                                                  return ["FILE", matched];
                                                                                                  }else if ("begin"['$===']($case)) {
                                                                                                  if (($b = ["expr_dot", "expr_fname"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                                                                    this.lex_state = "expr_end";
                                                                                                    return ["IDENTIFIER", matched];
                                                                                                  };
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["BEGIN", matched];
                                                                                                  }else if ("rescue"['$===']($case)) {
                                                                                                  if (($b = ["expr_dot", "expr_fname"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                                                                    return ["IDENTIFIER", matched]
                                                                                                  };
                                                                                                  if (this.lex_state['$==']("expr_beg")) {
                                                                                                    this.lex_state = "expr_mid";
                                                                                                    return ["RESCUE", matched];
                                                                                                  };
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["RESCUE_MOD", matched];
                                                                                                  }else if ("ensure"['$===']($case)) {
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["ENSURE", matched];
                                                                                                  }else if ("case"['$===']($case)) {
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["CASE", matched];
                                                                                                  }else if ("when"['$===']($case)) {
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["WHEN", matched];
                                                                                                  }else if ("or"['$===']($case)) {
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["OR", matched];
                                                                                                  }else if ("and"['$===']($case)) {
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["AND", matched];
                                                                                                  }else if ("not"['$===']($case)) {
                                                                                                  this.lex_state = "expr_arg";
                                                                                                  return ["NOT", matched];
                                                                                                  }else if ("return"['$===']($case)) {
                                                                                                  this.lex_state = "expr_mid";
                                                                                                  return ["RETURN", matched];
                                                                                                  }else if ("next"['$===']($case)) {
                                                                                                  if (($b = ((($c = this.lex_state['$==']("expr_dot")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_fname"))) !== false && $b !== nil) {
                                                                                                    this.lex_state = "expr_end";
                                                                                                    return ["IDENTIFIER", matched];
                                                                                                  };
                                                                                                  this.lex_state = "expr_mid";
                                                                                                  return ["NEXT", matched];
                                                                                                  }else if ("redo"['$===']($case)) {
                                                                                                  if (($b = ((($c = this.lex_state['$==']("expr_dot")) !== false && $c !== nil) ? $c : this.lex_state['$==']("expr_fname"))) !== false && $b !== nil) {
                                                                                                    this.lex_state = "expr_end";
                                                                                                    return ["IDENTIFIER", matched];
                                                                                                  };
                                                                                                  this.lex_state = "expr_mid";
                                                                                                  return ["REDO", matched];
                                                                                                  }else if ("break"['$===']($case)) {
                                                                                                  this.lex_state = "expr_mid";
                                                                                                  return ["BREAK", matched];
                                                                                                  }else if ("super"['$===']($case)) {
                                                                                                  this.lex_state = "expr_arg";
                                                                                                  return ["SUPER", matched];
                                                                                                  }else if ("then"['$===']($case)) {
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["THEN", matched];
                                                                                                  }else if ("while"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_beg")) {
                                                                                                    return ["WHILE", matched]
                                                                                                  };
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["WHILE_MOD", matched];
                                                                                                  }else if ("until"['$===']($case)) {
                                                                                                  if (this.lex_state['$==']("expr_beg")) {
                                                                                                    return ["UNTIL", matched]
                                                                                                  };
                                                                                                  this.lex_state = "expr_beg";
                                                                                                  return ["UNTIL_MOD", matched];
                                                                                                  }else if ("yield"['$===']($case)) {
                                                                                                  this.lex_state = "expr_arg";
                                                                                                  return ["YIELD", matched];
                                                                                                  }else if ("alias"['$===']($case)) {
                                                                                                  this.lex_state = "expr_fname";
                                                                                                  return ["ALIAS", matched];
                                                                                                  };
                                                                                                  matched = matched;
                                                                                                  if (($b = ($c = ($c = scanner.$peek(2)['$==']("::"), ($c === nil || $c === false)), $c !== false && $c !== nil ? scanner.$scan(/\:/) : $c)) !== false && $b !== nil) {
                                                                                                    return ["LABEL", matched]
                                                                                                  };
                                                                                                  if (this.lex_state['$==']("expr_fname")) {
                                                                                                    if (($b = scanner.$scan(/\=/)) !== false && $b !== nil) {
                                                                                                      this.lex_state = "expr_end";
                                                                                                      return ["IDENTIFIER", matched['$+'](scanner.$matched())];
                                                                                                    }
                                                                                                  };
                                                                                                  if (($b = ["expr_beg", "expr_dot", "expr_mid", "expr_arg", "expr_cmdarg"]['$include?'](this.lex_state)) !== false && $b !== nil) {
                                                                                                    this.lex_state = (function() { if (cmd_start !== false && cmd_start !== nil) {
                                                                                                      return "expr_cmdarg"
                                                                                                    } else {
                                                                                                      return "expr_arg"
                                                                                                    }; return nil; }).call(this)
                                                                                                  } else {
                                                                                                    this.lex_state = "expr_end"
                                                                                                  };
                                                                                                  return [(function() { if (($b = matched['$=~'](/^[A-Z]/)) !== false && $b !== nil) {
                                                                                                    return "CONSTANT"
                                                                                                  } else {
                                                                                                    return "IDENTIFIER"
                                                                                                  }; return nil; }).call(this), matched];
                                                                                                }
                                                                                              }
                                                                                            }
                                                                                          }
                                                                                        }
                                                                                      }
                                                                                    }
                                                                                  }
                                                                                }
                                                                              }
                                                                            }
                                                                          }
                                                                        }
                                                                      }
                                                                    }
                                                                  }
                                                                }
                                                              }
                                                            }
                                                          }
                                                        }
                                                      }
                                                    }
                                                  }
                                                }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        };
        if (($b = scanner['$eos?']()) !== false && $b !== nil) {
          return [false, false]
        };
        this.$raise("Unexpected content in parsing stream `" + (scanner.$peek(5)) + "` :" + (this.file) + ":" + (this.line));};
      };

      return nil;
    })(Opal, ($scope.Racc)._scope.Parser)

  })(self);
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $hash2 = $opal.hash2, $gvars = $opal.gvars, $range = $opal.range;

  $opal.add_stubs(['$attr_reader', '$to_s', '$line', '$inspect', '$parse', '$new', '$[]', '$==', '$flatten', '$top', '$unshift', '$f', '$version_comment', '$join', '$map', '$to_proc', '$=~', '$gsub', '$[]=', '$to_sym', '$sub', '$each', '$split', '$raise', '$warn', '$line=', '$alias_method', '$+', '$include?', '$s', '$process', '$is_a?', '$indent', '$add_temp', '$defines_defn', '$keys', '$to_vars', '$in_scope', '$parent=', '$tap', '$new_temp', '$queue_temp', '$push_while', '$pop_while', '$in_while?', '$shift', '$respond_to?', '$__send__', '$returns', '$first', '$===', '$>', '$length', '$<<', '$empty?', '$class_scope?', '$find_inline_yield', '$expression?', '$<', '$index', '$each_with_index', '$has_temp?', '$uses_block!', '$block_name', '$find_parent_def', '$mid_to_jsid', '$current_self', '$with_temp', '$last', '$pop', '$identify!', '$js_block_args', '$find', '$add_arg', '$-', '$block_name=', '$lvar_to_js', '$next_temp', '$top?', '$intern', '$js_block_given', '$any?', '$insert', '$name=', '$proto', '$to_donate_methods', '$js_def', '$end_line', '$defines_defs=', '$defines_defn=', '$start_with?', '$arity_check', '$mid=', '$defs=', '$identity', '$uses_block?', '$push', '$uses_super', '$uses_zuper', '$catch_return', '$name', '$class?', '$methods', '$size', '$-@', '$iter?', '$even?', '$all?', '$times', '$js_truthy', '$in_while', '$type', '$%', '$>=', '$add_local', '$add_ivar', '$catch_return=', '$def?', '$js_falsy', '$dup', '$js_truthy_optimize', '$handle_block_given', '$handle_yield_call', '$process_arglist', '$error', '$in_case', '$js_super', '$uses_zuper=', '$def_in_class?', '$mid', '$uses_super=', '$unique_temp', '$parent', '$defs', '$get_super_chain']);
  ;
  ;
  ;
  ;
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function Parser() {};
      Parser = $klass($base, $super, "Parser", Parser);

      var def = Parser._proto, $scope = Parser._scope, TMP_6, TMP_8, TMP_9, TMP_10, TMP_11;
      def.file = def.sexp = def.fragments = def.line = def.indent = def.unique = def.method_missing = def.method_calls = def.scope = def.case_stmt = def.helpers = def.irb_vars = def.arity_check = def.const_missing = def.while_loop = def.space = nil;

      (function($base, $super){
        function Fragment() {};
        Fragment = $klass($base, $super, "Fragment", Fragment);

        var def = Fragment._proto, $scope = Fragment._scope;
        def.sexp = def.code = nil;

        Fragment.$attr_reader("code");

        def.$initialize = function(code, sexp) {
          if (sexp == null) {
            sexp = nil
          }
          this.code = code.$to_s();
          return this.sexp = sexp;
        };

        def.$to_code = function() {
          var $a;
          if (($a = this.sexp) !== false && $a !== nil) {
            return "/*:" + (this.sexp.$line()) + "*/" + (this.code)
          } else {
            return this.code
          };
        };

        def.$inspect = function() {
          
          return "f(" + (this.code.$inspect()) + ")";
        };

        def.$line = function() {
          var $a;
          if (($a = this.sexp) !== false && $a !== nil) {
            return this.sexp.$line()
          } else {
            return nil
          };
        };

        return nil;
      })(Parser, null);

      $scope.INDENT = "  ";

      $scope.LEVEL = ["stmt", "stmt_closure", "list", "expr", "recv"];

      $scope.COMPARE = ["<", ">", "<=", ">="];

      $scope.RESERVED = ["break", "case", "catch", "continue", "debugger", "default", "delete", "do", "else", "finally", "for", "function", "if", "in", "instanceof", "new", "return", "switch", "this", "throw", "try", "typeof", "var", "let", "void", "while", "with", "class", "enum", "export", "extends", "import", "super", "true", "false", "native", "const", "static"];

      $scope.STATEMENTS = ["xstr", "dxstr"];

      Parser.$attr_reader("result");

      Parser.$attr_reader("fragments");

      def.$parse = function(source, options) {
        var $a, $b;if (options == null) {
          options = $hash2([], {})
        }
        this.sexp = $scope.Grammar.$new().$parse(source, options['$[]']("file"));
        this.line = 1;
        this.indent = "";
        this.unique = 0;
        this.helpers = $hash2(["breaker", "slice"], {"breaker": true, "slice": true});
        this.file = ((($a = options['$[]']("file")) !== false && $a !== nil) ? $a : "(file)");
        this.source_file = ((($a = options['$[]']("source_file")) !== false && $a !== nil) ? $a : this.file);
        this.method_missing = ($a = options['$[]']("method_missing")['$=='](false), ($a === nil || $a === false));
        this.arity_check = options['$[]']("arity_check");
        this.const_missing = options['$[]']("const_missing")['$=='](true);
        this.irb_vars = options['$[]']("irb")['$=='](true);
        this.method_calls = $hash2([], {});
        this.fragments = this.$top(this.sexp).$flatten();
        this.fragments.$unshift(this.$f(this.$version_comment()));
        return this.result = ($a = ($b = this.fragments).$map, $a._p = "code".$to_proc(), $a).call($b).$join("");
      };

      def.$version_comment = function() {
        
        return "/* Generated by Opal " + (($scope.Opal)._scope.VERSION) + " */\n";
      };

      def.$source_map = function() {
        
        return ($scope.Opal)._scope.SourceMap.$new(this.fragments, "(file)");
      };

      def.$extract_parser_options = function(content) {
        var $a, TMP_1, $b, $c, $d, result = nil;
        result = $hash2([], {});
        if (($a = /^#\ opal\:(.*)/['$=~'](content)) !== false && $a !== nil) {
          ($a = ($b = ($c = ($d = $gvars["~"]['$[]'](1).$split(",")).$map, $c._p = "strip".$to_proc(), $c).call($d)).$each, $a._p = (TMP_1 = function(opt) {

            var self = TMP_1._s || this, $a;
            if (opt == null) opt = nil;
            
            if (opt['$==']("")) {
              return nil;
            };
            opt = opt.$gsub("-", "_");
            if (($a = opt['$=~'](/no_/)) !== false && $a !== nil) {
              return result['$[]='](opt.$sub(/no_/, "").$to_sym(), false)
            } else {
              return result['$[]='](opt.$to_sym(), true)
            };
          }, TMP_1._s = this, TMP_1), $a).call($b)
        };
        return result;
      };

      def.$error = function(msg) {
        
        return this.$raise($scope.SyntaxError, "" + (msg) + " :" + (this.file) + ":" + (this.line));
      };

      def.$warning = function(msg) {
        
        return this.$warn("" + (msg) + " :" + (this.file) + ":" + (this.line));
      };

      def.$parser_indent = function() {
        
        return this.indent;
      };

      def.$s = function(parts) {
        var sexp = nil;parts = $slice.call(arguments, 0);
        sexp = $scope.Array.$new(parts);
        sexp['$line='](this.line);
        return sexp;
      };

      def.$f = function(code, sexp) {
        if (sexp == null) {
          sexp = nil
        }
        return $scope.Fragment.$new(code, sexp);
      };

      Parser.$alias_method("fragment", "f");

      def.$mid_to_jsid = function(mid) {
        var $a;
        if (($a = /\=|\+|\-|\*|\/|\!|\?|\<|\>|\&|\||\^|\%|\~|\[/['$=~'](mid.$to_s())) !== false && $a !== nil) {
          return "['$" + (mid) + "']"
        } else {
          return ".$"['$+'](mid)
        };
      };

      def.$lvar_to_js = function(var$) {
        var $a;
        if (($a = $scope.RESERVED['$include?'](var$.$to_s())) !== false && $a !== nil) {
          var$ = "" + (var$) + "$"
        };
        return var$.$to_sym();
      };

      def.$unique_temp = function() {
        
        return "TMP_" + (this.unique = this.unique['$+'](1));
      };

      def.$top = function(sexp, options) {
        var $a, TMP_2, $b, TMP_5, $c, code = nil, vars = nil, stubs = nil;if (options == null) {
          options = $hash2([], {})
        }
        $a = [nil, nil], code = $a[0], vars = $a[1];
        if (($a = sexp) === false || $a === nil) {
          sexp = this.$s("nil")
        };
        ($a = ($b = this).$in_scope, $a._p = (TMP_2 = function() {

          var self = TMP_2._s || this, TMP_3, $a, $b, TMP_4, $c;
          if (self.scope == null) self.scope = nil;
          if (self.helpers == null) self.helpers = nil;
          if (self.irb_vars == null) self.irb_vars = nil;

          
          ($a = ($b = self).$indent, $a._p = (TMP_3 = function() {

            var self = TMP_3._s || this, $a, scope = nil;
            if (self.indent == null) self.indent = nil;

            
            scope = self.$s("scope", sexp);
            scope['$line='](sexp.$line());
            code = self.$process(scope, "stmt");
            if (($a = code['$is_a?']($scope.Array)) === false || $a === nil) {
              code = [code]
            };
            return code.$unshift(self.$f(self.indent, sexp));
          }, TMP_3._s = self, TMP_3), $a).call($b);
          self.scope.$add_temp("self = $opal.top");
          self.scope.$add_temp("$scope = $opal");
          self.scope.$add_temp("nil = $opal.nil");
          if (($a = self.scope.$defines_defn()) !== false && $a !== nil) {
            self.scope.$add_temp("def = $opal.Object._proto")
          };
          ($a = ($c = self.helpers.$keys()).$each, $a._p = (TMP_4 = function(h) {

            var self = TMP_4._s || this;
            if (self.scope == null) self.scope = nil;

            if (h == null) h = nil;
            
            return self.scope.$add_temp("$" + (h) + " = $opal." + (h))
          }, TMP_4._s = self, TMP_4), $a).call($c);
          vars = [self.$f($scope.INDENT, sexp), self.scope.$to_vars(), self.$f("\n", sexp)];
          if (($a = self.irb_vars) !== false && $a !== nil) {
            return code.$unshift(self.$f("if (!$opal.irb_vars) { $opal.irb_vars = {}; }\n", sexp))
          } else {
            return nil
          };
        }, TMP_2._s = this, TMP_2), $a).call($b, "top");
        if (($a = this.method_missing) !== false && $a !== nil) {
          stubs = this.$f(("\n" + ($scope.INDENT) + "$opal.add_stubs([")['$+'](($a = ($c = this.method_calls.$keys()).$map, $a._p = (TMP_5 = function(k) {

            var self = TMP_5._s || this;
            if (k == null) k = nil;
            
            return "'$" + (k) + "'"
          }, TMP_5._s = this, TMP_5), $a).call($c).$join(", "))['$+']("]);\n"), sexp)
        } else {
          stubs = []
        };
        return [this.$f("(function($opal) {\n", sexp), vars, stubs, code, this.$f("\n})(Opal);\n", sexp)];
      };

      def.$in_scope = TMP_6 = function(type) {
        var TMP_7, $a, $b, $iter = TMP_6._p, $yield = $iter || nil, parent = nil;TMP_6._p = null;
        if ($yield === nil) {
          return nil
        };
        parent = this.scope;
        this.scope = ($a = ($b = $scope.TargetScope.$new(type, this)).$tap, $a._p = (TMP_7 = function(s) {

          var self = TMP_7._s || this;
          if (s == null) s = nil;
          
          return s['$parent='](parent)
        }, TMP_7._s = this, TMP_7), $a).call($b);
        if ($opal.$yield1($yield, this.scope) === $breaker) return $breaker.$v;
        return this.scope = parent;
      };

      def.$indent = TMP_8 = function() {
        var $a, $iter = TMP_8._p, block = $iter || nil, indent = nil, res = nil;TMP_8._p = null;
        indent = this.indent;
        this.indent = this.indent['$+']($scope.INDENT);
        this.space = "\n" + (this.indent);
        res = ((($a = $opal.$yieldX(block, [])) === $breaker) ? $breaker.$v : $a);
        this.indent = indent;
        this.space = "\n" + (this.indent);
        return res;
      };

      def.$with_temp = TMP_9 = function() {
        var $a, $iter = TMP_9._p, block = $iter || nil, tmp = nil, res = nil;TMP_9._p = null;
        tmp = this.scope.$new_temp();
        res = ((($a = $opal.$yield1(block, tmp)) === $breaker) ? $breaker.$v : $a);
        this.scope.$queue_temp(tmp);
        return res;
      };

      def.$in_while = TMP_10 = function() {
        var $a, $iter = TMP_10._p, $yield = $iter || nil, result = nil;TMP_10._p = null;
        if ($yield === nil) {
          return nil
        };
        this.while_loop = this.scope.$push_while();
        result = ((($a = $opal.$yieldX($yield, [])) === $breaker) ? $breaker.$v : $a);
        this.scope.$pop_while();
        return result;
      };

      def.$in_case = TMP_11 = function() {
        var $iter = TMP_11._p, $yield = $iter || nil, old = nil;TMP_11._p = null;
        if ($yield === nil) {
          return nil
        };
        old = this.case_stmt;
        this.case_stmt = $hash2([], {});
        if ($opal.$yieldX($yield, []) === $breaker) return $breaker.$v;
        return this.case_stmt = old;
      };

      def['$in_while?'] = function() {
        
        return this.scope['$in_while?']();
      };

      def.$process = function(sexp, level) {
        var $a, type = nil, meth = nil;if (level == null) {
          level = "expr"
        }
        type = sexp.$shift();
        meth = "process_" + (type);
        if (($a = this['$respond_to?'](meth)) === false || $a === nil) {
          this.$raise("Unsupported sexp: " + (type))
        };
        this.line = sexp.$line();
        return this.$__send__(meth, sexp, level);
      };

      def.$returns = function(sexp) {
        var $a, $b, TMP_12, $case = nil;
        if (($a = sexp) === false || $a === nil) {
          return this.$returns(this.$s("nil"))
        };
        return (function() { $case = sexp.$first();if ("break"['$===']($case) || "next"['$===']($case) || "redo"['$===']($case)) {
        return sexp
        }else if ("yield"['$===']($case)) {
        sexp['$[]='](0, "returnable_yield");
        return sexp;
        }else if ("scope"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }else if ("block"['$===']($case)) {
        if (sexp.$length()['$>'](1)) {
          sexp['$[]='](-1, this.$returns(sexp['$[]'](-1)))
        } else {
          sexp['$<<'](this.$returns(this.$s("nil")))
        };
        return sexp;
        }else if ("when"['$===']($case)) {
        sexp['$[]='](2, this.$returns(sexp['$[]'](2)));
        return sexp;
        }else if ("rescue"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        if (($a = ($b = sexp['$[]'](2), $b !== false && $b !== nil ? sexp['$[]'](2)['$[]'](0)['$==']("resbody") : $b)) !== false && $a !== nil) {
          if (($a = sexp['$[]'](2)['$[]'](2)) !== false && $a !== nil) {
            sexp['$[]'](2)['$[]='](2, this.$returns(sexp['$[]'](2)['$[]'](2)))
          } else {
            sexp['$[]'](2)['$[]='](2, this.$returns(this.$s("nil")))
          }
        };
        return sexp;
        }else if ("ensure"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }else if ("begin"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }else if ("while"['$===']($case)) {
        return sexp
        }else if ("return"['$===']($case)) {
        return sexp
        }else if ("xstr"['$===']($case)) {
        if (($a = /return|;/['$=~'](sexp['$[]'](1))) === false || $a === nil) {
          sexp['$[]='](1, "return " + (sexp['$[]'](1)) + ";")
        };
        return sexp;
        }else if ("dxstr"['$===']($case)) {
        if (($a = /return|;|\n/['$=~'](sexp['$[]'](1))) === false || $a === nil) {
          sexp['$[]='](1, "return " + (sexp['$[]'](1)))
        };
        return sexp;
        }else if ("if"['$===']($case)) {
        sexp['$[]='](2, this.$returns(((($a = sexp['$[]'](2)) !== false && $a !== nil) ? $a : this.$s("nil"))));
        sexp['$[]='](3, this.$returns(((($a = sexp['$[]'](3)) !== false && $a !== nil) ? $a : this.$s("nil"))));
        return sexp;
        }else {return ($a = ($b = this.$s("js_return", sexp)).$tap, $a._p = (TMP_12 = function(s) {

          var self = TMP_12._s || this;
          if (s == null) s = nil;
          
          return s['$line='](sexp.$line())
        }, TMP_12._s = this, TMP_12), $a).call($b)} }).call(this);
      };

      def['$expression?'] = function(sexp) {
        var $a;
        return ($a = $scope.STATEMENTS['$include?'](sexp.$first()), ($a === nil || $a === false));
      };

      def.$process_block = function(sexp, level) {
        var $a, TMP_13, $b, result = nil, join = nil;
        if (($a = sexp['$empty?']()) !== false && $a !== nil) {
          return this.$process(this.$s("nil"))
        };
        result = [];
        join = (function() { if (($a = this.scope['$class_scope?']()) !== false && $a !== nil) {
          return "\n\n" + (this.indent)
        } else {
          return "\n" + (this.indent)
        }; return nil; }).call(this);
        ($a = ($b = sexp).$each, $a._p = (TMP_13 = function(stmt) {

          var self = TMP_13._s || this, $a, yasgn = nil, expr = nil;
          if (stmt == null) stmt = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(join, sexp))
          };
          if (($a = yasgn = self.$find_inline_yield(stmt)) !== false && $a !== nil) {
            result['$<<'](self.$process(yasgn, level))['$<<'](self.$f(";", yasgn))
          };
          ($a = expr = self['$expression?'](stmt), $a !== false && $a !== nil ? $scope.LEVEL.$index(level)['$<']($scope.LEVEL.$index("list")) : $a);
          result['$<<'](self.$process(stmt, level));
          if (expr !== false && expr !== nil) {
            return result['$<<'](self.$f(";", stmt))
          } else {
            return nil
          };
        }, TMP_13._s = this, TMP_13), $a).call($b);
        return result;
      };

      def.$find_inline_yield = function(stmt) {
        var $a, TMP_14, $b, TMP_15, $c, found = nil, $case = nil, arglist = nil;
        found = nil;
        $case = stmt.$first();if ("js_return"['$===']($case)) {
        if (($a = found = this.$find_inline_yield(stmt['$[]'](1))) !== false && $a !== nil) {
          found = found['$[]'](2)
        }
        }else if ("array"['$===']($case)) {
        ($a = ($b = stmt['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_14 = function(el, idx) {

          var self = TMP_14._s || this;
          if (el == null) el = nil;
          if (idx == null) idx = nil;
          
          if (el.$first()['$==']("yield")) {
            found = el;
            return stmt['$[]='](idx['$+'](1), self.$s("js_tmp", "$yielded"));
          } else {
            return nil
          }
        }, TMP_14._s = this, TMP_14), $a).call($b)
        }else if ("call"['$===']($case)) {
        arglist = stmt['$[]'](3);
        ($a = ($c = arglist['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_15 = function(el, idx) {

          var self = TMP_15._s || this;
          if (el == null) el = nil;
          if (idx == null) idx = nil;
          
          if (el.$first()['$==']("yield")) {
            found = el;
            return arglist['$[]='](idx['$+'](1), self.$s("js_tmp", "$yielded"));
          } else {
            return nil
          }
        }, TMP_15._s = this, TMP_15), $a).call($c);
        };
        if (found !== false && found !== nil) {
          if (($a = this.scope['$has_temp?']("$yielded")) === false || $a === nil) {
            this.scope.$add_temp("$yielded")
          };
          return this.$s("yasgn", "$yielded", found);
        } else {
          return nil
        };
      };

      def.$process_scope = function(sexp, level) {
        var $a, stmt = nil;
        stmt = ((($a = sexp['$[]'](0)) !== false && $a !== nil) ? $a : this.$s("nil"));
        if (($a = this.scope['$class_scope?']()) === false || $a === nil) {
          stmt = this.$returns(stmt)
        };
        return this.$process(stmt, "stmt");
      };

      def.$process_js_return = function(sexp, level) {
        
        return [this.$f("return ", sexp), this.$process(sexp['$[]'](0))];
      };

      def.$process_js_tmp = function(sexp, level) {
        
        return this.$f(sexp['$[]'](0).$to_s(), sexp);
      };

      def.$js_block_given = function(sexp, level) {
        var $a, $b, scope = nil;
        this.scope['$uses_block!']();
        if (($a = this.scope.$block_name()) !== false && $a !== nil) {
          return this.$f("(" + (this.scope.$block_name()) + " !== nil)", sexp)
        } else {
          if (($a = ($b = scope = this.scope.$find_parent_def(), $b !== false && $b !== nil ? scope.$block_name() : $b)) !== false && $a !== nil) {
            return this.$f("(" + (scope.$block_name()) + " !== nil)", sexp)
          } else {
            return this.$f("false", sexp)
          }
        };
      };

      def.$handle_block_given = function(sexp, reverse) {
        var name = nil;if (reverse == null) {
          reverse = false
        }
        this.scope['$uses_block!']();
        name = this.scope.$block_name();
        return this.$f((function() { if (reverse !== false && reverse !== nil) {
          return "" + (name) + " === nil"
        } else {
          return "" + (name) + " !== nil"
        }; return nil; }).call(this), sexp);
      };

      def.$process_sym = function(sexp, level) {
        
        return this.$f(sexp['$[]'](0).$to_s().$inspect(), sexp);
      };

      def.$process_int = function(sexp, level) {
        
        return this.$f((function() { if (level['$==']("recv")) {
          return "(" + (sexp['$[]'](0)) + ")"
        } else {
          return sexp['$[]'](0).$to_s()
        }; return nil; }).call(this), sexp);
      };

      Parser.$alias_method("process_float", "process_int");

      def.$process_regexp = function(sexp, level) {
        var val = nil;
        val = sexp['$[]'](0);
        return this.$f((function() { if (val['$=='](/^/)) {
          return /^/.$inspect()
        } else {
          return val.$inspect()
        }; return nil; }).call(this), sexp);
      };

      def.$process_dregx = function(sexp, level) {
        var TMP_16, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_16 = function(part) {

          var self = TMP_16._s || this, $a;
          if (part == null) part = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(" + ", sexp))
          };
          if (($a = $scope.String['$==='](part)) !== false && $a !== nil) {
            return result['$<<'](self.$f(part.$inspect(), sexp))
          } else {
            if (part['$[]'](0)['$==']("str")) {
              return result['$<<'](self.$process(part))
            } else {
              return result['$<<'](self.$process(part['$[]'](1)))
            }
          };
        }, TMP_16._s = this, TMP_16), $a).call($b);
        return [this.$f("(new RegExp(", sexp), result, this.$f("))", sexp)];
      };

      def.$process_dot2 = function(sexp, level) {
        
        this.helpers['$[]=']("range", true);
        return [this.$f("$range(", sexp), this.$process(sexp['$[]'](0)), this.$f(", ", sexp), this.$process(sexp['$[]'](1)), this.$f(", false)", sexp)];
      };

      def.$process_dot3 = function(sexp, level) {
        
        this.helpers['$[]=']("range", true);
        return [this.$f("$range(", sexp), this.$process(sexp['$[]'](0)), this.$f(", ", sexp), this.$process(sexp['$[]'](1)), this.$f(", true)", sexp)];
      };

      def.$process_str = function(sexp, level) {
        
        return this.$f(sexp['$[]'](0).$inspect(), sexp);
      };

      def.$process_defined = function(sexp, level) {
        var $a, TMP_17, $b, part = nil, $case = nil, mid = nil, recv = nil, ivar_name = nil;
        part = sexp['$[]'](0);
        return (function() { $case = part['$[]'](0);if ("self"['$===']($case)) {
        return this.$f("'self'", sexp)
        }else if ("nil"['$===']($case)) {
        return this.$f("'nil'", sexp)
        }else if ("true"['$===']($case)) {
        return this.$f("'true'", sexp)
        }else if ("false"['$===']($case)) {
        return this.$f("'false'", sexp)
        }else if ("call"['$===']($case)) {
        mid = this.$mid_to_jsid(part['$[]'](2).$to_s());
        recv = (function() { if (($a = part['$[]'](1)) !== false && $a !== nil) {
          return this.$process(part['$[]'](1))
        } else {
          return this.$f(this.$current_self(), sexp)
        }; return nil; }).call(this);
        return [this.$f("(", sexp), recv, this.$f("" + (mid) + " ? 'method' : nil)", sexp)];
        }else if ("xstr"['$===']($case) || "dxstr"['$===']($case)) {
        return [this.$f("(typeof(", sexp), this.$process(part), this.$f(") !== 'undefined')", sexp)]
        }else if ("const"['$===']($case)) {
        return this.$f("($scope." + (part['$[]'](1).$to_s()) + " != null)", sexp)
        }else if ("cvar"['$===']($case)) {
        return this.$f("($opal.cvars[" + (part['$[]'](1).$to_s().$inspect()) + "] != null ? 'class-variable' : nil)", sexp)
        }else if ("colon2"['$===']($case)) {
        return this.$f("false", sexp)
        }else if ("colon3"['$===']($case)) {
        return this.$f("($opal.Object._scope." + (sexp['$[]'](0)['$[]'](1)) + " == null ? nil : 'constant')", sexp)
        }else if ("ivar"['$===']($case)) {
        ivar_name = part['$[]'](1).$to_s()['$[]']($range(1, -1, false));
        return ($a = ($b = this).$with_temp, $a._p = (TMP_17 = function(t) {

          var self = TMP_17._s || this;
          if (t == null) t = nil;
          
          return self.$f("((" + (t) + " = " + (self.$current_self()) + "[" + (ivar_name.$inspect()) + "], " + (t) + " != null && " + (t) + " !== nil) ? 'instance-variable' : nil)", sexp)
        }, TMP_17._s = this, TMP_17), $a).call($b);
        }else if ("lvar"['$===']($case)) {
        return this.$f("local-variable", sexp)
        }else {return this.$raise("bad defined? part: " + (part['$[]'](0)))} }).call(this);
      };

      def.$process_not = function(sexp, level) {
        var TMP_18, $a, $b;
        return ($a = ($b = this).$with_temp, $a._p = (TMP_18 = function(tmp) {

          var self = TMP_18._s || this, expr = nil;
          if (tmp == null) tmp = nil;
          
          expr = sexp['$[]'](0);
          return [self.$f("(" + (tmp) + " = ", sexp), self.$process(expr), self.$f(", (" + (tmp) + " === nil || " + (tmp) + " === false))", sexp)];
        }, TMP_18._s = this, TMP_18), $a).call($b);
      };

      def.$process_block_pass = function(exp, level) {
        
        return this.$process(this.$s("call", exp['$[]'](0), "to_proc", this.$s("arglist")));
      };

      def.$process_iter = function(sexp, level) {
        var $a, $b, TMP_19, call = nil, args = nil, body = nil, code = nil, params = nil, scope_name = nil, identity = nil, to_vars = nil, opt_args = nil, block_arg = nil, splat = nil, len = nil, itercode = nil;
        $a = $opal.to_ary(sexp), call = ($a[0] == null ? nil : $a[0]), args = ($a[1] == null ? nil : $a[1]), body = ($a[2] == null ? nil : $a[2]);
        ((($a = body) !== false && $a !== nil) ? $a : body = this.$s("nil"));
        body = this.$returns(body);
        code = [];
        params = nil;
        scope_name = nil;
        identity = nil;
        to_vars = nil;
        if (($a = $scope.Fixnum['$==='](args)) !== false && $a !== nil) {
          args = nil
        };
        ((($a = args) !== false && $a !== nil) ? $a : args = this.$s("masgn", this.$s("array")));
        args = (function() { if (args.$first()['$==']("lasgn")) {
          return this.$s("array", args)
        } else {
          return args['$[]'](1)
        }; return nil; }).call(this);
        if (($a = ($b = args.$last()['$is_a?']($scope.Array), $b !== false && $b !== nil ? args.$last()['$[]'](0)['$==']("block") : $b)) !== false && $a !== nil) {
          opt_args = args.$pop();
          opt_args.$shift();
        };
        if (($a = ($b = args.$last()['$is_a?']($scope.Array), $b !== false && $b !== nil ? args.$last()['$[]'](0)['$==']("block_pass") : $b)) !== false && $a !== nil) {
          block_arg = args.$pop();
          block_arg = block_arg['$[]'](1)['$[]'](1).$to_sym();
        };
        if (($a = ($b = args.$last()['$is_a?']($scope.Array), $b !== false && $b !== nil ? args.$last()['$[]'](0)['$==']("splat") : $b)) !== false && $a !== nil) {
          splat = args.$last()['$[]'](1)['$[]'](1);
          args.$pop();
          len = args.$length();
        };
        ($a = ($b = this).$indent, $a._p = (TMP_19 = function() {

          var self = TMP_19._s || this, TMP_20, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_20 = function() {

            var self = TMP_20._s || this, TMP_21, $a, $b, blk = nil;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;

            
            identity = self.scope['$identify!']();
            self.scope.$add_temp("" + (self.$current_self()) + " = " + (identity) + "._s || this");
            params = self.$js_block_args(args['$[]']($range(1, -1, false)));
            ($a = ($b = args['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_21 = function(arg, idx) {

              var self = TMP_21._s || this, $a, $b, TMP_22, $c, $d, TMP_23, current_opt = nil;
              if (self.indent == null) self.indent = nil;

              if (arg == null) arg = nil;
              if (idx == null) idx = nil;
              
              if (arg['$[]'](0)['$==']("lasgn")) {
                arg = arg['$[]'](1);
                if (($a = $scope.RESERVED['$include?'](arg.$to_s())) !== false && $a !== nil) {
                  arg = "" + (arg) + "$"
                };
                if (($a = (($b = opt_args !== false && opt_args !== nil) ? current_opt = ($c = ($d = opt_args).$find, $c._p = (TMP_22 = function(s) {

                  var self = TMP_22._s || this;
                  if (s == null) s = nil;
                  
                  return s['$[]'](1)['$=='](arg.$to_sym())
                }, TMP_22._s = self, TMP_22), $c).call($d) : $b)) !== false && $a !== nil) {
                  return code['$<<']([self.$f("if (" + (arg) + " == null) " + (arg) + " = ", sexp), self.$process(current_opt['$[]'](2)), self.$f(";\n" + (self.indent), sexp)])
                } else {
                  return code['$<<'](self.$f("if (" + (arg) + " == null) " + (arg) + " = nil;\n" + (self.indent), sexp))
                };
              } else {
                if (arg['$[]'](0)['$==']("array")) {
                  return ($a = ($b = arg['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_23 = function(arg, midx) {

                    var self = TMP_23._s || this, $a;
                    if (self.indent == null) self.indent = nil;

                    if (arg == null) arg = nil;
                    if (midx == null) midx = nil;
                    
                    arg = arg['$[]'](1);
                    if (($a = $scope.RESERVED['$include?'](arg.$to_s())) !== false && $a !== nil) {
                      arg = "" + (arg) + "$"
                    };
                    return code['$<<'](self.$f("" + (arg) + " = " + (params['$[]'](idx)) + "[" + (midx) + "];\n" + (self.indent)));
                  }, TMP_23._s = self, TMP_23), $a).call($b)
                } else {
                  return self.$raise("Bad block_arg type: " + (arg['$[]'](0)))
                }
              }
            }, TMP_21._s = self, TMP_21), $a).call($b);
            if (splat !== false && splat !== nil) {
              self.scope.$add_arg(splat);
              params['$<<'](splat);
              code['$<<'](self.$f("" + (splat) + " = $slice.call(arguments, " + (len['$-'](1)) + ");", sexp));
            };
            if (block_arg !== false && block_arg !== nil) {
              self.scope['$block_name='](block_arg);
              self.scope.$add_temp(block_arg);
              scope_name = self.scope['$identify!']();
              blk = [];
              blk['$<<'](self.$f("\n" + (self.indent) + (block_arg) + " = " + (scope_name) + "._p || nil, " + (scope_name) + "._p = null;\n" + (self.indent), sexp));
              code.$unshift(blk);
            };
            code['$<<'](self.$f("\n" + (self.indent), sexp));
            code['$<<'](self.$process(body, "stmt"));
            if (($a = self.scope.$defines_defn()) !== false && $a !== nil) {
              self.scope.$add_temp("def = ((" + (self.$current_self()) + "._isClass) ? " + (self.$current_self()) + "._proto : " + (self.$current_self()) + ")")
            };
            return to_vars = [self.$f("\n" + (self.indent), sexp), self.scope.$to_vars(), self.$f("\n" + (self.indent), sexp)];
          }, TMP_20._s = self, TMP_20), $a).call($b, "iter")
        }, TMP_19._s = this, TMP_19), $a).call($b);
        itercode = [this.$f("function(" + (params.$join(", ")) + ") {\n", sexp), to_vars, code, this.$f("\n" + (this.indent) + "}", sexp)];
        itercode.$unshift(this.$f("(" + (identity) + " = ", sexp));
        itercode['$<<'](this.$f(", " + (identity) + "._s = " + (this.$current_self()) + ", " + (identity) + ")", sexp));
        call['$<<'](itercode);
        return this.$process(call, level);
      };

      def.$js_block_args = function(sexp) {
        var TMP_24, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_24 = function(arg) {

          var self = TMP_24._s || this, ref = nil;
          if (self.scope == null) self.scope = nil;

          if (arg == null) arg = nil;
          
          if (arg['$[]'](0)['$==']("lasgn")) {
            ref = self.$lvar_to_js(arg['$[]'](1));
            self.scope.$add_arg(ref);
            return result['$<<'](ref);
          } else {
            if (arg['$[]'](0)['$==']("array")) {
              return result['$<<'](self.scope.$next_temp())
            } else {
              return self.$raise("Bad js_block_arg: " + (arg['$[]'](0)))
            }
          }
        }, TMP_24._s = this, TMP_24), $a).call($b);
        return result;
      };

      def.$process_attrasgn = function(exp, level) {
        var $a, recv = nil, mid = nil, arglist = nil;
        $a = $opal.to_ary(exp), recv = ($a[0] == null ? nil : $a[0]), mid = ($a[1] == null ? nil : $a[1]), arglist = ($a[2] == null ? nil : $a[2]);
        return this.$process(this.$s("call", recv, mid, arglist), level);
      };

      def.$process_call = function(sexp, level) {
        var $a, $b, TMP_25, TMP_26, $c, $d, $e, recv = nil, meth = nil, arglist = nil, iter = nil, mid = nil, $case = nil, splat = nil, block = nil, tmpfunc = nil, tmprecv = nil, args = nil, recv_code = nil, call_recv = nil, dispatch = nil, result = nil;
        $a = $opal.to_ary(sexp), recv = ($a[0] == null ? nil : $a[0]), meth = ($a[1] == null ? nil : $a[1]), arglist = ($a[2] == null ? nil : $a[2]), iter = ($a[3] == null ? nil : $a[3]);
        mid = this.$mid_to_jsid(meth.$to_s());
        this.method_calls['$[]='](meth.$to_sym(), true);
        if (($a = ($b = ($b = ($b = ($b = this.irb_vars, $b !== false && $b !== nil ? this.scope['$top?']() : $b), $b !== false && $b !== nil ? arglist['$=='](this.$s("arglist")) : $b), $b !== false && $b !== nil ? recv['$=='](nil) : $b), $b !== false && $b !== nil ? iter['$=='](nil) : $b)) !== false && $a !== nil) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_25 = function(t) {

            var self = TMP_25._s || this, $a, lvar = nil, call = nil;
            if (t == null) t = nil;
            
            lvar = meth.$intern();
            if (($a = $scope.RESERVED['$include?'](lvar)) !== false && $a !== nil) {
              lvar = "" + (lvar) + "$"
            };
            call = self.$s("call", self.$s("self"), meth.$intern(), self.$s("arglist"));
            return [self.$f("((" + (t) + " = $opal.irb_vars." + (lvar) + ") == null ? ", sexp), self.$process(call), self.$f(" : " + (t) + ")", sexp)];
          }, TMP_25._s = this, TMP_25), $a).call($b)
        };
        $case = meth;if ("block_given?"['$===']($case)) {
        return this.$js_block_given(sexp, level)
        };
        splat = ($a = ($c = arglist['$[]']($range(1, -1, false)))['$any?'], $a._p = (TMP_26 = function(a) {

          var self = TMP_26._s || this;
          if (a == null) a = nil;
          
          return a.$first()['$==']("splat")
        }, TMP_26._s = this, TMP_26), $a).call($c);
        if (($a = ($d = $scope.Array['$==='](arglist.$last()), $d !== false && $d !== nil ? arglist.$last().$first()['$==']("block_pass") : $d)) !== false && $a !== nil) {
          block = this.$process(arglist.$pop())
        } else {
          if (iter !== false && iter !== nil) {
            block = iter
          }
        };
        ((($a = recv) !== false && $a !== nil) ? $a : recv = this.$s("self"));
        if (block !== false && block !== nil) {
          tmpfunc = this.scope.$new_temp()
        };
        if (($a = ((($d = splat) !== false && $d !== nil) ? $d : tmpfunc)) !== false && $a !== nil) {
          tmprecv = this.scope.$new_temp()
        };
        args = "";
        recv_code = this.$process(recv, "recv");
        call_recv = this.$s("js_tmp", ((($a = tmprecv) !== false && $a !== nil) ? $a : recv_code));
        if (($a = (($d = tmpfunc !== false && tmpfunc !== nil) ? ($e = splat, ($e === nil || $e === false)) : $d)) !== false && $a !== nil) {
          arglist.$insert(1, call_recv)
        };
        args = this.$process(arglist);
        dispatch = (function() { if (tmprecv !== false && tmprecv !== nil) {
          return [this.$f("(" + (tmprecv) + " = "), recv_code, this.$f(")" + (mid))]
        } else {
          return [recv_code, this.$f(mid)]
        }; return nil; }).call(this);
        if (tmpfunc !== false && tmpfunc !== nil) {
          dispatch.$unshift(this.$f("(" + (tmpfunc) + " = "));
          dispatch['$<<'](this.$f(", " + (tmpfunc) + "._p = "));
          dispatch['$<<'](block);
          dispatch['$<<'](this.$f(", " + (tmpfunc) + ")"));
        };
        result = (function() { if (splat !== false && splat !== nil) {
          return [dispatch, this.$f(".apply("), (function() { if (tmprecv !== false && tmprecv !== nil) {
            return this.$f(tmprecv)
          } else {
            return recv_code
          }; return nil; }).call(this), this.$f(", "), args, this.$f(")")]
        } else {
          if (tmpfunc !== false && tmpfunc !== nil) {
            return [dispatch, this.$f(".call("), args, this.$f(")")]
          } else {
            return [dispatch, this.$f("("), args, this.$f(")")]
          }
        }; return nil; }).call(this);
        if (tmpfunc !== false && tmpfunc !== nil) {
          this.scope.$queue_temp(tmpfunc)
        };
        return result;
      };

      def.$process_arglist = function(sexp, level) {
        var $a, TMP_27, $b, code = nil, work = nil, join = nil;
        $a = [[], []], code = $a[0], work = $a[1];
        ($a = ($b = sexp).$each, $a._p = (TMP_27 = function(current) {

          var self = TMP_27._s || this, $a, splat = nil, arg = nil;
          if (current == null) current = nil;
          
          splat = current.$first()['$==']("splat");
          arg = self.$process(current);
          if (splat !== false && splat !== nil) {
            if (($a = work['$empty?']()) !== false && $a !== nil) {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<'](self.$f("[].concat(", sexp));
                code['$<<'](arg);
                code['$<<'](self.$f(")"));
              } else {
                code = code['$+'](".concat(" + (arg) + ")")
              }
            } else {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<']([self.$f("["), work, self.$f("]")])
              } else {
                code['$<<']([self.$f(".concat(["), work, self.$f("])")])
              };
              code['$<<']([self.$f(".concat("), arg, self.$f(")")]);
            };
            return work = [];
          } else {
            if (($a = work['$empty?']()) === false || $a === nil) {
              work['$<<'](self.$f(", "))
            };
            return work['$<<'](arg);
          };
        }, TMP_27._s = this, TMP_27), $a).call($b);
        if (($a = work['$empty?']()) === false || $a === nil) {
          join = work;
          if (($a = code['$empty?']()) !== false && $a !== nil) {
            code = join
          } else {
            code['$<<'](this.$f(".concat("))['$<<'](join)['$<<'](this.$f(")"))
          };
        };
        return code;
      };

      def.$process_splat = function(sexp, level) {
        
        if (sexp.$first()['$=='](["nil"])) {
          return [this.$f("[]")]
        } else {
          if (sexp.$first().$first()['$==']("sym")) {
            return [this.$f("["), this.$process(sexp['$[]'](0)), this.$f("]")]
          } else {
            return this.$process(sexp.$first(), "recv")
          }
        };
      };

      def.$process_class = function(sexp, level) {
        var $a, $b, TMP_28, cid = nil, sup = nil, body = nil, code = nil, base = nil, name = nil, spacer = nil, cls = nil, boot = nil;
        $a = $opal.to_ary(sexp), cid = ($a[0] == null ? nil : $a[0]), sup = ($a[1] == null ? nil : $a[1]), body = ($a[2] == null ? nil : $a[2]);
        if (($a = body['$[]'](1)) === false || $a === nil) {
          body['$[]='](1, this.$s("nil"))
        };
        code = [];
        this.helpers['$[]=']("klass", true);
        if (($a = ((($b = $scope.Symbol['$==='](cid)) !== false && $b !== nil) ? $b : $scope.String['$==='](cid))) !== false && $a !== nil) {
          base = this.$process(this.$s("self"));
          name = cid.$to_s();
        } else {
          if (cid['$[]'](0)['$==']("colon2")) {
            base = this.$process(cid['$[]'](1));
            name = cid['$[]'](2).$to_s();
          } else {
            if (cid['$[]'](0)['$==']("colon3")) {
              base = this.$process(this.$s("js_tmp", "$opal.Object"));
              name = cid['$[]'](1).$to_s();
            } else {
              this.$raise("Bad receiver in class")
            }
          }
        };
        sup = (function() { if (sup !== false && sup !== nil) {
          return this.$process(sup)
        } else {
          return this.$process(this.$s("js_tmp", "null"))
        }; return nil; }).call(this);
        ($a = ($b = this).$indent, $a._p = (TMP_28 = function() {

          var self = TMP_28._s || this, TMP_29, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_29 = function() {

            var self = TMP_29._s || this, $a, $b, needs_block = nil, last_body_statement = nil;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;

            
            self.scope['$name='](name);
            self.scope.$add_temp("" + (self.scope.$proto()) + " = " + (name) + "._proto", "$scope = " + (name) + "._scope");
            if (($a = $scope.Array['$==='](body.$last())) !== false && $a !== nil) {
              needs_block = ($a = body.$last().$first()['$==']("block"), ($a === nil || $a === false));
              body.$last().$first()['$==']("block");
              last_body_statement = (function() { if (needs_block !== false && needs_block !== nil) {
                return body.$last()
              } else {
                return body.$last().$last()
              }; return nil; }).call(self);
              if (($a = (($b = last_body_statement !== false && last_body_statement !== nil) ? $scope.Array['$==='](last_body_statement) : $b)) !== false && $a !== nil) {
                if (($a = ["defn", "defs"]['$include?'](last_body_statement.$first())) !== false && $a !== nil) {
                  if (needs_block !== false && needs_block !== nil) {
                    body['$[]='](-1, self.$s("block", body['$[]'](-1)))
                  };
                  body.$last()['$<<'](self.$s("nil"));
                }
              };
            };
            body = self.$process(self.$returns(body), "stmt");
            code['$<<'](self.$f("\n"));
            code['$<<'](self.scope.$to_donate_methods());
            code['$<<'](self.$f(self.indent));
            code['$<<'](self.scope.$to_vars());
            code['$<<'](self.$f("\n\n" + (self.indent)));
            return code['$<<'](body);
          }, TMP_29._s = self, TMP_29), $a).call($b, "class")
        }, TMP_28._s = this, TMP_28), $a).call($b);
        spacer = "\n" + (this.indent) + ($scope.INDENT);
        cls = "function " + (name) + "() {};";
        boot = "" + (name) + " = $klass($base, $super, " + (name.$inspect()) + ", " + (name) + ");";
        return [this.$f("(function($base, $super){" + (spacer) + (cls) + (spacer) + (boot) + "\n", sexp), code, this.$f("\n" + (this.indent) + "})", sexp), this.$f("(", sexp), base, this.$f(", ", sexp), sup, this.$f(")", sexp)];
      };

      def.$process_sclass = function(sexp, level) {
        var $a, TMP_30, $b, recv = nil, body = nil, code = nil;
        $a = [sexp['$[]'](0), sexp['$[]'](1), []], recv = $a[0], body = $a[1], code = $a[2];
        ($a = ($b = this).$in_scope, $a._p = (TMP_30 = function() {

          var self = TMP_30._s || this;
          if (self.scope == null) self.scope = nil;

          
          self.scope.$add_temp("$scope = " + (self.$current_self()) + "._scope");
          self.scope.$add_temp("def = " + (self.$current_self()) + "._proto");
          return code['$<<'](self.scope.$to_vars())['$<<'](self.$process(body, "stmt"));
        }, TMP_30._s = this, TMP_30), $a).call($b, "sclass");
        return [this.$f("(function(){"), code, this.$f("}).call("), this.$process(recv, "recv"), this.$f(".$singleton_class())")];
      };

      def.$process_module = function(sexp, level) {
        var $a, $b, TMP_31, cid = nil, body = nil, code = nil, base = nil, name = nil, spacer = nil, cls = nil, boot = nil;
        $a = $opal.to_ary(sexp), cid = ($a[0] == null ? nil : $a[0]), body = ($a[1] == null ? nil : $a[1]);
        code = [];
        this.helpers['$[]=']("module", true);
        if (($a = ((($b = $scope.Symbol['$==='](cid)) !== false && $b !== nil) ? $b : $scope.String['$==='](cid))) !== false && $a !== nil) {
          base = this.$process(this.$s("self"));
          name = cid.$to_s();
        } else {
          if (cid['$[]'](0)['$==']("colon2")) {
            base = this.$process(cid['$[]'](1));
            name = cid['$[]'](2).$to_s();
          } else {
            if (cid['$[]'](0)['$==']("colon3")) {
              base = this.$f("$opal.Object", sexp);
              name = cid['$[]'](1).$to_s();
            } else {
              this.$raise("Bad receiver in class")
            }
          }
        };
        ($a = ($b = this).$indent, $a._p = (TMP_31 = function() {

          var self = TMP_31._s || this, TMP_32, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_32 = function() {

            var self = TMP_32._s || this;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;
            if (self.ident == null) self.ident = nil;

            
            self.scope['$name='](name);
            self.scope.$add_temp("" + (self.scope.$proto()) + " = " + (name) + "._proto", "$scope = " + (name) + "._scope");
            body = self.$process(body, "stmt");
            code['$<<'](self.$f(self.indent));
            code['$<<'](self.scope.$to_vars());
            code['$<<'](self.$f("\n\n" + (self.indent)));
            code['$<<'](body);
            code['$<<'](self.$f("\n" + (self.ident)));
            return code['$<<'](self.scope.$to_donate_methods());
          }, TMP_32._s = self, TMP_32), $a).call($b, "module")
        }, TMP_31._s = this, TMP_31), $a).call($b);
        spacer = "\n" + (this.indent) + ($scope.INDENT);
        cls = "function " + (name) + "() {};";
        boot = "" + (name) + " = $module($base, " + (name.$inspect()) + ", " + (name) + ");";
        code.$unshift(this.$f("(function($base){" + (spacer) + (cls) + (spacer) + (boot) + "\n", sexp));
        code['$<<'](this.$f("\n" + (this.indent) + "})("));
        code['$<<'](base);
        code['$<<'](this.$f(")"));
        return code;
      };

      def.$process_undef = function(sexp, level) {
        
        return this.$f("delete " + (this.scope.$proto()) + (this.$mid_to_jsid(sexp['$[]'](0)['$[]'](1).$to_s())), sexp);
      };

      def.$process_defn = function(sexp, level) {
        var $a, mid = nil, args = nil, stmts = nil;
        $a = $opal.to_ary(sexp), mid = ($a[0] == null ? nil : $a[0]), args = ($a[1] == null ? nil : $a[1]), stmts = ($a[2] == null ? nil : $a[2]);
        return this.$js_def(nil, mid, args, stmts, sexp.$line(), sexp.$end_line(), sexp);
      };

      def.$process_defs = function(sexp, level) {
        var $a, recv = nil, mid = nil, args = nil, stmts = nil;
        $a = $opal.to_ary(sexp), recv = ($a[0] == null ? nil : $a[0]), mid = ($a[1] == null ? nil : $a[1]), args = ($a[2] == null ? nil : $a[2]), stmts = ($a[3] == null ? nil : $a[3]);
        return this.$js_def(recv, mid, args, stmts, sexp.$line(), sexp.$end_line(), sexp);
      };

      def.$js_def = function(recvr, mid, args, stmts, line, end_line, sexp) {
        var $a, $b, TMP_33, $c, $d, $e, jsid = nil, smethod = nil, recv = nil, code = nil, params = nil, scope_name = nil, uses_super = nil, uses_splat = nil, opt = nil, argc = nil, block_name = nil, splat = nil, arity_code = nil, result = nil;
        jsid = this.$mid_to_jsid(mid.$to_s());
        if (recvr !== false && recvr !== nil) {
          this.scope['$defines_defs='](true);
          if (($a = ($b = this.scope['$class_scope?'](), $b !== false && $b !== nil ? recvr.$first()['$==']("self") : $b)) !== false && $a !== nil) {
            smethod = true
          };
          recv = this.$process(recvr);
        } else {
          this.scope['$defines_defn='](true);
          recv = this.$current_self();
        };
        code = [];
        params = nil;
        scope_name = nil;
        uses_super = nil;
        uses_splat = nil;
        if (($a = $scope.Array['$==='](args.$last())) !== false && $a !== nil) {
          opt = args.$pop()
        };
        argc = args.$length()['$-'](1);
        if (($a = args.$last().$to_s()['$start_with?']("&")) !== false && $a !== nil) {
          block_name = args.$pop().$to_s()['$[]']($range(1, -1, false)).$to_sym();
          argc = argc['$-'](1);
        };
        if (($a = args.$last().$to_s()['$start_with?']("*")) !== false && $a !== nil) {
          uses_splat = true;
          if (args.$last()['$==']("*")) {
            argc = argc['$-'](1)
          } else {
            splat = args['$[]'](-1).$to_s()['$[]']($range(1, -1, false)).$to_sym();
            args['$[]='](-1, splat);
            argc = argc['$-'](1);
          };
        };
        if (($a = this.arity_check) !== false && $a !== nil) {
          arity_code = this.$arity_check(args, opt, uses_splat, block_name, mid)['$+']("\n" + ($scope.INDENT))
        };
        ($a = ($b = this).$indent, $a._p = (TMP_33 = function() {

          var self = TMP_33._s || this, TMP_34, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_34 = function() {

            var self = TMP_34._s || this, $a, TMP_35, $b, $c, yielder = nil, stmt_code = nil;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;

            
            self.scope['$mid='](mid);
            if (recvr !== false && recvr !== nil) {
              self.scope['$defs='](true)
            };
            if (block_name !== false && block_name !== nil) {
              self.scope['$uses_block!']();
              self.scope.$add_arg(block_name);
            };
            yielder = ((($a = block_name) !== false && $a !== nil) ? $a : "$yield");
            self.scope['$block_name='](yielder);
            params = self.$process(args);
            stmt_code = [self.$f("\n" + (self.indent)), self.$process(stmts, "stmt")];
            if (opt !== false && opt !== nil) {
              ($a = ($b = opt['$[]']($range(1, -1, false))).$each, $a._p = (TMP_35 = function(o) {

                var self = TMP_35._s || this;
                if (self.indent == null) self.indent = nil;

                if (o == null) o = nil;
                
                if (o['$[]'](2)['$[]'](2)['$==']("undefined")) {
                  return nil;
                };
                code['$<<'](self.$f("if (" + (self.$lvar_to_js(o['$[]'](1))) + " == null) {\n" + (self.indent['$+']($scope.INDENT)), o));
                code['$<<'](self.$process(o));
                return code['$<<'](self.$f("\n" + (self.indent) + "}", o));
              }, TMP_35._s = self, TMP_35), $a).call($b)
            };
            if (splat !== false && splat !== nil) {
              code['$<<'](self.$f("" + (splat) + " = $slice.call(arguments, " + (argc) + ");", sexp))
            };
            scope_name = self.scope.$identity();
            if (($a = self.scope['$uses_block?']()) !== false && $a !== nil) {
              self.scope.$add_temp("$iter = " + (scope_name) + "._p");
              self.scope.$add_temp("" + (yielder) + " = $iter || nil");
              code.$unshift(self.$f("" + (scope_name) + "._p = null;", sexp));
            };
            ($a = code).$push.apply($a, [].concat(stmt_code));
            uses_super = self.scope.$uses_super();
            code = [self.$f("" + (arity_code) + (self.indent), sexp), self.scope.$to_vars(), code];
            if (($c = self.scope.$uses_zuper()) !== false && $c !== nil) {
              code.$unshift(self.$f("var $zuper = $slice.call(arguments, 0);", sexp))
            };
            if (($c = self.scope.$catch_return()) !== false && $c !== nil) {
              code.$unshift(self.$f("try {\n", sexp));
              return code.$push(self.$f("\n} catch($returner) { if ($returner === $opal.returner) { return $returner.$v; } throw $returner; }", sexp));
            } else {
              return nil
            };
          }, TMP_34._s = self, TMP_34), $a).call($b, "def")
        }, TMP_33._s = this, TMP_33), $a).call($b);
        result = [this.$f("" + ((function() { if (scope_name !== false && scope_name !== nil) {
          return "" + (scope_name) + " = "
        } else {
          return nil
        }; return nil; }).call(this)) + "function(", sexp)];
        ($a = result).$push.apply($a, [].concat(params));
        result['$<<'](this.$f(") {\n", sexp));
        ($c = result).$push.apply($c, [].concat(code));
        result['$<<'](this.$f("\n" + (this.indent) + "}", sexp));
        if (recvr !== false && recvr !== nil) {
          if (smethod !== false && smethod !== nil) {
            return [this.$f("" + (this.scope.$name()) + ".constructor.prototype['$" + (mid) + "'] = ", sexp), result]
          } else {
            return [recv, this.$f("" + (jsid) + " = ", sexp), result]
          }
        } else {
          if (($d = ($e = this.scope['$class?'](), $e !== false && $e !== nil ? this.scope.$name()['$==']("Object") : $e)) !== false && $d !== nil) {
            return [this.$f("" + (this.$current_self()) + "._defn('$" + (mid) + "', ", sexp), result, this.$f(")", sexp)]
          } else {
            if (($d = this.scope['$class_scope?']()) !== false && $d !== nil) {
              this.scope.$methods()['$<<']("$" + (mid));
              if (uses_super !== false && uses_super !== nil) {
                this.scope.$add_temp(uses_super);
                uses_super = "" + (uses_super) + " = " + (this.scope.$proto()) + (jsid) + ";\n" + (this.indent);
              };
              return [this.$f("" + (uses_super) + (this.scope.$proto()) + (jsid) + " = ", sexp), result];
            } else {
              return [this.$f("def" + (jsid) + " = ", sexp), result]
            }
          }
        };
      };

      def.$arity_check = function(args, opt, splat, block_name, mid) {
        var $a, $b, meth = nil, arity = nil, aritycode = nil;
        meth = mid.$to_s().$inspect();
        arity = args.$size()['$-'](1);
        if (opt !== false && opt !== nil) {
          arity = arity['$-'](opt.$size()['$-'](1))
        };
        if (splat !== false && splat !== nil) {
          arity = arity['$-'](1)
        };
        if (($a = ((($b = opt) !== false && $b !== nil) ? $b : splat)) !== false && $a !== nil) {
          arity = arity['$-@']()['$-'](1)
        };
        aritycode = "var $arity = arguments.length;";
        if (arity['$<'](0)) {
          return aritycode['$+']("if ($arity < " + (arity['$+'](1)['$-@']()) + ") { $opal.ac($arity, " + (arity) + ", this, " + (meth) + "); }")
        } else {
          return aritycode['$+']("if ($arity !== " + (arity) + ") { $opal.ac($arity, " + (arity) + ", this, " + (meth) + "); }")
        };
      };

      def.$process_args = function(exp, level) {
        var TMP_36, $a, $b, args = nil;
        args = [];
        ($a = ($b = exp).$each, $a._p = (TMP_36 = function(a) {

          var self = TMP_36._s || this;
          if (self.scope == null) self.scope = nil;

          if (a == null) a = nil;
          
          a = a.$to_sym();
          if (a.$to_s()['$==']("*")) {
            return nil;
          };
          a = self.$lvar_to_js(a);
          self.scope.$add_arg(a);
          return args['$<<'](a);
        }, TMP_36._s = this, TMP_36), $a).call($b);
        return this.$f(args.$join(", "), exp);
      };

      def.$process_self = function(sexp, level) {
        
        return this.$f(this.$current_self(), sexp);
      };

      def.$current_self = function() {
        var $a, $b;
        if (($a = this.scope['$class_scope?']()) !== false && $a !== nil) {
          return this.scope.$name()
        } else {
          if (($a = ((($b = this.scope['$top?']()) !== false && $b !== nil) ? $b : this.scope['$iter?']())) !== false && $a !== nil) {
            return "self"
          } else {
            return "this"
          }
        };
      };

      def.$process_true = function(sexp, level) {
        
        return this.$f("true", sexp);
      };

      def.$process_false = function(sexp, level) {
        
        return this.$f("false", sexp);
      };

      def.$process_nil = function(sexp, level) {
        
        return this.$f("nil", sexp);
      };

      def.$process_array = function(sexp, level) {
        var $a, TMP_37, $b, code = nil, work = nil, join = nil;
        if (($a = sexp['$empty?']()) !== false && $a !== nil) {
          return [this.$f("[]", sexp)]
        };
        $a = [[], []], code = $a[0], work = $a[1];
        ($a = ($b = sexp).$each, $a._p = (TMP_37 = function(current) {

          var self = TMP_37._s || this, $a, splat = nil, part = nil;
          if (current == null) current = nil;
          
          splat = current.$first()['$==']("splat");
          part = self.$process(current);
          if (splat !== false && splat !== nil) {
            if (($a = work['$empty?']()) !== false && $a !== nil) {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<'](self.$f("[].concat(", sexp))['$<<'](part)['$<<'](self.$f(")", sexp))
              } else {
                code['$<<'](self.$f(".concat(", sexp))['$<<'](part)['$<<'](self.$f(")", sexp))
              }
            } else {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<'](self.$f("[", sexp))['$<<'](work)['$<<'](self.$f("]", sexp))
              } else {
                code['$<<'](self.$f(".concat([", sexp))['$<<'](work)['$<<'](self.$f("])", sexp))
              };
              code['$<<'](self.$f(".concat(", sexp))['$<<'](part)['$<<'](self.$f(")", sexp));
            };
            return work = [];
          } else {
            if (($a = work['$empty?']()) === false || $a === nil) {
              work['$<<'](self.$f(", ", current))
            };
            return work['$<<'](part);
          };
        }, TMP_37._s = this, TMP_37), $a).call($b);
        if (($a = work['$empty?']()) === false || $a === nil) {
          join = [this.$f("[", sexp), work, this.$f("]", sexp)];
          if (($a = code['$empty?']()) !== false && $a !== nil) {
            code = join
          } else {
            code.$push([this.$f(".concat(", sexp), join, this.$f(")", sexp)])
          };
        };
        return code;
      };

      def.$process_hash = function(sexp, level) {
        var TMP_38, $a, $b, TMP_39, $c, $d, TMP_40, TMP_41, $e, TMP_42, $f, keys = nil, vals = nil, hash_obj = nil, hash_keys = nil, result = nil;
        keys = [];
        vals = [];
        ($a = ($b = sexp).$each_with_index, $a._p = (TMP_38 = function(obj, idx) {

          var self = TMP_38._s || this, $a;
          if (obj == null) obj = nil;
          if (idx == null) idx = nil;
          
          if (($a = idx['$even?']()) !== false && $a !== nil) {
            return keys['$<<'](obj)
          } else {
            return vals['$<<'](obj)
          }
        }, TMP_38._s = this, TMP_38), $a).call($b);
        if (($a = ($c = ($d = keys)['$all?'], $c._p = (TMP_39 = function(k) {

          var self = TMP_39._s || this;
          if (k == null) k = nil;
          
          return ["sym", "str"]['$include?'](k['$[]'](0))
        }, TMP_39._s = this, TMP_39), $c).call($d)) !== false && $a !== nil) {
          hash_obj = $hash2([], {});
          hash_keys = [];
          ($a = ($c = keys.$size()).$times, $a._p = (TMP_40 = function(i) {

            var self = TMP_40._s || this, $a, k = nil;
            if (i == null) i = nil;
            
            k = keys['$[]'](i)['$[]'](1).$to_s().$inspect();
            if (($a = hash_obj['$include?'](k)) === false || $a === nil) {
              hash_keys['$<<'](k)
            };
            return hash_obj['$[]='](k, self.$process(vals['$[]'](i)));
          }, TMP_40._s = this, TMP_40), $a).call($c);
          result = [];
          this.helpers['$[]=']("hash2", true);
          ($a = ($e = hash_keys).$each, $a._p = (TMP_41 = function(k) {

            var self = TMP_41._s || this, $a;
            if (k == null) k = nil;
            
            if (($a = result['$empty?']()) === false || $a === nil) {
              result['$<<'](self.$f(", ", sexp))
            };
            result['$<<'](self.$f("" + (k) + ": ", sexp));
            return result['$<<'](hash_obj['$[]'](k));
          }, TMP_41._s = this, TMP_41), $a).call($e);
          return [this.$f("$hash2([" + (hash_keys.$join(", ")) + "], {", sexp), result, this.$f("})", sexp)];
        } else {
          this.helpers['$[]=']("hash", true);
          result = [];
          ($a = ($f = sexp).$each, $a._p = (TMP_42 = function(p) {

            var self = TMP_42._s || this, $a;
            if (p == null) p = nil;
            
            if (($a = result['$empty?']()) === false || $a === nil) {
              result['$<<'](self.$f(", ", p))
            };
            return result['$<<'](self.$process(p));
          }, TMP_42._s = this, TMP_42), $a).call($f);
          return [this.$f("$hash(", sexp), result, this.$f(")", sexp)];
        };
      };

      def.$process_while = function(sexp, level) {
        var $a, $b, TMP_43, expr = nil, stmt = nil, redo_var = nil, code = nil, stmt_level = nil, pre = nil;
        $a = $opal.to_ary(sexp), expr = ($a[0] == null ? nil : $a[0]), stmt = ($a[1] == null ? nil : $a[1]);
        redo_var = this.scope.$new_temp();
        code = [];
        stmt_level = (function() { if (($a = ((($b = level['$==']("expr")) !== false && $b !== nil) ? $b : level['$==']("recv"))) !== false && $a !== nil) {
          return "stmt_closure"
        } else {
          return "stmt"
        }; return nil; }).call(this);
        code['$<<'](this.$js_truthy(expr))['$<<'](this.$f("){", sexp));
        pre = "while (";
        ($a = ($b = this).$in_while, $a._p = (TMP_43 = function() {

          var self = TMP_43._s || this, $a, body = nil;
          if (self.while_loop == null) self.while_loop = nil;

          
          if (stmt_level['$==']("stmt_closure")) {
            self.while_loop['$[]=']("closure", true)
          };
          self.while_loop['$[]=']("redo_var", redo_var);
          body = self.$process(stmt, "stmt");
          if (($a = self.while_loop['$[]']("use_redo")) !== false && $a !== nil) {
            pre = ("" + (redo_var) + "=false;")['$+'](pre)['$+']("" + (redo_var) + " || ");
            code['$<<'](self.$f("" + (redo_var) + "=false;", sexp));
          };
          return code['$<<'](body);
        }, TMP_43._s = this, TMP_43), $a).call($b);
        code['$<<'](this.$f("}", sexp));
        code.$unshift(this.$f(pre, sexp));
        this.scope.$queue_temp(redo_var);
        if (stmt_level['$==']("stmt_closure")) {
          code.$unshift(this.$f("(function() {", sexp));
          code.$push(this.$f("; return nil; }).call(" + (this.$current_self()) + ")", sexp));
        };
        return code;
      };

      def.$process_until = function(exp, level) {
        var $a, $b, TMP_44, expr = nil, stmt = nil, redo_var = nil, stmt_level = nil, code = nil, pre = nil;
        $a = $opal.to_ary(exp), expr = ($a[0] == null ? nil : $a[0]), stmt = ($a[1] == null ? nil : $a[1]);
        redo_var = this.scope.$new_temp();
        stmt_level = (function() { if (($a = ((($b = level['$==']("expr")) !== false && $b !== nil) ? $b : level['$==']("recv"))) !== false && $a !== nil) {
          return "stmt_closure"
        } else {
          return "stmt"
        }; return nil; }).call(this);
        code = [];
        pre = "while (!(";
        code['$<<'](this.$js_truthy(expr))['$<<'](this.$f(")) {", exp));
        ($a = ($b = this).$in_while, $a._p = (TMP_44 = function() {

          var self = TMP_44._s || this, $a, body = nil;
          if (self.while_loop == null) self.while_loop = nil;

          
          if (stmt_level['$==']("stmt_closure")) {
            self.while_loop['$[]=']("closure", true)
          };
          self.while_loop['$[]=']("redo_var", redo_var);
          body = self.$process(stmt, "stmt");
          if (($a = self.while_loop['$[]']("use_redo")) !== false && $a !== nil) {
            pre = ("" + (redo_var) + "=false;")['$+'](pre)['$+']("" + (redo_var) + " || ");
            code['$<<'](self.$f("" + (redo_var) + "=false;", exp));
          };
          return code['$<<'](body);
        }, TMP_44._s = this, TMP_44), $a).call($b);
        code['$<<'](this.$f("}", exp));
        code.$unshift(this.$f(pre, exp));
        this.scope.$queue_temp(redo_var);
        if (stmt_level['$==']("stmt_closure")) {
          code.$unshift(this.$f("(function() {", exp));
          code['$<<'](this.$f("; return nil; }).call(" + (this.$current_self()) + ")", exp));
        };
        return code;
      };

      def.$process_alias = function(exp, level) {
        var $a, new$ = nil, old = nil, current = nil;
        new$ = this.$mid_to_jsid(exp['$[]'](0)['$[]'](1).$to_s());
        old = this.$mid_to_jsid(exp['$[]'](1)['$[]'](1).$to_s());
        if (($a = ["class", "module"]['$include?'](this.scope.$type())) !== false && $a !== nil) {
          this.scope.$methods()['$<<']("$" + (exp['$[]'](0)['$[]'](1).$to_s()));
          return this.$f("%s%s = %s%s"['$%']([this.scope.$proto(), new$, this.scope.$proto(), old]), exp);
        } else {
          current = this.$current_self();
          return this.$f("%s._proto%s = %s._proto%s"['$%']([current, new$, current, old]), exp);
        };
      };

      def.$process_masgn = function(sexp, level) {
        var $a, TMP_45, $b, lhs = nil, rhs = nil, tmp = nil, len = nil, code = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        tmp = this.scope.$new_temp();
        len = 0;
        code = [];
        if (rhs['$[]'](0)['$==']("array")) {
          len = rhs.$length()['$-'](1);
          code['$<<'](this.$f("" + (tmp) + " = ", sexp))['$<<'](this.$process(rhs));
        } else {
          if (rhs['$[]'](0)['$==']("to_ary")) {
            code['$<<']([this.$f("" + (tmp) + " = $opal.to_ary("), this.$process(rhs['$[]'](1)), this.$f(")")])
          } else {
            if (rhs['$[]'](0)['$==']("splat")) {
              code['$<<'](this.$f("(" + (tmp) + " = ", sexp))['$<<'](this.$process(rhs['$[]'](1)));
              code['$<<'](this.$f(")['$to_a'] ? (" + (tmp) + " = " + (tmp) + "['$to_a']()) : (" + (tmp) + ")._isArray ?  " + (tmp) + " : (" + (tmp) + " = [" + (tmp) + "])", sexp));
            } else {
              this.$raise("Unsupported mlhs type")
            }
          }
        };
        ($a = ($b = lhs['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_45 = function(l, idx) {

          var self = TMP_45._s || this, $a, $b, $c, s = nil, assign = nil;
          if (l == null) l = nil;
          if (idx == null) idx = nil;
          
          if (($a = code['$empty?']()) === false || $a === nil) {
            code['$<<'](self.$f(", ", sexp))
          };
          if (l.$first()['$==']("splat")) {
            if (($a = s = l['$[]'](1)) !== false && $a !== nil) {
              s['$<<'](self.$s("js_tmp", "$slice.call(" + (tmp) + ", " + (idx) + ")"));
              return code['$<<'](self.$process(s));
            } else {
              return nil
            }
          } else {
            if (idx['$>='](len)) {
              assign = self.$s("js_tmp", "(" + (tmp) + "[" + (idx) + "] == null ? nil : " + (tmp) + "[" + (idx) + "])")
            } else {
              assign = self.$s("js_tmp", "" + (tmp) + "[" + (idx) + "]")
            };
            if (($a = ((($b = ((($c = l['$[]'](0)['$==']("lasgn")) !== false && $c !== nil) ? $c : l['$[]'](0)['$==']("iasgn"))) !== false && $b !== nil) ? $b : l['$[]'](0)['$==']("lvar"))) !== false && $a !== nil) {
              l['$<<'](assign)
            } else {
              if (l['$[]'](0)['$==']("call")) {
                l['$[]='](2, ("" + (l['$[]'](2)) + "=").$to_sym());
                l.$last()['$<<'](assign);
              } else {
                if (l['$[]'](0)['$==']("attrasgn")) {
                  l.$last()['$<<'](assign)
                } else {
                  self.$raise("bad lhs for masgn: " + (l.$inspect()))
                }
              }
            };
            return code['$<<'](self.$process(l));
          };
        }, TMP_45._s = this, TMP_45), $a).call($b);
        this.scope.$queue_temp(tmp);
        return code;
      };

      def.$process_svalue = function(sexp, level) {
        
        return this.$process(sexp['$[]'](0), level);
      };

      def.$process_lasgn = function(sexp, level) {
        var $a, $b, lvar = nil, rhs = nil, result = nil;
        lvar = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        if (($a = $scope.RESERVED['$include?'](lvar.$to_s())) !== false && $a !== nil) {
          lvar = ("" + (lvar) + "$").$to_sym()
        };
        if (($a = ($b = this.irb_vars, $b !== false && $b !== nil ? this.scope['$top?']() : $b)) !== false && $a !== nil) {
          return [this.$f("$opal.irb_vars." + (lvar) + " = ", sexp), this.$process(rhs)]
        } else {
          this.scope.$add_local(lvar);
          rhs = this.$process(rhs);
          result = [this.$f(lvar, sexp), this.$f(" = ", sexp), rhs];
          if (level['$==']("recv")) {
            result.$unshift(this.$f("(", sexp));
            result.$push(this.$f(")", sexp));
          };
          return result;
        };
      };

      def.$process_lvar = function(sexp, level) {
        var $a, $b, TMP_46, lvar = nil;
        lvar = sexp['$[]'](0).$to_s();
        if (($a = $scope.RESERVED['$include?'](lvar)) !== false && $a !== nil) {
          lvar = "" + (lvar) + "$"
        };
        if (($a = ($b = this.irb_vars, $b !== false && $b !== nil ? this.scope['$top?']() : $b)) !== false && $a !== nil) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_46 = function(t) {

            var self = TMP_46._s || this;
            if (t == null) t = nil;
            
            return self.$f("((" + (t) + " = $opal.irb_vars." + (lvar) + ") == null ? nil : " + (t) + ")", sexp)
          }, TMP_46._s = this, TMP_46), $a).call($b)
        } else {
          return this.$f(lvar, sexp)
        };
      };

      def.$process_iasgn = function(exp, level) {
        var $a, ivar = nil, rhs = nil, lhs = nil;
        $a = $opal.to_ary(exp), ivar = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        ivar = ivar.$to_s()['$[]']($range(1, -1, false));
        lhs = (function() { if (($a = $scope.RESERVED['$include?'](ivar)) !== false && $a !== nil) {
          return "" + (this.$current_self()) + "['" + (ivar) + "']"
        } else {
          return "" + (this.$current_self()) + "." + (ivar)
        }; return nil; }).call(this);
        return [this.$f(lhs, exp), this.$f(" = ", exp), this.$process(rhs)];
      };

      def.$process_ivar = function(exp, level) {
        var $a, ivar = nil, part = nil;
        ivar = exp['$[]'](0).$to_s()['$[]']($range(1, -1, false));
        part = (function() { if (($a = $scope.RESERVED['$include?'](ivar)) !== false && $a !== nil) {
          return "['" + (ivar) + "']"
        } else {
          return "." + (ivar)
        }; return nil; }).call(this);
        this.scope.$add_ivar(part);
        return this.$f("" + (this.$current_self()) + (part), exp);
      };

      def.$process_gvar = function(sexp, level) {
        var gvar = nil;
        gvar = sexp['$[]'](0).$to_s()['$[]']($range(1, -1, false));
        this.helpers['$[]=']("gvars", true);
        return this.$f("$gvars[" + (gvar.$inspect()) + "]", sexp);
      };

      def.$process_nth_ref = function(sexp, level) {
        
        return this.$f("nil", sexp);
      };

      def.$process_gasgn = function(sexp, level) {
        var gvar = nil, rhs = nil;
        gvar = sexp['$[]'](0).$to_s()['$[]']($range(1, -1, false));
        rhs = sexp['$[]'](1);
        this.helpers['$[]=']("gvars", true);
        return [this.$f("$gvars[" + (gvar.$to_s().$inspect()) + "] = ", sexp), this.$process(rhs)];
      };

      def.$process_const = function(sexp, level) {
        var $a, TMP_47, $b, cname = nil;
        cname = sexp['$[]'](0).$to_s();
        if (($a = this.const_missing) !== false && $a !== nil) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_47 = function(t) {

            var self = TMP_47._s || this;
            if (t == null) t = nil;
            
            return self.$f("((" + (t) + " = $scope." + (cname) + ") == null ? $opal.cm(" + (cname.$inspect()) + ") : " + (t) + ")", sexp)
          }, TMP_47._s = this, TMP_47), $a).call($b)
        } else {
          return this.$f("$scope." + (cname), sexp)
        };
      };

      def.$process_cdecl = function(sexp, level) {
        var $a, const$ = nil, rhs = nil;
        $a = $opal.to_ary(sexp), const$ = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        return [this.$f("$scope." + (const$) + " = ", sexp), this.$process(rhs)];
      };

      def.$process_casgn = function(sexp, level) {
        var $a, lhs = nil, const$ = nil, rhs = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), const$ = ($a[1] == null ? nil : $a[1]), rhs = ($a[2] == null ? nil : $a[2]);
        return [this.$process(lhs), this.$f("._scope." + (const$) + " = ", sexp), this.$process(rhs)];
      };

      def.$process_return = function(sexp, level) {
        var $a, $b, val = nil, parent_def = nil;
        val = this.$process(((($a = sexp['$[]'](0)) !== false && $a !== nil) ? $a : this.$s("nil")));
        if (($a = ($b = this.scope['$iter?'](), $b !== false && $b !== nil ? parent_def = this.scope.$find_parent_def() : $b)) !== false && $a !== nil) {
          parent_def['$catch_return='](true);
          return [this.$f("$opal.$return(", sexp), val, this.$f(")", sexp)];
        } else {
          if (($a = (($b = level['$==']("expr")) ? this.scope['$def?']() : $b)) !== false && $a !== nil) {
            this.scope['$catch_return='](true);
            return [this.$f("$opal.$return(", sexp), val, this.$f(")", sexp)];
          } else {
            if (level['$==']("stmt")) {
              return [this.$f("return ", sexp), val]
            } else {
              return this.$raise($scope.SyntaxError, "void value expression: cannot return as an expression")
            }
          }
        };
      };

      def.$process_xstr = function(sexp, level) {
        var $a, $b, $c, code = nil, result = nil;
        code = sexp.$first().$to_s();
        if (($a = (($b = level['$==']("stmt")) ? ($c = code['$include?'](";"), ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
          code = code['$+'](";")
        };
        result = this.$f(code, sexp);
        if (level['$==']("recv")) {
          return [this.$f("(", sexp), result, this.$f(")", sexp)]
        } else {
          return result
        };
      };

      def.$process_dxstr = function(sexp, level) {
        var TMP_48, $a, $b, result = nil, needs_sc = nil;
        result = [];
        needs_sc = false;
        ($a = ($b = sexp).$each, $a._p = (TMP_48 = function(p) {

          var self = TMP_48._s || this, $a, $b, $c, $d;
          if (p == null) p = nil;
          
          if (($a = $scope.String['$==='](p)) !== false && $a !== nil) {
            result['$<<'](self.$f(p.$to_s(), sexp));
            if (($a = (($b = level['$==']("stmt")) ? ($c = p.$to_s()['$include?'](";"), ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
              return needs_sc = true
            } else {
              return nil
            };
          } else {
            if (p.$first()['$==']("evstr")) {
              return ($a = result).$push.apply($a, [].concat(self.$process(p.$last(), "stmt")))
            } else {
              if (p.$first()['$==']("str")) {
                result['$<<'](self.$f(p.$last().$to_s(), p));
                if (($b = (($c = level['$==']("stmt")) ? ($d = p.$last().$to_s()['$include?'](";"), ($d === nil || $d === false)) : $c)) !== false && $b !== nil) {
                  return needs_sc = true
                } else {
                  return nil
                };
              } else {
                return self.$raise("Bad dxstr part")
              }
            }
          }
        }, TMP_48._s = this, TMP_48), $a).call($b);
        if (needs_sc !== false && needs_sc !== nil) {
          result['$<<'](this.$f(";", sexp))
        };
        if (level['$==']("recv")) {
          return [this.$f("(", sexp), result, this.$f(")", sexp)]
        } else {
          return result
        };
      };

      def.$process_dstr = function(sexp, level) {
        var TMP_49, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_49 = function(p) {

          var self = TMP_49._s || this, $a;
          if (p == null) p = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(" + ", sexp))
          };
          if (($a = $scope.String['$==='](p)) !== false && $a !== nil) {
            return result['$<<'](self.$f(p.$inspect(), sexp))
          } else {
            if (p.$first()['$==']("evstr")) {
              result['$<<'](self.$f("(", p));
              result['$<<'](self.$process(p.$last()));
              return result['$<<'](self.$f(")", p));
            } else {
              if (p.$first()['$==']("str")) {
                return result['$<<'](self.$f(p.$last().$inspect(), p))
              } else {
                return self.$raise("Bad dstr part")
              }
            }
          };
        }, TMP_49._s = this, TMP_49), $a).call($b);
        if (level['$==']("recv")) {
          return [this.$f("(", sexp), result, this.$f(")", sexp)]
        } else {
          return result
        };
      };

      def.$process_dsym = function(sexp, level) {
        var TMP_50, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_50 = function(p) {

          var self = TMP_50._s || this, $a;
          if (p == null) p = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(" + ", sexp))
          };
          if (($a = $scope.String['$==='](p)) !== false && $a !== nil) {
            return result['$<<'](self.$f(p.$inspect(), sexp))
          } else {
            if (p.$first()['$==']("evstr")) {
              return result['$<<'](self.$process(self.$s("call", p.$last(), "to_s", self.$s("arglist"))))
            } else {
              if (p.$first()['$==']("str")) {
                return result['$<<'](self.$f(p.$last().$inspect(), sexp))
              } else {
                return self.$raise("Bad dsym part")
              }
            }
          };
        }, TMP_50._s = this, TMP_50), $a).call($b);
        return [this.$f("(", sexp), result, this.$f(")", sexp)];
      };

      def.$process_if = function(sexp, level) {
        var $a, $b, $c, TMP_51, TMP_52, test = nil, truthy = nil, falsy = nil, returnable = nil, check = nil, result = nil, outdent = nil;
        $a = $opal.to_ary(sexp), test = ($a[0] == null ? nil : $a[0]), truthy = ($a[1] == null ? nil : $a[1]), falsy = ($a[2] == null ? nil : $a[2]);
        returnable = ((($a = level['$==']("expr")) !== false && $a !== nil) ? $a : level['$==']("recv"));
        if (returnable !== false && returnable !== nil) {
          truthy = this.$returns(((($a = truthy) !== false && $a !== nil) ? $a : this.$s("nil")));
          falsy = this.$returns(((($a = falsy) !== false && $a !== nil) ? $a : this.$s("nil")));
        };
        if (($a = (($b = falsy !== false && falsy !== nil) ? ($c = truthy, ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
          truthy = falsy;
          falsy = nil;
          check = this.$js_falsy(test);
        } else {
          check = this.$js_truthy(test)
        };
        result = [this.$f("if (", sexp), check, this.$f(") {\n", sexp)];
        if (truthy !== false && truthy !== nil) {
          ($a = ($b = this).$indent, $a._p = (TMP_51 = function() {

            var self = TMP_51._s || this;
            if (self.indent == null) self.indent = nil;

            
            return result.$push(self.$f(self.indent, sexp), self.$process(truthy, "stmt"))
          }, TMP_51._s = this, TMP_51), $a).call($b)
        };
        outdent = this.indent;
        if (falsy !== false && falsy !== nil) {
          ($a = ($c = this).$indent, $a._p = (TMP_52 = function() {

            var self = TMP_52._s || this;
            if (self.indent == null) self.indent = nil;

            
            return result.$push(self.$f("\n" + (outdent) + "} else {\n" + (self.indent), sexp), self.$process(falsy, "stmt"))
          }, TMP_52._s = this, TMP_52), $a).call($c)
        };
        result['$<<'](this.$f("\n" + (this.indent) + "}", sexp));
        if (returnable !== false && returnable !== nil) {
          result.$unshift(this.$f("(function() { ", sexp));
          result.$push(this.$f("; return nil; }).call(" + (this.$current_self()) + ")", sexp));
        };
        return result;
      };

      def.$js_truthy_optimize = function(sexp) {
        var $a, mid = nil;
        if (sexp.$first()['$==']("call")) {
          mid = sexp['$[]'](2);
          if (mid['$==']("block_given?")) {
            return this.$process(sexp)
          } else {
            if (($a = $scope.COMPARE['$include?'](mid.$to_s())) !== false && $a !== nil) {
              return this.$process(sexp)
            } else {
              if (mid['$==']("==")) {
                return this.$process(sexp)
              } else {
                return nil
              }
            }
          };
        } else {
          if (($a = ["lvar", "self"]['$include?'](sexp.$first())) !== false && $a !== nil) {
            return [this.$process(sexp.$dup()), this.$f(" !== false && ", sexp), this.$process(sexp.$dup()), this.$f(" !== nil", sexp)]
          } else {
            return nil
          }
        };
      };

      def.$js_truthy = function(sexp) {
        var $a, TMP_53, $b, optimized = nil;
        if (($a = optimized = this.$js_truthy_optimize(sexp)) !== false && $a !== nil) {
          return optimized
        };
        return ($a = ($b = this).$with_temp, $a._p = (TMP_53 = function(tmp) {

          var self = TMP_53._s || this;
          if (tmp == null) tmp = nil;
          
          return [self.$f("(" + (tmp) + " = ", sexp), self.$process(sexp), self.$f(") !== false && " + (tmp) + " !== nil", sexp)]
        }, TMP_53._s = this, TMP_53), $a).call($b);
      };

      def.$js_falsy = function(sexp) {
        var TMP_54, $a, $b, mid = nil;
        if (sexp.$first()['$==']("call")) {
          mid = sexp['$[]'](2);
          if (mid['$==']("block_given?")) {
            return this.$handle_block_given(sexp, true)
          };
        };
        return ($a = ($b = this).$with_temp, $a._p = (TMP_54 = function(tmp) {

          var self = TMP_54._s || this, result = nil;
          if (tmp == null) tmp = nil;
          
          result = [];
          result['$<<'](self.$f("(" + (tmp) + " = ", sexp));
          result['$<<'](self.$process(sexp));
          result['$<<'](self.$f(") === false || " + (tmp) + " === nil", sexp));
          return result;
        }, TMP_54._s = this, TMP_54), $a).call($b);
      };

      def.$process_and = function(sexp, level) {
        var $a, lhs = nil, rhs = nil, t = nil, tmp = nil, result = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        t = nil;
        tmp = this.scope.$new_temp();
        if (($a = t = this.$js_truthy_optimize(lhs)) !== false && $a !== nil) {
          result = [];
          result['$<<'](this.$f("((" + (tmp) + " = ", sexp))['$<<'](t);
          result['$<<'](this.$f(") ? ", sexp))['$<<'](this.$process(rhs));
          result['$<<'](this.$f(" : " + (tmp) + ")", sexp));
          this.scope.$queue_temp(tmp);
          return result;
        };
        this.scope.$queue_temp(tmp);
        return [this.$f("(" + (tmp) + " = ", sexp), this.$process(lhs), this.$f(", " + (tmp) + " !== false && " + (tmp) + " !== nil ? ", sexp), this.$process(rhs), this.$f(" : " + (tmp) + ")", sexp)];
      };

      def.$process_or = function(sexp, level) {
        var $a, TMP_55, $b, lhs = nil, rhs = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        return ($a = ($b = this).$with_temp, $a._p = (TMP_55 = function(tmp) {

          var self = TMP_55._s || this;
          if (tmp == null) tmp = nil;
          
          lhs = self.$process(lhs);
          rhs = self.$process(rhs);
          return [self.$f("(((" + (tmp) + " = ", sexp), lhs, self.$f(") !== false && " + (tmp) + " !== nil) ? " + (tmp) + " : ", sexp), rhs, self.$f(")", sexp)];
        }, TMP_55._s = this, TMP_55), $a).call($b);
      };

      def.$process_yield = function(sexp, level) {
        var TMP_56, $a, $b, call = nil;
        call = this.$handle_yield_call(sexp, level);
        if (level['$==']("stmt")) {
          return [this.$f("if (", sexp), call, this.$f(" === $breaker) return $breaker.$v")]
        } else {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_56 = function(tmp) {

            var self = TMP_56._s || this;
            if (tmp == null) tmp = nil;
            
            return [self.$f("(((" + (tmp) + " = ", sexp), call, self.$f(") === $breaker) ? $breaker.$v : " + (tmp) + ")", sexp)]
          }, TMP_56._s = this, TMP_56), $a).call($b)
        };
      };

      def.$process_yasgn = function(sexp, level) {
        var $a, call = nil;
        call = this.$handle_yield_call(($a = this).$s.apply($a, [].concat(sexp['$[]'](1)['$[]']($range(1, -1, false)))), "stmt");
        return [this.$f("if ((" + (sexp['$[]'](0)) + " = ", sexp), call, this.$f(") === $breaker) return $breaker.$v", sexp)];
      };

      def.$process_returnable_yield = function(sexp, level) {
        var TMP_57, $a, $b, call = nil;
        call = this.$handle_yield_call(sexp, level);
        return ($a = ($b = this).$with_temp, $a._p = (TMP_57 = function(tmp) {

          var self = TMP_57._s || this;
          if (tmp == null) tmp = nil;
          
          return [self.$f("return " + (tmp) + " = ", sexp), call, self.$f(", " + (tmp) + " === $breaker ? " + (tmp) + " : " + (tmp))]
        }, TMP_57._s = this, TMP_57), $a).call($b);
      };

      def.$handle_yield_call = function(sexp, level) {
        var TMP_58, $a, $b, $c, splat = nil, args = nil, y = nil;
        this.scope['$uses_block!']();
        splat = ($a = ($b = sexp)['$any?'], $a._p = (TMP_58 = function(s) {

          var self = TMP_58._s || this;
          if (s == null) s = nil;
          
          return s.$first()['$==']("splat")
        }, TMP_58._s = this, TMP_58), $a).call($b);
        if (($a = ($c = ($c = splat, ($c === nil || $c === false)), $c !== false && $c !== nil ? sexp.$size()['$=='](1) : $c)) !== false && $a !== nil) {
          return [this.$f("$opal.$yield1(" + (((($a = this.scope.$block_name()) !== false && $a !== nil) ? $a : "$yield")) + ", "), this.$process(sexp['$[]'](0)), this.$f(")")]
        };
        args = this.$process_arglist(sexp, level);
        y = ((($a = this.scope.$block_name()) !== false && $a !== nil) ? $a : "$yield");
        if (splat !== false && splat !== nil) {
          return [this.$f("$opal.$yieldX(" + (y) + ", ", sexp), args, this.$f(")")]
        } else {
          return [this.$f("$opal.$yieldX(" + (y) + ", [", sexp), args, this.$f("])")]
        };
      };

      def.$process_break = function(sexp, level) {
        var $a, val = nil;
        val = (function() { if (($a = sexp['$empty?']()) !== false && $a !== nil) {
          return this.$f("nil", sexp)
        } else {
          return this.$process(sexp['$[]'](0))
        }; return nil; }).call(this);
        if (($a = this['$in_while?']()) !== false && $a !== nil) {
          if (($a = this.while_loop['$[]']("closure")) !== false && $a !== nil) {
            return [this.$f("return ", sexp), val, this.$f("", sexp)]
          } else {
            return this.$f("break;", sexp)
          }
        } else {
          if (($a = this.scope['$iter?']()) !== false && $a !== nil) {
            if (($a = level['$==']("stmt")) === false || $a === nil) {
              this.$error("break must be used as a statement")
            };
            return [this.$f("return ($breaker.$v = ", sexp), val, this.$f(", $breaker)", sexp)];
          } else {
            return this.$error("void value expression: cannot use break outside of iter/while")
          }
        };
      };

      def.$process_case = function(exp, level) {
        var $a, TMP_59, $b, $c, $d, pre = nil, code = nil, returnable = nil, done_else = nil;
        $a = [[], []], pre = $a[0], code = $a[1];
        returnable = ($a = level['$==']("stmt"), ($a === nil || $a === false));
        done_else = false;
        ($a = ($b = this).$in_case, $a._p = (TMP_59 = function() {

          var self = TMP_59._s || this, $a, TMP_60, $b, cond = nil, expr = nil;
          if (self.case_stmt == null) self.case_stmt = nil;
          if (self.scope == null) self.scope = nil;

          
          if (($a = cond = exp['$[]'](0)) !== false && $a !== nil) {
            self.case_stmt['$[]=']("cond", true);
            self.scope.$add_local("$case");
            expr = self.$process(cond);
            pre['$<<'](self.$f("$case = ", exp))['$<<'](expr)['$<<'](self.$f(";", exp));
          };
          return ($a = ($b = exp['$[]']($range(1, -1, false))).$each, $a._p = (TMP_60 = function(wen) {

            var self = TMP_60._s || this, $a, $b;
            if (wen == null) wen = nil;
            
            if (($a = (($b = wen !== false && wen !== nil) ? wen.$first()['$==']("when") : $b)) !== false && $a !== nil) {
              if (returnable !== false && returnable !== nil) {
                self.$returns(wen)
              };
              wen = self.$process(wen, "stmt");
              if (($a = code['$empty?']()) === false || $a === nil) {
                code['$<<'](self.$f("else ", exp))
              };
              return code['$<<'](wen);
            } else {
              if (wen !== false && wen !== nil) {
                done_else = true;
                if (returnable !== false && returnable !== nil) {
                  wen = self.$returns(wen)
                };
                return code['$<<'](self.$f("else {", exp))['$<<'](self.$process(wen, "stmt"))['$<<'](self.$f("}", exp));
              } else {
                return nil
              }
            }
          }, TMP_60._s = self, TMP_60), $a).call($b);
        }, TMP_59._s = this, TMP_59), $a).call($b);
        if (($a = (($c = returnable !== false && returnable !== nil) ? ($d = done_else, ($d === nil || $d === false)) : $c)) !== false && $a !== nil) {
          code['$<<'](this.$f("else { return nil }", exp))
        };
        code.$unshift(pre);
        if (returnable !== false && returnable !== nil) {
          code.$unshift(this.$f("(function() { ", exp));
          code['$<<'](this.$f(" }).call(" + (this.$current_self()) + ")", exp));
        };
        return code;
      };

      def.$process_when = function(exp, level) {
        var $a, TMP_61, $b, arg = nil, body = nil, test = nil;
        arg = exp['$[]'](0)['$[]']($range(1, -1, false));
        body = ((($a = exp['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("nil"));
        body = this.$process(body, level);
        test = [];
        ($a = ($b = arg).$each, $a._p = (TMP_61 = function(a) {

          var self = TMP_61._s || this, $a, call = nil, splt = nil;
          if (self.case_stmt == null) self.case_stmt = nil;

          if (a == null) a = nil;
          
          if (($a = test['$empty?']()) === false || $a === nil) {
            test['$<<'](self.$f(" || "))
          };
          if (a.$first()['$==']("splat")) {
            call = self.$f("$splt[i]['$===']($case)", a);
            splt = [self.$f("(function($splt) { for(var i = 0; i < $splt.length; i++) {", exp)];
            splt['$<<'](self.$f("if ("))['$<<'](call)['$<<'](self.$f(") { return true; }", exp));
            splt['$<<'](self.$f("} return false; }).call(" + (self.$current_self()) + ", ", exp));
            splt['$<<'](self.$process(a['$[]'](1)))['$<<'](self.$f(")"));
            return test['$<<'](splt);
          } else {
            if (($a = self.case_stmt['$[]']("cond")) !== false && $a !== nil) {
              call = self.$s("call", a, "===", self.$s("arglist", self.$s("js_tmp", "$case")));
              return test['$<<'](self.$process(call));
            } else {
              return test['$<<'](self.$js_truthy(a))
            }
          };
        }, TMP_61._s = this, TMP_61), $a).call($b);
        return [this.$f("if ("), test, this.$f(") {" + (this.space)), body, this.$f("" + (this.space) + "}")];
      };

      def.$process_match3 = function(sexp, level) {
        
        return this.$process(this.$s("call", sexp['$[]'](0), "=~", this.$s("arglist", sexp['$[]'](1))), level);
      };

      def.$process_cvar = function(exp, level) {
        var TMP_62, $a, $b;
        return ($a = ($b = this).$with_temp, $a._p = (TMP_62 = function(tmp) {

          var self = TMP_62._s || this;
          if (tmp == null) tmp = nil;
          
          return self.$f("((" + (tmp) + " = $opal.cvars['" + (exp['$[]'](0)) + "']) == null ? nil : " + (tmp) + ")", exp)
        }, TMP_62._s = this, TMP_62), $a).call($b);
      };

      def.$process_cvasgn = function(exp, level) {
        
        return "($opal.cvars['" + (exp['$[]'](0)) + "'] = " + (this.$process(exp['$[]'](1))) + ")";
      };

      def.$process_cvdecl = function(exp, level) {
        
        return [this.$f("($opal.cvars['" + (exp['$[]'](0)) + "'] = ", exp), this.$process(exp['$[]'](1)), this.$f(")", exp)];
      };

      def.$process_colon2 = function(sexp, level) {
        var $a, TMP_63, $b, base = nil, cname = nil, result = nil;
        $a = $opal.to_ary(sexp), base = ($a[0] == null ? nil : $a[0]), cname = ($a[1] == null ? nil : $a[1]);
        result = [];
        if (($a = this.const_missing) !== false && $a !== nil) {
          ($a = ($b = this).$with_temp, $a._p = (TMP_63 = function(t) {

            var self = TMP_63._s || this;
            if (t == null) t = nil;
            
            base = self.$process(base);
            result['$<<'](self.$f("((" + (t) + " = (", sexp))['$<<'](base)['$<<'](self.$f(")._scope).", sexp));
            return result['$<<'](self.$f("" + (cname) + " == null ? " + (t) + ".cm('" + (cname) + "') : " + (t) + "." + (cname) + ")", sexp));
          }, TMP_63._s = this, TMP_63), $a).call($b)
        } else {
          result['$<<'](this.$f("(", sexp))['$<<'](this.$process(base))['$<<'](this.$f(")._scope." + (cname), sexp))
        };
        return result;
      };

      def.$process_colon3 = function(exp, level) {
        var TMP_64, $a, $b;
        return ($a = ($b = this).$with_temp, $a._p = (TMP_64 = function(t) {

          var self = TMP_64._s || this;
          if (t == null) t = nil;
          
          return self.$f("((" + (t) + " = $opal.Object._scope." + (exp['$[]'](0)) + ") == null ? $opal.cm('" + (exp['$[]'](0)) + "') : " + (t) + ")", exp)
        }, TMP_64._s = this, TMP_64), $a).call($b);
      };

      def.$process_super = function(sexp, level) {
        var TMP_65, $a, $b, $c, splat = nil, args = nil;
        splat = ($a = ($b = sexp)['$any?'], $a._p = (TMP_65 = function(s) {

          var self = TMP_65._s || this;
          if (s == null) s = nil;
          
          return s.$first()['$==']("splat")
        }, TMP_65._s = this, TMP_65), $a).call($b);
        args = ($a = this).$s.apply($a, ["arglist"].concat(sexp));
        args = this.$process(args);
        if (($c = splat) === false || $c === nil) {
          args = [this.$f("["), args, this.$f("]")]
        };
        return this.$js_super(args, false, sexp);
      };

      def.$process_zsuper = function(exp, level) {
        var $a;
        if (($a = this.scope['$def?']()) !== false && $a !== nil) {
          this.scope['$uses_zuper='](true);
          return this.$js_super(this.$f("$zuper", exp), true, exp);
        } else {
          return this.$js_super(this.$f("$slice.call(arguments)", exp), true, exp)
        };
      };

      def.$js_super = function(args, pass_block, sexp) {
        var $a, TMP_66, $b, mid = nil, sid = nil, cls_name = nil, jsid = nil, iter = nil, chain = nil, defn = nil, trys = nil;
        if (($a = this.scope['$def_in_class?']()) !== false && $a !== nil) {
          this.scope['$uses_block!']();
          mid = this.scope.$mid().$to_s();
          if (($a = this.scope.$uses_super()) !== false && $a !== nil) {
            sid = this.scope.$uses_super()
          } else {
            sid = this.scope['$uses_super=']("super_" + (this.$unique_temp()))
          };
          if (pass_block !== false && pass_block !== nil) {
            this.scope['$uses_block!']();
            return [this.$f("(" + (sid) + "._p = $iter, " + (sid) + ".apply(" + (this.$current_self()) + ", ", sexp), args, this.$f("))", sexp)];
          } else {
            return [this.$f("" + (sid) + ".apply(" + (this.$current_self()) + ", ", sexp), args, this.$f(")", sexp)]
          };
        } else {
          if (this.scope.$type()['$==']("def")) {
            this.scope['$uses_block!']();
            this.scope['$identify!']();
            cls_name = ((($a = this.scope.$parent().$name()) !== false && $a !== nil) ? $a : "" + (this.$current_self()) + "._klass._proto");
            jsid = this.$mid_to_jsid(this.scope.$mid().$to_s());
            if (pass_block !== false && pass_block !== nil) {
              this.scope['$uses_block!']();
              iter = "$iter";
            } else {
              iter = "null"
            };
            if (($a = this.scope.$defs()) !== false && $a !== nil) {
              return [this.$f("$opal.dispatch_super(this, " + (this.scope.$mid().$to_s().$inspect()) + ",", sexp), args, this.$f(", " + (iter) + ", " + (cls_name) + ")", sexp)]
            } else {
              return [this.$f("$opal.dispatch_super(" + (this.$current_self()) + ", " + (this.scope.$mid().$to_s().$inspect()) + ", ", sexp), args, this.$f(", " + (iter) + ")", sexp)]
            };
          } else {
            if (this.scope.$type()['$==']("iter")) {
              $a = $opal.to_ary(this.scope.$get_super_chain()), chain = ($a[0] == null ? nil : $a[0]), defn = ($a[1] == null ? nil : $a[1]), mid = ($a[2] == null ? nil : $a[2]);
              trys = ($a = ($b = chain).$map, $a._p = (TMP_66 = function(c) {

                var self = TMP_66._s || this;
                if (c == null) c = nil;
                
                return "" + (c) + "._sup"
              }, TMP_66._s = this, TMP_66), $a).call($b).$join(" || ");
              return [this.$f("(" + (trys) + " || " + (this.$current_self()) + "._klass._super._proto[" + (mid) + "]).apply(" + (this.$current_self()) + ", ", sexp), args, this.$f(")", sexp)];
            } else {
              return this.$raise("Cannot call super() from outside a method block")
            }
          }
        };
      };

      def.$process_op_asgn_or = function(exp, level) {
        
        return this.$process(this.$s("or", exp['$[]'](0), exp['$[]'](1)));
      };

      def.$process_op_asgn_and = function(sexp, level) {
        
        return this.$process(this.$s("and", sexp['$[]'](0), sexp['$[]'](1)));
      };

      def.$process_op_asgn1 = function(sexp, level) {
        var $a, TMP_67, $b, lhs = nil, arglist = nil, op = nil, rhs = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), arglist = ($a[1] == null ? nil : $a[1]), op = ($a[2] == null ? nil : $a[2]), rhs = ($a[3] == null ? nil : $a[3]);
        return ($a = ($b = this).$with_temp, $a._p = (TMP_67 = function(a) {

          var self = TMP_67._s || this, TMP_68, $a, $b;
          if (a == null) a = nil;
          
          return ($a = ($b = self).$with_temp, $a._p = (TMP_68 = function(r) {

            var self = TMP_68._s || this, args = nil, recv = nil, aref = nil, aset = nil, orop = nil, result = nil;
            if (r == null) r = nil;
            
            args = self.$process(arglist['$[]'](1));
            recv = self.$process(lhs);
            aref = self.$s("call", self.$s("js_tmp", r), "[]", self.$s("arglist", self.$s("js_tmp", a)));
            aset = self.$s("call", self.$s("js_tmp", r), "[]=", self.$s("arglist", self.$s("js_tmp", a), rhs));
            orop = self.$s("or", aref, aset);
            result = [];
            result['$<<'](self.$f("(" + (a) + " = ", sexp))['$<<'](args)['$<<'](self.$f(", " + (r) + " = ", sexp));
            result['$<<'](recv)['$<<'](self.$f(", ", sexp))['$<<'](self.$process(orop));
            result['$<<'](self.$f(")", sexp));
            return result;
          }, TMP_68._s = self, TMP_68), $a).call($b)
        }, TMP_67._s = this, TMP_67), $a).call($b);
      };

      def.$process_op_asgn2 = function(sexp, level) {
        var TMP_69, $a, $b, TMP_70, $c, TMP_71, $d, lhs = nil, mid = nil, op = nil, rhs = nil;
        lhs = this.$process(sexp['$[]'](0));
        mid = sexp['$[]'](1).$to_s()['$[]']($range(0, -2, false));
        op = sexp['$[]'](2);
        rhs = sexp['$[]'](3);
        if (op.$to_s()['$==']("||")) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_69 = function(temp) {

            var self = TMP_69._s || this, getr = nil, asgn = nil, orop = nil;
            if (temp == null) temp = nil;
            
            getr = self.$s("call", self.$s("js_tmp", temp), mid, self.$s("arglist"));
            asgn = self.$s("call", self.$s("js_tmp", temp), "" + (mid) + "=", self.$s("arglist", rhs));
            orop = self.$s("or", getr, asgn);
            return [self.$f("(" + (temp) + " = ", sexp), lhs, self.$f(", ", sexp), self.$process(orop), self.$f(")", sexp)];
          }, TMP_69._s = this, TMP_69), $a).call($b)
        } else {
          if (op.$to_s()['$==']("&&")) {
            return ($a = ($c = this).$with_temp, $a._p = (TMP_70 = function(temp) {

              var self = TMP_70._s || this, getr = nil, asgn = nil, andop = nil;
              if (temp == null) temp = nil;
              
              getr = self.$s("call", self.$s("js_tmp", temp), mid, self.$s("arglist"));
              asgn = self.$s("call", self.$s("js_tmp", temp), "" + (mid) + "=", self.$s("arglist", rhs));
              andop = self.$s("and", getr, asgn);
              return [self.$f("(" + (temp) + " = ", sexp), lhs, self.$f(", ", sexp), self.$process(andop), self.$f(")", sexp)];
            }, TMP_70._s = this, TMP_70), $a).call($c)
          } else {
            return ($a = ($d = this).$with_temp, $a._p = (TMP_71 = function(temp) {

              var self = TMP_71._s || this, getr = nil, oper = nil, asgn = nil;
              if (temp == null) temp = nil;
              
              getr = self.$s("call", self.$s("js_tmp", temp), mid, self.$s("arglist"));
              oper = self.$s("call", getr, op, self.$s("arglist", rhs));
              asgn = self.$s("call", self.$s("js_tmp", temp), "" + (mid) + "=", self.$s("arglist", oper));
              return [self.$f("(" + (temp) + " = ", sexp), lhs, self.$f(", ", sexp), self.$process(asgn), self.$f(")", sexp)];
            }, TMP_71._s = this, TMP_71), $a).call($d)
          }
        };
      };

      def.$process_ensure = function(exp, level) {
        var $a, $b, begn = nil, retn = nil, result = nil, body = nil, ensr = nil;
        begn = exp['$[]'](0);
        if (($a = ((($b = level['$==']("recv")) !== false && $b !== nil) ? $b : level['$==']("expr"))) !== false && $a !== nil) {
          retn = true;
          begn = this.$returns(begn);
        };
        result = [];
        body = this.$process(begn, level);
        ensr = ((($a = exp['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("nil"));
        ensr = this.$process(ensr, level);
        body = [this.$f("try {\n", exp), body, this.$f("}", exp)];
        result['$<<'](body)['$<<'](this.$f("" + (this.space) + "finally {" + (this.space), exp))['$<<'](ensr)['$<<'](this.$f("}", exp));
        if (retn !== false && retn !== nil) {
          return [this.$f("(function() { ", exp), result, this.$f("; }).call(" + (this.$current_self()) + ")", exp)]
        } else {
          return result
        };
      };

      def.$process_rescue = function(exp, level) {
        var TMP_72, $a, $b, TMP_73, $c, TMP_75, $d, body = nil, handled_else = nil, parts = nil, code = nil;
        body = (function() { if (exp.$first().$first()['$==']("resbody")) {
          return this.$s("nil")
        } else {
          return exp['$[]'](0)
        }; return nil; }).call(this);
        body = ($a = ($b = this).$indent, $a._p = (TMP_72 = function() {

          var self = TMP_72._s || this;
          
          return self.$process(body, level)
        }, TMP_72._s = this, TMP_72), $a).call($b);
        handled_else = false;
        parts = [];
        ($a = ($c = exp['$[]']($range(1, -1, false))).$each, $a._p = (TMP_73 = function(a) {

          var self = TMP_73._s || this, $a, TMP_74, $b, part = nil;
          if (a == null) a = nil;
          
          if (($a = a.$first()['$==']("resbody")) === false || $a === nil) {
            handled_else = true
          };
          part = ($a = ($b = self).$indent, $a._p = (TMP_74 = function() {

            var self = TMP_74._s || this;
            
            return self.$process(a, level)
          }, TMP_74._s = self, TMP_74), $a).call($b);
          if (($a = parts['$empty?']()) === false || $a === nil) {
            parts['$<<'](self.$f("else ", exp))
          };
          return parts['$<<'](part);
        }, TMP_73._s = this, TMP_73), $a).call($c);
        if (($a = handled_else) === false || $a === nil) {
          parts['$<<'](($a = ($d = this).$indent, $a._p = (TMP_75 = function() {

            var self = TMP_75._s || this;
            
            return self.$f("else { throw $err; }", exp)
          }, TMP_75._s = this, TMP_75), $a).call($d))
        };
        code = [];
        code['$<<'](this.$f("try {" + (this.space) + ($scope.INDENT), exp));
        code['$<<'](body);
        code['$<<'](this.$f("" + (this.space) + "} catch ($err) {" + (this.space), exp));
        code['$<<'](parts);
        code['$<<'](this.$f("" + (this.space) + "}", exp));
        if (level['$==']("expr")) {
          code.$unshift(this.$f("(function() { ", exp));
          code['$<<'](this.$f(" }).call(" + (this.$current_self()) + ")", exp));
        };
        return code;
      };

      def.$process_resbody = function(exp, level) {
        var $a, $b, TMP_76, $c, args = nil, body = nil, types = nil, err = nil, val = nil;
        args = exp['$[]'](0);
        body = exp['$[]'](1);
        body = this.$process(((($a = body) !== false && $a !== nil) ? $a : this.$s("nil")), level);
        types = args['$[]']($range(1, -1, false));
        if (($a = ($b = types.$last(), $b !== false && $b !== nil ? ($b = types.$last().$first()['$==']("const"), ($b === nil || $b === false)) : $b)) !== false && $a !== nil) {
          types.$pop()
        };
        err = [];
        ($a = ($b = types).$each, $a._p = (TMP_76 = function(t) {

          var self = TMP_76._s || this, $a, call = nil, a = nil;
          if (t == null) t = nil;
          
          if (($a = err['$empty?']()) === false || $a === nil) {
            err['$<<'](self.$f(", ", exp))
          };
          call = self.$s("call", t, "===", self.$s("arglist", self.$s("js_tmp", "$err")));
          a = self.$process(call);
          return err['$<<'](a);
        }, TMP_76._s = this, TMP_76), $a).call($b);
        if (($a = err['$empty?']()) !== false && $a !== nil) {
          err['$<<'](this.$f("true", exp))
        };
        if (($a = ($c = $scope.Array['$==='](args.$last()), $c !== false && $c !== nil ? ["lasgn", "iasgn"]['$include?'](args.$last().$first()) : $c)) !== false && $a !== nil) {
          val = args.$last();
          val['$[]='](2, this.$s("js_tmp", "$err"));
          val = [this.$process(val), this.$f(";", exp)];
        };
        if (($a = val) === false || $a === nil) {
          val = []
        };
        return [this.$f("if (", exp), err, this.$f("){" + (this.space), exp), val, body, this.$f("}", exp)];
      };

      def.$process_begin = function(exp, level) {
        
        return this.$process(exp['$[]'](0), level);
      };

      def.$process_next = function(exp, level) {
        var $a, result = nil;
        if (($a = this['$in_while?']()) !== false && $a !== nil) {
          return this.$f("continue;", exp)
        } else {
          result = [];
          result['$<<'](this.$f("return ", exp));
          result['$<<']((function() { if (($a = exp['$empty?']()) !== false && $a !== nil) {
            return this.$f("nil", exp)
          } else {
            return this.$process(exp['$[]'](0))
          }; return nil; }).call(this));
          result['$<<'](this.$f(";", exp));
          return result;
        };
      };

      def.$process_redo = function(exp, level) {
        var $a;
        if (($a = this['$in_while?']()) !== false && $a !== nil) {
          this.while_loop['$[]=']("use_redo", true);
          return this.$f("" + (this.while_loop['$[]']("redo_var")) + " = true", exp);
        } else {
          if (($a = this.scope['$iter?']()) !== false && $a !== nil) {
            return this.$f("return " + (this.scope.$identity()) + ".apply(null, $slice.call(arguments))")
          } else {
            return this.$f("REDO()", exp)
          }
        };
      };

      return nil;
    })(Opal, null)

  })(self);
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $hash2 = $opal.hash2;

  $opal.add_stubs(['$attr_accessor', '$attr_reader', '$==', '$class?', '$to_s', '$dup', '$push', '$map', '$current_self', '$ivars', '$parser_indent', '$empty?', '$join', '$proto', '$%', '$f', '$should_donate?', '$to_proc', '$def_in_class?', '$add_proto_ivar', '$include?', '$<<', '$has_local?', '$pop', '$next_temp', '$succ', '$uses_block!', '$identify!', '$unique_temp', '$add_temp', '$parent', '$def?', '$type', '$mid']);
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function TargetScope() {};
      TargetScope = $klass($base, $super, "TargetScope", TargetScope);

      var def = TargetScope._proto, $scope = TargetScope._scope;
      def.type = def.defs = def.parent = def.name = def.temps = def.locals = def.parser = def.proto_ivars = def.methods = def.ivars = def.args = def.queue = def.unique = def.while_stack = def.identity = def.uses_block = nil;

      TargetScope.$attr_accessor("parent");

      TargetScope.$attr_accessor("name");

      TargetScope.$attr_accessor("block_name");

      TargetScope.$attr_reader("scope_name");

      TargetScope.$attr_reader("ivars");

      TargetScope.$attr_reader("type");

      TargetScope.$attr_accessor("defines_defn");

      TargetScope.$attr_accessor("defines_defs");

      TargetScope.$attr_accessor("mid");

      TargetScope.$attr_accessor("defs");

      TargetScope.$attr_reader("methods");

      TargetScope.$attr_accessor("uses_super");

      TargetScope.$attr_accessor("uses_zuper");

      TargetScope.$attr_accessor("catch_return");

      def.$initialize = function(type, parser) {
        
        this.parser = parser;
        this.type = type;
        this.locals = [];
        this.temps = [];
        this.args = [];
        this.ivars = [];
        this.parent = nil;
        this.queue = [];
        this.unique = "a";
        this.while_stack = [];
        this.defines_defs = false;
        this.defines_defn = false;
        this.methods = [];
        this.uses_block = false;
        return this.proto_ivars = [];
      };

      def['$class_scope?'] = function() {
        var $a;
        return ((($a = this.type['$==']("class")) !== false && $a !== nil) ? $a : this.type['$==']("module"));
      };

      def['$class?'] = function() {
        
        return this.type['$==']("class");
      };

      def['$module?'] = function() {
        
        return this.type['$==']("module");
      };

      def['$sclass?'] = function() {
        
        return this.type['$==']("sclass");
      };

      def['$top?'] = function() {
        
        return this.type['$==']("top");
      };

      def['$iter?'] = function() {
        
        return this.type['$==']("iter");
      };

      def['$def?'] = function() {
        
        return this.type['$==']("def");
      };

      def['$def_in_class?'] = function() {
        var $a;
        return ($a = ($a = ($a = ($a = this.defs, ($a === nil || $a === false)), $a !== false && $a !== nil ? this.type['$==']("def") : $a), $a !== false && $a !== nil ? this.parent : $a), $a !== false && $a !== nil ? this.parent['$class?']() : $a);
      };

      def.$proto = function() {
        
        return "def";
      };

      def['$should_donate?'] = function() {
        var $a;
        return ((($a = this.type['$==']("module")) !== false && $a !== nil) ? $a : this.name.$to_s()['$==']("Object"));
      };

      def.$to_vars = function() {
        var $a, TMP_1, $b, $c, TMP_2, $d, $e, TMP_3, vars = nil, current_self = nil, iv = nil, indent = nil, res = nil, str = nil, pvars = nil, result = nil;
        vars = this.temps.$dup();
        ($a = vars).$push.apply($a, [].concat(($b = ($c = this.locals).$map, $b._p = (TMP_1 = function(l) {

          var self = TMP_1._s || this;
          if (l == null) l = nil;
          
          return "" + (l) + " = nil"
        }, TMP_1._s = this, TMP_1), $b).call($c)));
        current_self = this.parser.$current_self();
        iv = ($b = ($d = this.$ivars()).$map, $b._p = (TMP_2 = function(ivar) {

          var self = TMP_2._s || this;
          if (ivar == null) ivar = nil;
          
          return "if (" + (current_self) + (ivar) + " == null) " + (current_self) + (ivar) + " = nil;\n"
        }, TMP_2._s = this, TMP_2), $b).call($d);
        indent = this.parser.$parser_indent();
        res = (function() { if (($b = vars['$empty?']()) !== false && $b !== nil) {
          return ""
        } else {
          return "var " + (vars.$join(", ")) + ";"
        }; return nil; }).call(this);
        str = (function() { if (($b = this.$ivars()['$empty?']()) !== false && $b !== nil) {
          return res
        } else {
          return "" + (res) + "\n" + (indent) + (iv.$join(indent))
        }; return nil; }).call(this);
        if (($b = ($e = this['$class?'](), $e !== false && $e !== nil ? ($e = this.proto_ivars['$empty?'](), ($e === nil || $e === false)) : $e)) !== false && $b !== nil) {
          pvars = ($b = ($e = this.proto_ivars).$map, $b._p = (TMP_3 = function(i) {

            var self = TMP_3._s || this;
            if (i == null) i = nil;
            
            return "" + (self.$proto()) + (i)
          }, TMP_3._s = this, TMP_3), $b).call($e).$join(" = ");
          result = "%s\n%s%s = nil;"['$%']([str, indent, pvars]);
        } else {
          result = str
        };
        return this.$f(result);
      };

      def.$f = function(code, sexp) {
        if (sexp == null) {
          sexp = nil
        }
        return this.parser.$f(code);
      };

      def.$to_donate_methods = function() {
        var $a, $b;
        if (($a = ($b = this['$should_donate?'](), $b !== false && $b !== nil ? ($b = this.methods['$empty?'](), ($b === nil || $b === false)) : $b)) !== false && $a !== nil) {
          return this.$f(("%s;$opal.donate(" + (this.name) + ", [%s]);")['$%']([this.parser.$parser_indent(), ($a = ($b = this.methods).$map, $a._p = "inspect".$to_proc(), $a).call($b).$join(", ")]))
        } else {
          return this.$f("")
        };
      };

      def.$add_ivar = function(ivar) {
        var $a;
        if (($a = this['$def_in_class?']()) !== false && $a !== nil) {
          return this.parent.$add_proto_ivar(ivar)
        } else {
          if (($a = this.ivars['$include?'](ivar)) !== false && $a !== nil) {
            return nil
          } else {
            return this.ivars['$<<'](ivar)
          }
        };
      };

      def.$add_proto_ivar = function(ivar) {
        var $a;
        if (($a = this.proto_ivars['$include?'](ivar)) !== false && $a !== nil) {
          return nil
        } else {
          return this.proto_ivars['$<<'](ivar)
        };
      };

      def.$add_arg = function(arg) {
        var $a;
        if (($a = this.args['$include?'](arg)) === false || $a === nil) {
          this.args['$<<'](arg)
        };
        return arg;
      };

      def.$add_local = function(local) {
        var $a;
        if (($a = this['$has_local?'](local)) !== false && $a !== nil) {
          return nil
        };
        return this.locals['$<<'](local);
      };

      def['$has_local?'] = function(local) {
        var $a, $b;
        if (($a = ((($b = this.locals['$include?'](local)) !== false && $b !== nil) ? $b : this.args['$include?'](local))) !== false && $a !== nil) {
          return true
        };
        if (($a = ($b = this.parent, $b !== false && $b !== nil ? this.type['$==']("iter") : $b)) !== false && $a !== nil) {
          return this.parent['$has_local?'](local)
        };
        return false;
      };

      def.$add_temp = function(tmps) {
        var $a;tmps = $slice.call(arguments, 0);
        return ($a = this.temps).$push.apply($a, [].concat(tmps));
      };

      def['$has_temp?'] = function(tmp) {
        
        return this.temps['$include?'](tmp);
      };

      def.$new_temp = function() {
        var $a, tmp = nil;
        if (($a = this.queue['$empty?']()) === false || $a === nil) {
          return this.queue.$pop()
        };
        tmp = this.$next_temp();
        this.temps['$<<'](tmp);
        return tmp;
      };

      def.$next_temp = function() {
        var tmp = nil;
        tmp = "$" + (this.unique);
        this.unique = this.unique.$succ();
        return tmp;
      };

      def.$queue_temp = function(name) {
        
        return this.queue['$<<'](name);
      };

      def.$push_while = function() {
        var info = nil;
        info = $hash2([], {});
        this.while_stack.$push(info);
        return info;
      };

      def.$pop_while = function() {
        
        return this.while_stack.$pop();
      };

      def['$in_while?'] = function() {
        var $a;
        return ($a = this.while_stack['$empty?'](), ($a === nil || $a === false));
      };

      def['$uses_block!'] = function() {
        var $a, $b;
        if (($a = (($b = this.type['$==']("iter")) ? this.parent : $b)) !== false && $a !== nil) {
          return this.parent['$uses_block!']()
        } else {
          this.uses_block = true;
          return this['$identify!']();
        };
      };

      def['$identify!'] = function() {
        var $a;
        if (($a = this.identity) !== false && $a !== nil) {
          return this.identity
        };
        this.identity = this.parser.$unique_temp();
        if (($a = this.parent) !== false && $a !== nil) {
          this.parent.$add_temp(this.identity)
        };
        return this.identity;
      };

      def.$identity = function() {
        
        return this.identity;
      };

      def.$find_parent_def = function() {
        var $a, $b, scope = nil;
        scope = this;
        while (($b = scope = scope.$parent()) !== false && $b !== nil){if (($b = scope['$def?']()) !== false && $b !== nil) {
          return scope
        }};
        return nil;
      };

      def.$get_super_chain = function() {
        var $a, $b, chain = nil, scope = nil, defn = nil, mid = nil;
        $a = [[], this, "null", "null"], chain = $a[0], scope = $a[1], defn = $a[2], mid = $a[3];
        while (scope !== false && scope !== nil){if (scope.$type()['$==']("iter")) {
          chain['$<<'](scope['$identify!']());
          if (($b = scope.$parent()) !== false && $b !== nil) {
            scope = scope.$parent()
          };
        } else {
          if (scope.$type()['$==']("def")) {
            defn = scope['$identify!']();
            mid = "'$" + (scope.$mid()) + "'";
            break;;
          } else {
            break;
          }
        }};
        return [chain, defn, mid];
      };

      def['$uses_block?'] = function() {
        
        return this.uses_block;
      };

      return nil;
    })(Opal, null)

  })(self)
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$attr_accessor']);
  return (function($base, $super){
    function Array() {};
    Array = $klass($base, $super, "Array", Array);

    var def = Array._proto, $scope = Array._scope;

    Array.$attr_accessor("line");

    return Array.$attr_accessor("end_line");
  })(self, null)
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass;

  $opal.add_stubs(['$attr_reader', '$attr_accessor', '$==', '$<<', '$include?', '$has_local?']);
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function LexerScope() {};
      LexerScope = $klass($base, $super, "LexerScope", LexerScope);

      var def = LexerScope._proto, $scope = LexerScope._scope;
      def.locals = def.parent = def.block = nil;

      LexerScope.$attr_reader("locals");

      LexerScope.$attr_accessor("parent");

      def.$initialize = function(type) {
        
        this.block = type['$==']("block");
        this.locals = [];
        return this.parent = nil;
      };

      def.$add_local = function(local) {
        
        return this.locals['$<<'](local);
      };

      def['$has_local?'] = function(local) {
        var $a, $b;
        if (($a = this.locals['$include?'](local)) !== false && $a !== nil) {
          return true
        };
        if (($a = ($b = this.parent, $b !== false && $b !== nil ? this.block : $b)) !== false && $a !== nil) {
          return this.parent['$has_local?'](local)
        };
        return false;
      };

      return nil;
    })(Opal, null)

  })(self)
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $range = $opal.range;

  $opal.add_stubs(['$s', '$<<', '$==', '$size', '$[]', '$line=', '$line', '$each', '$to_sym', '$end_line=', '$add_local', '$to_s', '$empty?', '$is_a?', '$[]=', '$length', '$new_gettable', '$===', '$new_call', '$last', '$raise', '$has_local?', '$>', '$new', '$first']);
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function Grammar() {};
      Grammar = $klass($base, $super, "Grammar", Grammar);

      var def = Grammar._proto, $scope = Grammar._scope;
      def.line = def.scope = nil;

      def.$new_block = function(stmt) {
        var s = nil;if (stmt == null) {
          stmt = nil
        }
        s = this.$s("block");
        if (stmt !== false && stmt !== nil) {
          s['$<<'](stmt)
        };
        return s;
      };

      def.$new_compstmt = function(block) {
        
        if (block.$size()['$=='](1)) {
          return nil
        } else {
          if (block.$size()['$=='](2)) {
            return block['$[]'](1)
          } else {
            block['$line='](block['$[]'](1).$line());
            return block;
          }
        };
      };

      def.$new_body = function(compstmt, res, els, ens) {
        var $a, TMP_1, $b, s = nil;
        s = ((($a = compstmt) !== false && $a !== nil) ? $a : this.$s("block"));
        if (compstmt !== false && compstmt !== nil) {
          s['$line='](compstmt.$line())
        };
        if (res !== false && res !== nil) {
          s = this.$s("rescue", s);
          ($a = ($b = res).$each, $a._p = (TMP_1 = function(r) {

            var self = TMP_1._s || this;
            if (r == null) r = nil;
            
            return s['$<<'](r)
          }, TMP_1._s = this, TMP_1), $a).call($b);
          if (els !== false && els !== nil) {
            s['$<<'](els)
          };
        };
        if (ens !== false && ens !== nil) {
          return this.$s("ensure", s, ens)
        } else {
          return s
        };
      };

      def.$new_defn = function(line, name, args, body) {
        var $a, $b, scope = nil, s = nil;
        if (($a = ($b = body['$[]'](0)['$==']("block"), ($b === nil || $b === false))) !== false && $a !== nil) {
          body = this.$s("block", body)
        };
        scope = this.$s("scope", body);
        if (body.$size()['$=='](1)) {
          body['$<<'](this.$s("nil"))
        };
        scope['$line='](body.$line());
        args['$line='](line);
        s = this.$s("defn", name.$to_sym(), args, scope);
        s['$line='](line);
        s['$end_line='](this.line);
        return s;
      };

      def.$new_defs = function(line, recv, name, args, body) {
        var scope = nil, s = nil;
        scope = this.$s("scope", body);
        scope['$line='](body.$line());
        s = this.$s("defs", recv, name.$to_sym(), args, scope);
        s['$line='](line);
        s['$end_line='](this.line);
        return s;
      };

      def.$new_class = function(path, sup, body) {
        var $a, scope = nil, s = nil;
        scope = this.$s("scope");
        if (($a = body.$size()['$=='](1)) === false || $a === nil) {
          scope['$<<'](body)
        };
        scope['$line='](body.$line());
        s = this.$s("class", path, sup, scope);
        return s;
      };

      def.$new_sclass = function(expr, body) {
        var scope = nil, s = nil;
        scope = this.$s("scope");
        scope['$<<'](body);
        scope['$line='](body.$line());
        s = this.$s("sclass", expr, scope);
        return s;
      };

      def.$new_module = function(path, body) {
        var $a, scope = nil, s = nil;
        scope = this.$s("scope");
        if (($a = body.$size()['$=='](1)) === false || $a === nil) {
          scope['$<<'](body)
        };
        scope['$line='](body.$line());
        s = this.$s("module", path, scope);
        return s;
      };

      def.$new_iter = function(call, args, body) {
        var s = nil;
        s = this.$s("iter", call, args);
        if (body !== false && body !== nil) {
          s['$<<'](body)
        };
        s['$end_line='](this.line);
        return s;
      };

      def.$new_if = function(expr, stmt, tail) {
        var s = nil;
        s = this.$s("if", expr, stmt, tail);
        s['$line='](expr.$line());
        s['$end_line='](this.line);
        return s;
      };

      def.$new_args = function(norm, opt, rest, block) {
        var TMP_2, $a, $b, TMP_3, $c, res = nil, rest_str = nil;
        res = this.$s("args");
        if (norm !== false && norm !== nil) {
          ($a = ($b = norm).$each, $a._p = (TMP_2 = function(arg) {

            var self = TMP_2._s || this;
            if (self.scope == null) self.scope = nil;

            if (arg == null) arg = nil;
            
            self.scope.$add_local(arg);
            return res['$<<'](arg);
          }, TMP_2._s = this, TMP_2), $a).call($b)
        };
        if (opt !== false && opt !== nil) {
          ($a = ($c = opt['$[]']($range(1, -1, false))).$each, $a._p = (TMP_3 = function(_opt) {

            var self = TMP_3._s || this;
            if (_opt == null) _opt = nil;
            
            return res['$<<'](_opt['$[]'](1))
          }, TMP_3._s = this, TMP_3), $a).call($c)
        };
        if (rest !== false && rest !== nil) {
          res['$<<'](rest);
          rest_str = rest.$to_s()['$[]']($range(1, -1, false));
          if (($a = rest_str['$empty?']()) === false || $a === nil) {
            this.scope.$add_local(rest_str.$to_sym())
          };
        };
        if (block !== false && block !== nil) {
          res['$<<'](block);
          this.scope.$add_local(block.$to_s()['$[]']($range(1, -1, false)).$to_sym());
        };
        if (opt !== false && opt !== nil) {
          res['$<<'](opt)
        };
        return res;
      };

      def.$new_block_args = function(norm, opt, rest, block) {
        var TMP_4, $a, $b, TMP_5, $c, $d, res = nil, r = nil, b = nil, args = nil;
        res = this.$s("array");
        if (norm !== false && norm !== nil) {
          ($a = ($b = norm).$each, $a._p = (TMP_4 = function(arg) {

            var self = TMP_4._s || this, $a;
            if (self.scope == null) self.scope = nil;

            if (arg == null) arg = nil;
            
            if (($a = arg['$is_a?']($scope.Symbol)) !== false && $a !== nil) {
              self.scope.$add_local(arg);
              return res['$<<'](self.$s("lasgn", arg));
            } else {
              return res['$<<'](arg)
            }
          }, TMP_4._s = this, TMP_4), $a).call($b)
        };
        if (opt !== false && opt !== nil) {
          ($a = ($c = opt['$[]']($range(1, -1, false))).$each, $a._p = (TMP_5 = function(_opt) {

            var self = TMP_5._s || this;
            if (_opt == null) _opt = nil;
            
            return res['$<<'](self.$s("lasgn", _opt['$[]'](1)))
          }, TMP_5._s = this, TMP_5), $a).call($c)
        };
        if (rest !== false && rest !== nil) {
          r = rest.$to_s()['$[]']($range(1, -1, false)).$to_sym();
          res['$<<'](this.$s("splat", this.$s("lasgn", r)));
          this.scope.$add_local(r);
        };
        if (block !== false && block !== nil) {
          b = block.$to_s()['$[]']($range(1, -1, false)).$to_sym();
          res['$<<'](this.$s("block_pass", this.$s("lasgn", b)));
          this.scope.$add_local(b);
        };
        if (opt !== false && opt !== nil) {
          res['$<<'](opt)
        };
        args = (function() { if (($a = (($d = res.$size()['$=='](2)) ? norm : $d)) !== false && $a !== nil) {
          return res['$[]'](1)
        } else {
          return this.$s("masgn", res)
        }; return nil; }).call(this);
        if (args['$[]'](0)['$==']("array")) {
          return this.$s("masgn", args)
        } else {
          return args
        };
      };

      def.$new_call = function(recv, meth, args) {
        var $a, call = nil;if (args == null) {
          args = nil
        }
        call = this.$s("call", recv, meth);
        if (($a = args) === false || $a === nil) {
          args = this.$s("arglist")
        };
        if (args['$[]'](0)['$==']("array")) {
          args['$[]='](0, "arglist")
        };
        call['$<<'](args);
        if (recv !== false && recv !== nil) {
          call['$line='](recv.$line())
        } else {
          if (($a = args['$[]'](1)) !== false && $a !== nil) {
            call['$line='](args['$[]'](1).$line())
          }
        };
        if (args.$length()['$=='](1)) {
          args['$line='](call.$line())
        } else {
          args['$line='](args['$[]'](1).$line())
        };
        return call;
      };

      def.$add_block_pass = function(arglist, block) {
        
        if (block !== false && block !== nil) {
          arglist['$<<'](block)
        };
        return arglist;
      };

      def.$new_op_asgn = function(op, lhs, rhs) {
        var $case = nil, result = nil;
        $case = op;if ("||"['$===']($case)) {
        result = this.$s("op_asgn_or", this.$new_gettable(lhs));
        result['$<<'](lhs['$<<'](rhs));
        }else if ("&&"['$===']($case)) {
        result = this.$s("op_asgn_and", this.$new_gettable(lhs));
        result['$<<'](lhs['$<<'](rhs));
        }else {result = lhs;
        result['$<<'](this.$new_call(this.$new_gettable(lhs), op, this.$s("arglist", rhs)));};
        result['$line='](lhs.$line());
        return result;
      };

      def.$new_assign = function(lhs, rhs) {
        var $case = nil;
        return (function() { $case = lhs['$[]'](0);if ("iasgn"['$===']($case) || "cdecl"['$===']($case) || "lasgn"['$===']($case) || "gasgn"['$===']($case) || "cvdecl"['$===']($case) || "nth_ref"['$===']($case)) {
        lhs['$<<'](rhs);
        return lhs;
        }else if ("call"['$===']($case) || "attrasgn"['$===']($case)) {
        lhs.$last()['$<<'](rhs);
        return lhs;
        }else if ("colon2"['$===']($case)) {
        lhs['$<<'](rhs);
        lhs['$[]='](0, "casgn");
        return lhs;
        }else {return this.$raise("Bad lhs for new_assign: " + (lhs['$[]'](0)))} }).call(this);
      };

      def.$new_assignable = function(ref) {
        var $a, $case = nil;
        $case = ref['$[]'](0);if ("ivar"['$===']($case)) {
        ref['$[]='](0, "iasgn")
        }else if ("const"['$===']($case)) {
        ref['$[]='](0, "cdecl")
        }else if ("identifier"['$===']($case)) {
        if (($a = this.scope['$has_local?'](ref['$[]'](1))) === false || $a === nil) {
          this.scope.$add_local(ref['$[]'](1))
        };
        ref['$[]='](0, "lasgn");
        }else if ("gvar"['$===']($case)) {
        ref['$[]='](0, "gasgn")
        }else if ("cvar"['$===']($case)) {
        ref['$[]='](0, "cvdecl")
        }else {this.$raise("Bad new_assignable type: " + (ref['$[]'](0)))};
        return ref;
      };

      def.$new_gettable = function(ref) {
        var res = nil, $case = nil;
        res = (function() { $case = ref['$[]'](0);if ("lasgn"['$===']($case)) {
        return this.$s("lvar", ref['$[]'](1))
        }else if ("iasgn"['$===']($case)) {
        return this.$s("ivar", ref['$[]'](1))
        }else if ("gasgn"['$===']($case)) {
        return this.$s("gvar", ref['$[]'](1))
        }else if ("cvdecl"['$===']($case)) {
        return this.$s("cvar", ref['$[]'](1))
        }else {return this.$raise("Bad new_gettable ref: " + (ref['$[]'](0)))} }).call(this);
        res['$line='](ref.$line());
        return res;
      };

      def.$new_var_ref = function(ref) {
        var $a, $case = nil;
        return (function() { $case = ref['$[]'](0);if ("self"['$===']($case) || "nil"['$===']($case) || "true"['$===']($case) || "false"['$===']($case) || "line"['$===']($case) || "file"['$===']($case)) {
        return ref
        }else if ("const"['$===']($case)) {
        return ref
        }else if ("ivar"['$===']($case) || "gvar"['$===']($case) || "cvar"['$===']($case)) {
        return ref
        }else if ("int"['$===']($case)) {
        return ref
        }else if ("str"['$===']($case)) {
        return ref
        }else if ("identifier"['$===']($case)) {
        if (($a = this.scope['$has_local?'](ref['$[]'](1))) !== false && $a !== nil) {
          return this.$s("lvar", ref['$[]'](1))
        } else {
          return this.$s("call", nil, ref['$[]'](1), this.$s("arglist"))
        }
        }else {return this.$raise("Bad var_ref type: " + (ref['$[]'](0)))} }).call(this);
      };

      def.$new_super = function(args) {
        var $a;
        args = ((($a = args) !== false && $a !== nil) ? $a : this.$s("arglist"))['$[]']($range(1, -1, false));
        return ($a = this).$s.apply($a, ["super"].concat(args));
      };

      def.$new_yield = function(args) {
        var $a;
        args = ((($a = args) !== false && $a !== nil) ? $a : this.$s("arglist"))['$[]']($range(1, -1, false));
        return ($a = this).$s.apply($a, ["yield"].concat(args));
      };

      def.$new_xstr = function(str) {
        var $a, $case = nil;
        if (($a = str) === false || $a === nil) {
          return this.$s("xstr", "")
        };
        $case = str['$[]'](0);if ("str"['$===']($case)) {
        str['$[]='](0, "xstr")
        }else if ("dstr"['$===']($case)) {
        str['$[]='](0, "dxstr")
        }else if ("evstr"['$===']($case)) {
        str = this.$s("dxstr", "", str)
        };
        return str;
      };

      def.$new_dsym = function(str) {
        var $a, $case = nil;
        if (($a = str) === false || $a === nil) {
          return this.$s("nil")
        };
        $case = str['$[]'](0);if ("str"['$===']($case)) {
        str['$[]='](0, "sym");
        str['$[]='](1, str['$[]'](1).$to_sym());
        }else if ("dstr"['$===']($case)) {
        str['$[]='](0, "dsym")
        };
        return str;
      };

      def.$new_str = function(str) {
        var $a, $b;
        if (($a = str) === false || $a === nil) {
          return this.$s("str", "")
        };
        if (($a = ($b = (($b = str.$size()['$=='](3)) ? str['$[]'](1)['$==']("") : $b), $b !== false && $b !== nil ? str['$[]'](0)['$==']("str") : $b)) !== false && $a !== nil) {
          return str['$[]'](2)
        } else {
          if (($a = (($b = str['$[]'](0)['$==']("str")) ? str.$size()['$>'](3) : $b)) !== false && $a !== nil) {
            str['$[]='](0, "dstr");
            return str;
          } else {
            if (str['$[]'](0)['$==']("evstr")) {
              return this.$s("dstr", "", str)
            } else {
              return str
            }
          }
        };
      };

      def.$new_regexp = function(reg, ending) {
        var $a, $case = nil;
        if (($a = reg) === false || $a === nil) {
          return this.$s("regexp", /^/)
        };
        return (function() { $case = reg['$[]'](0);if ("str"['$===']($case)) {
        return this.$s("regexp", $scope.Regexp.$new(reg['$[]'](1), ending))
        }else if ("evstr"['$===']($case)) {
        return this.$s("dregx", "", reg)
        }else if ("dstr"['$===']($case)) {
        reg['$[]='](0, "dregx");
        return reg;
        }else { return nil } }).call(this);
      };

      def.$str_append = function(str, str2) {
        var $a;
        if (($a = str) === false || $a === nil) {
          return str2
        };
        if (($a = str2) === false || $a === nil) {
          return str
        };
        if (str.$first()['$==']("evstr")) {
          str = this.$s("dstr", "", str)
        } else {
          if (str.$first()['$==']("str")) {
            str = this.$s("dstr", str['$[]'](1))
          }
        };
        str['$<<'](str2);
        return str;
      };

      return nil;
    })(Opal, ($scope.Racc)._scope.Parser)

  })(self)
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $klass = $opal.klass, $hash2 = $opal.hash2, $gvars = $opal.gvars, $range = $opal.range;

  $opal.add_stubs(['$attr_reader', '$to_s', '$line', '$inspect', '$parse', '$new', '$[]', '$==', '$flatten', '$top', '$unshift', '$f', '$version_comment', '$join', '$map', '$to_proc', '$=~', '$gsub', '$[]=', '$to_sym', '$sub', '$each', '$split', '$raise', '$warn', '$line=', '$alias_method', '$+', '$include?', '$s', '$process', '$is_a?', '$indent', '$add_temp', '$defines_defn', '$keys', '$to_vars', '$in_scope', '$parent=', '$tap', '$new_temp', '$queue_temp', '$push_while', '$pop_while', '$in_while?', '$shift', '$respond_to?', '$__send__', '$returns', '$first', '$===', '$>', '$length', '$<<', '$empty?', '$class_scope?', '$find_inline_yield', '$expression?', '$<', '$index', '$each_with_index', '$has_temp?', '$uses_block!', '$block_name', '$find_parent_def', '$mid_to_jsid', '$current_self', '$with_temp', '$last', '$pop', '$identify!', '$js_block_args', '$find', '$add_arg', '$-', '$block_name=', '$lvar_to_js', '$next_temp', '$top?', '$intern', '$js_block_given', '$any?', '$insert', '$name=', '$proto', '$to_donate_methods', '$js_def', '$end_line', '$defines_defs=', '$defines_defn=', '$start_with?', '$arity_check', '$mid=', '$defs=', '$identity', '$uses_block?', '$push', '$uses_super', '$uses_zuper', '$catch_return', '$name', '$class?', '$methods', '$size', '$-@', '$iter?', '$even?', '$all?', '$times', '$js_truthy', '$in_while', '$type', '$%', '$>=', '$add_local', '$add_ivar', '$catch_return=', '$def?', '$js_falsy', '$dup', '$js_truthy_optimize', '$handle_block_given', '$handle_yield_call', '$process_arglist', '$error', '$in_case', '$js_super', '$uses_zuper=', '$def_in_class?', '$mid', '$uses_super=', '$unique_temp', '$parent', '$defs', '$get_super_chain']);
  ;
  ;
  ;
  ;
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    (function($base, $super){
      function Parser() {};
      Parser = $klass($base, $super, "Parser", Parser);

      var def = Parser._proto, $scope = Parser._scope, TMP_6, TMP_8, TMP_9, TMP_10, TMP_11;
      def.file = def.sexp = def.fragments = def.line = def.indent = def.unique = def.method_missing = def.method_calls = def.scope = def.case_stmt = def.helpers = def.irb_vars = def.arity_check = def.const_missing = def.while_loop = def.space = nil;

      (function($base, $super){
        function Fragment() {};
        Fragment = $klass($base, $super, "Fragment", Fragment);

        var def = Fragment._proto, $scope = Fragment._scope;
        def.sexp = def.code = nil;

        Fragment.$attr_reader("code");

        def.$initialize = function(code, sexp) {
          if (sexp == null) {
            sexp = nil
          }
          this.code = code.$to_s();
          return this.sexp = sexp;
        };

        def.$to_code = function() {
          var $a;
          if (($a = this.sexp) !== false && $a !== nil) {
            return "/*:" + (this.sexp.$line()) + "*/" + (this.code)
          } else {
            return this.code
          };
        };

        def.$inspect = function() {
          
          return "f(" + (this.code.$inspect()) + ")";
        };

        def.$line = function() {
          var $a;
          if (($a = this.sexp) !== false && $a !== nil) {
            return this.sexp.$line()
          } else {
            return nil
          };
        };

        return nil;
      })(Parser, null);

      $scope.INDENT = "  ";

      $scope.LEVEL = ["stmt", "stmt_closure", "list", "expr", "recv"];

      $scope.COMPARE = ["<", ">", "<=", ">="];

      $scope.RESERVED = ["break", "case", "catch", "continue", "debugger", "default", "delete", "do", "else", "finally", "for", "function", "if", "in", "instanceof", "new", "return", "switch", "this", "throw", "try", "typeof", "var", "let", "void", "while", "with", "class", "enum", "export", "extends", "import", "super", "true", "false", "native", "const", "static"];

      $scope.STATEMENTS = ["xstr", "dxstr"];

      Parser.$attr_reader("result");

      Parser.$attr_reader("fragments");

      def.$parse = function(source, options) {
        var $a, $b;if (options == null) {
          options = $hash2([], {})
        }
        this.sexp = $scope.Grammar.$new().$parse(source, options['$[]']("file"));
        this.line = 1;
        this.indent = "";
        this.unique = 0;
        this.helpers = $hash2(["breaker", "slice"], {"breaker": true, "slice": true});
        this.file = ((($a = options['$[]']("file")) !== false && $a !== nil) ? $a : "(file)");
        this.source_file = ((($a = options['$[]']("source_file")) !== false && $a !== nil) ? $a : this.file);
        this.method_missing = ($a = options['$[]']("method_missing")['$=='](false), ($a === nil || $a === false));
        this.arity_check = options['$[]']("arity_check");
        this.const_missing = options['$[]']("const_missing")['$=='](true);
        this.irb_vars = options['$[]']("irb")['$=='](true);
        this.method_calls = $hash2([], {});
        this.fragments = this.$top(this.sexp).$flatten();
        this.fragments.$unshift(this.$f(this.$version_comment()));
        return this.result = ($a = ($b = this.fragments).$map, $a._p = "code".$to_proc(), $a).call($b).$join("");
      };

      def.$version_comment = function() {
        
        return "/* Generated by Opal " + (($scope.Opal)._scope.VERSION) + " */\n";
      };

      def.$source_map = function() {
        
        return ($scope.Opal)._scope.SourceMap.$new(this.fragments, "(file)");
      };

      def.$extract_parser_options = function(content) {
        var $a, TMP_1, $b, $c, $d, result = nil;
        result = $hash2([], {});
        if (($a = /^#\ opal\:(.*)/['$=~'](content)) !== false && $a !== nil) {
          ($a = ($b = ($c = ($d = $gvars["~"]['$[]'](1).$split(",")).$map, $c._p = "strip".$to_proc(), $c).call($d)).$each, $a._p = (TMP_1 = function(opt) {

            var self = TMP_1._s || this, $a;
            if (opt == null) opt = nil;
            
            if (opt['$==']("")) {
              return nil;
            };
            opt = opt.$gsub("-", "_");
            if (($a = opt['$=~'](/no_/)) !== false && $a !== nil) {
              return result['$[]='](opt.$sub(/no_/, "").$to_sym(), false)
            } else {
              return result['$[]='](opt.$to_sym(), true)
            };
          }, TMP_1._s = this, TMP_1), $a).call($b)
        };
        return result;
      };

      def.$error = function(msg) {
        
        return this.$raise($scope.SyntaxError, "" + (msg) + " :" + (this.file) + ":" + (this.line));
      };

      def.$warning = function(msg) {
        
        return this.$warn("" + (msg) + " :" + (this.file) + ":" + (this.line));
      };

      def.$parser_indent = function() {
        
        return this.indent;
      };

      def.$s = function(parts) {
        var sexp = nil;parts = $slice.call(arguments, 0);
        sexp = $scope.Array.$new(parts);
        sexp['$line='](this.line);
        return sexp;
      };

      def.$f = function(code, sexp) {
        if (sexp == null) {
          sexp = nil
        }
        return $scope.Fragment.$new(code, sexp);
      };

      Parser.$alias_method("fragment", "f");

      def.$mid_to_jsid = function(mid) {
        var $a;
        if (($a = /\=|\+|\-|\*|\/|\!|\?|\<|\>|\&|\||\^|\%|\~|\[/['$=~'](mid.$to_s())) !== false && $a !== nil) {
          return "['$" + (mid) + "']"
        } else {
          return ".$"['$+'](mid)
        };
      };

      def.$lvar_to_js = function(var$) {
        var $a;
        if (($a = $scope.RESERVED['$include?'](var$.$to_s())) !== false && $a !== nil) {
          var$ = "" + (var$) + "$"
        };
        return var$.$to_sym();
      };

      def.$unique_temp = function() {
        
        return "TMP_" + (this.unique = this.unique['$+'](1));
      };

      def.$top = function(sexp, options) {
        var $a, TMP_2, $b, TMP_5, $c, code = nil, vars = nil, stubs = nil;if (options == null) {
          options = $hash2([], {})
        }
        $a = [nil, nil], code = $a[0], vars = $a[1];
        if (($a = sexp) === false || $a === nil) {
          sexp = this.$s("nil")
        };
        ($a = ($b = this).$in_scope, $a._p = (TMP_2 = function() {

          var self = TMP_2._s || this, TMP_3, $a, $b, TMP_4, $c;
          if (self.scope == null) self.scope = nil;
          if (self.helpers == null) self.helpers = nil;
          if (self.irb_vars == null) self.irb_vars = nil;

          
          ($a = ($b = self).$indent, $a._p = (TMP_3 = function() {

            var self = TMP_3._s || this, $a, scope = nil;
            if (self.indent == null) self.indent = nil;

            
            scope = self.$s("scope", sexp);
            scope['$line='](sexp.$line());
            code = self.$process(scope, "stmt");
            if (($a = code['$is_a?']($scope.Array)) === false || $a === nil) {
              code = [code]
            };
            return code.$unshift(self.$f(self.indent, sexp));
          }, TMP_3._s = self, TMP_3), $a).call($b);
          self.scope.$add_temp("self = $opal.top");
          self.scope.$add_temp("$scope = $opal");
          self.scope.$add_temp("nil = $opal.nil");
          if (($a = self.scope.$defines_defn()) !== false && $a !== nil) {
            self.scope.$add_temp("def = $opal.Object._proto")
          };
          ($a = ($c = self.helpers.$keys()).$each, $a._p = (TMP_4 = function(h) {

            var self = TMP_4._s || this;
            if (self.scope == null) self.scope = nil;

            if (h == null) h = nil;
            
            return self.scope.$add_temp("$" + (h) + " = $opal." + (h))
          }, TMP_4._s = self, TMP_4), $a).call($c);
          vars = [self.$f($scope.INDENT, sexp), self.scope.$to_vars(), self.$f("\n", sexp)];
          if (($a = self.irb_vars) !== false && $a !== nil) {
            return code.$unshift(self.$f("if (!$opal.irb_vars) { $opal.irb_vars = {}; }\n", sexp))
          } else {
            return nil
          };
        }, TMP_2._s = this, TMP_2), $a).call($b, "top");
        if (($a = this.method_missing) !== false && $a !== nil) {
          stubs = this.$f(("\n" + ($scope.INDENT) + "$opal.add_stubs([")['$+'](($a = ($c = this.method_calls.$keys()).$map, $a._p = (TMP_5 = function(k) {

            var self = TMP_5._s || this;
            if (k == null) k = nil;
            
            return "'$" + (k) + "'"
          }, TMP_5._s = this, TMP_5), $a).call($c).$join(", "))['$+']("]);\n"), sexp)
        } else {
          stubs = []
        };
        return [this.$f("(function($opal) {\n", sexp), vars, stubs, code, this.$f("\n})(Opal);\n", sexp)];
      };

      def.$in_scope = TMP_6 = function(type) {
        var TMP_7, $a, $b, $iter = TMP_6._p, $yield = $iter || nil, parent = nil;TMP_6._p = null;
        if ($yield === nil) {
          return nil
        };
        parent = this.scope;
        this.scope = ($a = ($b = $scope.TargetScope.$new(type, this)).$tap, $a._p = (TMP_7 = function(s) {

          var self = TMP_7._s || this;
          if (s == null) s = nil;
          
          return s['$parent='](parent)
        }, TMP_7._s = this, TMP_7), $a).call($b);
        if ($opal.$yield1($yield, this.scope) === $breaker) return $breaker.$v;
        return this.scope = parent;
      };

      def.$indent = TMP_8 = function() {
        var $a, $iter = TMP_8._p, block = $iter || nil, indent = nil, res = nil;TMP_8._p = null;
        indent = this.indent;
        this.indent = this.indent['$+']($scope.INDENT);
        this.space = "\n" + (this.indent);
        res = ((($a = $opal.$yieldX(block, [])) === $breaker) ? $breaker.$v : $a);
        this.indent = indent;
        this.space = "\n" + (this.indent);
        return res;
      };

      def.$with_temp = TMP_9 = function() {
        var $a, $iter = TMP_9._p, block = $iter || nil, tmp = nil, res = nil;TMP_9._p = null;
        tmp = this.scope.$new_temp();
        res = ((($a = $opal.$yield1(block, tmp)) === $breaker) ? $breaker.$v : $a);
        this.scope.$queue_temp(tmp);
        return res;
      };

      def.$in_while = TMP_10 = function() {
        var $a, $iter = TMP_10._p, $yield = $iter || nil, result = nil;TMP_10._p = null;
        if ($yield === nil) {
          return nil
        };
        this.while_loop = this.scope.$push_while();
        result = ((($a = $opal.$yieldX($yield, [])) === $breaker) ? $breaker.$v : $a);
        this.scope.$pop_while();
        return result;
      };

      def.$in_case = TMP_11 = function() {
        var $iter = TMP_11._p, $yield = $iter || nil, old = nil;TMP_11._p = null;
        if ($yield === nil) {
          return nil
        };
        old = this.case_stmt;
        this.case_stmt = $hash2([], {});
        if ($opal.$yieldX($yield, []) === $breaker) return $breaker.$v;
        return this.case_stmt = old;
      };

      def['$in_while?'] = function() {
        
        return this.scope['$in_while?']();
      };

      def.$process = function(sexp, level) {
        var $a, type = nil, meth = nil;if (level == null) {
          level = "expr"
        }
        type = sexp.$shift();
        meth = "process_" + (type);
        if (($a = this['$respond_to?'](meth)) === false || $a === nil) {
          this.$raise("Unsupported sexp: " + (type))
        };
        this.line = sexp.$line();
        return this.$__send__(meth, sexp, level);
      };

      def.$returns = function(sexp) {
        var $a, $b, TMP_12, $case = nil;
        if (($a = sexp) === false || $a === nil) {
          return this.$returns(this.$s("nil"))
        };
        return (function() { $case = sexp.$first();if ("break"['$===']($case) || "next"['$===']($case) || "redo"['$===']($case)) {
        return sexp
        }else if ("yield"['$===']($case)) {
        sexp['$[]='](0, "returnable_yield");
        return sexp;
        }else if ("scope"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }else if ("block"['$===']($case)) {
        if (sexp.$length()['$>'](1)) {
          sexp['$[]='](-1, this.$returns(sexp['$[]'](-1)))
        } else {
          sexp['$<<'](this.$returns(this.$s("nil")))
        };
        return sexp;
        }else if ("when"['$===']($case)) {
        sexp['$[]='](2, this.$returns(sexp['$[]'](2)));
        return sexp;
        }else if ("rescue"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        if (($a = ($b = sexp['$[]'](2), $b !== false && $b !== nil ? sexp['$[]'](2)['$[]'](0)['$==']("resbody") : $b)) !== false && $a !== nil) {
          if (($a = sexp['$[]'](2)['$[]'](2)) !== false && $a !== nil) {
            sexp['$[]'](2)['$[]='](2, this.$returns(sexp['$[]'](2)['$[]'](2)))
          } else {
            sexp['$[]'](2)['$[]='](2, this.$returns(this.$s("nil")))
          }
        };
        return sexp;
        }else if ("ensure"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }else if ("begin"['$===']($case)) {
        sexp['$[]='](1, this.$returns(sexp['$[]'](1)));
        return sexp;
        }else if ("while"['$===']($case)) {
        return sexp
        }else if ("return"['$===']($case)) {
        return sexp
        }else if ("xstr"['$===']($case)) {
        if (($a = /return|;/['$=~'](sexp['$[]'](1))) === false || $a === nil) {
          sexp['$[]='](1, "return " + (sexp['$[]'](1)) + ";")
        };
        return sexp;
        }else if ("dxstr"['$===']($case)) {
        if (($a = /return|;|\n/['$=~'](sexp['$[]'](1))) === false || $a === nil) {
          sexp['$[]='](1, "return " + (sexp['$[]'](1)))
        };
        return sexp;
        }else if ("if"['$===']($case)) {
        sexp['$[]='](2, this.$returns(((($a = sexp['$[]'](2)) !== false && $a !== nil) ? $a : this.$s("nil"))));
        sexp['$[]='](3, this.$returns(((($a = sexp['$[]'](3)) !== false && $a !== nil) ? $a : this.$s("nil"))));
        return sexp;
        }else {return ($a = ($b = this.$s("js_return", sexp)).$tap, $a._p = (TMP_12 = function(s) {

          var self = TMP_12._s || this;
          if (s == null) s = nil;
          
          return s['$line='](sexp.$line())
        }, TMP_12._s = this, TMP_12), $a).call($b)} }).call(this);
      };

      def['$expression?'] = function(sexp) {
        var $a;
        return ($a = $scope.STATEMENTS['$include?'](sexp.$first()), ($a === nil || $a === false));
      };

      def.$process_block = function(sexp, level) {
        var $a, TMP_13, $b, result = nil, join = nil;
        if (($a = sexp['$empty?']()) !== false && $a !== nil) {
          return this.$process(this.$s("nil"))
        };
        result = [];
        join = (function() { if (($a = this.scope['$class_scope?']()) !== false && $a !== nil) {
          return "\n\n" + (this.indent)
        } else {
          return "\n" + (this.indent)
        }; return nil; }).call(this);
        ($a = ($b = sexp).$each, $a._p = (TMP_13 = function(stmt) {

          var self = TMP_13._s || this, $a, yasgn = nil, expr = nil;
          if (stmt == null) stmt = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(join, sexp))
          };
          if (($a = yasgn = self.$find_inline_yield(stmt)) !== false && $a !== nil) {
            result['$<<'](self.$process(yasgn, level))['$<<'](self.$f(";", yasgn))
          };
          ($a = expr = self['$expression?'](stmt), $a !== false && $a !== nil ? $scope.LEVEL.$index(level)['$<']($scope.LEVEL.$index("list")) : $a);
          result['$<<'](self.$process(stmt, level));
          if (expr !== false && expr !== nil) {
            return result['$<<'](self.$f(";", stmt))
          } else {
            return nil
          };
        }, TMP_13._s = this, TMP_13), $a).call($b);
        return result;
      };

      def.$find_inline_yield = function(stmt) {
        var $a, TMP_14, $b, TMP_15, $c, found = nil, $case = nil, arglist = nil;
        found = nil;
        $case = stmt.$first();if ("js_return"['$===']($case)) {
        if (($a = found = this.$find_inline_yield(stmt['$[]'](1))) !== false && $a !== nil) {
          found = found['$[]'](2)
        }
        }else if ("array"['$===']($case)) {
        ($a = ($b = stmt['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_14 = function(el, idx) {

          var self = TMP_14._s || this;
          if (el == null) el = nil;
          if (idx == null) idx = nil;
          
          if (el.$first()['$==']("yield")) {
            found = el;
            return stmt['$[]='](idx['$+'](1), self.$s("js_tmp", "$yielded"));
          } else {
            return nil
          }
        }, TMP_14._s = this, TMP_14), $a).call($b)
        }else if ("call"['$===']($case)) {
        arglist = stmt['$[]'](3);
        ($a = ($c = arglist['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_15 = function(el, idx) {

          var self = TMP_15._s || this;
          if (el == null) el = nil;
          if (idx == null) idx = nil;
          
          if (el.$first()['$==']("yield")) {
            found = el;
            return arglist['$[]='](idx['$+'](1), self.$s("js_tmp", "$yielded"));
          } else {
            return nil
          }
        }, TMP_15._s = this, TMP_15), $a).call($c);
        };
        if (found !== false && found !== nil) {
          if (($a = this.scope['$has_temp?']("$yielded")) === false || $a === nil) {
            this.scope.$add_temp("$yielded")
          };
          return this.$s("yasgn", "$yielded", found);
        } else {
          return nil
        };
      };

      def.$process_scope = function(sexp, level) {
        var $a, stmt = nil;
        stmt = ((($a = sexp['$[]'](0)) !== false && $a !== nil) ? $a : this.$s("nil"));
        if (($a = this.scope['$class_scope?']()) === false || $a === nil) {
          stmt = this.$returns(stmt)
        };
        return this.$process(stmt, "stmt");
      };

      def.$process_js_return = function(sexp, level) {
        
        return [this.$f("return ", sexp), this.$process(sexp['$[]'](0))];
      };

      def.$process_js_tmp = function(sexp, level) {
        
        return this.$f(sexp['$[]'](0).$to_s(), sexp);
      };

      def.$js_block_given = function(sexp, level) {
        var $a, $b, scope = nil;
        this.scope['$uses_block!']();
        if (($a = this.scope.$block_name()) !== false && $a !== nil) {
          return this.$f("(" + (this.scope.$block_name()) + " !== nil)", sexp)
        } else {
          if (($a = ($b = scope = this.scope.$find_parent_def(), $b !== false && $b !== nil ? scope.$block_name() : $b)) !== false && $a !== nil) {
            return this.$f("(" + (scope.$block_name()) + " !== nil)", sexp)
          } else {
            return this.$f("false", sexp)
          }
        };
      };

      def.$handle_block_given = function(sexp, reverse) {
        var name = nil;if (reverse == null) {
          reverse = false
        }
        this.scope['$uses_block!']();
        name = this.scope.$block_name();
        return this.$f((function() { if (reverse !== false && reverse !== nil) {
          return "" + (name) + " === nil"
        } else {
          return "" + (name) + " !== nil"
        }; return nil; }).call(this), sexp);
      };

      def.$process_sym = function(sexp, level) {
        
        return this.$f(sexp['$[]'](0).$to_s().$inspect(), sexp);
      };

      def.$process_int = function(sexp, level) {
        
        return this.$f((function() { if (level['$==']("recv")) {
          return "(" + (sexp['$[]'](0)) + ")"
        } else {
          return sexp['$[]'](0).$to_s()
        }; return nil; }).call(this), sexp);
      };

      Parser.$alias_method("process_float", "process_int");

      def.$process_regexp = function(sexp, level) {
        var val = nil;
        val = sexp['$[]'](0);
        return this.$f((function() { if (val['$=='](/^/)) {
          return /^/.$inspect()
        } else {
          return val.$inspect()
        }; return nil; }).call(this), sexp);
      };

      def.$process_dregx = function(sexp, level) {
        var TMP_16, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_16 = function(part) {

          var self = TMP_16._s || this, $a;
          if (part == null) part = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(" + ", sexp))
          };
          if (($a = $scope.String['$==='](part)) !== false && $a !== nil) {
            return result['$<<'](self.$f(part.$inspect(), sexp))
          } else {
            if (part['$[]'](0)['$==']("str")) {
              return result['$<<'](self.$process(part))
            } else {
              return result['$<<'](self.$process(part['$[]'](1)))
            }
          };
        }, TMP_16._s = this, TMP_16), $a).call($b);
        return [this.$f("(new RegExp(", sexp), result, this.$f("))", sexp)];
      };

      def.$process_dot2 = function(sexp, level) {
        
        this.helpers['$[]=']("range", true);
        return [this.$f("$range(", sexp), this.$process(sexp['$[]'](0)), this.$f(", ", sexp), this.$process(sexp['$[]'](1)), this.$f(", false)", sexp)];
      };

      def.$process_dot3 = function(sexp, level) {
        
        this.helpers['$[]=']("range", true);
        return [this.$f("$range(", sexp), this.$process(sexp['$[]'](0)), this.$f(", ", sexp), this.$process(sexp['$[]'](1)), this.$f(", true)", sexp)];
      };

      def.$process_str = function(sexp, level) {
        
        return this.$f(sexp['$[]'](0).$inspect(), sexp);
      };

      def.$process_defined = function(sexp, level) {
        var $a, TMP_17, $b, part = nil, $case = nil, mid = nil, recv = nil, ivar_name = nil;
        part = sexp['$[]'](0);
        return (function() { $case = part['$[]'](0);if ("self"['$===']($case)) {
        return this.$f("'self'", sexp)
        }else if ("nil"['$===']($case)) {
        return this.$f("'nil'", sexp)
        }else if ("true"['$===']($case)) {
        return this.$f("'true'", sexp)
        }else if ("false"['$===']($case)) {
        return this.$f("'false'", sexp)
        }else if ("call"['$===']($case)) {
        mid = this.$mid_to_jsid(part['$[]'](2).$to_s());
        recv = (function() { if (($a = part['$[]'](1)) !== false && $a !== nil) {
          return this.$process(part['$[]'](1))
        } else {
          return this.$f(this.$current_self(), sexp)
        }; return nil; }).call(this);
        return [this.$f("(", sexp), recv, this.$f("" + (mid) + " ? 'method' : nil)", sexp)];
        }else if ("xstr"['$===']($case) || "dxstr"['$===']($case)) {
        return [this.$f("(typeof(", sexp), this.$process(part), this.$f(") !== 'undefined')", sexp)]
        }else if ("const"['$===']($case)) {
        return this.$f("($scope." + (part['$[]'](1).$to_s()) + " != null)", sexp)
        }else if ("cvar"['$===']($case)) {
        return this.$f("($opal.cvars[" + (part['$[]'](1).$to_s().$inspect()) + "] != null ? 'class-variable' : nil)", sexp)
        }else if ("colon2"['$===']($case)) {
        return this.$f("false", sexp)
        }else if ("colon3"['$===']($case)) {
        return this.$f("($opal.Object._scope." + (sexp['$[]'](0)['$[]'](1)) + " == null ? nil : 'constant')", sexp)
        }else if ("ivar"['$===']($case)) {
        ivar_name = part['$[]'](1).$to_s()['$[]']($range(1, -1, false));
        return ($a = ($b = this).$with_temp, $a._p = (TMP_17 = function(t) {

          var self = TMP_17._s || this;
          if (t == null) t = nil;
          
          return self.$f("((" + (t) + " = " + (self.$current_self()) + "[" + (ivar_name.$inspect()) + "], " + (t) + " != null && " + (t) + " !== nil) ? 'instance-variable' : nil)", sexp)
        }, TMP_17._s = this, TMP_17), $a).call($b);
        }else if ("lvar"['$===']($case)) {
        return this.$f("local-variable", sexp)
        }else {return this.$raise("bad defined? part: " + (part['$[]'](0)))} }).call(this);
      };

      def.$process_not = function(sexp, level) {
        var TMP_18, $a, $b;
        return ($a = ($b = this).$with_temp, $a._p = (TMP_18 = function(tmp) {

          var self = TMP_18._s || this, expr = nil;
          if (tmp == null) tmp = nil;
          
          expr = sexp['$[]'](0);
          return [self.$f("(" + (tmp) + " = ", sexp), self.$process(expr), self.$f(", (" + (tmp) + " === nil || " + (tmp) + " === false))", sexp)];
        }, TMP_18._s = this, TMP_18), $a).call($b);
      };

      def.$process_block_pass = function(exp, level) {
        
        return this.$process(this.$s("call", exp['$[]'](0), "to_proc", this.$s("arglist")));
      };

      def.$process_iter = function(sexp, level) {
        var $a, $b, TMP_19, call = nil, args = nil, body = nil, code = nil, params = nil, scope_name = nil, identity = nil, to_vars = nil, opt_args = nil, block_arg = nil, splat = nil, len = nil, itercode = nil;
        $a = $opal.to_ary(sexp), call = ($a[0] == null ? nil : $a[0]), args = ($a[1] == null ? nil : $a[1]), body = ($a[2] == null ? nil : $a[2]);
        ((($a = body) !== false && $a !== nil) ? $a : body = this.$s("nil"));
        body = this.$returns(body);
        code = [];
        params = nil;
        scope_name = nil;
        identity = nil;
        to_vars = nil;
        if (($a = $scope.Fixnum['$==='](args)) !== false && $a !== nil) {
          args = nil
        };
        ((($a = args) !== false && $a !== nil) ? $a : args = this.$s("masgn", this.$s("array")));
        args = (function() { if (args.$first()['$==']("lasgn")) {
          return this.$s("array", args)
        } else {
          return args['$[]'](1)
        }; return nil; }).call(this);
        if (($a = ($b = args.$last()['$is_a?']($scope.Array), $b !== false && $b !== nil ? args.$last()['$[]'](0)['$==']("block") : $b)) !== false && $a !== nil) {
          opt_args = args.$pop();
          opt_args.$shift();
        };
        if (($a = ($b = args.$last()['$is_a?']($scope.Array), $b !== false && $b !== nil ? args.$last()['$[]'](0)['$==']("block_pass") : $b)) !== false && $a !== nil) {
          block_arg = args.$pop();
          block_arg = block_arg['$[]'](1)['$[]'](1).$to_sym();
        };
        if (($a = ($b = args.$last()['$is_a?']($scope.Array), $b !== false && $b !== nil ? args.$last()['$[]'](0)['$==']("splat") : $b)) !== false && $a !== nil) {
          splat = args.$last()['$[]'](1)['$[]'](1);
          args.$pop();
          len = args.$length();
        };
        ($a = ($b = this).$indent, $a._p = (TMP_19 = function() {

          var self = TMP_19._s || this, TMP_20, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_20 = function() {

            var self = TMP_20._s || this, TMP_21, $a, $b, blk = nil;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;

            
            identity = self.scope['$identify!']();
            self.scope.$add_temp("" + (self.$current_self()) + " = " + (identity) + "._s || this");
            params = self.$js_block_args(args['$[]']($range(1, -1, false)));
            ($a = ($b = args['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_21 = function(arg, idx) {

              var self = TMP_21._s || this, $a, $b, TMP_22, $c, $d, TMP_23, current_opt = nil;
              if (self.indent == null) self.indent = nil;

              if (arg == null) arg = nil;
              if (idx == null) idx = nil;
              
              if (arg['$[]'](0)['$==']("lasgn")) {
                arg = arg['$[]'](1);
                if (($a = $scope.RESERVED['$include?'](arg.$to_s())) !== false && $a !== nil) {
                  arg = "" + (arg) + "$"
                };
                if (($a = (($b = opt_args !== false && opt_args !== nil) ? current_opt = ($c = ($d = opt_args).$find, $c._p = (TMP_22 = function(s) {

                  var self = TMP_22._s || this;
                  if (s == null) s = nil;
                  
                  return s['$[]'](1)['$=='](arg.$to_sym())
                }, TMP_22._s = self, TMP_22), $c).call($d) : $b)) !== false && $a !== nil) {
                  return code['$<<']([self.$f("if (" + (arg) + " == null) " + (arg) + " = ", sexp), self.$process(current_opt['$[]'](2)), self.$f(";\n" + (self.indent), sexp)])
                } else {
                  return code['$<<'](self.$f("if (" + (arg) + " == null) " + (arg) + " = nil;\n" + (self.indent), sexp))
                };
              } else {
                if (arg['$[]'](0)['$==']("array")) {
                  return ($a = ($b = arg['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_23 = function(arg, midx) {

                    var self = TMP_23._s || this, $a;
                    if (self.indent == null) self.indent = nil;

                    if (arg == null) arg = nil;
                    if (midx == null) midx = nil;
                    
                    arg = arg['$[]'](1);
                    if (($a = $scope.RESERVED['$include?'](arg.$to_s())) !== false && $a !== nil) {
                      arg = "" + (arg) + "$"
                    };
                    return code['$<<'](self.$f("" + (arg) + " = " + (params['$[]'](idx)) + "[" + (midx) + "];\n" + (self.indent)));
                  }, TMP_23._s = self, TMP_23), $a).call($b)
                } else {
                  return self.$raise("Bad block_arg type: " + (arg['$[]'](0)))
                }
              }
            }, TMP_21._s = self, TMP_21), $a).call($b);
            if (splat !== false && splat !== nil) {
              self.scope.$add_arg(splat);
              params['$<<'](splat);
              code['$<<'](self.$f("" + (splat) + " = $slice.call(arguments, " + (len['$-'](1)) + ");", sexp));
            };
            if (block_arg !== false && block_arg !== nil) {
              self.scope['$block_name='](block_arg);
              self.scope.$add_temp(block_arg);
              scope_name = self.scope['$identify!']();
              blk = [];
              blk['$<<'](self.$f("\n" + (self.indent) + (block_arg) + " = " + (scope_name) + "._p || nil, " + (scope_name) + "._p = null;\n" + (self.indent), sexp));
              code.$unshift(blk);
            };
            code['$<<'](self.$f("\n" + (self.indent), sexp));
            code['$<<'](self.$process(body, "stmt"));
            if (($a = self.scope.$defines_defn()) !== false && $a !== nil) {
              self.scope.$add_temp("def = ((" + (self.$current_self()) + "._isClass) ? " + (self.$current_self()) + "._proto : " + (self.$current_self()) + ")")
            };
            return to_vars = [self.$f("\n" + (self.indent), sexp), self.scope.$to_vars(), self.$f("\n" + (self.indent), sexp)];
          }, TMP_20._s = self, TMP_20), $a).call($b, "iter")
        }, TMP_19._s = this, TMP_19), $a).call($b);
        itercode = [this.$f("function(" + (params.$join(", ")) + ") {\n", sexp), to_vars, code, this.$f("\n" + (this.indent) + "}", sexp)];
        itercode.$unshift(this.$f("(" + (identity) + " = ", sexp));
        itercode['$<<'](this.$f(", " + (identity) + "._s = " + (this.$current_self()) + ", " + (identity) + ")", sexp));
        call['$<<'](itercode);
        return this.$process(call, level);
      };

      def.$js_block_args = function(sexp) {
        var TMP_24, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_24 = function(arg) {

          var self = TMP_24._s || this, ref = nil;
          if (self.scope == null) self.scope = nil;

          if (arg == null) arg = nil;
          
          if (arg['$[]'](0)['$==']("lasgn")) {
            ref = self.$lvar_to_js(arg['$[]'](1));
            self.scope.$add_arg(ref);
            return result['$<<'](ref);
          } else {
            if (arg['$[]'](0)['$==']("array")) {
              return result['$<<'](self.scope.$next_temp())
            } else {
              return self.$raise("Bad js_block_arg: " + (arg['$[]'](0)))
            }
          }
        }, TMP_24._s = this, TMP_24), $a).call($b);
        return result;
      };

      def.$process_attrasgn = function(exp, level) {
        var $a, recv = nil, mid = nil, arglist = nil;
        $a = $opal.to_ary(exp), recv = ($a[0] == null ? nil : $a[0]), mid = ($a[1] == null ? nil : $a[1]), arglist = ($a[2] == null ? nil : $a[2]);
        return this.$process(this.$s("call", recv, mid, arglist), level);
      };

      def.$process_call = function(sexp, level) {
        var $a, $b, TMP_25, TMP_26, $c, $d, $e, recv = nil, meth = nil, arglist = nil, iter = nil, mid = nil, $case = nil, splat = nil, block = nil, tmpfunc = nil, tmprecv = nil, args = nil, recv_code = nil, call_recv = nil, dispatch = nil, result = nil;
        $a = $opal.to_ary(sexp), recv = ($a[0] == null ? nil : $a[0]), meth = ($a[1] == null ? nil : $a[1]), arglist = ($a[2] == null ? nil : $a[2]), iter = ($a[3] == null ? nil : $a[3]);
        mid = this.$mid_to_jsid(meth.$to_s());
        this.method_calls['$[]='](meth.$to_sym(), true);
        if (($a = ($b = ($b = ($b = ($b = this.irb_vars, $b !== false && $b !== nil ? this.scope['$top?']() : $b), $b !== false && $b !== nil ? arglist['$=='](this.$s("arglist")) : $b), $b !== false && $b !== nil ? recv['$=='](nil) : $b), $b !== false && $b !== nil ? iter['$=='](nil) : $b)) !== false && $a !== nil) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_25 = function(t) {

            var self = TMP_25._s || this, $a, lvar = nil, call = nil;
            if (t == null) t = nil;
            
            lvar = meth.$intern();
            if (($a = $scope.RESERVED['$include?'](lvar)) !== false && $a !== nil) {
              lvar = "" + (lvar) + "$"
            };
            call = self.$s("call", self.$s("self"), meth.$intern(), self.$s("arglist"));
            return [self.$f("((" + (t) + " = $opal.irb_vars." + (lvar) + ") == null ? ", sexp), self.$process(call), self.$f(" : " + (t) + ")", sexp)];
          }, TMP_25._s = this, TMP_25), $a).call($b)
        };
        $case = meth;if ("block_given?"['$===']($case)) {
        return this.$js_block_given(sexp, level)
        };
        splat = ($a = ($c = arglist['$[]']($range(1, -1, false)))['$any?'], $a._p = (TMP_26 = function(a) {

          var self = TMP_26._s || this;
          if (a == null) a = nil;
          
          return a.$first()['$==']("splat")
        }, TMP_26._s = this, TMP_26), $a).call($c);
        if (($a = ($d = $scope.Array['$==='](arglist.$last()), $d !== false && $d !== nil ? arglist.$last().$first()['$==']("block_pass") : $d)) !== false && $a !== nil) {
          block = this.$process(arglist.$pop())
        } else {
          if (iter !== false && iter !== nil) {
            block = iter
          }
        };
        ((($a = recv) !== false && $a !== nil) ? $a : recv = this.$s("self"));
        if (block !== false && block !== nil) {
          tmpfunc = this.scope.$new_temp()
        };
        if (($a = ((($d = splat) !== false && $d !== nil) ? $d : tmpfunc)) !== false && $a !== nil) {
          tmprecv = this.scope.$new_temp()
        };
        args = "";
        recv_code = this.$process(recv, "recv");
        call_recv = this.$s("js_tmp", ((($a = tmprecv) !== false && $a !== nil) ? $a : recv_code));
        if (($a = (($d = tmpfunc !== false && tmpfunc !== nil) ? ($e = splat, ($e === nil || $e === false)) : $d)) !== false && $a !== nil) {
          arglist.$insert(1, call_recv)
        };
        args = this.$process(arglist);
        dispatch = (function() { if (tmprecv !== false && tmprecv !== nil) {
          return [this.$f("(" + (tmprecv) + " = "), recv_code, this.$f(")" + (mid))]
        } else {
          return [recv_code, this.$f(mid)]
        }; return nil; }).call(this);
        if (tmpfunc !== false && tmpfunc !== nil) {
          dispatch.$unshift(this.$f("(" + (tmpfunc) + " = "));
          dispatch['$<<'](this.$f(", " + (tmpfunc) + "._p = "));
          dispatch['$<<'](block);
          dispatch['$<<'](this.$f(", " + (tmpfunc) + ")"));
        };
        result = (function() { if (splat !== false && splat !== nil) {
          return [dispatch, this.$f(".apply("), (function() { if (tmprecv !== false && tmprecv !== nil) {
            return this.$f(tmprecv)
          } else {
            return recv_code
          }; return nil; }).call(this), this.$f(", "), args, this.$f(")")]
        } else {
          if (tmpfunc !== false && tmpfunc !== nil) {
            return [dispatch, this.$f(".call("), args, this.$f(")")]
          } else {
            return [dispatch, this.$f("("), args, this.$f(")")]
          }
        }; return nil; }).call(this);
        if (tmpfunc !== false && tmpfunc !== nil) {
          this.scope.$queue_temp(tmpfunc)
        };
        return result;
      };

      def.$process_arglist = function(sexp, level) {
        var $a, TMP_27, $b, code = nil, work = nil, join = nil;
        $a = [[], []], code = $a[0], work = $a[1];
        ($a = ($b = sexp).$each, $a._p = (TMP_27 = function(current) {

          var self = TMP_27._s || this, $a, splat = nil, arg = nil;
          if (current == null) current = nil;
          
          splat = current.$first()['$==']("splat");
          arg = self.$process(current);
          if (splat !== false && splat !== nil) {
            if (($a = work['$empty?']()) !== false && $a !== nil) {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<'](self.$f("[].concat(", sexp));
                code['$<<'](arg);
                code['$<<'](self.$f(")"));
              } else {
                code = code['$+'](".concat(" + (arg) + ")")
              }
            } else {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<']([self.$f("["), work, self.$f("]")])
              } else {
                code['$<<']([self.$f(".concat(["), work, self.$f("])")])
              };
              code['$<<']([self.$f(".concat("), arg, self.$f(")")]);
            };
            return work = [];
          } else {
            if (($a = work['$empty?']()) === false || $a === nil) {
              work['$<<'](self.$f(", "))
            };
            return work['$<<'](arg);
          };
        }, TMP_27._s = this, TMP_27), $a).call($b);
        if (($a = work['$empty?']()) === false || $a === nil) {
          join = work;
          if (($a = code['$empty?']()) !== false && $a !== nil) {
            code = join
          } else {
            code['$<<'](this.$f(".concat("))['$<<'](join)['$<<'](this.$f(")"))
          };
        };
        return code;
      };

      def.$process_splat = function(sexp, level) {
        
        if (sexp.$first()['$=='](["nil"])) {
          return [this.$f("[]")]
        } else {
          if (sexp.$first().$first()['$==']("sym")) {
            return [this.$f("["), this.$process(sexp['$[]'](0)), this.$f("]")]
          } else {
            return this.$process(sexp.$first(), "recv")
          }
        };
      };

      def.$process_class = function(sexp, level) {
        var $a, $b, TMP_28, cid = nil, sup = nil, body = nil, code = nil, base = nil, name = nil, spacer = nil, cls = nil, boot = nil;
        $a = $opal.to_ary(sexp), cid = ($a[0] == null ? nil : $a[0]), sup = ($a[1] == null ? nil : $a[1]), body = ($a[2] == null ? nil : $a[2]);
        if (($a = body['$[]'](1)) === false || $a === nil) {
          body['$[]='](1, this.$s("nil"))
        };
        code = [];
        this.helpers['$[]=']("klass", true);
        if (($a = ((($b = $scope.Symbol['$==='](cid)) !== false && $b !== nil) ? $b : $scope.String['$==='](cid))) !== false && $a !== nil) {
          base = this.$process(this.$s("self"));
          name = cid.$to_s();
        } else {
          if (cid['$[]'](0)['$==']("colon2")) {
            base = this.$process(cid['$[]'](1));
            name = cid['$[]'](2).$to_s();
          } else {
            if (cid['$[]'](0)['$==']("colon3")) {
              base = this.$process(this.$s("js_tmp", "$opal.Object"));
              name = cid['$[]'](1).$to_s();
            } else {
              this.$raise("Bad receiver in class")
            }
          }
        };
        sup = (function() { if (sup !== false && sup !== nil) {
          return this.$process(sup)
        } else {
          return this.$process(this.$s("js_tmp", "null"))
        }; return nil; }).call(this);
        ($a = ($b = this).$indent, $a._p = (TMP_28 = function() {

          var self = TMP_28._s || this, TMP_29, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_29 = function() {

            var self = TMP_29._s || this, $a, $b, needs_block = nil, last_body_statement = nil;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;

            
            self.scope['$name='](name);
            self.scope.$add_temp("" + (self.scope.$proto()) + " = " + (name) + "._proto", "$scope = " + (name) + "._scope");
            if (($a = $scope.Array['$==='](body.$last())) !== false && $a !== nil) {
              needs_block = ($a = body.$last().$first()['$==']("block"), ($a === nil || $a === false));
              body.$last().$first()['$==']("block");
              last_body_statement = (function() { if (needs_block !== false && needs_block !== nil) {
                return body.$last()
              } else {
                return body.$last().$last()
              }; return nil; }).call(self);
              if (($a = (($b = last_body_statement !== false && last_body_statement !== nil) ? $scope.Array['$==='](last_body_statement) : $b)) !== false && $a !== nil) {
                if (($a = ["defn", "defs"]['$include?'](last_body_statement.$first())) !== false && $a !== nil) {
                  if (needs_block !== false && needs_block !== nil) {
                    body['$[]='](-1, self.$s("block", body['$[]'](-1)))
                  };
                  body.$last()['$<<'](self.$s("nil"));
                }
              };
            };
            body = self.$process(self.$returns(body), "stmt");
            code['$<<'](self.$f("\n"));
            code['$<<'](self.scope.$to_donate_methods());
            code['$<<'](self.$f(self.indent));
            code['$<<'](self.scope.$to_vars());
            code['$<<'](self.$f("\n\n" + (self.indent)));
            return code['$<<'](body);
          }, TMP_29._s = self, TMP_29), $a).call($b, "class")
        }, TMP_28._s = this, TMP_28), $a).call($b);
        spacer = "\n" + (this.indent) + ($scope.INDENT);
        cls = "function " + (name) + "() {};";
        boot = "" + (name) + " = $klass($base, $super, " + (name.$inspect()) + ", " + (name) + ");";
        return [this.$f("(function($base, $super){" + (spacer) + (cls) + (spacer) + (boot) + "\n", sexp), code, this.$f("\n" + (this.indent) + "})", sexp), this.$f("(", sexp), base, this.$f(", ", sexp), sup, this.$f(")", sexp)];
      };

      def.$process_sclass = function(sexp, level) {
        var $a, TMP_30, $b, recv = nil, body = nil, code = nil;
        $a = [sexp['$[]'](0), sexp['$[]'](1), []], recv = $a[0], body = $a[1], code = $a[2];
        ($a = ($b = this).$in_scope, $a._p = (TMP_30 = function() {

          var self = TMP_30._s || this;
          if (self.scope == null) self.scope = nil;

          
          self.scope.$add_temp("$scope = " + (self.$current_self()) + "._scope");
          self.scope.$add_temp("def = " + (self.$current_self()) + "._proto");
          return code['$<<'](self.scope.$to_vars())['$<<'](self.$process(body, "stmt"));
        }, TMP_30._s = this, TMP_30), $a).call($b, "sclass");
        return [this.$f("(function(){"), code, this.$f("}).call("), this.$process(recv, "recv"), this.$f(".$singleton_class())")];
      };

      def.$process_module = function(sexp, level) {
        var $a, $b, TMP_31, cid = nil, body = nil, code = nil, base = nil, name = nil, spacer = nil, cls = nil, boot = nil;
        $a = $opal.to_ary(sexp), cid = ($a[0] == null ? nil : $a[0]), body = ($a[1] == null ? nil : $a[1]);
        code = [];
        this.helpers['$[]=']("module", true);
        if (($a = ((($b = $scope.Symbol['$==='](cid)) !== false && $b !== nil) ? $b : $scope.String['$==='](cid))) !== false && $a !== nil) {
          base = this.$process(this.$s("self"));
          name = cid.$to_s();
        } else {
          if (cid['$[]'](0)['$==']("colon2")) {
            base = this.$process(cid['$[]'](1));
            name = cid['$[]'](2).$to_s();
          } else {
            if (cid['$[]'](0)['$==']("colon3")) {
              base = this.$f("$opal.Object", sexp);
              name = cid['$[]'](1).$to_s();
            } else {
              this.$raise("Bad receiver in class")
            }
          }
        };
        ($a = ($b = this).$indent, $a._p = (TMP_31 = function() {

          var self = TMP_31._s || this, TMP_32, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_32 = function() {

            var self = TMP_32._s || this;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;
            if (self.ident == null) self.ident = nil;

            
            self.scope['$name='](name);
            self.scope.$add_temp("" + (self.scope.$proto()) + " = " + (name) + "._proto", "$scope = " + (name) + "._scope");
            body = self.$process(body, "stmt");
            code['$<<'](self.$f(self.indent));
            code['$<<'](self.scope.$to_vars());
            code['$<<'](self.$f("\n\n" + (self.indent)));
            code['$<<'](body);
            code['$<<'](self.$f("\n" + (self.ident)));
            return code['$<<'](self.scope.$to_donate_methods());
          }, TMP_32._s = self, TMP_32), $a).call($b, "module")
        }, TMP_31._s = this, TMP_31), $a).call($b);
        spacer = "\n" + (this.indent) + ($scope.INDENT);
        cls = "function " + (name) + "() {};";
        boot = "" + (name) + " = $module($base, " + (name.$inspect()) + ", " + (name) + ");";
        code.$unshift(this.$f("(function($base){" + (spacer) + (cls) + (spacer) + (boot) + "\n", sexp));
        code['$<<'](this.$f("\n" + (this.indent) + "})("));
        code['$<<'](base);
        code['$<<'](this.$f(")"));
        return code;
      };

      def.$process_undef = function(sexp, level) {
        
        return this.$f("delete " + (this.scope.$proto()) + (this.$mid_to_jsid(sexp['$[]'](0)['$[]'](1).$to_s())), sexp);
      };

      def.$process_defn = function(sexp, level) {
        var $a, mid = nil, args = nil, stmts = nil;
        $a = $opal.to_ary(sexp), mid = ($a[0] == null ? nil : $a[0]), args = ($a[1] == null ? nil : $a[1]), stmts = ($a[2] == null ? nil : $a[2]);
        return this.$js_def(nil, mid, args, stmts, sexp.$line(), sexp.$end_line(), sexp);
      };

      def.$process_defs = function(sexp, level) {
        var $a, recv = nil, mid = nil, args = nil, stmts = nil;
        $a = $opal.to_ary(sexp), recv = ($a[0] == null ? nil : $a[0]), mid = ($a[1] == null ? nil : $a[1]), args = ($a[2] == null ? nil : $a[2]), stmts = ($a[3] == null ? nil : $a[3]);
        return this.$js_def(recv, mid, args, stmts, sexp.$line(), sexp.$end_line(), sexp);
      };

      def.$js_def = function(recvr, mid, args, stmts, line, end_line, sexp) {
        var $a, $b, TMP_33, $c, $d, $e, jsid = nil, smethod = nil, recv = nil, code = nil, params = nil, scope_name = nil, uses_super = nil, uses_splat = nil, opt = nil, argc = nil, block_name = nil, splat = nil, arity_code = nil, result = nil;
        jsid = this.$mid_to_jsid(mid.$to_s());
        if (recvr !== false && recvr !== nil) {
          this.scope['$defines_defs='](true);
          if (($a = ($b = this.scope['$class_scope?'](), $b !== false && $b !== nil ? recvr.$first()['$==']("self") : $b)) !== false && $a !== nil) {
            smethod = true
          };
          recv = this.$process(recvr);
        } else {
          this.scope['$defines_defn='](true);
          recv = this.$current_self();
        };
        code = [];
        params = nil;
        scope_name = nil;
        uses_super = nil;
        uses_splat = nil;
        if (($a = $scope.Array['$==='](args.$last())) !== false && $a !== nil) {
          opt = args.$pop()
        };
        argc = args.$length()['$-'](1);
        if (($a = args.$last().$to_s()['$start_with?']("&")) !== false && $a !== nil) {
          block_name = args.$pop().$to_s()['$[]']($range(1, -1, false)).$to_sym();
          argc = argc['$-'](1);
        };
        if (($a = args.$last().$to_s()['$start_with?']("*")) !== false && $a !== nil) {
          uses_splat = true;
          if (args.$last()['$==']("*")) {
            argc = argc['$-'](1)
          } else {
            splat = args['$[]'](-1).$to_s()['$[]']($range(1, -1, false)).$to_sym();
            args['$[]='](-1, splat);
            argc = argc['$-'](1);
          };
        };
        if (($a = this.arity_check) !== false && $a !== nil) {
          arity_code = this.$arity_check(args, opt, uses_splat, block_name, mid)['$+']("\n" + ($scope.INDENT))
        };
        ($a = ($b = this).$indent, $a._p = (TMP_33 = function() {

          var self = TMP_33._s || this, TMP_34, $a, $b;
          
          return ($a = ($b = self).$in_scope, $a._p = (TMP_34 = function() {

            var self = TMP_34._s || this, $a, TMP_35, $b, $c, yielder = nil, stmt_code = nil;
            if (self.scope == null) self.scope = nil;
            if (self.indent == null) self.indent = nil;

            
            self.scope['$mid='](mid);
            if (recvr !== false && recvr !== nil) {
              self.scope['$defs='](true)
            };
            if (block_name !== false && block_name !== nil) {
              self.scope['$uses_block!']();
              self.scope.$add_arg(block_name);
            };
            yielder = ((($a = block_name) !== false && $a !== nil) ? $a : "$yield");
            self.scope['$block_name='](yielder);
            params = self.$process(args);
            stmt_code = [self.$f("\n" + (self.indent)), self.$process(stmts, "stmt")];
            if (opt !== false && opt !== nil) {
              ($a = ($b = opt['$[]']($range(1, -1, false))).$each, $a._p = (TMP_35 = function(o) {

                var self = TMP_35._s || this;
                if (self.indent == null) self.indent = nil;

                if (o == null) o = nil;
                
                if (o['$[]'](2)['$[]'](2)['$==']("undefined")) {
                  return nil;
                };
                code['$<<'](self.$f("if (" + (self.$lvar_to_js(o['$[]'](1))) + " == null) {\n" + (self.indent['$+']($scope.INDENT)), o));
                code['$<<'](self.$process(o));
                return code['$<<'](self.$f("\n" + (self.indent) + "}", o));
              }, TMP_35._s = self, TMP_35), $a).call($b)
            };
            if (splat !== false && splat !== nil) {
              code['$<<'](self.$f("" + (splat) + " = $slice.call(arguments, " + (argc) + ");", sexp))
            };
            scope_name = self.scope.$identity();
            if (($a = self.scope['$uses_block?']()) !== false && $a !== nil) {
              self.scope.$add_temp("$iter = " + (scope_name) + "._p");
              self.scope.$add_temp("" + (yielder) + " = $iter || nil");
              code.$unshift(self.$f("" + (scope_name) + "._p = null;", sexp));
            };
            ($a = code).$push.apply($a, [].concat(stmt_code));
            uses_super = self.scope.$uses_super();
            code = [self.$f("" + (arity_code) + (self.indent), sexp), self.scope.$to_vars(), code];
            if (($c = self.scope.$uses_zuper()) !== false && $c !== nil) {
              code.$unshift(self.$f("var $zuper = $slice.call(arguments, 0);", sexp))
            };
            if (($c = self.scope.$catch_return()) !== false && $c !== nil) {
              code.$unshift(self.$f("try {\n", sexp));
              return code.$push(self.$f("\n} catch($returner) { if ($returner === $opal.returner) { return $returner.$v; } throw $returner; }", sexp));
            } else {
              return nil
            };
          }, TMP_34._s = self, TMP_34), $a).call($b, "def")
        }, TMP_33._s = this, TMP_33), $a).call($b);
        result = [this.$f("" + ((function() { if (scope_name !== false && scope_name !== nil) {
          return "" + (scope_name) + " = "
        } else {
          return nil
        }; return nil; }).call(this)) + "function(", sexp)];
        ($a = result).$push.apply($a, [].concat(params));
        result['$<<'](this.$f(") {\n", sexp));
        ($c = result).$push.apply($c, [].concat(code));
        result['$<<'](this.$f("\n" + (this.indent) + "}", sexp));
        if (recvr !== false && recvr !== nil) {
          if (smethod !== false && smethod !== nil) {
            return [this.$f("" + (this.scope.$name()) + ".constructor.prototype['$" + (mid) + "'] = ", sexp), result]
          } else {
            return [recv, this.$f("" + (jsid) + " = ", sexp), result]
          }
        } else {
          if (($d = ($e = this.scope['$class?'](), $e !== false && $e !== nil ? this.scope.$name()['$==']("Object") : $e)) !== false && $d !== nil) {
            return [this.$f("" + (this.$current_self()) + "._defn('$" + (mid) + "', ", sexp), result, this.$f(")", sexp)]
          } else {
            if (($d = this.scope['$class_scope?']()) !== false && $d !== nil) {
              this.scope.$methods()['$<<']("$" + (mid));
              if (uses_super !== false && uses_super !== nil) {
                this.scope.$add_temp(uses_super);
                uses_super = "" + (uses_super) + " = " + (this.scope.$proto()) + (jsid) + ";\n" + (this.indent);
              };
              return [this.$f("" + (uses_super) + (this.scope.$proto()) + (jsid) + " = ", sexp), result];
            } else {
              return [this.$f("def" + (jsid) + " = ", sexp), result]
            }
          }
        };
      };

      def.$arity_check = function(args, opt, splat, block_name, mid) {
        var $a, $b, meth = nil, arity = nil, aritycode = nil;
        meth = mid.$to_s().$inspect();
        arity = args.$size()['$-'](1);
        if (opt !== false && opt !== nil) {
          arity = arity['$-'](opt.$size()['$-'](1))
        };
        if (splat !== false && splat !== nil) {
          arity = arity['$-'](1)
        };
        if (($a = ((($b = opt) !== false && $b !== nil) ? $b : splat)) !== false && $a !== nil) {
          arity = arity['$-@']()['$-'](1)
        };
        aritycode = "var $arity = arguments.length;";
        if (arity['$<'](0)) {
          return aritycode['$+']("if ($arity < " + (arity['$+'](1)['$-@']()) + ") { $opal.ac($arity, " + (arity) + ", this, " + (meth) + "); }")
        } else {
          return aritycode['$+']("if ($arity !== " + (arity) + ") { $opal.ac($arity, " + (arity) + ", this, " + (meth) + "); }")
        };
      };

      def.$process_args = function(exp, level) {
        var TMP_36, $a, $b, args = nil;
        args = [];
        ($a = ($b = exp).$each, $a._p = (TMP_36 = function(a) {

          var self = TMP_36._s || this;
          if (self.scope == null) self.scope = nil;

          if (a == null) a = nil;
          
          a = a.$to_sym();
          if (a.$to_s()['$==']("*")) {
            return nil;
          };
          a = self.$lvar_to_js(a);
          self.scope.$add_arg(a);
          return args['$<<'](a);
        }, TMP_36._s = this, TMP_36), $a).call($b);
        return this.$f(args.$join(", "), exp);
      };

      def.$process_self = function(sexp, level) {
        
        return this.$f(this.$current_self(), sexp);
      };

      def.$current_self = function() {
        var $a, $b;
        if (($a = this.scope['$class_scope?']()) !== false && $a !== nil) {
          return this.scope.$name()
        } else {
          if (($a = ((($b = this.scope['$top?']()) !== false && $b !== nil) ? $b : this.scope['$iter?']())) !== false && $a !== nil) {
            return "self"
          } else {
            return "this"
          }
        };
      };

      def.$process_true = function(sexp, level) {
        
        return this.$f("true", sexp);
      };

      def.$process_false = function(sexp, level) {
        
        return this.$f("false", sexp);
      };

      def.$process_nil = function(sexp, level) {
        
        return this.$f("nil", sexp);
      };

      def.$process_array = function(sexp, level) {
        var $a, TMP_37, $b, code = nil, work = nil, join = nil;
        if (($a = sexp['$empty?']()) !== false && $a !== nil) {
          return [this.$f("[]", sexp)]
        };
        $a = [[], []], code = $a[0], work = $a[1];
        ($a = ($b = sexp).$each, $a._p = (TMP_37 = function(current) {

          var self = TMP_37._s || this, $a, splat = nil, part = nil;
          if (current == null) current = nil;
          
          splat = current.$first()['$==']("splat");
          part = self.$process(current);
          if (splat !== false && splat !== nil) {
            if (($a = work['$empty?']()) !== false && $a !== nil) {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<'](self.$f("[].concat(", sexp))['$<<'](part)['$<<'](self.$f(")", sexp))
              } else {
                code['$<<'](self.$f(".concat(", sexp))['$<<'](part)['$<<'](self.$f(")", sexp))
              }
            } else {
              if (($a = code['$empty?']()) !== false && $a !== nil) {
                code['$<<'](self.$f("[", sexp))['$<<'](work)['$<<'](self.$f("]", sexp))
              } else {
                code['$<<'](self.$f(".concat([", sexp))['$<<'](work)['$<<'](self.$f("])", sexp))
              };
              code['$<<'](self.$f(".concat(", sexp))['$<<'](part)['$<<'](self.$f(")", sexp));
            };
            return work = [];
          } else {
            if (($a = work['$empty?']()) === false || $a === nil) {
              work['$<<'](self.$f(", ", current))
            };
            return work['$<<'](part);
          };
        }, TMP_37._s = this, TMP_37), $a).call($b);
        if (($a = work['$empty?']()) === false || $a === nil) {
          join = [this.$f("[", sexp), work, this.$f("]", sexp)];
          if (($a = code['$empty?']()) !== false && $a !== nil) {
            code = join
          } else {
            code.$push([this.$f(".concat(", sexp), join, this.$f(")", sexp)])
          };
        };
        return code;
      };

      def.$process_hash = function(sexp, level) {
        var TMP_38, $a, $b, TMP_39, $c, $d, TMP_40, TMP_41, $e, TMP_42, $f, keys = nil, vals = nil, hash_obj = nil, hash_keys = nil, result = nil;
        keys = [];
        vals = [];
        ($a = ($b = sexp).$each_with_index, $a._p = (TMP_38 = function(obj, idx) {

          var self = TMP_38._s || this, $a;
          if (obj == null) obj = nil;
          if (idx == null) idx = nil;
          
          if (($a = idx['$even?']()) !== false && $a !== nil) {
            return keys['$<<'](obj)
          } else {
            return vals['$<<'](obj)
          }
        }, TMP_38._s = this, TMP_38), $a).call($b);
        if (($a = ($c = ($d = keys)['$all?'], $c._p = (TMP_39 = function(k) {

          var self = TMP_39._s || this;
          if (k == null) k = nil;
          
          return ["sym", "str"]['$include?'](k['$[]'](0))
        }, TMP_39._s = this, TMP_39), $c).call($d)) !== false && $a !== nil) {
          hash_obj = $hash2([], {});
          hash_keys = [];
          ($a = ($c = keys.$size()).$times, $a._p = (TMP_40 = function(i) {

            var self = TMP_40._s || this, $a, k = nil;
            if (i == null) i = nil;
            
            k = keys['$[]'](i)['$[]'](1).$to_s().$inspect();
            if (($a = hash_obj['$include?'](k)) === false || $a === nil) {
              hash_keys['$<<'](k)
            };
            return hash_obj['$[]='](k, self.$process(vals['$[]'](i)));
          }, TMP_40._s = this, TMP_40), $a).call($c);
          result = [];
          this.helpers['$[]=']("hash2", true);
          ($a = ($e = hash_keys).$each, $a._p = (TMP_41 = function(k) {

            var self = TMP_41._s || this, $a;
            if (k == null) k = nil;
            
            if (($a = result['$empty?']()) === false || $a === nil) {
              result['$<<'](self.$f(", ", sexp))
            };
            result['$<<'](self.$f("" + (k) + ": ", sexp));
            return result['$<<'](hash_obj['$[]'](k));
          }, TMP_41._s = this, TMP_41), $a).call($e);
          return [this.$f("$hash2([" + (hash_keys.$join(", ")) + "], {", sexp), result, this.$f("})", sexp)];
        } else {
          this.helpers['$[]=']("hash", true);
          result = [];
          ($a = ($f = sexp).$each, $a._p = (TMP_42 = function(p) {

            var self = TMP_42._s || this, $a;
            if (p == null) p = nil;
            
            if (($a = result['$empty?']()) === false || $a === nil) {
              result['$<<'](self.$f(", ", p))
            };
            return result['$<<'](self.$process(p));
          }, TMP_42._s = this, TMP_42), $a).call($f);
          return [this.$f("$hash(", sexp), result, this.$f(")", sexp)];
        };
      };

      def.$process_while = function(sexp, level) {
        var $a, $b, TMP_43, expr = nil, stmt = nil, redo_var = nil, code = nil, stmt_level = nil, pre = nil;
        $a = $opal.to_ary(sexp), expr = ($a[0] == null ? nil : $a[0]), stmt = ($a[1] == null ? nil : $a[1]);
        redo_var = this.scope.$new_temp();
        code = [];
        stmt_level = (function() { if (($a = ((($b = level['$==']("expr")) !== false && $b !== nil) ? $b : level['$==']("recv"))) !== false && $a !== nil) {
          return "stmt_closure"
        } else {
          return "stmt"
        }; return nil; }).call(this);
        code['$<<'](this.$js_truthy(expr))['$<<'](this.$f("){", sexp));
        pre = "while (";
        ($a = ($b = this).$in_while, $a._p = (TMP_43 = function() {

          var self = TMP_43._s || this, $a, body = nil;
          if (self.while_loop == null) self.while_loop = nil;

          
          if (stmt_level['$==']("stmt_closure")) {
            self.while_loop['$[]=']("closure", true)
          };
          self.while_loop['$[]=']("redo_var", redo_var);
          body = self.$process(stmt, "stmt");
          if (($a = self.while_loop['$[]']("use_redo")) !== false && $a !== nil) {
            pre = ("" + (redo_var) + "=false;")['$+'](pre)['$+']("" + (redo_var) + " || ");
            code['$<<'](self.$f("" + (redo_var) + "=false;", sexp));
          };
          return code['$<<'](body);
        }, TMP_43._s = this, TMP_43), $a).call($b);
        code['$<<'](this.$f("}", sexp));
        code.$unshift(this.$f(pre, sexp));
        this.scope.$queue_temp(redo_var);
        if (stmt_level['$==']("stmt_closure")) {
          code.$unshift(this.$f("(function() {", sexp));
          code.$push(this.$f("; return nil; }).call(" + (this.$current_self()) + ")", sexp));
        };
        return code;
      };

      def.$process_until = function(exp, level) {
        var $a, $b, TMP_44, expr = nil, stmt = nil, redo_var = nil, stmt_level = nil, code = nil, pre = nil;
        $a = $opal.to_ary(exp), expr = ($a[0] == null ? nil : $a[0]), stmt = ($a[1] == null ? nil : $a[1]);
        redo_var = this.scope.$new_temp();
        stmt_level = (function() { if (($a = ((($b = level['$==']("expr")) !== false && $b !== nil) ? $b : level['$==']("recv"))) !== false && $a !== nil) {
          return "stmt_closure"
        } else {
          return "stmt"
        }; return nil; }).call(this);
        code = [];
        pre = "while (!(";
        code['$<<'](this.$js_truthy(expr))['$<<'](this.$f(")) {", exp));
        ($a = ($b = this).$in_while, $a._p = (TMP_44 = function() {

          var self = TMP_44._s || this, $a, body = nil;
          if (self.while_loop == null) self.while_loop = nil;

          
          if (stmt_level['$==']("stmt_closure")) {
            self.while_loop['$[]=']("closure", true)
          };
          self.while_loop['$[]=']("redo_var", redo_var);
          body = self.$process(stmt, "stmt");
          if (($a = self.while_loop['$[]']("use_redo")) !== false && $a !== nil) {
            pre = ("" + (redo_var) + "=false;")['$+'](pre)['$+']("" + (redo_var) + " || ");
            code['$<<'](self.$f("" + (redo_var) + "=false;", exp));
          };
          return code['$<<'](body);
        }, TMP_44._s = this, TMP_44), $a).call($b);
        code['$<<'](this.$f("}", exp));
        code.$unshift(this.$f(pre, exp));
        this.scope.$queue_temp(redo_var);
        if (stmt_level['$==']("stmt_closure")) {
          code.$unshift(this.$f("(function() {", exp));
          code['$<<'](this.$f("; return nil; }).call(" + (this.$current_self()) + ")", exp));
        };
        return code;
      };

      def.$process_alias = function(exp, level) {
        var $a, new$ = nil, old = nil, current = nil;
        new$ = this.$mid_to_jsid(exp['$[]'](0)['$[]'](1).$to_s());
        old = this.$mid_to_jsid(exp['$[]'](1)['$[]'](1).$to_s());
        if (($a = ["class", "module"]['$include?'](this.scope.$type())) !== false && $a !== nil) {
          this.scope.$methods()['$<<']("$" + (exp['$[]'](0)['$[]'](1).$to_s()));
          return this.$f("%s%s = %s%s"['$%']([this.scope.$proto(), new$, this.scope.$proto(), old]), exp);
        } else {
          current = this.$current_self();
          return this.$f("%s._proto%s = %s._proto%s"['$%']([current, new$, current, old]), exp);
        };
      };

      def.$process_masgn = function(sexp, level) {
        var $a, TMP_45, $b, lhs = nil, rhs = nil, tmp = nil, len = nil, code = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        tmp = this.scope.$new_temp();
        len = 0;
        code = [];
        if (rhs['$[]'](0)['$==']("array")) {
          len = rhs.$length()['$-'](1);
          code['$<<'](this.$f("" + (tmp) + " = ", sexp))['$<<'](this.$process(rhs));
        } else {
          if (rhs['$[]'](0)['$==']("to_ary")) {
            code['$<<']([this.$f("" + (tmp) + " = $opal.to_ary("), this.$process(rhs['$[]'](1)), this.$f(")")])
          } else {
            if (rhs['$[]'](0)['$==']("splat")) {
              code['$<<'](this.$f("(" + (tmp) + " = ", sexp))['$<<'](this.$process(rhs['$[]'](1)));
              code['$<<'](this.$f(")['$to_a'] ? (" + (tmp) + " = " + (tmp) + "['$to_a']()) : (" + (tmp) + ")._isArray ?  " + (tmp) + " : (" + (tmp) + " = [" + (tmp) + "])", sexp));
            } else {
              this.$raise("Unsupported mlhs type")
            }
          }
        };
        ($a = ($b = lhs['$[]']($range(1, -1, false))).$each_with_index, $a._p = (TMP_45 = function(l, idx) {

          var self = TMP_45._s || this, $a, $b, $c, s = nil, assign = nil;
          if (l == null) l = nil;
          if (idx == null) idx = nil;
          
          if (($a = code['$empty?']()) === false || $a === nil) {
            code['$<<'](self.$f(", ", sexp))
          };
          if (l.$first()['$==']("splat")) {
            if (($a = s = l['$[]'](1)) !== false && $a !== nil) {
              s['$<<'](self.$s("js_tmp", "$slice.call(" + (tmp) + ", " + (idx) + ")"));
              return code['$<<'](self.$process(s));
            } else {
              return nil
            }
          } else {
            if (idx['$>='](len)) {
              assign = self.$s("js_tmp", "(" + (tmp) + "[" + (idx) + "] == null ? nil : " + (tmp) + "[" + (idx) + "])")
            } else {
              assign = self.$s("js_tmp", "" + (tmp) + "[" + (idx) + "]")
            };
            if (($a = ((($b = ((($c = l['$[]'](0)['$==']("lasgn")) !== false && $c !== nil) ? $c : l['$[]'](0)['$==']("iasgn"))) !== false && $b !== nil) ? $b : l['$[]'](0)['$==']("lvar"))) !== false && $a !== nil) {
              l['$<<'](assign)
            } else {
              if (l['$[]'](0)['$==']("call")) {
                l['$[]='](2, ("" + (l['$[]'](2)) + "=").$to_sym());
                l.$last()['$<<'](assign);
              } else {
                if (l['$[]'](0)['$==']("attrasgn")) {
                  l.$last()['$<<'](assign)
                } else {
                  self.$raise("bad lhs for masgn: " + (l.$inspect()))
                }
              }
            };
            return code['$<<'](self.$process(l));
          };
        }, TMP_45._s = this, TMP_45), $a).call($b);
        this.scope.$queue_temp(tmp);
        return code;
      };

      def.$process_svalue = function(sexp, level) {
        
        return this.$process(sexp['$[]'](0), level);
      };

      def.$process_lasgn = function(sexp, level) {
        var $a, $b, lvar = nil, rhs = nil, result = nil;
        lvar = sexp['$[]'](0);
        rhs = sexp['$[]'](1);
        if (($a = $scope.RESERVED['$include?'](lvar.$to_s())) !== false && $a !== nil) {
          lvar = ("" + (lvar) + "$").$to_sym()
        };
        if (($a = ($b = this.irb_vars, $b !== false && $b !== nil ? this.scope['$top?']() : $b)) !== false && $a !== nil) {
          return [this.$f("$opal.irb_vars." + (lvar) + " = ", sexp), this.$process(rhs)]
        } else {
          this.scope.$add_local(lvar);
          rhs = this.$process(rhs);
          result = [this.$f(lvar, sexp), this.$f(" = ", sexp), rhs];
          if (level['$==']("recv")) {
            result.$unshift(this.$f("(", sexp));
            result.$push(this.$f(")", sexp));
          };
          return result;
        };
      };

      def.$process_lvar = function(sexp, level) {
        var $a, $b, TMP_46, lvar = nil;
        lvar = sexp['$[]'](0).$to_s();
        if (($a = $scope.RESERVED['$include?'](lvar)) !== false && $a !== nil) {
          lvar = "" + (lvar) + "$"
        };
        if (($a = ($b = this.irb_vars, $b !== false && $b !== nil ? this.scope['$top?']() : $b)) !== false && $a !== nil) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_46 = function(t) {

            var self = TMP_46._s || this;
            if (t == null) t = nil;
            
            return self.$f("((" + (t) + " = $opal.irb_vars." + (lvar) + ") == null ? nil : " + (t) + ")", sexp)
          }, TMP_46._s = this, TMP_46), $a).call($b)
        } else {
          return this.$f(lvar, sexp)
        };
      };

      def.$process_iasgn = function(exp, level) {
        var $a, ivar = nil, rhs = nil, lhs = nil;
        $a = $opal.to_ary(exp), ivar = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        ivar = ivar.$to_s()['$[]']($range(1, -1, false));
        lhs = (function() { if (($a = $scope.RESERVED['$include?'](ivar)) !== false && $a !== nil) {
          return "" + (this.$current_self()) + "['" + (ivar) + "']"
        } else {
          return "" + (this.$current_self()) + "." + (ivar)
        }; return nil; }).call(this);
        return [this.$f(lhs, exp), this.$f(" = ", exp), this.$process(rhs)];
      };

      def.$process_ivar = function(exp, level) {
        var $a, ivar = nil, part = nil;
        ivar = exp['$[]'](0).$to_s()['$[]']($range(1, -1, false));
        part = (function() { if (($a = $scope.RESERVED['$include?'](ivar)) !== false && $a !== nil) {
          return "['" + (ivar) + "']"
        } else {
          return "." + (ivar)
        }; return nil; }).call(this);
        this.scope.$add_ivar(part);
        return this.$f("" + (this.$current_self()) + (part), exp);
      };

      def.$process_gvar = function(sexp, level) {
        var gvar = nil;
        gvar = sexp['$[]'](0).$to_s()['$[]']($range(1, -1, false));
        this.helpers['$[]=']("gvars", true);
        return this.$f("$gvars[" + (gvar.$inspect()) + "]", sexp);
      };

      def.$process_nth_ref = function(sexp, level) {
        
        return this.$f("nil", sexp);
      };

      def.$process_gasgn = function(sexp, level) {
        var gvar = nil, rhs = nil;
        gvar = sexp['$[]'](0).$to_s()['$[]']($range(1, -1, false));
        rhs = sexp['$[]'](1);
        this.helpers['$[]=']("gvars", true);
        return [this.$f("$gvars[" + (gvar.$to_s().$inspect()) + "] = ", sexp), this.$process(rhs)];
      };

      def.$process_const = function(sexp, level) {
        var $a, TMP_47, $b, cname = nil;
        cname = sexp['$[]'](0).$to_s();
        if (($a = this.const_missing) !== false && $a !== nil) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_47 = function(t) {

            var self = TMP_47._s || this;
            if (t == null) t = nil;
            
            return self.$f("((" + (t) + " = $scope." + (cname) + ") == null ? $opal.cm(" + (cname.$inspect()) + ") : " + (t) + ")", sexp)
          }, TMP_47._s = this, TMP_47), $a).call($b)
        } else {
          return this.$f("$scope." + (cname), sexp)
        };
      };

      def.$process_cdecl = function(sexp, level) {
        var $a, const$ = nil, rhs = nil;
        $a = $opal.to_ary(sexp), const$ = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        return [this.$f("$scope." + (const$) + " = ", sexp), this.$process(rhs)];
      };

      def.$process_casgn = function(sexp, level) {
        var $a, lhs = nil, const$ = nil, rhs = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), const$ = ($a[1] == null ? nil : $a[1]), rhs = ($a[2] == null ? nil : $a[2]);
        return [this.$process(lhs), this.$f("._scope." + (const$) + " = ", sexp), this.$process(rhs)];
      };

      def.$process_return = function(sexp, level) {
        var $a, $b, val = nil, parent_def = nil;
        val = this.$process(((($a = sexp['$[]'](0)) !== false && $a !== nil) ? $a : this.$s("nil")));
        if (($a = ($b = this.scope['$iter?'](), $b !== false && $b !== nil ? parent_def = this.scope.$find_parent_def() : $b)) !== false && $a !== nil) {
          parent_def['$catch_return='](true);
          return [this.$f("$opal.$return(", sexp), val, this.$f(")", sexp)];
        } else {
          if (($a = (($b = level['$==']("expr")) ? this.scope['$def?']() : $b)) !== false && $a !== nil) {
            this.scope['$catch_return='](true);
            return [this.$f("$opal.$return(", sexp), val, this.$f(")", sexp)];
          } else {
            if (level['$==']("stmt")) {
              return [this.$f("return ", sexp), val]
            } else {
              return this.$raise($scope.SyntaxError, "void value expression: cannot return as an expression")
            }
          }
        };
      };

      def.$process_xstr = function(sexp, level) {
        var $a, $b, $c, code = nil, result = nil;
        code = sexp.$first().$to_s();
        if (($a = (($b = level['$==']("stmt")) ? ($c = code['$include?'](";"), ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
          code = code['$+'](";")
        };
        result = this.$f(code, sexp);
        if (level['$==']("recv")) {
          return [this.$f("(", sexp), result, this.$f(")", sexp)]
        } else {
          return result
        };
      };

      def.$process_dxstr = function(sexp, level) {
        var TMP_48, $a, $b, result = nil, needs_sc = nil;
        result = [];
        needs_sc = false;
        ($a = ($b = sexp).$each, $a._p = (TMP_48 = function(p) {

          var self = TMP_48._s || this, $a, $b, $c, $d;
          if (p == null) p = nil;
          
          if (($a = $scope.String['$==='](p)) !== false && $a !== nil) {
            result['$<<'](self.$f(p.$to_s(), sexp));
            if (($a = (($b = level['$==']("stmt")) ? ($c = p.$to_s()['$include?'](";"), ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
              return needs_sc = true
            } else {
              return nil
            };
          } else {
            if (p.$first()['$==']("evstr")) {
              return ($a = result).$push.apply($a, [].concat(self.$process(p.$last(), "stmt")))
            } else {
              if (p.$first()['$==']("str")) {
                result['$<<'](self.$f(p.$last().$to_s(), p));
                if (($b = (($c = level['$==']("stmt")) ? ($d = p.$last().$to_s()['$include?'](";"), ($d === nil || $d === false)) : $c)) !== false && $b !== nil) {
                  return needs_sc = true
                } else {
                  return nil
                };
              } else {
                return self.$raise("Bad dxstr part")
              }
            }
          }
        }, TMP_48._s = this, TMP_48), $a).call($b);
        if (needs_sc !== false && needs_sc !== nil) {
          result['$<<'](this.$f(";", sexp))
        };
        if (level['$==']("recv")) {
          return [this.$f("(", sexp), result, this.$f(")", sexp)]
        } else {
          return result
        };
      };

      def.$process_dstr = function(sexp, level) {
        var TMP_49, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_49 = function(p) {

          var self = TMP_49._s || this, $a;
          if (p == null) p = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(" + ", sexp))
          };
          if (($a = $scope.String['$==='](p)) !== false && $a !== nil) {
            return result['$<<'](self.$f(p.$inspect(), sexp))
          } else {
            if (p.$first()['$==']("evstr")) {
              result['$<<'](self.$f("(", p));
              result['$<<'](self.$process(p.$last()));
              return result['$<<'](self.$f(")", p));
            } else {
              if (p.$first()['$==']("str")) {
                return result['$<<'](self.$f(p.$last().$inspect(), p))
              } else {
                return self.$raise("Bad dstr part")
              }
            }
          };
        }, TMP_49._s = this, TMP_49), $a).call($b);
        if (level['$==']("recv")) {
          return [this.$f("(", sexp), result, this.$f(")", sexp)]
        } else {
          return result
        };
      };

      def.$process_dsym = function(sexp, level) {
        var TMP_50, $a, $b, result = nil;
        result = [];
        ($a = ($b = sexp).$each, $a._p = (TMP_50 = function(p) {

          var self = TMP_50._s || this, $a;
          if (p == null) p = nil;
          
          if (($a = result['$empty?']()) === false || $a === nil) {
            result['$<<'](self.$f(" + ", sexp))
          };
          if (($a = $scope.String['$==='](p)) !== false && $a !== nil) {
            return result['$<<'](self.$f(p.$inspect(), sexp))
          } else {
            if (p.$first()['$==']("evstr")) {
              return result['$<<'](self.$process(self.$s("call", p.$last(), "to_s", self.$s("arglist"))))
            } else {
              if (p.$first()['$==']("str")) {
                return result['$<<'](self.$f(p.$last().$inspect(), sexp))
              } else {
                return self.$raise("Bad dsym part")
              }
            }
          };
        }, TMP_50._s = this, TMP_50), $a).call($b);
        return [this.$f("(", sexp), result, this.$f(")", sexp)];
      };

      def.$process_if = function(sexp, level) {
        var $a, $b, $c, TMP_51, TMP_52, test = nil, truthy = nil, falsy = nil, returnable = nil, check = nil, result = nil, outdent = nil;
        $a = $opal.to_ary(sexp), test = ($a[0] == null ? nil : $a[0]), truthy = ($a[1] == null ? nil : $a[1]), falsy = ($a[2] == null ? nil : $a[2]);
        returnable = ((($a = level['$==']("expr")) !== false && $a !== nil) ? $a : level['$==']("recv"));
        if (returnable !== false && returnable !== nil) {
          truthy = this.$returns(((($a = truthy) !== false && $a !== nil) ? $a : this.$s("nil")));
          falsy = this.$returns(((($a = falsy) !== false && $a !== nil) ? $a : this.$s("nil")));
        };
        if (($a = (($b = falsy !== false && falsy !== nil) ? ($c = truthy, ($c === nil || $c === false)) : $b)) !== false && $a !== nil) {
          truthy = falsy;
          falsy = nil;
          check = this.$js_falsy(test);
        } else {
          check = this.$js_truthy(test)
        };
        result = [this.$f("if (", sexp), check, this.$f(") {\n", sexp)];
        if (truthy !== false && truthy !== nil) {
          ($a = ($b = this).$indent, $a._p = (TMP_51 = function() {

            var self = TMP_51._s || this;
            if (self.indent == null) self.indent = nil;

            
            return result.$push(self.$f(self.indent, sexp), self.$process(truthy, "stmt"))
          }, TMP_51._s = this, TMP_51), $a).call($b)
        };
        outdent = this.indent;
        if (falsy !== false && falsy !== nil) {
          ($a = ($c = this).$indent, $a._p = (TMP_52 = function() {

            var self = TMP_52._s || this;
            if (self.indent == null) self.indent = nil;

            
            return result.$push(self.$f("\n" + (outdent) + "} else {\n" + (self.indent), sexp), self.$process(falsy, "stmt"))
          }, TMP_52._s = this, TMP_52), $a).call($c)
        };
        result['$<<'](this.$f("\n" + (this.indent) + "}", sexp));
        if (returnable !== false && returnable !== nil) {
          result.$unshift(this.$f("(function() { ", sexp));
          result.$push(this.$f("; return nil; }).call(" + (this.$current_self()) + ")", sexp));
        };
        return result;
      };

      def.$js_truthy_optimize = function(sexp) {
        var $a, mid = nil;
        if (sexp.$first()['$==']("call")) {
          mid = sexp['$[]'](2);
          if (mid['$==']("block_given?")) {
            return this.$process(sexp)
          } else {
            if (($a = $scope.COMPARE['$include?'](mid.$to_s())) !== false && $a !== nil) {
              return this.$process(sexp)
            } else {
              if (mid['$==']("==")) {
                return this.$process(sexp)
              } else {
                return nil
              }
            }
          };
        } else {
          if (($a = ["lvar", "self"]['$include?'](sexp.$first())) !== false && $a !== nil) {
            return [this.$process(sexp.$dup()), this.$f(" !== false && ", sexp), this.$process(sexp.$dup()), this.$f(" !== nil", sexp)]
          } else {
            return nil
          }
        };
      };

      def.$js_truthy = function(sexp) {
        var $a, TMP_53, $b, optimized = nil;
        if (($a = optimized = this.$js_truthy_optimize(sexp)) !== false && $a !== nil) {
          return optimized
        };
        return ($a = ($b = this).$with_temp, $a._p = (TMP_53 = function(tmp) {

          var self = TMP_53._s || this;
          if (tmp == null) tmp = nil;
          
          return [self.$f("(" + (tmp) + " = ", sexp), self.$process(sexp), self.$f(") !== false && " + (tmp) + " !== nil", sexp)]
        }, TMP_53._s = this, TMP_53), $a).call($b);
      };

      def.$js_falsy = function(sexp) {
        var TMP_54, $a, $b, mid = nil;
        if (sexp.$first()['$==']("call")) {
          mid = sexp['$[]'](2);
          if (mid['$==']("block_given?")) {
            return this.$handle_block_given(sexp, true)
          };
        };
        return ($a = ($b = this).$with_temp, $a._p = (TMP_54 = function(tmp) {

          var self = TMP_54._s || this, result = nil;
          if (tmp == null) tmp = nil;
          
          result = [];
          result['$<<'](self.$f("(" + (tmp) + " = ", sexp));
          result['$<<'](self.$process(sexp));
          result['$<<'](self.$f(") === false || " + (tmp) + " === nil", sexp));
          return result;
        }, TMP_54._s = this, TMP_54), $a).call($b);
      };

      def.$process_and = function(sexp, level) {
        var $a, lhs = nil, rhs = nil, t = nil, tmp = nil, result = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        t = nil;
        tmp = this.scope.$new_temp();
        if (($a = t = this.$js_truthy_optimize(lhs)) !== false && $a !== nil) {
          result = [];
          result['$<<'](this.$f("((" + (tmp) + " = ", sexp))['$<<'](t);
          result['$<<'](this.$f(") ? ", sexp))['$<<'](this.$process(rhs));
          result['$<<'](this.$f(" : " + (tmp) + ")", sexp));
          this.scope.$queue_temp(tmp);
          return result;
        };
        this.scope.$queue_temp(tmp);
        return [this.$f("(" + (tmp) + " = ", sexp), this.$process(lhs), this.$f(", " + (tmp) + " !== false && " + (tmp) + " !== nil ? ", sexp), this.$process(rhs), this.$f(" : " + (tmp) + ")", sexp)];
      };

      def.$process_or = function(sexp, level) {
        var $a, TMP_55, $b, lhs = nil, rhs = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), rhs = ($a[1] == null ? nil : $a[1]);
        return ($a = ($b = this).$with_temp, $a._p = (TMP_55 = function(tmp) {

          var self = TMP_55._s || this;
          if (tmp == null) tmp = nil;
          
          lhs = self.$process(lhs);
          rhs = self.$process(rhs);
          return [self.$f("(((" + (tmp) + " = ", sexp), lhs, self.$f(") !== false && " + (tmp) + " !== nil) ? " + (tmp) + " : ", sexp), rhs, self.$f(")", sexp)];
        }, TMP_55._s = this, TMP_55), $a).call($b);
      };

      def.$process_yield = function(sexp, level) {
        var TMP_56, $a, $b, call = nil;
        call = this.$handle_yield_call(sexp, level);
        if (level['$==']("stmt")) {
          return [this.$f("if (", sexp), call, this.$f(" === $breaker) return $breaker.$v")]
        } else {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_56 = function(tmp) {

            var self = TMP_56._s || this;
            if (tmp == null) tmp = nil;
            
            return [self.$f("(((" + (tmp) + " = ", sexp), call, self.$f(") === $breaker) ? $breaker.$v : " + (tmp) + ")", sexp)]
          }, TMP_56._s = this, TMP_56), $a).call($b)
        };
      };

      def.$process_yasgn = function(sexp, level) {
        var $a, call = nil;
        call = this.$handle_yield_call(($a = this).$s.apply($a, [].concat(sexp['$[]'](1)['$[]']($range(1, -1, false)))), "stmt");
        return [this.$f("if ((" + (sexp['$[]'](0)) + " = ", sexp), call, this.$f(") === $breaker) return $breaker.$v", sexp)];
      };

      def.$process_returnable_yield = function(sexp, level) {
        var TMP_57, $a, $b, call = nil;
        call = this.$handle_yield_call(sexp, level);
        return ($a = ($b = this).$with_temp, $a._p = (TMP_57 = function(tmp) {

          var self = TMP_57._s || this;
          if (tmp == null) tmp = nil;
          
          return [self.$f("return " + (tmp) + " = ", sexp), call, self.$f(", " + (tmp) + " === $breaker ? " + (tmp) + " : " + (tmp))]
        }, TMP_57._s = this, TMP_57), $a).call($b);
      };

      def.$handle_yield_call = function(sexp, level) {
        var TMP_58, $a, $b, $c, splat = nil, args = nil, y = nil;
        this.scope['$uses_block!']();
        splat = ($a = ($b = sexp)['$any?'], $a._p = (TMP_58 = function(s) {

          var self = TMP_58._s || this;
          if (s == null) s = nil;
          
          return s.$first()['$==']("splat")
        }, TMP_58._s = this, TMP_58), $a).call($b);
        if (($a = ($c = ($c = splat, ($c === nil || $c === false)), $c !== false && $c !== nil ? sexp.$size()['$=='](1) : $c)) !== false && $a !== nil) {
          return [this.$f("$opal.$yield1(" + (((($a = this.scope.$block_name()) !== false && $a !== nil) ? $a : "$yield")) + ", "), this.$process(sexp['$[]'](0)), this.$f(")")]
        };
        args = this.$process_arglist(sexp, level);
        y = ((($a = this.scope.$block_name()) !== false && $a !== nil) ? $a : "$yield");
        if (splat !== false && splat !== nil) {
          return [this.$f("$opal.$yieldX(" + (y) + ", ", sexp), args, this.$f(")")]
        } else {
          return [this.$f("$opal.$yieldX(" + (y) + ", [", sexp), args, this.$f("])")]
        };
      };

      def.$process_break = function(sexp, level) {
        var $a, val = nil;
        val = (function() { if (($a = sexp['$empty?']()) !== false && $a !== nil) {
          return this.$f("nil", sexp)
        } else {
          return this.$process(sexp['$[]'](0))
        }; return nil; }).call(this);
        if (($a = this['$in_while?']()) !== false && $a !== nil) {
          if (($a = this.while_loop['$[]']("closure")) !== false && $a !== nil) {
            return [this.$f("return ", sexp), val, this.$f("", sexp)]
          } else {
            return this.$f("break;", sexp)
          }
        } else {
          if (($a = this.scope['$iter?']()) !== false && $a !== nil) {
            if (($a = level['$==']("stmt")) === false || $a === nil) {
              this.$error("break must be used as a statement")
            };
            return [this.$f("return ($breaker.$v = ", sexp), val, this.$f(", $breaker)", sexp)];
          } else {
            return this.$error("void value expression: cannot use break outside of iter/while")
          }
        };
      };

      def.$process_case = function(exp, level) {
        var $a, TMP_59, $b, $c, $d, pre = nil, code = nil, returnable = nil, done_else = nil;
        $a = [[], []], pre = $a[0], code = $a[1];
        returnable = ($a = level['$==']("stmt"), ($a === nil || $a === false));
        done_else = false;
        ($a = ($b = this).$in_case, $a._p = (TMP_59 = function() {

          var self = TMP_59._s || this, $a, TMP_60, $b, cond = nil, expr = nil;
          if (self.case_stmt == null) self.case_stmt = nil;
          if (self.scope == null) self.scope = nil;

          
          if (($a = cond = exp['$[]'](0)) !== false && $a !== nil) {
            self.case_stmt['$[]=']("cond", true);
            self.scope.$add_local("$case");
            expr = self.$process(cond);
            pre['$<<'](self.$f("$case = ", exp))['$<<'](expr)['$<<'](self.$f(";", exp));
          };
          return ($a = ($b = exp['$[]']($range(1, -1, false))).$each, $a._p = (TMP_60 = function(wen) {

            var self = TMP_60._s || this, $a, $b;
            if (wen == null) wen = nil;
            
            if (($a = (($b = wen !== false && wen !== nil) ? wen.$first()['$==']("when") : $b)) !== false && $a !== nil) {
              if (returnable !== false && returnable !== nil) {
                self.$returns(wen)
              };
              wen = self.$process(wen, "stmt");
              if (($a = code['$empty?']()) === false || $a === nil) {
                code['$<<'](self.$f("else ", exp))
              };
              return code['$<<'](wen);
            } else {
              if (wen !== false && wen !== nil) {
                done_else = true;
                if (returnable !== false && returnable !== nil) {
                  wen = self.$returns(wen)
                };
                return code['$<<'](self.$f("else {", exp))['$<<'](self.$process(wen, "stmt"))['$<<'](self.$f("}", exp));
              } else {
                return nil
              }
            }
          }, TMP_60._s = self, TMP_60), $a).call($b);
        }, TMP_59._s = this, TMP_59), $a).call($b);
        if (($a = (($c = returnable !== false && returnable !== nil) ? ($d = done_else, ($d === nil || $d === false)) : $c)) !== false && $a !== nil) {
          code['$<<'](this.$f("else { return nil }", exp))
        };
        code.$unshift(pre);
        if (returnable !== false && returnable !== nil) {
          code.$unshift(this.$f("(function() { ", exp));
          code['$<<'](this.$f(" }).call(" + (this.$current_self()) + ")", exp));
        };
        return code;
      };

      def.$process_when = function(exp, level) {
        var $a, TMP_61, $b, arg = nil, body = nil, test = nil;
        arg = exp['$[]'](0)['$[]']($range(1, -1, false));
        body = ((($a = exp['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("nil"));
        body = this.$process(body, level);
        test = [];
        ($a = ($b = arg).$each, $a._p = (TMP_61 = function(a) {

          var self = TMP_61._s || this, $a, call = nil, splt = nil;
          if (self.case_stmt == null) self.case_stmt = nil;

          if (a == null) a = nil;
          
          if (($a = test['$empty?']()) === false || $a === nil) {
            test['$<<'](self.$f(" || "))
          };
          if (a.$first()['$==']("splat")) {
            call = self.$f("$splt[i]['$===']($case)", a);
            splt = [self.$f("(function($splt) { for(var i = 0; i < $splt.length; i++) {", exp)];
            splt['$<<'](self.$f("if ("))['$<<'](call)['$<<'](self.$f(") { return true; }", exp));
            splt['$<<'](self.$f("} return false; }).call(" + (self.$current_self()) + ", ", exp));
            splt['$<<'](self.$process(a['$[]'](1)))['$<<'](self.$f(")"));
            return test['$<<'](splt);
          } else {
            if (($a = self.case_stmt['$[]']("cond")) !== false && $a !== nil) {
              call = self.$s("call", a, "===", self.$s("arglist", self.$s("js_tmp", "$case")));
              return test['$<<'](self.$process(call));
            } else {
              return test['$<<'](self.$js_truthy(a))
            }
          };
        }, TMP_61._s = this, TMP_61), $a).call($b);
        return [this.$f("if ("), test, this.$f(") {" + (this.space)), body, this.$f("" + (this.space) + "}")];
      };

      def.$process_match3 = function(sexp, level) {
        
        return this.$process(this.$s("call", sexp['$[]'](0), "=~", this.$s("arglist", sexp['$[]'](1))), level);
      };

      def.$process_cvar = function(exp, level) {
        var TMP_62, $a, $b;
        return ($a = ($b = this).$with_temp, $a._p = (TMP_62 = function(tmp) {

          var self = TMP_62._s || this;
          if (tmp == null) tmp = nil;
          
          return self.$f("((" + (tmp) + " = $opal.cvars['" + (exp['$[]'](0)) + "']) == null ? nil : " + (tmp) + ")", exp)
        }, TMP_62._s = this, TMP_62), $a).call($b);
      };

      def.$process_cvasgn = function(exp, level) {
        
        return "($opal.cvars['" + (exp['$[]'](0)) + "'] = " + (this.$process(exp['$[]'](1))) + ")";
      };

      def.$process_cvdecl = function(exp, level) {
        
        return [this.$f("($opal.cvars['" + (exp['$[]'](0)) + "'] = ", exp), this.$process(exp['$[]'](1)), this.$f(")", exp)];
      };

      def.$process_colon2 = function(sexp, level) {
        var $a, TMP_63, $b, base = nil, cname = nil, result = nil;
        $a = $opal.to_ary(sexp), base = ($a[0] == null ? nil : $a[0]), cname = ($a[1] == null ? nil : $a[1]);
        result = [];
        if (($a = this.const_missing) !== false && $a !== nil) {
          ($a = ($b = this).$with_temp, $a._p = (TMP_63 = function(t) {

            var self = TMP_63._s || this;
            if (t == null) t = nil;
            
            base = self.$process(base);
            result['$<<'](self.$f("((" + (t) + " = (", sexp))['$<<'](base)['$<<'](self.$f(")._scope).", sexp));
            return result['$<<'](self.$f("" + (cname) + " == null ? " + (t) + ".cm('" + (cname) + "') : " + (t) + "." + (cname) + ")", sexp));
          }, TMP_63._s = this, TMP_63), $a).call($b)
        } else {
          result['$<<'](this.$f("(", sexp))['$<<'](this.$process(base))['$<<'](this.$f(")._scope." + (cname), sexp))
        };
        return result;
      };

      def.$process_colon3 = function(exp, level) {
        var TMP_64, $a, $b;
        return ($a = ($b = this).$with_temp, $a._p = (TMP_64 = function(t) {

          var self = TMP_64._s || this;
          if (t == null) t = nil;
          
          return self.$f("((" + (t) + " = $opal.Object._scope." + (exp['$[]'](0)) + ") == null ? $opal.cm('" + (exp['$[]'](0)) + "') : " + (t) + ")", exp)
        }, TMP_64._s = this, TMP_64), $a).call($b);
      };

      def.$process_super = function(sexp, level) {
        var TMP_65, $a, $b, $c, splat = nil, args = nil;
        splat = ($a = ($b = sexp)['$any?'], $a._p = (TMP_65 = function(s) {

          var self = TMP_65._s || this;
          if (s == null) s = nil;
          
          return s.$first()['$==']("splat")
        }, TMP_65._s = this, TMP_65), $a).call($b);
        args = ($a = this).$s.apply($a, ["arglist"].concat(sexp));
        args = this.$process(args);
        if (($c = splat) === false || $c === nil) {
          args = [this.$f("["), args, this.$f("]")]
        };
        return this.$js_super(args, false, sexp);
      };

      def.$process_zsuper = function(exp, level) {
        var $a;
        if (($a = this.scope['$def?']()) !== false && $a !== nil) {
          this.scope['$uses_zuper='](true);
          return this.$js_super(this.$f("$zuper", exp), true, exp);
        } else {
          return this.$js_super(this.$f("$slice.call(arguments)", exp), true, exp)
        };
      };

      def.$js_super = function(args, pass_block, sexp) {
        var $a, TMP_66, $b, mid = nil, sid = nil, cls_name = nil, jsid = nil, iter = nil, chain = nil, defn = nil, trys = nil;
        if (($a = this.scope['$def_in_class?']()) !== false && $a !== nil) {
          this.scope['$uses_block!']();
          mid = this.scope.$mid().$to_s();
          if (($a = this.scope.$uses_super()) !== false && $a !== nil) {
            sid = this.scope.$uses_super()
          } else {
            sid = this.scope['$uses_super=']("super_" + (this.$unique_temp()))
          };
          if (pass_block !== false && pass_block !== nil) {
            this.scope['$uses_block!']();
            return [this.$f("(" + (sid) + "._p = $iter, " + (sid) + ".apply(" + (this.$current_self()) + ", ", sexp), args, this.$f("))", sexp)];
          } else {
            return [this.$f("" + (sid) + ".apply(" + (this.$current_self()) + ", ", sexp), args, this.$f(")", sexp)]
          };
        } else {
          if (this.scope.$type()['$==']("def")) {
            this.scope['$uses_block!']();
            this.scope['$identify!']();
            cls_name = ((($a = this.scope.$parent().$name()) !== false && $a !== nil) ? $a : "" + (this.$current_self()) + "._klass._proto");
            jsid = this.$mid_to_jsid(this.scope.$mid().$to_s());
            if (pass_block !== false && pass_block !== nil) {
              this.scope['$uses_block!']();
              iter = "$iter";
            } else {
              iter = "null"
            };
            if (($a = this.scope.$defs()) !== false && $a !== nil) {
              return [this.$f("$opal.dispatch_super(this, " + (this.scope.$mid().$to_s().$inspect()) + ",", sexp), args, this.$f(", " + (iter) + ", " + (cls_name) + ")", sexp)]
            } else {
              return [this.$f("$opal.dispatch_super(" + (this.$current_self()) + ", " + (this.scope.$mid().$to_s().$inspect()) + ", ", sexp), args, this.$f(", " + (iter) + ")", sexp)]
            };
          } else {
            if (this.scope.$type()['$==']("iter")) {
              $a = $opal.to_ary(this.scope.$get_super_chain()), chain = ($a[0] == null ? nil : $a[0]), defn = ($a[1] == null ? nil : $a[1]), mid = ($a[2] == null ? nil : $a[2]);
              trys = ($a = ($b = chain).$map, $a._p = (TMP_66 = function(c) {

                var self = TMP_66._s || this;
                if (c == null) c = nil;
                
                return "" + (c) + "._sup"
              }, TMP_66._s = this, TMP_66), $a).call($b).$join(" || ");
              return [this.$f("(" + (trys) + " || " + (this.$current_self()) + "._klass._super._proto[" + (mid) + "]).apply(" + (this.$current_self()) + ", ", sexp), args, this.$f(")", sexp)];
            } else {
              return this.$raise("Cannot call super() from outside a method block")
            }
          }
        };
      };

      def.$process_op_asgn_or = function(exp, level) {
        
        return this.$process(this.$s("or", exp['$[]'](0), exp['$[]'](1)));
      };

      def.$process_op_asgn_and = function(sexp, level) {
        
        return this.$process(this.$s("and", sexp['$[]'](0), sexp['$[]'](1)));
      };

      def.$process_op_asgn1 = function(sexp, level) {
        var $a, TMP_67, $b, lhs = nil, arglist = nil, op = nil, rhs = nil;
        $a = $opal.to_ary(sexp), lhs = ($a[0] == null ? nil : $a[0]), arglist = ($a[1] == null ? nil : $a[1]), op = ($a[2] == null ? nil : $a[2]), rhs = ($a[3] == null ? nil : $a[3]);
        return ($a = ($b = this).$with_temp, $a._p = (TMP_67 = function(a) {

          var self = TMP_67._s || this, TMP_68, $a, $b;
          if (a == null) a = nil;
          
          return ($a = ($b = self).$with_temp, $a._p = (TMP_68 = function(r) {

            var self = TMP_68._s || this, args = nil, recv = nil, aref = nil, aset = nil, orop = nil, result = nil;
            if (r == null) r = nil;
            
            args = self.$process(arglist['$[]'](1));
            recv = self.$process(lhs);
            aref = self.$s("call", self.$s("js_tmp", r), "[]", self.$s("arglist", self.$s("js_tmp", a)));
            aset = self.$s("call", self.$s("js_tmp", r), "[]=", self.$s("arglist", self.$s("js_tmp", a), rhs));
            orop = self.$s("or", aref, aset);
            result = [];
            result['$<<'](self.$f("(" + (a) + " = ", sexp))['$<<'](args)['$<<'](self.$f(", " + (r) + " = ", sexp));
            result['$<<'](recv)['$<<'](self.$f(", ", sexp))['$<<'](self.$process(orop));
            result['$<<'](self.$f(")", sexp));
            return result;
          }, TMP_68._s = self, TMP_68), $a).call($b)
        }, TMP_67._s = this, TMP_67), $a).call($b);
      };

      def.$process_op_asgn2 = function(sexp, level) {
        var TMP_69, $a, $b, TMP_70, $c, TMP_71, $d, lhs = nil, mid = nil, op = nil, rhs = nil;
        lhs = this.$process(sexp['$[]'](0));
        mid = sexp['$[]'](1).$to_s()['$[]']($range(0, -2, false));
        op = sexp['$[]'](2);
        rhs = sexp['$[]'](3);
        if (op.$to_s()['$==']("||")) {
          return ($a = ($b = this).$with_temp, $a._p = (TMP_69 = function(temp) {

            var self = TMP_69._s || this, getr = nil, asgn = nil, orop = nil;
            if (temp == null) temp = nil;
            
            getr = self.$s("call", self.$s("js_tmp", temp), mid, self.$s("arglist"));
            asgn = self.$s("call", self.$s("js_tmp", temp), "" + (mid) + "=", self.$s("arglist", rhs));
            orop = self.$s("or", getr, asgn);
            return [self.$f("(" + (temp) + " = ", sexp), lhs, self.$f(", ", sexp), self.$process(orop), self.$f(")", sexp)];
          }, TMP_69._s = this, TMP_69), $a).call($b)
        } else {
          if (op.$to_s()['$==']("&&")) {
            return ($a = ($c = this).$with_temp, $a._p = (TMP_70 = function(temp) {

              var self = TMP_70._s || this, getr = nil, asgn = nil, andop = nil;
              if (temp == null) temp = nil;
              
              getr = self.$s("call", self.$s("js_tmp", temp), mid, self.$s("arglist"));
              asgn = self.$s("call", self.$s("js_tmp", temp), "" + (mid) + "=", self.$s("arglist", rhs));
              andop = self.$s("and", getr, asgn);
              return [self.$f("(" + (temp) + " = ", sexp), lhs, self.$f(", ", sexp), self.$process(andop), self.$f(")", sexp)];
            }, TMP_70._s = this, TMP_70), $a).call($c)
          } else {
            return ($a = ($d = this).$with_temp, $a._p = (TMP_71 = function(temp) {

              var self = TMP_71._s || this, getr = nil, oper = nil, asgn = nil;
              if (temp == null) temp = nil;
              
              getr = self.$s("call", self.$s("js_tmp", temp), mid, self.$s("arglist"));
              oper = self.$s("call", getr, op, self.$s("arglist", rhs));
              asgn = self.$s("call", self.$s("js_tmp", temp), "" + (mid) + "=", self.$s("arglist", oper));
              return [self.$f("(" + (temp) + " = ", sexp), lhs, self.$f(", ", sexp), self.$process(asgn), self.$f(")", sexp)];
            }, TMP_71._s = this, TMP_71), $a).call($d)
          }
        };
      };

      def.$process_ensure = function(exp, level) {
        var $a, $b, begn = nil, retn = nil, result = nil, body = nil, ensr = nil;
        begn = exp['$[]'](0);
        if (($a = ((($b = level['$==']("recv")) !== false && $b !== nil) ? $b : level['$==']("expr"))) !== false && $a !== nil) {
          retn = true;
          begn = this.$returns(begn);
        };
        result = [];
        body = this.$process(begn, level);
        ensr = ((($a = exp['$[]'](1)) !== false && $a !== nil) ? $a : this.$s("nil"));
        ensr = this.$process(ensr, level);
        body = [this.$f("try {\n", exp), body, this.$f("}", exp)];
        result['$<<'](body)['$<<'](this.$f("" + (this.space) + "finally {" + (this.space), exp))['$<<'](ensr)['$<<'](this.$f("}", exp));
        if (retn !== false && retn !== nil) {
          return [this.$f("(function() { ", exp), result, this.$f("; }).call(" + (this.$current_self()) + ")", exp)]
        } else {
          return result
        };
      };

      def.$process_rescue = function(exp, level) {
        var TMP_72, $a, $b, TMP_73, $c, TMP_75, $d, body = nil, handled_else = nil, parts = nil, code = nil;
        body = (function() { if (exp.$first().$first()['$==']("resbody")) {
          return this.$s("nil")
        } else {
          return exp['$[]'](0)
        }; return nil; }).call(this);
        body = ($a = ($b = this).$indent, $a._p = (TMP_72 = function() {

          var self = TMP_72._s || this;
          
          return self.$process(body, level)
        }, TMP_72._s = this, TMP_72), $a).call($b);
        handled_else = false;
        parts = [];
        ($a = ($c = exp['$[]']($range(1, -1, false))).$each, $a._p = (TMP_73 = function(a) {

          var self = TMP_73._s || this, $a, TMP_74, $b, part = nil;
          if (a == null) a = nil;
          
          if (($a = a.$first()['$==']("resbody")) === false || $a === nil) {
            handled_else = true
          };
          part = ($a = ($b = self).$indent, $a._p = (TMP_74 = function() {

            var self = TMP_74._s || this;
            
            return self.$process(a, level)
          }, TMP_74._s = self, TMP_74), $a).call($b);
          if (($a = parts['$empty?']()) === false || $a === nil) {
            parts['$<<'](self.$f("else ", exp))
          };
          return parts['$<<'](part);
        }, TMP_73._s = this, TMP_73), $a).call($c);
        if (($a = handled_else) === false || $a === nil) {
          parts['$<<'](($a = ($d = this).$indent, $a._p = (TMP_75 = function() {

            var self = TMP_75._s || this;
            
            return self.$f("else { throw $err; }", exp)
          }, TMP_75._s = this, TMP_75), $a).call($d))
        };
        code = [];
        code['$<<'](this.$f("try {" + (this.space) + ($scope.INDENT), exp));
        code['$<<'](body);
        code['$<<'](this.$f("" + (this.space) + "} catch ($err) {" + (this.space), exp));
        code['$<<'](parts);
        code['$<<'](this.$f("" + (this.space) + "}", exp));
        if (level['$==']("expr")) {
          code.$unshift(this.$f("(function() { ", exp));
          code['$<<'](this.$f(" }).call(" + (this.$current_self()) + ")", exp));
        };
        return code;
      };

      def.$process_resbody = function(exp, level) {
        var $a, $b, TMP_76, $c, args = nil, body = nil, types = nil, err = nil, val = nil;
        args = exp['$[]'](0);
        body = exp['$[]'](1);
        body = this.$process(((($a = body) !== false && $a !== nil) ? $a : this.$s("nil")), level);
        types = args['$[]']($range(1, -1, false));
        if (($a = ($b = types.$last(), $b !== false && $b !== nil ? ($b = types.$last().$first()['$==']("const"), ($b === nil || $b === false)) : $b)) !== false && $a !== nil) {
          types.$pop()
        };
        err = [];
        ($a = ($b = types).$each, $a._p = (TMP_76 = function(t) {

          var self = TMP_76._s || this, $a, call = nil, a = nil;
          if (t == null) t = nil;
          
          if (($a = err['$empty?']()) === false || $a === nil) {
            err['$<<'](self.$f(", ", exp))
          };
          call = self.$s("call", t, "===", self.$s("arglist", self.$s("js_tmp", "$err")));
          a = self.$process(call);
          return err['$<<'](a);
        }, TMP_76._s = this, TMP_76), $a).call($b);
        if (($a = err['$empty?']()) !== false && $a !== nil) {
          err['$<<'](this.$f("true", exp))
        };
        if (($a = ($c = $scope.Array['$==='](args.$last()), $c !== false && $c !== nil ? ["lasgn", "iasgn"]['$include?'](args.$last().$first()) : $c)) !== false && $a !== nil) {
          val = args.$last();
          val['$[]='](2, this.$s("js_tmp", "$err"));
          val = [this.$process(val), this.$f(";", exp)];
        };
        if (($a = val) === false || $a === nil) {
          val = []
        };
        return [this.$f("if (", exp), err, this.$f("){" + (this.space), exp), val, body, this.$f("}", exp)];
      };

      def.$process_begin = function(exp, level) {
        
        return this.$process(exp['$[]'](0), level);
      };

      def.$process_next = function(exp, level) {
        var $a, result = nil;
        if (($a = this['$in_while?']()) !== false && $a !== nil) {
          return this.$f("continue;", exp)
        } else {
          result = [];
          result['$<<'](this.$f("return ", exp));
          result['$<<']((function() { if (($a = exp['$empty?']()) !== false && $a !== nil) {
            return this.$f("nil", exp)
          } else {
            return this.$process(exp['$[]'](0))
          }; return nil; }).call(this));
          result['$<<'](this.$f(";", exp));
          return result;
        };
      };

      def.$process_redo = function(exp, level) {
        var $a;
        if (($a = this['$in_while?']()) !== false && $a !== nil) {
          this.while_loop['$[]=']("use_redo", true);
          return this.$f("" + (this.while_loop['$[]']("redo_var")) + " = true", exp);
        } else {
          if (($a = this.scope['$iter?']()) !== false && $a !== nil) {
            return this.$f("return " + (this.scope.$identity()) + ".apply(null, $slice.call(arguments))")
          } else {
            return this.$f("REDO()", exp)
          }
        };
      };

      return nil;
    })(Opal, null)

  })(self);
})(Opal);
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $module = $opal.module, $hash2 = $opal.hash2;

  $opal.add_stubs(['$parse', '$new', '$expand_path', '$untaint', '$<<', '$paths', '$append_path', '$join', '$gem_dir', '$find_by_name', '$core_dir', '$std_dir']);
  ;
  ;
  ;
  ;
  ;
  return (function($base){
    function Opal() {};
    Opal = $module($base, "Opal", Opal);
    var def = Opal._proto, $scope = Opal._scope;

    Opal.constructor.prototype['$parse'] = function(source, options) {
      if (options == null) {
        options = $hash2([], {})
      }
      return $scope.Parser.$new().$parse(source, options)
    };

    Opal.constructor.prototype['$core_dir'] = function() {
      
      return $scope.File.$expand_path("../../corelib", nil.$untaint())
    };

    Opal.constructor.prototype['$std_dir'] = function() {
      
      return $scope.File.$expand_path("../../stdlib", nil.$untaint())
    };

    Opal.constructor.prototype['$append_path'] = function(path) {
      
      return this.$paths()['$<<'](path)
    };

    Opal.constructor.prototype['$use_gem'] = function(gem_name) {
      
      return $scope.Opal.$append_path($scope.File.$join(($scope.Gem)._scope.Specification.$find_by_name(gem_name).$gem_dir(), "lib"))
    };

    Opal.constructor.prototype['$paths'] = function() {
      var $a;
      if (this.paths == null) this.paths = nil;

      return ((($a = this.paths) !== false && $a !== nil) ? $a : this.paths = [this.$core_dir().$untaint(), this.$std_dir().$untaint()])
    };

  })(self);
})(Opal);

Opal.parse = function(str) {
  return Opal.Opal.Parser.$new().$parse(str);
};

Opal.eval = function(str) {
  return eval(Opal.parse(str));
};

function run_ruby_scripts() {
  var tags = document.getElementsByTagName('script');

  for (var i = 0, len = tags.length; i < len; i++) {
    if (tags[i].type === "text/ruby") {
      Opal.eval(tags[i].innerHTML);
    }
  }
}

if (typeof(document) !== 'undefined') {
  if (window.addEventListener) {
    window.addEventListener('DOMContentLoaded', run_ruby_scripts, false);
  }
  else {
    window.attachEvent('onload', run_ruby_scripts);
  }
}
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass;

  $opal.add_stubs(['$sort', '$include?', '$reject', '$instance_variables', '$instance_variable_get', '$map', '$irb_instance_variables']);
  (function($base, $super){
    function Object() {};
    Object = $klass($base, $super, "Object", Object);

    var def = Object._proto, $scope = Object._scope;

    Object._defn('$irb_instance_variables', function() {
      var TMP_1, $a, $b, filtered = nil;
      filtered = ["_id", "constructor", "toString", "_klass"];
      return ($a = ($b = this.$instance_variables()).$reject, $a._p = (TMP_1 = function(var$) {

        var self = TMP_1._s || this;
        if (var$ == null) var$ = nil;
        
        return filtered['$include?'](var$)
      }, TMP_1._s = this, TMP_1), $a).call($b).$sort();
    });

    Object._defn('$irb_instance_var_values', function() {
      var TMP_2, $a, $b;
      return ($a = ($b = this.$irb_instance_variables()).$map, $a._p = (TMP_2 = function(var_name) {

        var self = TMP_2._s || this;
        if (var_name == null) var_name = nil;
        
        return [var_name, self.$instance_variable_get("@" + (var_name))]
      }, TMP_2._s = this, TMP_2), $a).call($b);
    });

    return nil;
  })(self, null);
  return (function($base, $super){
    function Foo() {};
    Foo = $klass($base, $super, "Foo", Foo);

    var def = Foo._proto, $scope = Foo._scope;

    def.$initialize = function() {
      
      this.a = "a";
      return this.b = "b";
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/object_extensions.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $gvars = $opal.gvars, $hash2 = $opal.hash2;

  $opal.add_stubs(['$[]', '$is_a?', '$<<', '$each', '$uniq', '$attr_reader', '$new', '$parse']);
  ;
  ;
  ;
  return (function($base, $super){
    function OpalIrb() {};
    OpalIrb = $klass($base, $super, "OpalIrb", OpalIrb);

    var def = OpalIrb._proto, $scope = OpalIrb._scope;
    def.parser = nil;

    def.$irb_vars = function() {
      
      irbVars = [];
       for(variable in Opal.irb_vars) {
         if(Opal.irb_vars.hasOwnProperty(variable)) {
            irbVars.push([variable, Opal.irb_vars[variable]])
         }
       };
       return irbVars;
    };

    def.$opal_classes = function() {
      var TMP_1, $a, $b, classes = nil;
      classes = [];
      $gvars["opal_js_object"] = Opal;
      ($a = ($b = $gvars["opal_js_object"]).$each, $a._p = (TMP_1 = function(k) {

        var self = TMP_1._s || this, $a, $b, attr = nil;
        if (k == null) k = nil;
        
        attr = $gvars["opal_js_object"]['$[]'](k);
        if (($a = attr['$is_a?']((($b = $scope.Class) == null ? $opal.cm("Class") : $b))) !== false && $a !== nil) {
          return classes['$<<'](attr)
        } else {
          return nil
        };
      }, TMP_1._s = this, TMP_1), $a).call($b);
      return classes.$uniq();
    };

    OpalIrb.$attr_reader("parser");

    def.$initialize = function() {
      var $a, $b;
      return this.parser = (($a = ((($b = $scope.Opal) == null ? $opal.cm("Opal") : $b))._scope).Parser == null ? $a.cm('Parser') : $a.Parser).$new();
    };

    def.$parse = function(cmd) {
      
      return this.parser.$parse(cmd, $hash2(["irb"], {"irb": true}));
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal_irb.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice, $klass = $opal.klass, $hash2 = $opal.hash2, $range = $opal.range, $gvars = $opal.gvars;

  $opal.add_stubs(['$map', '$-', '$width', '$value', '$html', '$height', '$+', '$gsub', '$attr_reader', '$clone', '$new', '$handle_keypress', '$on', '$initialize_window', '$print_header', '$html=', '$inspect', '$unshift', '$==', '$[]', '$add_to_history', '$parse', '$log', '$backtrace', '$join', '$===', '$print', '$each_with_index', '$reverse', '$which', '$prevent_default', '$value=', '$escape_html', '$add_to_saved', '$process_saved', '$open_multiline_dialog', '$show_previous_history', '$show_next_history', '$ctrl_key', '$<', '$length', '$>', '$resize_input', '$focus', '$each', '$find', '$create_html', '$setup_cmd_line_methods', '$scroll_to_bottom', '$setup_multi_line', '$setValue', '$call', '$sub', '$getValue']);
  ;
  ;
  ;
  return (function($base, $super){
    function OpalIRBHomebrewConsole() {};
    OpalIRBHomebrewConsole = $klass($base, $super, "OpalIRBHomebrewConsole", OpalIRBHomebrewConsole);

    var def = OpalIRBHomebrewConsole._proto, $scope = OpalIRBHomebrewConsole._scope;
    def.settings = def.inputdiv = def.inputl = def.input = def.inputcopy = def.prompt = def.output = def.history = def.multiline = def.saved = def.irb = def.historyi = def.editor = def.open_editor_dialog_function = nil;

    def.$reset_settings = function() {
      
      return localStorage.clear();
    };

    def.$save_settings = function() {
      
      return localStorage.settings = JSON.stringify( this.settings.$map());
    };

    def.$resize_input = function(e) {
      var width = nil, content = nil;
      width = this.inputdiv.$width()['$-'](this.inputl.$width());
      content = this.input.$value();
      this.inputcopy.$html(content);
      this.inputcopy.$width(width);
      this.input.$width(width);
      return this.input.$height(this.inputcopy.$height()['$+'](2));
    };

    def.$scroll_to_bottom = function() {
      
      return window.scrollTo( 0, this.prompt[0].offsetTop);
    };

    $scope.DEFAULT_SETTINGS = $hash2(["max_lines", "max_depth", "show_hidden", "colorize"], {"max_lines": 500, "max_depth": 2, "show_hidden": false, "colorize": true});

    def.$escape_html = function(s) {
      
      return s.$gsub(/&/, "&amp;").$gsub(/</, "&lt;").$gsub(/>/, "&gt;");
    };

    OpalIRBHomebrewConsole.$attr_reader("settings");

    def.$initialize = function(output, input, prompt, inputdiv, inputl, inputr, inputcopy, settings) {
      var $a, TMP_1, $b, myself = nil;if (settings == null) {
        settings = $hash2([], {})
      }
      $a = [output, input, prompt, inputdiv, inputl, inputr, inputcopy], this.output = $a[0], this.input = $a[1], this.prompt = $a[2], this.inputdiv = $a[3], this.inputl = $a[4], this.inputr = $a[5], this.inputcopy = $a[6];
      this.history = [];
      this.historyi = -1;
      this.saved = "";
      this.multiline = false;
      this.settings = (($a = $scope.DEFAULT_SETTINGS) == null ? $opal.cm("DEFAULT_SETTINGS") : $a).$clone();
      this.irb = (($a = $scope.OpalIrb) == null ? $opal.cm("OpalIrb") : $a).$new();
      myself = this;
      ($a = ($b = this.input).$on, $a._p = (TMP_1 = function(evt) {

        var self = TMP_1._s || this;
        if (evt == null) evt = nil;
        
        return myself.$handle_keypress(evt)
      }, TMP_1._s = this, TMP_1), $a).call($b, "keydown");
      this.$initialize_window();
      return this.$print_header();
    };

    def.$print = function(args) {
      var s = nil, o = nil;
      s = args;
      o = this.output.$html()['$+'](s)['$+']("\n");
      this.output['$html='](o);
      return nil;
    };

    def.$to_s = function() {
      
      return $hash2(["history", "multiline", "settings"], {"history": this.history, "multiline": this.multiline, "settings": this.settings}).$inspect();
    };

    def.$add_to_history = function(s) {
      
      this.history.$unshift(s);
      return this.historyi = -1;
    };

    def.$add_to_saved = function(s) {
      
      this.saved = this.saved['$+']((function() { if (s['$[]']($range(0, -1, true))['$==']("\\")) {
        return s['$[]']($range(0, -1, true))
      } else {
        return s
      }; return nil; }).call(this));
      this.saved = this.saved['$+']("\n");
      return this.$add_to_history(s);
    };

    def.$clear = function() {
      
      this.output['$html=']("");
      return nil;
    };

    def.$process_saved = function() {
      var $a, compiled = nil, value = nil, output = nil, e = nil;
      try {
        compiled = this.irb.$parse(this.saved);
        this.$log(compiled);
        value = eval(compiled);
        $gvars["_"] = value;
        output = nodeutil.inspect( value, this.settings['$[]']("show_hidden"), this.settings['$[]']("max_depth"), this.settings['$[]']("colorize"));
      } catch ($err) {
      if ((($a = $scope.Exception) == null ? $opal.cm("Exception") : $a)['$===']($err)){
        e = $err;if (($a = e.$backtrace()) !== false && $a !== nil) {
          output = ("FOR:\n" + (compiled) + "\n============\n")['$+'](e.$backtrace().$join("\n"))
        } else {
          output = e.toString()
        }}else { throw $err; }
      };
      this.saved = "";
      return this.$print(output);
    };

    def.$help = function() {
      var text = nil;
      text = [" ", "<strong>Features</strong>", "<strong>========</strong>", "+ <strong>Esc</strong> enters multiline mode.", "+ <strong>Up/Down arrow and ctrl-p/ctrl-n</strong> flips through line history.", "+ Access the internals of this console through <strong>$irb</strong>.", "+ <strong>clear</strong> clears this console.", "+ <strong>history</strong> shows line history.", " ", "<strong>@Settings</strong>", "<strong>========</strong>", "You can modify the behavior of this IRB by altering <strong>$irb.@settings</strong>:", " ", "+ <strong>max_lines</strong> (" + (this.settings['$[]']("max_lines")) + "): max line count of this console", "+ <strong>max_depth</strong> (" + (this.settings['$[]']("max_depth")) + "): max_depth in which to inspect outputted object", "+ <strong>show_hidden</strong> (" + (this.settings['$[]']("show_hidden")) + "): flag to output hidden (not enumerable) properties of objects", "+ <strong>colorize</strong> (" + (this.settings['$[]']("colorize")) + "): flag to colorize output (set to false if IRB is slow)", " ", " "].$join("\n");
      return this.$print(text);
    };

    def.$log = function(thing) {
      
      return console.orig_log(thing);
    };

    def.$history = function() {
      var TMP_2, $a, $b;
      return ($a = ($b = this.history.$reverse()).$each_with_index, $a._p = (TMP_2 = function(line, i) {

        var self = TMP_2._s || this;
        if (line == null) line = nil;
        if (i == null) i = nil;
        
        return self.$print("" + (i) + ": " + (line))
      }, TMP_2._s = this, TMP_2), $a).call($b);
    };

    def.$handle_keypress = function(e) {
      var $a, $b, $case = nil, input = nil;
      return (function() { $case = e.$which();if ((13)['$===']($case)) {
      e.$prevent_default();
      input = this.input.$value();
      this.input['$value=']("");
      this.$print(this.prompt.$html()['$+'](this.$escape_html(input)));
      if (input !== false && input !== nil) {
        this.$add_to_saved(input);
        if (($a = ($b = ($b = input['$[]']($range(0, -1, true))['$==']("\\"), ($b === nil || $b === false)), $b !== false && $b !== nil ? ($b = this.multiline, ($b === nil || $b === false)) : $b)) !== false && $a !== nil) {
          return this.$process_saved()
        } else {
          return nil
        };
      } else {
        return nil
      };
      }else if ((27)['$===']($case)) {
      e.$prevent_default();
      return this.$open_multiline_dialog();
      }else if ((38)['$===']($case)) {
      e.$prevent_default();
      return this.$show_previous_history();
      }else if ((40)['$===']($case)) {
      e.$prevent_default();
      return this.$show_next_history();
      }else if ((80)['$===']($case)) {
      if (($a = e.$ctrl_key()) !== false && $a !== nil) {
        e.$prevent_default();
        return this.$show_previous_history();
      } else {
        return nil
      }
      }else if ((78)['$===']($case)) {
      if (($a = e.$ctrl_key()) !== false && $a !== nil) {
        e.$prevent_default();
        return this.$show_next_history();
      } else {
        return nil
      }
      }else { return nil } }).call(this);
    };

    def.$show_previous_history = function() {
      
      if (this.historyi['$<'](this.history.$length()['$-'](1))) {
        this.historyi = this.historyi['$+'](1);
        return this.input['$value='](this.history['$[]'](this.historyi));
      } else {
        return nil
      };
    };

    def.$show_next_history = function() {
      
      if (this.historyi['$>'](0)) {
        this.historyi = this.historyi['$+'](-1);
        return this.input['$value='](this.history['$[]'](this.historyi));
      } else {
        return nil
      };
    };

    def.$initialize_window = function() {
      
      this.$resize_input();
      return this.input.$focus();
    };

    $scope.CMD_LINE_METHOD_DEFINITIONS = ["def help\n                                   $irb.help\n                                   nil\n                                 end", "def clear\n                                   $irb.clear\n                                   nil\n                                 end", "def history\n                                   $irb.history\n                                   nil\n                                 end"];

    def.$setup_cmd_line_methods = function() {
      var TMP_3, $a, $b, $c;
      return ($a = ($b = (($c = $scope.CMD_LINE_METHOD_DEFINITIONS) == null ? $opal.cm("CMD_LINE_METHOD_DEFINITIONS") : $c)).$each, $a._p = (TMP_3 = function(method_defn) {

        var self = TMP_3._s || this, compiled = nil;
        if (self.irb == null) self.irb = nil;

        if (method_defn == null) method_defn = nil;
        
        compiled = self.irb.$parse(method_defn);
        return eval(compiled);
      }, TMP_3._s = this, TMP_3), $a).call($b);
    };

    def.$print_header = function() {
      var $a, $b;
      return this.$print(["# Opal v" + ((($a = ((($b = $scope.Opal) == null ? $opal.cm("Opal") : $b))._scope).VERSION == null ? $a.cm('VERSION') : $a.VERSION)) + " IRB", "# <a href=\"https://github.com/fkchang/opal-irb\" target=\"_blank\">https://github.com/fkchang/opal-irb</a>", "# inspired by <a href=\"https://github.com/larryng/coffeescript-repl\" target=\"_blank\">https://github.com/larryng/coffeescript-repl</a>", "#", "# <strong>help</strong> for features and tips.", " "].$join("\n"));
    };

    OpalIRBHomebrewConsole.constructor.prototype['$create_html'] = function(parent_container_id) {
      var $a, parent = nil;
      parent = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find(parent_container_id);
      return parent['$html=']("      <div id=\"outputdiv\">\n        <pre id=\"output\"></pre>\n      </div>\n      <div id=\"inputdiv\">\n        <div id=\"inputl\">\n          <pre id=\"prompt\">opal&gt;&nbsp;</pre>\n        </div>\n        <div id=\"inputr\">\n          <textarea id=\"input\" spellcheck=\"false\"></textarea>\n          <div id=\"inputcopy\"></div>\n        </div>\n");
    };

    OpalIRBHomebrewConsole.constructor.prototype['$create'] = function(container_id) {
      var $a, TMP_4, $b, TMP_5, $c, $d, TMP_6, TMP_7, $e, TMP_8, $f, $g, output = nil, input = nil, prompt = nil, inputdiv = nil, inputl = nil, inputr = nil, inputcopy = nil, irb = nil;
      this.$create_html(container_id);
      output = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#output");
      input = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#input");
      prompt = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#prompt");
      inputdiv = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#inputdiv");
      inputl = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#inputl");
      inputr = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#inputr");
      inputcopy = (($a = $scope.Element) == null ? $opal.cm("Element") : $a).$find("#inputcopy");
      irb = (($a = $scope.OpalIRBHomebrewConsole) == null ? $opal.cm("OpalIRBHomebrewConsole") : $a).$new(output, input, prompt, inputdiv, inputl, inputr, inputcopy);
      irb.$setup_cmd_line_methods();
      ($a = ($b = input).$on, $a._p = (TMP_4 = function() {

        var self = TMP_4._s || this;
        
        return irb.$scroll_to_bottom()
      }, TMP_4._s = this, TMP_4), $a).call($b, "keydown");
      ($a = ($c = (($d = $scope.Element) == null ? $opal.cm("Element") : $d).$find(window)).$on, $a._p = (TMP_5 = function(e) {

        var self = TMP_5._s || this;
        if (e == null) e = nil;
        
        return irb.$resize_input(e)
      }, TMP_5._s = this, TMP_5), $a).call($c, "resize");
      ($a = ($d = input).$on, $a._p = (TMP_6 = function(e) {

        var self = TMP_6._s || this;
        if (e == null) e = nil;
        
        return irb.$resize_input(e)
      }, TMP_6._s = this, TMP_6), $a).call($d, "keyup");
      ($a = ($e = input).$on, $a._p = (TMP_7 = function(e) {

        var self = TMP_7._s || this;
        if (e == null) e = nil;
        
        return irb.$resize_input(e)
      }, TMP_7._s = this, TMP_7), $a).call($e, "change");
      ($a = ($f = (($g = $scope.Element) == null ? $opal.cm("Element") : $g).$find("html")).$on, $a._p = (TMP_8 = function(e) {

        var self = TMP_8._s || this;
        if (e == null) e = nil;
        
        return input.$focus()
      }, TMP_8._s = this, TMP_8), $a).call($f, "click");
      
    console.orig_log = console.log
    console.log = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      console.orig_log(args);
      Opal.gvars["irb"].$print(args);
    };
    
      $gvars["irb"] = irb;
      return irb.$setup_multi_line();
    };

    def.$setup_multi_line = function() {
      var myself = nil;
      myself = this;
      
    $( ".dialog" ).dialog({
                            autoOpen: false,
                            show: "blind",
                            hide: "explode",
                            modal: true,
                            width: "500px",
                            title: "Multi Line Edit",
                            buttons: {
                              "Run it":  function() {
                                $( this ).dialog( "close" );
                                myself.$process_multiline();
                              },
                              "Cancel":  function() {
                                $( this ).dialog( "close" );
                           },
                        }
          });
      
      this.open_editor_dialog_function = function() {
          $( ".dialog" ).dialog( "open" );
          setTimeout(function(){editor.refresh();}, 20);
      }
      ;
      return this.editor = 
      editor = CodeMirror.fromTextArea(document.getElementById("multi_line_input"),
              {mode: "ruby",
                  lineNumbers: true,
                  matchBrackets: true,
                  keyMap: "emacs",
                  theme: "default"
              });

   ;
    };

    def.$open_multiline_dialog = function() {
      
      this.editor.$setValue(this.input.$value());
      return this.open_editor_dialog_function.$call();
    };

    def.$process_multiline = function() {
      var multi_line_value = nil;
      multi_line_value = this.editor.$getValue().$sub(/(\n)+$/, "");
      this.$add_to_saved(multi_line_value);
      this.$print(multi_line_value);
      this.$process_saved();
      return this.input['$value=']("");
    };

    return nil;
  })(self, null);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/opal_irb_homebrew_console.js.map
;
/* Generated by Opal 0.4.4 */
(function($opal) {
  var TMP_1, $a, $b, $c, self = $opal.top, $scope = $opal, nil = $opal.nil, $breaker = $opal.breaker, $slice = $opal.slice;

  $opal.add_stubs(['$create', '$ready?']);
  ;
  ;
  ;
  ;
  return ($a = ($b = (($c = $scope.Document) == null ? $opal.cm("Document") : $c))['$ready?'], $a._p = (TMP_1 = function() {

    var self = TMP_1._s || this, $a;
    
    return (($a = $scope.OpalIRBHomebrewConsole) == null ? $opal.cm("OpalIRBHomebrewConsole") : $a).$create("#container")
  }, TMP_1._s = self, TMP_1), $a).call($b);
})(Opal);

//@ sourceMappingURL=/__opal_source_maps__/application.js.map
;
