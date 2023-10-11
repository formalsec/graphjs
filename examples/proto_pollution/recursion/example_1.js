function merge(obj1, obj2) {
    for (var key in obj2) {
        if (typeof object1[key] === 'object' && typeof object2[key] === 'object') {
            obj1[key] = merge(obj1[key], obj2[key]);
        } else {
            obj1[key] = obj2[key];
        }
    }
    return obj1;
};