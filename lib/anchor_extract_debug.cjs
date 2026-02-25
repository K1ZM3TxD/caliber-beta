const { extractAnchors } = require('./anchors.ts');

const input = {
  resumeText: 'plan',
  promptAnswers: ['plan'],
};

console.log(JSON.stringify(extractAnchors(input), null, 2));
