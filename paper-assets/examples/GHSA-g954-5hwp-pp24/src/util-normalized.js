'use strict';
const v1 = require('./util/minimal');
module.exports = v1;
var util = module.exports;
var roots = require('./roots');
var Type;
var Enum;
const v2 = require('@protobufjs/codegen');
util.codegen = v2;
const v3 = require('@protobufjs/fetch');
util.fetch = v3;
const v4 = require('@protobufjs/path');
util.path = v4;
const v5 = util.inquire('fs');
util.fs = v5;
const toArray = function (object) {
    if (object) {
        var keys = Object.keys(object);
        const v6 = keys.length;
        var array = new Array(v6);
        var index = 0;
        const v7 = keys.length;
        let v8 = index < v7;
        while (v8) {
            const v9 = index++;
            const v10 = keys[v9];
            const v11 = object[v10];
            array[index] = v11;
            v8 = index < v7;
        }
        return array;
    }
    const v12 = [];
    return v12;
};
util.toArray = toArray;
const toObject = function (array) {
    var object = {};
    var index = 0;
    const v13 = array.length;
    let v14 = index < v13;
    while (v14) {
        const v15 = index++;
        var key = array[v15];
        const v16 = index++;
        var val = array[v16];
        const v17 = val !== undefined;
        if (v17) {
            object[key] = val;
        }
        v14 = index < v13;
    }
    return object;
};
util.toObject = toObject;
var safePropBackslashRe = /\\/g;
var safePropQuoteRe = /"/g;
const isReserved = function (name) {
    const v18 = /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/.test(name);
    return v18;
};
util.isReserved = isReserved;
const safeProp = function (prop) {
    const v19 = /^[$\w_]+$/.test(prop);
    const v20 = !v19;
    const v21 = util.isReserved(prop);
    const v22 = v20 || v21;
    if (v22) {
        const v23 = prop.replace(safePropBackslashRe, '\\\\');
        const v24 = v23.replace(safePropQuoteRe, '\\"');
        const v25 = '["' + v24;
        const v26 = v25 + '"]';
        return v26;
    }
    const v27 = '.' + prop;
    return v27;
};
util.safeProp = safeProp;
const ucFirst = function (str) {
    const v28 = str.charAt(0);
    const v29 = v28.toUpperCase();
    const v30 = str.substring(1);
    const v31 = v29 + v30;
    return v31;
};
util.ucFirst = ucFirst;
var camelCaseRe = /_([a-z])/g;
const camelCase = function (str) {
    const v32 = str.substring(0, 1);
    const v33 = str.substring(1);
    const v35 = function ($0, $1) {
        const v34 = $1.toUpperCase();
        return v34;
    };
    const v36 = v33.replace(camelCaseRe, v35);
    const v37 = v32 + v36;
    return v37;
};
util.camelCase = camelCase;
const compareFieldsById = function (a, b) {
    const v38 = a.id;
    const v39 = b.id;
    const v40 = v38 - v39;
    return v40;
};
util.compareFieldsById = compareFieldsById;
const decorateType = function (ctor, typeName) {
    const v41 = ctor.$type;
    if (v41) {
        const v42 = ctor.$type;
        const v43 = v42.name;
        const v44 = v43 !== typeName;
        const v45 = typeName && v44;
        if (v45) {
            const v46 = util.decorateRoot;
            const v47 = ctor.$type;
            const v48 = v46.remove(v47);
            v48;
            const v49 = ctor.$type;
            v49.name = typeName;
            const v50 = util.decorateRoot;
            const v51 = ctor.$type;
            const v52 = v50.add(v51);
            v52;
        }
        const v53 = ctor.$type;
        return v53;
    }
    const v54 = !Type;
    if (v54) {
        Type = require('./type');
    }
    const v55 = ctor.name;
    const v56 = typeName || v55;
    var type = new Type(v56);
    const v57 = util.decorateRoot;
    const v58 = v57.add(type);
    v58;
    type.ctor = ctor;
    const v59 = {
        value: type,
        enumerable: false
    };
    const v60 = Object.defineProperty(ctor, '$type', v59);
    v60;
    const v61 = ctor.prototype;
    const v62 = {
        value: type,
        enumerable: false
    };
    const v63 = Object.defineProperty(v61, '$type', v62);
    v63;
    return type;
};
util.decorateType = decorateType;
var decorateEnumIndex = 0;
const decorateEnum = function (object) {
    const v64 = object.$type;
    if (v64) {
        const v65 = object.$type;
        return v65;
    }
    const v66 = !Enum;
    if (v66) {
        Enum = require('./enum');
    }
    const v67 = decorateEnumIndex++;
    const v68 = 'Enum' + v67;
    var enm = new Enum(v68, object);
    const v69 = util.decorateRoot;
    const v70 = v69.add(enm);
    v70;
    const v71 = {
        value: enm,
        enumerable: false
    };
    const v72 = Object.defineProperty(object, '$type', v71);
    v72;
    return enm;
};
util.decorateEnum = decorateEnum;
const setProperty = function (dst, path, value) {
    const setProp = function (dst, path, value) {
        var part = path.shift();
        const v73 = path.length;
        const v74 = v73 > 0;
        if (v74) {
            const v75 = dst[part];
            const v76 = {};
            const v77 = v75 || v76;
            const v78 = setProp(v77, path, value);
            dst[part] = v78;
        } else {
            var prevValue = dst[part];
            if (prevValue) {
                const v79 = [];
                const v80 = v79.concat(prevValue);
                value = v80.concat(value);
            }
            dst[part] = value;
        }
        return dst;
    };
    const v81 = typeof dst;
    const v82 = v81 !== 'object';
    if (v82) {
        const v83 = TypeError('dst must be an object');
        throw v83;
    }
    const v84 = !path;
    if (v84) {
        const v85 = TypeError('path must be specified');
        throw v85;
    }
    path = path.split('.');
    const v86 = setProp(dst, path, value);
    return v86;
};
util.setProperty = setProperty;
const v90 = function () {
    const v87 = roots['decorated'];
    const v88 = require('./root');
    const v89 = v87 || (roots['decorated'] = new v88());
    return v89;
};
const v91 = { get: v90 };
const v92 = Object.defineProperty(util, 'decorateRoot', v91);
v92;