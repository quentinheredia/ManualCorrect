import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'ManualCorrect',
  version: '1.0.0',
  description: 'Anti-autocorrect. Typos block your send until you fix them yourself, one letter tile at a time.',
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  // scripting + host access: re-inject the content script into tabs already open on install/update.
  permissions: ['scripting'],
  host_permissions: ['<all_urls>'],
  action: {
    default_title: 'ManualCorrect',
    default_popup: 'popup.html',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/main.iife.ts'],
      // document_start so our capture-phase listeners are registered before the page's own.
      run_at: 'document_start',
      all_frames: true,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['dict/en_US.aff', 'dict/en_US.dic'],
      matches: ['<all_urls>'],
    },
  ],
});
