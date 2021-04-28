let v0 = require('lodash');
var _ = v0;
let v1 = module.exports;
let v65 = function (db) {
    let v64 = function search(opts) {
        let v2 = _.extend;
        let v3 = {};
        let v4 = { include_docs: true };
        let v5 = v2(v3, v4, opts);
        var opts = v5;
        let v6 = opts.filter;
        let v7 = !v6;
        let v8 = opts.collection;
        let v9 = v7 && v8;
        if (v9) {
            let v10 = opts.collection;
            let v11 = typeof v10;
            let v12 = v11 === 'string';
            if (v12) {
                let v13 = opts.filter;
                let v14 = opts.collection;
                let v15 = 'function filter (doc) {return doc.type === \'' + v14;
                let v16 = v15 + '\'}';
                v13 = v16;
            } else {
                let v17 = opts.filter;
                v17 = 'function filter (doc) {';
                let v18 = opts.filter;
                let v19 = opts.collection;
                let v20 = v19.map;
                let v23 = function (c) {
                    let v21 = 'if (doc.type === \'' + c;
                    let v22 = v21 + '\') {return true;}';
                    return v22;
                };
                let v24 = v20(v23);
                let v25 = v24.join;
                let v26 = v25('\n');
                v18 += v26;
                let v27 = opts.filter;
                v27 += 'return false;}';
            }
            let v28 = opts.filter;
            let v29 = eval(v28);
            v29;
            let v30 = opts.filter;
            v30 = filter;
        }
        let v31 = opts.index;
        let v32 = v31 !== undefined;
        if (v32) {
            let v33 = opts.build;
            let v34 = opts.index;
            v33 = v34;
            let v35 = opts.index;
            let v36 = delete v35;
            v36;
        }
        let v37 = opts.includeDocs;
        let v38 = v37 !== undefined;
        if (v38) {
            let v39 = opts.include_docs;
            let v40 = opts.includeDocs;
            v39 = v40;
            let v41 = opts.includeDocs;
            let v42 = delete v41;
            v42;
        }
        let v43 = opts.build;
        let v44 = opts.query;
        let v45 = v43 && v44;
        if (v45) {
            let v46 = opts.build;
            let v47 = delete v46;
            v47;
        }
        let v48 = db.pouch;
        let v49 = v48.search;
        let v50 = v49(opts);
        let v51 = v50.then;
        let v62 = function (raw) {
            let v52 = opts.raw;
            if (v52) {
                return raw;
            }
            let v53 = opts.include_docs;
            if (v53) {
                let v54 = raw.rows;
                let v55 = v54.map;
                let v60 = function (result) {
                    let v56 = result.doc;
                    let v57 = v56._score;
                    let v58 = result.score;
                    v57 = v58;
                    let v59 = result.doc;
                    return v59;
                };
                let v61 = v55(v60);
                return v61;
            }
        };
        let v63 = v51(v62);
        return v63;
    };
    return v64;
};
v1 = v65;