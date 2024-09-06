// Global variable to track the currently active effect
let activeEffect;
// Map to store dependencies for each reactive object and its properties
const targetMap = new Map();
// Set to store queued effects
const queue = new Set();
// Flag to prevent multiple flush cycles
let isFlushPending = false;

// Track nested effects
const effectStack = [];

// Function to queue an effect for execution
function queueJob(job) {
  queue.add(job);
  if (!isFlushPending) {
    isFlushPending = true;
    Promise.resolve().then(flushJobs);
  }
}

// Function to flush all queued effects
function flushJobs() {
  for (const job of queue) {
    job();
  }
  queue.clear();
  isFlushPending = false;
}

// Function to track dependencies
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

// Function to trigger effects when a reactive property changes
function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (dep) {
    dep.forEach((effect) => queueJob(effect));
  }
}

// Function to remove an effect from all dependencies
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

// Function to create a reactive reference
function ref(value) {
  const refObject = {
    get value() {
      track(refObject, 'value');
      return value;
    },
    set value(newValue) {
      value = newValue;
      trigger(refObject, 'value');
    },
  };
  return refObject;
}

// Function to create a deeply reactive object
function reactive(target) {
  if (typeof target !== 'object' || target === null) {
    return target;
  }

  const handler = {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver);
      track(target, key);
      return reactive(result);
    },
    set(target, key, value, receiver) {
      const oldValue = target[key];
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

// Demo
const person = reactive({
  firstName: 'John',
  lastName: 'Doe',
  age: 18,
});

const fullName = computed(() => {
  return `${person.firstName} ${person.lastName}`;
});
const ageDescription = computed(() => {
  if (person.age < 18) return 'Minor';
  if (person.age >= 18 && person.age < 65) return 'Adult';
  return 'Senior';
});

watchEffect(() => {
  document.getElementById('full-name').textContent =
    fullName.value;
  document.getElementById('age').textContent = person.age;
  document.getElementById('age-description').textContent =
    ageDescription.value;
});

document
  .getElementById('change-first-name')
  .addEventListener('click', () => {
    person.firstName =
      person.firstName === 'John' ? 'Jane' : 'John';
  });

document
  .getElementById('change-last-name')
  .addEventListener('click', () => {
    person.lastName =
      person.lastName === 'Doe' ? 'Smith' : 'Doe';
  });

document
  .getElementById('increment-age')
  .addEventListener('click', () => {
    person.age++;
  });

document
  .getElementById('decrement-age')
  .addEventListener('click', () => {
    person.age--;
  });
