let v0 = require('lodash');
var _ = v0;
let v1 = module.exports;
let v64 = function (db) {
    let v63 = function search(opts) {
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
        }
        let v30 = opts.index;
        let v31 = v30 !== undefined;
        if (v31) {
            let v32 = opts.build;
            let v33 = opts.index;
            v32 = v33;
            let v34 = opts.index;
            let v35 = delete v34;
            v35;
        }
        let v36 = opts.includeDocs;
        let v37 = v36 !== undefined;
        if (v37) {
            let v38 = opts.include_docs;
            let v39 = opts.includeDocs;
            v38 = v39;
            let v40 = opts.includeDocs;
            let v41 = delete v40;
            v41;
        }
        let v42 = opts.build;
        let v43 = opts.query;
        let v44 = v42 && v43;
        if (v44) {
            let v45 = opts.build;
            let v46 = delete v45;
            v46;
        }
        let v47 = db.pouch;
        let v48 = v47.search;
        let v49 = v48(opts);
        let v50 = v49.then;
        let v61 = function (raw) {
            let v51 = opts.raw;
            if (v51) {
                return raw;
            }
            let v52 = opts.include_docs;
            if (v52) {
                let v53 = raw.rows;
                let v54 = v53.map;
                let v59 = function (result) {
                    let v55 = result.doc;
                    let v56 = v55._score;
                    let v57 = result.score;
                    v56 = v57;
                    let v58 = result.doc;
                    return v58;
                };
                let v60 = v54(v59);
                return v60;
            }
        };
        let v62 = v50(v61);
        return v62;
    };
    return v63;
};
v1 = v64;