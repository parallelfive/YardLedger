const DIRECTIVE =
  /^\s*(eslint-|@ts-|prettier-|stylelint-|v8 ignore|c8 ignore|istanbul |biome-|oxlint-)/;
// Guardrail against paragraph-in-a-comment; a single mega-line slips past the line-count check (CLAUDE.md: keep comments terse).
const MAX_COMMENT_CHARS = 200;

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Comments must fit on a single line (CLAUDE.md Code Comments rule)',
    },
    schema: [],
    messages: {
      block:
        'Comment spans {{lines}} lines (max 1). Collapse to one line or delete.',
      run: 'Run of {{count}} consecutive // comments (max 1). Collapse to one line or delete.',
      tooLong:
        'Comment is {{chars}} chars (max {{max}}). Shorten it or delete (CLAUDE.md: keep comments terse).',
    },
  },
  create(context) {
    const sc = context.sourceCode;
    const isDirective = (c) => DIRECTIVE.test(c.value);
    return {
      'Program:exit'() {
        const comments = sc.getAllComments();

        for (const c of comments) {
          if (isDirective(c)) continue;
          const chars = c.value.trim().length;
          if (chars > MAX_COMMENT_CHARS) {
            context.report({
              loc: c.loc,
              messageId: 'tooLong',
              data: { chars, max: MAX_COMMENT_CHARS },
            });
          }
        }

        for (const c of comments) {
          if (c.type !== 'Block' || isDirective(c)) continue;
          const lines = c.loc.end.line - c.loc.start.line + 1;
          if (lines >= 2) {
            context.report({ loc: c.loc, messageId: 'block', data: { lines } });
          }
        }

        const lineComments = comments
          .filter((c) => c.type === 'Line' && !isDirective(c))
          .filter((c) =>
            (sc.lines[c.loc.start.line - 1] ?? '').trimStart().startsWith('//')
          );

        let run = [];
        const flush = () => {
          if (run.length >= 2) {
            context.report({
              loc: {
                start: run[0].loc.start,
                end: run[run.length - 1].loc.end,
              },
              messageId: 'run',
              data: { count: run.length },
            });
          }
          run = [];
        };
        for (const c of lineComments) {
          if (run.length === 0) {
            run = [c];
            continue;
          }
          const prev = run[run.length - 1];
          if (c.loc.start.line === prev.loc.end.line + 1) run.push(c);
          else {
            flush();
            run = [c];
          }
        }
        flush();
      },
    };
  },
};

export default { rules: { 'single-line-comments': rule } };
