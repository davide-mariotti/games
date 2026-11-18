// The Destiny Table (Random Number Table): the printed table holds each digit 0-9 ten times,
// so picking from it blindfolded is a uniform draw.
export const getRandomDestinyNumber = () => Math.floor(Math.random() * 10);
