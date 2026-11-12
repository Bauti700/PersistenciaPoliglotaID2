import readline from 'readline';

// Función para crear un contexto de CLI que maneja la interacción con el usuario a través de la línea de comandos, incluyendo la lectura de entradas y el cierre del interfaz.
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

