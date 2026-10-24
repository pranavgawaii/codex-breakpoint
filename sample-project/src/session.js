let activeUser = null;

export function authenticate(user) { activeUser = user; }
export function currentUser() { return activeUser; }
export function clearSession() { activeUser = null; }
