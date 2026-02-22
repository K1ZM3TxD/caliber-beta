import { extractLexicalAnchors } from './anchor_extraction';

const anchors = extractLexicalAnchors(resumeText, promptAnswersText);

// LEXICAL ANCHORS (reuse exact terms where relevant; do not invent archetypes):
// Example anchors: ["walk", "run", "jump"]...  

userPrompt = userPrompt.replace(/TASK/, `TASK

LEXICAL ANCHORS: ${anchors.top12Verbs.join(', ')}, ${anchors.top12Nouns.join(', ')}`);

console.log('synthesis_source=llm', 'anchor_count=' + anchors.combined.length);