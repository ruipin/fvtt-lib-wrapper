class A {
  x() {
    return 1;
  }

  y(ret=1) {
    return ret;
  }
}

// Create object
let a = new A();
console.log("Unwrapped: ", a.x());

let xWrapper = new ResilientWrapper(A.prototype, 'x');
xWrapper.push_front(function(original) {
  console.log("Wrapper 1: ", original());
  return 10;
});
console.log("Wrapped with 10: ", a.x());


xWrapper.push_front(function(original) {
  console.log("Wrapper 2: ", original());
  return 20;
});

console.log("Wrapped with 20: ", a.x());


A.prototype.x = function() { return 2; };
console.log("Replaced with 2: ", a.x());


let xWrapper2 = new ResilientWrapper(A.prototype, 'x');
xWrapper2.push_front(function(original) {
  console.log("Wrapper 3: " + original());
  return 30;
});
console.log("Wrapped with 30: ", a.x());


A.prototype.x = function() { return 3; };
console.log("Replaced with 3: ", a.x());


// Test parameters
console.log("Unwrapped: ", a.y(2));

let yWrapper = new ResilientWrapper(A.prototype, 'y', function(original, ret=1) {
  console.log("Original: ", original(ret));
  return 1;
})
console.log("Wrapped 1: ", a.y(2));