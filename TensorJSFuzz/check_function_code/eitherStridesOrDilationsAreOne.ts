export function eitherStridesOrDilationsAreOne(
    strides: number|number[], dilations: number|number[]): boolean {
    return tupleValuesAreOne(strides) || tupleValuesAreOne(dilations);
}