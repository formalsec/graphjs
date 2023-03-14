const tag = function (strings, personExp, ageExp) {
    let ageStr;
    const v1 = ageExp > 99;
    if (v1) {
        ageStr = 'centenarian';
    } else {
        ageStr = 'youngster';
    }
    const v2 = strings[0];
    const v3 = strings[1];
    const v4 = strings[2];
    const v5 = `${ v2 }${ personExp }${ v3 }${ ageStr }${ v4 }`;
    return v5;
};
const firstName = 'Mike';
const lastName = 'Wheeler';
const age = 28;
const v6 = firstName + lastName;
const output = tag`${ v6 } is a ${ age }.`;