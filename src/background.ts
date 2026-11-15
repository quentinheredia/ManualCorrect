/**
 * Chrome does not inject content scripts into tabs that were already open when
 * the extension is installed, updated or reloaded, and the copies already
 * running there are orphaned (they step aside, see interceptor.ts). Without
 * this, an open tab is silently unprotected until it is refreshed, and a typo
 * can be sent while the user believes it was checked.
 */
chrome.runtime.onInstalled.addListener(async () => {
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length) return;
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined
        ? undefined
        : chrome.scripting
            .executeScript({ target: { tabId: tab.id, allFrames: true }, files })
            // Tabs we may not script (Web Store, discarded tabs) are skipped.
            .catch(() => undefined),
    ),
  );
});
