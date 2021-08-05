function search(opts) {
    if(!opts.filter && opts.collection) {
        opts.filter = "..." + opts.collection;
    }
    eval(opts.filter);
}