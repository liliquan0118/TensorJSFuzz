export function checkPadOnDimRoundingMode(
    opDesc: string, pad: 'valid'|'same'|number|ExplicitPadding,
    dimRoundingMode?: 'floor'|'round'|'ceil') {
    if (dimRoundingMode != null) {
        if (typeof pad === 'string') {
            throw Error(
                `Error in ${opDesc}: pad must be an integer when using ` +
                `dimRoundingMode ${dimRoundingMode} but got pad ${pad}.`);
        } else if (typeof pad === 'number') {
            util.assert(
                util.isInt(pad),
                () => `Error in ${opDesc}: pad must be an integer when using ` +
                    `dimRoundingMode ${dimRoundingMode} but got pad ${pad}.`);
        } else if (typeof pad === 'object') {
            (pad as ExplicitPadding).forEach(p => {
                p.forEach(v => {
                    util.assert(
                        util.isInt(v),
                        () => `Error in ${opDesc}: pad must be an integer when using ` +
                            `dimRoundingMode ${dimRoundingMode} but got pad ${v}.`);
                });
            });
        } else {
            throw Error(`Error in ${opDesc}: Unknown padding parameter: ${pad}`);
        }
    }
}