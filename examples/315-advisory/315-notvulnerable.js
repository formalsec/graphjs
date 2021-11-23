function search(opts) {
    if(!opts.filter && opts.collection) {
        opts.filter = "...";
        eval(opts.filter);
    }
}