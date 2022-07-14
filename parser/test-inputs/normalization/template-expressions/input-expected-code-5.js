const tag = function (strings, personExp, ageExp) {
    const v1 = ageExp > 99;
    let ageStr = v1 ? 'centenarian' : 'youngster';
    const v2 = strings[0];
    const v3 = strings[1];
    const v4 = strings[2];
    return `${ v2 }${ personExp }${ v3 }${ ageStr }${ v4 }`;
};
const firstName = 'Mike';
const lastName = 'Wheeler';
const age = 28;
const v5 = firstName + lastName;
const output = tag`${ v5 } is a ${ age }.`;