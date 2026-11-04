import readline from 'readline';

export function createCliContext() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return {
    rl,
    currentUser: null,
    ask: query => new Promise(resolve => {
      if (rl.closed) return resolve('');
      rl.question(query, answer => resolve(rl.closed ? '' : answer));
    }),
    close: () => rl.close()
  };
}

