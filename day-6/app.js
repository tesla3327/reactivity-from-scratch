// Global variables for reactivity system
let activeEffect;
const targetMap = new Map();
// Track nested effects
const effectStack = [];

// Track dependencies for reactive properties
function track(target, key) {
  if (activeEffect) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()));
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, (dep = new Set()));
    }
    dep.add(activeEffect);
  }
}

// Trigger effects for reactive properties
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach((effect) => queueJob(effect));
  }
}

// Create a reactive proxy for an object
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      track(target, key);
      return res && typeof res === 'object'
        ? reactive(res)
        : res;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      const result = Reflect.set(
        target,
        key,
        value,
        receiver
      );
      if (result && oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },
    deleteProperty(target, key) {
      const hadKey = Object.prototype.hasOwnProperty.call(
        target,
        key
      );
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        trigger(target, key);
      }
      return result;
    },
  });
}

// Create a readonly proxy for an object
function readonly(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      track(target, key);
      return res && typeof res === 'object'
        ? readonly(res)
        : res;
    },
    set() {
      console.warn(`Cannot set readonly property.`);
      return true;
    },
    deleteProperty() {
      console.warn(`Cannot delete readonly property.`);
      return true;
    },
  });
}

// Create a shallow reactive reference
function shallowRef(value) {
  return ref(value, true);
}

// Create a reactive reference (supports shallow behavior)
function ref(initialValue, shallow = false) {
  let value = shallow
    ? initialValue
    : reactive(initialValue);
  const r = {
    __v_isRef: true,
    get value() {
      track(r, 'value');
      return value;
    },
    set value(newValue) {
      if (shallow) {
        value = newValue;
      } else {
        value = reactive(newValue);
      }
      trigger(r, 'value');
    },
  };
  return r;
}

// Utility functions
function isReadonly(obj) {
  return !!(obj && obj.__v_isReadonly);
}

function isObject(val) {
  return val !== null && typeof val === 'object';
}

// Convert an object's properties to refs
function toRefs(obj) {
  const result = {};
  for (const key in obj) {
    result[key] = toRef(obj, key);
  }
  return result;
}

// Convert a single property to a ref
function toRef(obj, key) {
  return {
    __v_isRef: true,
    get value() {
      return obj[key];
    },
    set value(newValue) {
      obj[key] = newValue;
    },
  };
}

// Job queue for batching updates
const queue = new Set();
let isFlushPending = false;

// Queue a job for execution in the next microtask
function queueJob(job) {
  queue.add(job);
  if (!isFlushPending) {
    isFlushPending = true;
    Promise.resolve().then(flushJobs);
  }
}

// Execute all queued jobs
function flushJobs() {
  for (const job of queue) {
    job();
  }
  queue.clear();
  isFlushPending = false;
}

// Remove an effect from all dependencies
function removeEffect(wrappedEffect) {
  targetMap.forEach((depsMap, target) => {
    depsMap.forEach((dep, key) => {
      if (dep.has(wrappedEffect)) {
        dep.delete(wrappedEffect);
        if (dep.size === 0) {
          depsMap.delete(key);
        }
      }
    });
    if (depsMap.size === 0) {
      targetMap.delete(target);
    }
  });
}

// Methods to abstract effect stack operations
function pushEffect(effect) {
  effectStack.push(effect);
  activeEffect = effect;
}

function popEffect() {
  effectStack.pop();
  activeEffect = effectStack[effectStack.length - 1];
}

// Function to create and run a watchEffect
function watchEffect(effect) {
  let cleanup;
  const wrappedEffect = () => {
    if (cleanup) {
      cleanup();
    }
    pushEffect(wrappedEffect);
    cleanup = undefined;
    const registerCleanup = (fn) => {
      cleanup = fn;
    };
    try {
      effect(registerCleanup);
    } finally {
      popEffect();
    }
  };

  queueJob(wrappedEffect);

  return () => {
    queue.delete(wrappedEffect);
    if (cleanup) cleanup();
    removeEffect(wrappedEffect);
  };
}

// Function to create a computed reference
function computed(getter) {
  let value;
  let dirty = true;

  const computedRef = {
    get value() {
      if (dirty) {
        pushEffect(computedEffect);
        value = getter();
        popEffect();
        dirty = false;
      }
      track(computedRef, 'value');
      return value;
    },
  };

  const computedEffect = () => {
    dirty = true;
    trigger(computedRef, 'value');
  };

  return computedRef;
}

// Demo
// Create a reactive object
const original = reactive({
  nested: { count: 0 },
  array: [{ number: 0 }],
});

// Create a readonly version of the original object
const readonlyObj = readonly(original);

// Create a shallow reactive reference
const shallowRefObj = shallowRef({
  nested: { count: 0 },
  array: [{ number: 0 }],
});

// Use watchEffect to display changes in the DOM
watchEffect(() => {
  document.getElementById(
    'originalOutput'
  ).textContent = `Original: ${JSON.stringify(
    original,
    null,
    2
  )}`;
});

watchEffect(() => {
  document.getElementById(
    'readonlyOutput'
  ).textContent = `Readonly: ${JSON.stringify(
    readonlyObj,
    null,
    2
  )}`;
});

watchEffect(() => {
  document.getElementById(
    'shallowRefOutput'
  ).textContent = `ShallowRef: ${JSON.stringify(
    shallowRefObj.value,
    null,
    2
  )}`;
});

// Add event listeners for UI interactions
document
  .getElementById('modifyOriginal')
  .addEventListener('click', () => {
    original.nested.count++;
    original.array[0].number++;
  });

document
  .getElementById('modifyReadonly')
  .addEventListener('click', () => {
    readonlyObj.nested.count++;
    readonlyObj.array[0].number++;
  });

document
  .getElementById('modifyShallowRef')
  .addEventListener('click', () => {
    shallowRefObj.value.nested.count++;
    shallowRefObj.value.array[0].number++;
  });

document
  .getElementById('incrementShallowRef')
  .addEventListener('click', () => {
    shallowRefObj.value = {
      ...shallowRefObj.value,
      nested: {
        count: shallowRefObj.value.nested.count + 10,
      },
      array: [
        {
          number: shallowRefObj.value.array[0].number + 10,
        },
      ],
    };
  });
