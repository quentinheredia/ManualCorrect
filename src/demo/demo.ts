import { installInterceptor } from '../core/interceptor';
import { loadSpeller } from '../core/spell';
import { openPuzzle } from '../overlay/mount';

// Content scripts never run on chrome-extension:// pages, so the demo installs the same code directly.
installInterceptor(openPuzzle);
void loadSpeller();

const DEMO_MESSAGE = 'hey can you recieve teh package tomorow? definately need it';

const log = document.getElementById('log') as HTMLOListElement;
const form = document.getElementById('composer') as HTMLFormElement;
const field = document.getElementById('message') as HTMLTextAreaElement;
const loadDemo = document.getElementById('load-demo') as HTMLButtonElement;

function autosize(): void {
  field.style.height = 'auto';
  field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
}

function send(): void {
  const text = field.value.trim();
  if (!text) return;
  const bubble = document.createElement('li');
  bubble.className = 'bubble bubble--me';
  bubble.textContent = text;
  log.append(bubble);
  log.scrollTop = log.scrollHeight;
  field.value = '';
  autosize();
  field.focus();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  send();
});

field.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    send();
  }
});

field.addEventListener('input', autosize);

loadDemo.addEventListener('click', () => {
  field.value = DEMO_MESSAGE;
  autosize();
  field.focus();
});
