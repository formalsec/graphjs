function merge(source) {
    for (key in source) {
        value = source[key];
        eval(value);
    }
}