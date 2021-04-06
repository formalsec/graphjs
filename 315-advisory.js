var _ = require('lodash');

module.exports = function (db) {
  return function search (opts) {
    var opts = _.extend({}, {include_docs: true}, opts);

    if (!opts.filter && opts.collection) {
      if (typeof opts.collection === 'string') {
        opts.filter = "function filter (doc) {return doc.type === '" + opts.collection + "'}";
      }
      else {
        opts.filter =  "function filter (doc) {";

        opts.filter += opts.collection.map(function (c) {
          return "if (doc.type === '" + c + "') {return true;}";
        }).join('\n');

        opts.filter += "return false;}";
      }
      eval(opts.filter);
      opts.filter = filter;
    }

    if (opts.index !== undefined) {
      opts.build = opts.index;
      delete opts.index;
    }

    if (opts.includeDocs !== undefined) {
      opts.include_docs = opts.includeDocs;
      delete opts.includeDocs;
    }

    if (opts.build && opts.query) {
      // When build is `true`, the query will not be run.
      // However, since they included a query, they probably want data.
      // Querying will build the index anyways, so we'll just ignore the build option.
      delete opts.build;
    }

    return db.pouch.search(opts)
    .then(function (raw) {
      if (opts.raw) {
        return raw;
      }

      if (opts.include_docs) {
        return raw.rows.map(function (result) {
          result.doc._score = result.score;
          return result.doc;
        });
      }
    });
  }
}