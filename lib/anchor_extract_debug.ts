import { extractAnchors } from './anchors';

const input = {
  resumeText: 'plan',
  promptAnswers: ['plan'],
};

console.log(JSON.stringify(extractAnchors(input), null, 2));
