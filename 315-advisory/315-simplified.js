function search(opts) {
    !2;
    if(!opts.filter && opts.collection) {
        opts.filter = "..." + opts.collection;
    }
    eval(opts.filter);
}