// checks if prototype pollution is detected when attacker only controls a single lookup (avoid false positive)
// No vulnerability should be reported

function f(o, x, y) {
    o[x] = y;
}
