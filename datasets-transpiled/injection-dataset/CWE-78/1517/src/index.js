"use strict";
Object.defineProperty(exports, "__esModule", { value: !0 }), exports.latest = exports.get = void 0;const e = require("tslib"),
      t = require("semver"),
      r = require("child_process");exports.get = s => e.__awaiter(void 0, void 0, void 0, function* () {
  return (e => {
    const r = new Map();return e.split("\n").forEach(e => {
      const t = e.split(/\t/);r.set(t[1].split("/")[2].replace(/\^\{\}$/, ""), t[0]);
    }), new Map([...r.entries()].filter(e => t.valid(e[0])).sort((e, r) => t.compare(e[0], r[0])).reverse());
  })((yield (e => new Promise((t, s) => {
    r.exec("git ls-remote --tags " + e, (e, r, o) => {
      o && s(new Error(o)), t(r.toString().trim());
    });
  }))(s)));
}), exports.latest = t => e.__awaiter(void 0, void 0, void 0, function* () {
  return (yield exports.get(t)).entries().next().value;
}), module.exports = { get: exports.get, latest: exports.latest };
//# sourceMappingURL=index.js.map