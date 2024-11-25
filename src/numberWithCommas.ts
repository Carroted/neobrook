/** Turns numbers like 1000000 into strings like 1,000,000 */

export default function numberWithCommas(x: number) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}