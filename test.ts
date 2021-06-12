import { create } from 'domain';
import { createStringIterator, createTokenizer } from './parser';
import { jsonExample1 } from './testData';

export default () => {
  const tokenizer = createTokenizer(createStringIterator(jsonExample1));

  const result = tokenizer.tokenize();

  console.log('result', result);
  return result;
};
