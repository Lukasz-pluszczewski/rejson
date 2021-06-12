import { createSwich, defaultMatcher } from 'swich';
import { wile } from './utils';

const swich = createSwich({
  matcher: config => (valueToMatch, pattern) =>
    [...(Array.isArray(pattern) ? pattern : [pattern])].some(singlePattern =>
      defaultMatcher(config)(valueToMatch, singlePattern)
    )
});

enum TOKEN_TYPES {
  BEGIN_OBJECT,
  END_OBJECT,
  BEGIN_ARRAY,
  END_ARRAY,
  NULL,
  NUMBER,
  STRING,
  BOOLEAN,
  SEP_COLON,
  SEP_COMMA,
  END_DOCUMENT
}
type Token = {
  tokenType: TOKEN_TYPES,
  value: string,
  position: number,
};

class ParserError extends Error {
  constructor(message: string, { position }: { position?: number } = {}) {
    super(message);
    this.position = position;
  }
  position?: number
};

const getCreateToken = (position: number) => (
  tokenType: TOKEN_TYPES,
  value: string
): Token => ({
  tokenType,
  value,
  position
});

export const createStringIterator = (source: string) => {
  const iteratorInstance = {
    source,
    position: 0,
    increment: (number = 1) => iteratorInstance.position += number,
    getCharacters: (start: number, length = 1) => source.substr(start, length),
    /**
     * Returns next character and increments position
     */
    next: (length = 1): { done?: boolean; value?: string } => {
      if (iteratorInstance.position >= source.length) {
        return {
          done: true
        };
      }
      const characters = iteratorInstance.getCharacters(iteratorInstance.position, length);
      iteratorInstance.increment(length); 
      return {
        done: false,
        value: characters,
      };
    },
    /**
     * Returns next character without incrementing position
     */
    peek: (length = 1): { done?: boolean; value?: string } => {
      if (iteratorInstance.position >= source.length) {
        return {
          done: true
        };
      }
      return {
        done: false,
        value: iteratorInstance.getCharacters(iteratorInstance.position, length)
      };
    }
  };

  return iteratorInstance;
};

export const createTokenizer = (stringIterator: ReturnType<typeof createStringIterator>) => {
  const tokenizerInstance = {
    iterator: stringIterator,
    tokenize: () => wile<{ token: TOKEN_TYPES, tokens: Token[] }>(
      ({ token }) => token?.tokenType !== TOKEN_TYPES.END_DOCUMENT,
      ({ token, tokens }) => {
        const newToken = tokenizerInstance.next();
        return {
          token: newToken || token,
          tokens: newToken ? [...tokens, token] : tokens,
        };
      },
      { token: null, tokens: [] }
    ),
    next: () => {
      const {
        value: character,
        done
      } = tokenizerInstance.stringIterator.next();
      const createToken = getCreateToken(tokenizerInstance.stringIterator.position);
      if (done) {
        return createToken(TOKEN_TYPES.END_DOCUMENT, null);
      }

      return swich([
        ['{', createToken(TOKEN_TYPES.BEGIN_OBJECT, character)],
        ['}', createToken(TOKEN_TYPES.END_OBJECT, character)],
        ['[', createToken(TOKEN_TYPES.BEGIN_ARRAY, character)],
        [']', createToken(TOKEN_TYPES.END_ARRAY, character)],
        [',', createToken(TOKEN_TYPES.SEP_COMMA, character)],
        [':', createToken(TOKEN_TYPES.SEP_COLON, character)],
        [['t', 'f'], () => tokenizerInstance.readBoolean()],
        [['"', '\''], () => tokenizerInstance.readString()],
        [['-', /\d/], () => tokenizerInstance.readNumber()],
        [/\s/, null],
        [() => throw new Error('Illegal character')]
      ])(character);
    },
    readNull: () => {
      const position = tokenizerInstance.stringIterator.position - 1;
      if (tokenizerInstance.stringIterator.peek(3) === 'ull') {
        tokenizerInstance.stringIterator.increment(3);
        return getCreateToken(position)(TOKEN_TYPES.NULL, 'null');
      }
      throw new ParserError('Illegal character', position);
    },
    readBoolean: () => {
      const position = tokenizerInstance.stringIterator.position - 1;

      return swich([
        [tokenizerInstance.stringIterator.getCharacters(position, 4) === 'true', getCreateToken(position)(TOKEN_TYPES.BOOLEAN, 'true')],
        [tokenizerInstance.stringIterator.getCharacters(position, 5) === 'false', getCreateToken(position)(TOKEN_TYPES.BOOLEAN, 'false')],
        [() => throw new ParserError('Illegal character', position)]
      ]);
    },
    readNumber: () => {
      const position = tokenizerInstance.stringIterator.position - 1;
      const numberPattern = /[\d-.e]|0x|0b|0o|Infinity/;

      const { string } = wile(
        ({ character }) => numberPattern.test(character),
        ({ string }) => {
          const character = tokenizerInstance.stringIterator.next();
          return {
            string: string + character,
            character,
          }
        },
        { character: tokenizerInstance.stringIterator.getCharacters(position), string: '' },
      );
      if (isNaN(Number(string))) {
        throw new ParserError('Invalid number', position);
      }

      return getCreateToken(position)(TOKEN_TYPES.NUMBER, string);
    },
    readString: () => {},
  };

  return tokenizerInstance;
};

export default () => {
  const tokenizer = createTokenizer(createStringIterator())
  console.log(createToken(TOKEN_TYPES.BEGIN_ARRAY, '['));
};
