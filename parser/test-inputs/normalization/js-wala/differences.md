## Test 32
**Input**:
```
i++
```
**js-wala**:
```
var tmp0, tmp1, tmp2, tmp3, tmp4;
tmp4 = "i";
tmp2 = __global[tmp4];
tmp3 = 1;
tmp1 = tmp2 + tmp3;
tmp0 = "i";
__global[tmp0] = tmp1;
```
**js-cpg**:
```
i++;
```
wala removes the UpdateExpression node.
js-cpg: ++i -> const v1 = ++i; v1; Why?


## Test 36/37/38
**Input**:
```
for (var p in src)
    dest[p] = src[p];
```
Missing ForInStatement normalization.

## Test 39/40/41/42/43/44
Missing SwitchStatement normalization.

## Test 45
Missing TryCatchStatements normalization.

## Test 47
**Input**:
```
this.alert("Hi!");
```
**js-wala**:
```
var tmp0, tmp1, tmp2, tmp3;
tmp0 = __global;
tmp1 = "alert";
tmp2 = "Hi!";
tmp3 = tmp0[tmp1](tmp2);
```
**js-cpg**:
```
const v1 = this.alert;
v1('Hi!');
```
Don't see any problem though.

## Test 47
**Input**:
```
getPlatform();
function getPlatform() {
    return exports ? "node" : "browser";
}
```
**js-wala**:
```
var tmp0, tmp1, tmp2, tmp3, tmp4;
tmp4 = function() {
    var tmp5, tmp6, tmp7;
    tmp7 = "exports";
    tmp6 = __global[tmp7];
    if (tmp6) {
        tmp5 = "node";
    } else {
        tmp5 = "browser";
    }
    return tmp5;
};
tmp3 = "getPlatform";
__global[tmp3] = tmp4;
tmp1 = "getPlatform";
tmp0 = __global[tmp1];
tmp2 = tmp0();
```
**js-cpg**:
```
getPlatform();
function getPlatform() {
    return exports ? 'node' : 'browser';
}
```
wala removes ConditionalStatement.


## Test 52
**Input**:
```
(function(j) {
    for (var i = 0; i < j; ++i) {
        if (i % 2)
            break;

    }
})(10);
```
wala forces a `return`. < /br>
Check `const v2 = ++i`. Did I do this when assigning the update condition in the ForStatement?


## Test 53/54
**Input**:
```
(function(i) {
    return i++, 42;
})();
```

**js-wala**:
```
const v4 = function (j) {
    var i = 0;
    let v1 = i < j;
    while (v1) {
        const v3 = i % 2;
        if (v3)
            break;
        const v2 = ++i;
        v1 = i < j;
    }
};
v4(10);
```
**js-cpg**:
```
const v2 = function (i) {
    const v1 = i++;
    return v1, 42;
};
v2();
```
wala only returns the revelant value.


## Test 56
**Input**:
```
(function() {
    var i, j;
    i = j = 42;
})();
```

**js-wala**:
```
 var tmp0, tmp1;
tmp0 = function() {
    var i, j;
    i = 42;
    j = i;
    return;
};
tmp1 = tmp0();
```
**js-cpg**:
```
const v1 = function () {
    var i;
    var j;
    i = j = 42;
};
v1();