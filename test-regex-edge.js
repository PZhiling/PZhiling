const text1 = `
## Phase 1: ค้นหา
Some content

## Phase 2: Topic Selection
Some content 2

## Phase 3: Content Creation (ภาษาอังกฤษทั้งหมด)
Some content 3
`;

const text2 = `
Phase 1:
Phase 2:
Phase 3:
`;

const text3 = `
Phase 1:
Phase 2:
`;

function extractPhases(text) {
  const p1 = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 1[\s\S]*?(?=(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 2|$)/i);
  const p2 = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 2[\s\S]*?(?=(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 3|$)/i);
  const p3 = text.match(/(?:^|\n)(?:#+\s*|\*\*\s*)?Phase 3[\s\S]*$/i);

  return {
    phase1: p1 ? p1[0] : null,
    phase2: p2 ? p2[0] : null,
    phase3: p3 ? p3[0] : null,
  };
}

console.log("text1", extractPhases(text1));
console.log("text2", extractPhases(text2));
console.log("text3", extractPhases(text3));
