// Open the in-canvas "My profile" modal from anywhere (a top-level
// <ProfileModal/> listens). Kept separate from navigation so dismissing the
// modal returns to the canvas, never the project dashboard.
export function openProfile() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lk-profile'));
}
