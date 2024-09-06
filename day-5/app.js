// Global variables for reactivity system
let activeEffect;
const targetMap = new Map();
const queue = new Set();
let isFlushPending = false;

// Track nested effects
const effectStack = [];

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

// Create a reactive proxy for an object
function reactive(target) {
  const handler = {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);
      return result && typeof result === 'object'
        ? reactive(result)
        : result;
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
      // Unwrap refs when setting
      value =
        value && value.__v_isRef ? value.value : value;
      const result = Reflect.set(
        target,
        key,
        value,
        receiver
      );
      if (oldValue !== value) {
        trigger(target, key);
      }
      return result;
    },
  };

  return new Proxy(target, handler);
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

// Create a reactive reference
function ref(initialValue) {
  const r = {
    __v_isRef: true,
    _value: initialValue,
    get value() {
      track(r, 'value');
      return this._value;
    },
    set value(newValue) {
      this._value = newValue;
      trigger(r, 'value');
    },
  };
  return r;
}

// Check if a value is a ref
function isRef(r) {
  return !!(r && r.__v_isRef === true);
}

// Unwrap a ref if it's a ref, otherwise return the value
function unref(r) {
  return isRef(r) ? r.value : r;
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

// Demo
// Create a reactive person object
const person = reactive({
  firstName: 'John',
  lastName: 'Doe',
  age: 18,
});

// Convert person properties to refs
const { firstName, lastName, age } = toRefs(person);

// Create computed refs
const fullName = computed(
  () => `${unref(firstName)} ${unref(lastName)}`
);
const ageDescription = computed(() => {
  const currentAge = unref(age);
  if (currentAge < 18) return 'Minor';
  if (currentAge >= 18 && currentAge < 65) return 'Adult';
  return 'Senior';
});

// Watch for changes and update the DOM
watchEffect(() => {
  document.getElementById('full-name').textContent =
    fullName.value;
  document.getElementById('age').textContent = unref(age);
  document.getElementById('age-description').textContent =
    ageDescription.value;

  // isRef and unref demo
  document.getElementById('is-age-ref').textContent =
    isRef(age);
  document.getElementById('unref-age').textContent =
    unref(age);
  document.getElementById('is-fullname-ref').textContent =
    isRef(fullName);
  document.getElementById('unref-fullname').textContent =
    unref(JSON.stringify(fullName, null, 2));
});

// Add event listeners for UI interactions
document
  .getElementById('change-first-name')
  .addEventListener('click', () => {
    firstName.value =
      firstName.value === 'John' ? 'Jane' : 'John';
  });

document
  .getElementById('change-last-name')
  .addEventListener('click', () => {
    lastName.value =
      lastName.value === 'Doe' ? 'Smith' : 'Doe';
  });

document
  .getElementById('increment-age')
  .addEventListener('click', () => {
    age.value++;
  });

document
  .getElementById('decrement-age')
  .addEventListener('click', () => {
    age.value--;
  });

// Demo for isRef and unref
const normalValue = 42;
const refValue = ref(42);

console.log('Is normalValue a ref?', isRef(normalValue)); // false
console.log('Is refValue a ref?', isRef(refValue)); // true

console.log('Unref normalValue:', unref(normalValue)); // 42
console.log('Unref refValue:', unref(refValue)); // 42
