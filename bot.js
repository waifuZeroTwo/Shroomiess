const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Bot is running! Type something and press Enter (type "exit" to quit).');
rl.prompt();

rl.on('line', (line) => {
  if (line.trim().toLowerCase() === 'exit') {
    console.log('Goodbye!');
    rl.close();
  } else {
    console.log(`You said: ${line}`);
    rl.prompt();
  }
});
