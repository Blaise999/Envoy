// src/components/support/chatScope.js
//
// One bubble at a time.
//
// When a shipment is on screen, the tracking-scoped widget takes over and the
// site-wide ChatWidget steps aside — two floating bubbles in one corner is
// clutter, and it makes the customer guess which one reaches the person
// holding their parcel.
//
// A tiny store rather than context, so neither widget needs a provider
// wrapped around it and TrackPage doesn't have to thread props down.

let active = false;
const listeners = new Set();

export function setTrackChatActive(next) {
  if (active === next) return;
  active = next;
  listeners.forEach((fn) => fn(active));
}

export function isTrackChatActive() {
  return active;
}

export function subscribeTrackChat(fn) {
  listeners.add(fn);
  fn(active);
  return () => listeners.delete(fn);
}
