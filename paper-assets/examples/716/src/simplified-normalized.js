const f = function (object1, object2) {
    var key;
    for (key in object1) {
        const v1 = object2[key];
        object1[key] = v1;
    }
};
;