export function stridesOrDilationsArePositive(values: number|
    number[]): boolean {
    return parseTupleParam(values).every(value => value > 0);
}