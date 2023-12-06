function tag(strings, personExp, ageExp) {
    let ageStr = ageExp > 99 ? 'centenarian' : 'youngster'; 
    return `${strings[0]}${personExp}${strings[1]}${ageStr}${strings[2]}`;
}

const firstName = 'Mike';
const lastName = 'Wheeler';
const age = 28;
const output = tag`${ firstName + lastName } is a ${ age }.`;
