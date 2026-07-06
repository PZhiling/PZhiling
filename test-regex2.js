const text = `
Phase 1: ค้นหา
Some content

**Phase 2:** Topic Selection
Some content 2

Phase 3: Content Creation
Some content 3
`;

const p1 = text.match(/(?:#+\s*|\*\*\s*)Phase 1[\s\S]*?(?=(?:#+\s*|\*\*\s*)Phase 2|$)/i);
const p2 = text.match(/(?:#+\s*|\*\*\s*)Phase 2[\s\S]*?(?=(?:#+\s*|\*\*\s*)Phase 3|$)/i);
const p3 = text.match(/(?:#+\s*|\*\*\s*)Phase 3[\s\S]*$/i);

console.log("Old Regex");
console.log("P1:", !!p1);
console.log("P2:", !!p2);
console.log("P3:", !!p3);

const p1_new = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 1[\s\S]*?(?=(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 2|$)/i);
const p2_new = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 2[\s\S]*?(?=(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 3|$)/i);
const p3_new = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 3[\s\S]*$/i);

console.log("\nNew Regex");
console.log("P1:", !!p1_new);
console.log("P2:", !!p2_new);
console.log("P3:", !!p3_new);
