// Background service worker for LinkChat
// Keeps track of auth state and handles extension lifecycle

chrome.runtime.onInstalled.addListener(() => {
  console.log("LinkChat extension installed");
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_AUTH") {
    chrome.storage.local.get(["lc_token", "lc_user"], (data) => {
      sendResponse({ token: data.lc_token, user: data.lc_user });
    });
    return true; // async
  }

  if (request.type === "SET_AUTH") {
    chrome.storage.local.set(
      { lc_token: request.token, lc_user: request.user },
      () => sendResponse({ ok: true })
    );
    return true;
  }

  if (request.type === "CLEAR_AUTH") {
    chrome.storage.local.remove(["lc_token", "lc_user"], () =>
      sendResponse({ ok: true })
    );
    return true;
  }
});